"""Phase E (admin msg 4847, Q8 = A): two weekly events, scheduled by the server from the player's LOCAL weekday.

- Boss Rush, Saturday + Sunday: every won boss stage (a first clear or a replay of a boss already beaten) pays
  BOSS_RUSH_GEMS gems, +BOSS_RUSH_PERFECT_GEMS for 3 stars. At most BOSS_RUSH_DAILY_MAX rewarded wins per local day,
  so the weekend cannot be farmed. Lost bosses pay nothing (and still cost a heart as usual).
- Double XP, Wednesday: every finished stage gives 2x player XP and 2x Season Pass XP. The Season Pass daily cap stays,
  league points never change (they never see XP boosts), and it does not stack with the bought 15-minute Double XP
  boost (2x is the most).

The schedule lives only here; the app shows what GET /v1/events returns (active or next, with exact UTC bounds for the
countdown). Every reward is computed in play.complete on the server; the client never says which event is on.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, WalletTx
from ..timeutil import local_day, local_midnight_utc, ms, utcnow

BOSS_RUSH_GEMS = 5
BOSS_RUSH_PERFECT_GEMS = 3
BOSS_RUSH_DAILY_MAX = 2
DOUBLE_XP_MULT = 2

# weekday numbers: Monday = 0 ... Sunday = 6 (date.weekday())
EVENTS = [
    dict(id="boss_rush", title="Boss Rush", days=(5, 6), icon="boss",
         blurb=f"Beat any boss again for {BOSS_RUSH_GEMS} gems (+{BOSS_RUSH_PERFECT_GEMS} for 3 stars), "
               f"{BOSS_RUSH_DAILY_MAX} times a day.",
         short=f"Bosses pay {BOSS_RUSH_GEMS}+ gems"),
    dict(id="double_xp", title="Double XP", days=(2,), icon="xp",
         blurb="Every stage gives double XP and double Season Pass XP.",
         short="2x XP on every stage"),
]
BY_ID = {e["id"]: e for e in EVENTS}
# tests pin the active events (None = the real weekday schedule)
FORCE: set[str] | None = None


def _run(ev: dict, day: date) -> tuple[date, date] | None:
    """the event run (first day, last day) that contains `day`, or None"""
    if day.weekday() not in ev["days"]:
        return None
    a = day
    while (a - timedelta(days=1)).weekday() in ev["days"] and a - timedelta(days=1) >= day - timedelta(days=6):
        a -= timedelta(days=1)
    b = day
    while (b + timedelta(days=1)).weekday() in ev["days"] and b + timedelta(days=1) <= day + timedelta(days=6):
        b += timedelta(days=1)
    return a, b


def _next_run(ev: dict, day: date) -> tuple[date, date]:
    for k in range(1, 8):
        d = day + timedelta(days=k)
        if d.weekday() in ev["days"] and (d - timedelta(days=1)).weekday() not in ev["days"]:
            return _run(ev, d)
    raise ValueError("event without days")   # pragma: no cover


def active_ids(user: User, now: datetime | None = None) -> set[str]:
    if FORCE is not None:
        return set(FORCE)
    wd = local_day(user.timezone, now).weekday()
    return {e["id"] for e in EVENTS if wd in e["days"]}


def view(user: User, now: datetime | None = None) -> dict:
    now = now or utcnow()
    today = local_day(user.timezone, now)
    out = []
    for e in EVENTS:
        run = _run(e, today)
        on = run is not None
        a, b = run if on else _next_run(e, today)
        out.append({"id": e["id"], "title": e["title"], "icon": e["icon"], "blurb": e["blurb"], "short": e["short"],
                    "active": on, "starts_at": ms(local_midnight_utc(user.timezone, a)),
                    "ends_at": ms(local_midnight_utc(user.timezone, b + timedelta(days=1))),
                    "days": list(e["days"])})
    # active first, then the one that starts soonest
    out.sort(key=lambda x: (not x["active"], x["starts_at"]))
    return {"now": ms(now), "events": out,
            "rules": {"boss_rush": {"gems": BOSS_RUSH_GEMS, "perfect_bonus": BOSS_RUSH_PERFECT_GEMS,
                                    "daily_max": BOSS_RUSH_DAILY_MAX},
                      "double_xp": {"mult": DOUBLE_XP_MULT}}}


async def boss_rush_used(db: AsyncSession, user: User, day: date) -> int:
    """rewarded Boss Rush wins on this local day (wallet rows reason 'boss_rush', ref '<day>:<stage>:<session>')"""
    return (await db.execute(select(func.count()).select_from(WalletTx).where(
        WalletTx.user_id == user.id, WalletTx.reason == "boss_rush",
        WalletTx.ref.like(f"{day.isoformat()}:%")))).scalar_one()


def boss_rush_gems(stars: int) -> int:
    return 0 if stars <= 0 else BOSS_RUSH_GEMS + (BOSS_RUSH_PERFECT_GEMS if stars >= 3 else 0)
