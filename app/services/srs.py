"""Spaced review (the Overnight Cauldron): Leitner boxes 0..5, intervals 1/3/7/16/35 days."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import SrsItem

LADDER = [1, 3, 7, 16, 35]


def schedule(it: SrsItem, correct: bool, now: datetime):
    if correct:
        it.box = min((it.box or 0) + 1, 5)
        it.interval_days = LADDER[it.box - 1]
    else:
        it.box = 0
        it.interval_days = 1
        it.lapses = (it.lapses or 0) + 1
    it.due_at = now + timedelta(days=it.interval_days)
    it.reps = (it.reps or 0) + 1
    it.last_result = correct
    it.last_seen_at = now


async def record(db: AsyncSession, user_id, results: list[tuple[str, bool, str | None]], now: datetime,
                 only_existing: bool = False) -> list[SrsItem]:
    """results = [(question_id, correct, topic_id)]"""
    if not results:
        return []
    qids = [r[0] for r in results]
    rows = {r.question_id: r for r in (await db.execute(
        select(SrsItem).where(SrsItem.user_id == user_id, SrsItem.question_id.in_(qids)))).scalars()}
    out = []
    for qid, correct, topic_id in results:
        it = rows.get(qid)
        if it is None:
            if only_existing:
                continue
            it = SrsItem(user_id=user_id, question_id=qid, topic_id=topic_id, box=0, interval_days=1, reps=0,
                         lapses=0, due_at=now)
            db.add(it)
            rows[qid] = it
        elif topic_id and not it.topic_id:
            it.topic_id = topic_id
        schedule(it, correct, now)
        out.append(it)
    return out
