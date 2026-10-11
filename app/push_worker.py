"""English Spell daily reminder worker (Phase D). Run by host cron every 15 minutes:

    docker exec runecast-api python -m app.push_worker

At most one reminder per player per local day, near the usual play hour, only when the Hearthfire is at risk.
Dead endpoints (404/410) are deleted; others are dropped after MAX_FAILS failures in a row. Prints counts only
(never keys or endpoints)."""
import asyncio
from collections import Counter

from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from .db import SessionLocal, engine
from .models import PushSubscription, User
from .services import push as P
from .timeutil import local_day, utcnow


async def run(dry: bool = False) -> Counter:
    c: Counter = Counter()
    if not P.configured():
        c["not_configured"] += 1
        return c
    now = utcnow()
    async with SessionLocal() as db:
        uids = (await db.execute(select(PushSubscription.user_id).distinct())).scalars().all()
        for uid in uids:
            user = await db.get(User, uid)
            if user is None:
                continue
            ok, why, n = await P.due(db, user, now)
            c[why] += 1
            if not ok or dry:
                continue
            subs = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == uid))).scalars().all()
            payload = P.message(user, n)
            sent = False
            for s in subs:
                code = await run_in_threadpool(P.send_one, {"endpoint": s.endpoint, "p256dh": s.p256dh, "auth": s.auth},
                                               payload)
                if 200 <= code < 300:
                    s.fails, s.last_ok_at, sent = 0, now, True
                    c["sent"] += 1
                elif code in (404, 410):
                    await db.delete(s)
                    c["gone"] += 1
                else:
                    s.fails = (s.fails or 0) + 1
                    c[f"fail_{code}"] += 1
                    if s.fails >= P.MAX_FAILS:
                        await db.delete(s)
                        c["dropped"] += 1
            if sent or subs:
                user.last_reminder_day = local_day(user.timezone, now)
            await db.commit()
    return c


async def main():
    c = await run()
    await engine.dispose()
    print(utcnow().strftime("%Y-%m-%dT%H:%MZ"), dict(c))


if __name__ == "__main__":
    asyncio.run(main())
