"""Phase D (admin msg 4839, decision 7 A): English Spell's OWN Web Push daily reminder (VAPID).

🔴 Independent of Bingual: own VAPID keys, own subscriptions table, own service worker on /runecast/.

- The app asks for permission at a good moment (after a won stage, never on load) and posts the browser subscription.
- The worker (app/push_worker.py, cron every 15 min) sends at most ONE reminder a local day, near the player's usual
  play hour, and only when the player has not played today AND has a Hearthfire (streak) that would go out.
- Settings can turn it off: the app unsubscribes the browser and deletes the server row.
"""
import json
import random
import re
import statistics
from datetime import datetime, timedelta
from urllib.parse import urlparse

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..errors import ApiError
from ..models import UNNAMED, PushSubscription, StageSession, Streak, User
from ..timeutil import local_day, tz_of, utcnow
from . import engage

# push services browsers really use; anything else is refused (the server must never POST to arbitrary URLs)
PUSH_HOSTS = re.compile(r"(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|"
                        r"push\.apple\.com|notify\.windows\.com)$")
DEFAULT_HOUR = 18
EARLIEST, LATEST = 9, 21          # never remind before 09:00 or after 21:59 local time
MAX_FAILS = 5

MESSAGES = [
    ("Your Hearthfire is flickering", "{n}-day streak! One quick spell keeps it burning today."),
    ("The Spellbook misses you, {name}", "A two-minute stage keeps your {n}-day Hearthfire alight."),
    ("Embers need tending", "Cast one spell today and your {n}-day streak lives on."),
    ("A wizard's work is never done", "Your {n}-day Hearthfire needs one stage before midnight."),
]


def configured() -> bool:
    s = get_settings()
    return bool(s.vapid_public_key and s.vapid_private_key)


def valid_endpoint(url: str) -> bool:
    try:
        u = urlparse(url)
    except ValueError:
        return False
    return u.scheme == "https" and bool(u.hostname) and bool(PUSH_HOSTS.search(u.hostname)) and len(url) < 1024


async def subscribe(db: AsyncSession, user: User, endpoint: str, p256dh: str, auth: str, ua: str = "") -> dict:
    if not valid_endpoint(endpoint):
        raise ApiError(422, "bad_endpoint", "not a browser push endpoint")
    if not (20 <= len(p256dh) <= 200 and 8 <= len(auth) <= 64):
        raise ApiError(422, "bad_keys", "bad subscription keys")
    row = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint == endpoint))).scalar_one_or_none()
    if row is None:
        row = PushSubscription(user_id=user.id, endpoint=endpoint, p256dh=p256dh, auth=auth, user_agent=ua[:300])
        db.add(row)
    else:   # the same browser, maybe a new account on it: the newest owner wins
        row.user_id, row.p256dh, row.auth, row.fails = user.id, p256dh, auth, 0
    await db.flush()
    return await status(db, user)


async def unsubscribe(db: AsyncSession, user: User, endpoint: str | None) -> dict:
    q = delete(PushSubscription).where(PushSubscription.user_id == user.id)
    if endpoint:
        q = q.where(PushSubscription.endpoint == endpoint)
    await db.execute(q)
    await db.flush()
    return await status(db, user)


async def usual_hour(db: AsyncSession, user: User, now: datetime | None = None) -> int:
    """the median local hour the player started stages in the last 3 weeks (default 18:00), kept in 09..21"""
    now = now or utcnow()
    rows = (await db.execute(select(StageSession.started_at).where(
        StageSession.user_id == user.id, StageSession.started_at > now - timedelta(days=21))
        .order_by(StageSession.started_at.desc()).limit(60))).scalars().all()
    tz = tz_of(user.timezone)
    hours = [r.astimezone(tz).hour for r in rows]
    h = int(statistics.median(hours)) if hours else DEFAULT_HOUR
    return max(EARLIEST, min(LATEST, h))


async def status(db: AsyncSession, user: User) -> dict:
    n = len((await db.execute(select(PushSubscription.id).where(PushSubscription.user_id == user.id))).all())
    return {"enabled": configured(), "subscribed": n > 0, "devices": n,
            "public_key": get_settings().vapid_public_key or None, "reminder_hour": await usual_hour(db, user)}


def message(user: User, streak: int) -> dict:
    title, body = random.choice(MESSAGES)
    name = user.display_name if user.display_name and user.display_name not in UNNAMED else "friend"
    return {"title": title.format(n=streak, name=name), "body": body.format(n=streak, name=name),
            "url": get_settings().app_url, "tag": "es-daily"}


def send_one(sub: dict, payload: dict, ttl: int = 6 * 3600) -> int:
    """POST one encrypted push; returns the push service HTTP status (201 = accepted). Blocking (requests)."""
    from pywebpush import WebPushException, webpush
    s = get_settings()
    try:
        r = webpush(subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                    data=json.dumps(payload), vapid_private_key=s.vapid_private_key,
                    vapid_claims={"sub": s.vapid_subject}, ttl=ttl, timeout=15)
        return getattr(r, "status_code", 201)
    except WebPushException as e:
        return e.response.status_code if e.response is not None else 0
    except Exception:
        return 0


async def due(db: AsyncSession, user: User, now: datetime | None = None) -> tuple[bool, str, int]:
    """(send?, why, streak). Rules: local hour == usual hour, not reminded today, not played today, streak at risk"""
    now = now or utcnow()
    today = local_day(user.timezone, now)
    if user.last_reminder_day == today:
        return False, "already_today", 0
    hour = now.astimezone(tz_of(user.timezone)).hour
    if hour != await usual_hour(db, user, now):
        return False, "not_the_hour", 0
    st = await db.get(Streak, user.id)
    if st is None or st.last_active_day == today:
        return False, "played_today" if st else "no_streak", 0
    n = engage.live_streak(st, today)
    if n <= 0:
        return False, "no_streak", 0
    return True, "at_risk", n
