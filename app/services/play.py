"""Stage start / complete and the review queue. All rewards are computed here, on the server."""
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..curriculum import LEVEL_ORD, NEXT_LEVEL, TREASURE_GEMS
from ..errors import ApiError
from ..models import (Item, Question, SrsItem, Stage, StageSession, User, UserItem, UserProgress, World)
from ..timeutil import end_of_local_day, local_day, utcnow
from . import engage, srs
from . import wallet as W
from .content import is_stage_open, stage_out
from .grading import grade
from .selection import pick_for_stage


def question_out(q: Question, source: str | None = None, topic_id: str | None = None) -> dict:
    d = {"qid": q.id, "game": q.game, "level": q.level, "difficulty": q.difficulty, "grammar": q.grammar_codes,
         "skills": q.skills, "topic": q.topic, "payload": q.payload}
    if source is not None:
        d["source"] = source
        d["topic_id"] = topic_id
    return d


def me_out(u: User, streak: int | None = None) -> dict:
    return {"id": str(u.id), "display_name": u.display_name, "kind": u.kind, "level": u.level,
            "timezone": u.timezone, "player_level": u.player_level, "xp": u.xp, "xp_to_next": u.xp_to_next,
            "xp_total": u.xp_total, "streak": streak if streak is not None else 0,
            "xp_boost_until": int(u.xp_boost_until.timestamp() * 1000) if u.xp_boost_until else 0,
            "league_opt_in": u.league_opt_in, "created_at": u.created_at.isoformat() if u.created_at else None}


async def start_stage(db: AsyncSession, user: User, stage_id: str) -> dict:
    stage = await db.get(Stage, stage_id)
    if stage is None:
        raise ApiError(404, "not_found", "unknown stage")
    if not await is_stage_open(db, user, stage):
        raise ApiError(403, "stage_locked", "finish the previous stage first")
    w = await W.get_wallet(db, user.id)
    if stage.hearts_apply and w.hearts <= 0:
        raise ApiError(409, "no_hearts", "no hearts left: review in the Cauldron, wait, or use an elixir")
    picked = await pick_for_stage(db, user, stage)
    if not picked:
        raise ApiError(409, "no_questions", "the question bank has nothing for this stage yet")
    now = utcnow()
    sess = StageSession(user_id=user.id, stage_id=stage.id, question_ids=[q.id for q, _, _ in picked],
                        sources={q.id: {"source": s, "topic_id": t} for q, s, t in picked}, started_at=now,
                        expires_at=now + timedelta(minutes=get_settings().session_ttl_minutes))
    db.add(sess)
    await db.flush()
    return {"session_id": str(sess.id), "stage": stage_out(stage), "expires_at": sess.expires_at.isoformat(),
            "review_ratio": stage.review_ratio,
            "questions": [question_out(q, s, t) for q, s, t in picked], "hearts": w.hearts}


def stars_for(acc: float) -> int:
    return 3 if acc >= 0.9 else 2 if acc >= 0.7 else 1 if acc >= 0.5 else 0


async def _give_item(db, user_id, item_id: str | None, source: str) -> dict | None:
    if not item_id:
        return None
    if await db.get(UserItem, (user_id, item_id)) is not None:
        return None
    it = await db.get(Item, item_id)
    if it is None:
        return None
    db.add(UserItem(user_id=user_id, item_id=item_id, source=source))
    return {"item_id": it.id, "name": it.name, "slot": it.slot}


def _add_xp(db, user: User, w, xp: int) -> bool:
    user.xp += xp
    user.xp_total += xp
    up = False
    while user.xp >= user.xp_to_next:
        user.xp -= user.xp_to_next
        user.player_level += 1
        user.xp_to_next = round(user.xp_to_next * 1.15)
        W.change(db, w, "gems", 5, "level_up", str(user.player_level))
        up = True
    return up


async def complete(db: AsyncSession, user: User, session_id, answers: list[dict], hints_used: int,
                   use_elixir: bool) -> dict:
    sess = await db.get(StageSession, session_id, with_for_update=True)
    if sess is None or sess.user_id != user.id:
        raise ApiError(404, "not_found", "unknown session")
    if sess.completed_at is not None:
        raise ApiError(409, "already_completed", "this session was already completed")
    now = utcnow()
    if now > sess.expires_at:
        raise ApiError(410, "session_expired", "start the stage again")
    total = len(sess.question_ids)
    min_secs = get_settings().min_seconds_per_question * total
    if (now - sess.started_at).total_seconds() < min_secs:
        raise ApiError(409, "too_fast", "the stage was completed faster than it can be played")
    stage = await db.get(Stage, sess.stage_id)
    world = await db.get(World, stage.world_id)
    qs = {q.id: q for q in (await db.execute(select(Question).where(Question.id.in_(sess.question_ids)))).scalars()}
    by_qid = {}
    for a in answers:
        if a.get("qid") in qs and a["qid"] not in by_qid:
            by_qid[a["qid"]] = a
    graded = []
    unverified = 0
    for qid in sess.question_ids:
        q = qs.get(qid)
        a = by_qid.get(qid)
        if q is None or a is None:
            graded.append((qid, False))
            continue
        ok, verified = grade(q.game, q.payload, a.get("answer"), a.get("correct"))
        unverified += 0 if verified else 1
        graded.append((qid, ok))
    correct = sum(1 for _, ok in graded if ok)
    acc = correct / total if total else 0.0
    stars = stars_for(acc)

    prog = await db.get(UserProgress, (user.id, stage.id), with_for_update=True)
    if prog is None:
        prog = UserProgress(user_id=user.id, stage_id=stage.id, best_stars=0, attempts=0, best_accuracy=0.0)
        db.add(prog)
    prev = prog.best_stars or 0
    first_clear = prev == 0 and stars > 0
    improved = stars > prev
    prog.attempts = (prog.attempts or 0) + 1
    prog.best_stars = max(prev, stars)
    prog.best_accuracy = max(prog.best_accuracy or 0.0, acc)
    prog.last_played_at = now
    if first_clear:
        prog.completed_at = now

    w = await W.get_wallet(db, user.id)
    ref = f"{stage.id}:{sess.id}"
    xp = correct * 12 + stars * 10
    boosted = bool(user.xp_boost_until and user.xp_boost_until > now)
    xp_player = xp * 2 if boosted else xp
    coins = correct * 5 + stars * 15
    if not improved:
        coins //= 2
    gems = TREASURE_GEMS if (stage.kind == "bonus" and first_clear) else 0
    W.change(db, w, "coins", coins, "stage", ref)
    W.change(db, w, "gems", gems, "stage", ref)
    level_up = _add_xp(db, user, w, xp_player)
    items = []
    chest = None
    if first_clear and stage.kind == "boss":
        it = await _give_item(db, user.id, world.boss_drop_item_id, "boss")
        if it:
            items.append(it)
    if first_clear and stage.drop_item_id:
        it = await _give_item(db, user.id, stage.drop_item_id, "bonus")
        if it:
            items.append(it)
    hearts_lost, elixir_used = 0, False
    if stage.hearts_apply and stars == 0:
        if use_elixir and w.elixir > 0:
            W.change(db, w, "elixir", -1, "rescue", ref)
            elixir_used = True
        else:
            W.change(db, w, "hearts", -1, "stage_lost", ref)
            hearts_lost = 1
    # level completion: the last boss of the player's current level moves them up
    level_completed = False
    if first_clear and stage.kind == "boss" and user.level == stage.level:
        last_world = (await db.execute(select(func.max(World.index)).where(World.level == stage.level))).scalar_one()
        if world.index == last_world:
            level_completed = True
            nxt = NEXT_LEVEL.get(stage.level)
            if nxt:
                user.level = nxt
    # SRS for every issued question
    srs_rows = await srs.record(db, user.id, [(qid, ok, (sess.sources.get(qid) or {}).get("topic_id"))
                                              for qid, ok in graded if qid in qs], now)
    # stats, streak, league (league points never see the XP boost)
    stat = await engage.day_stat(db, user)
    stat.stages_played += 1
    stat.answered += total
    stat.correct += correct
    stat.xp += xp
    stat.coins += coins
    stat.gems += gems
    games = set(stat.games or [])
    games.add(stage.mini_game)
    stat.games = sorted(games)
    if stars > 0:
        stat.stages_won += 1
        stat.stars += stars
        if stars == 3:
            stat.stars3 += 1
        if stage.kind == "boss":
            stat.bosses += 1
    st = await engage.touch_streak(db, user, stat)
    lp = await engage.add_points(db, user, stat, engage.league_points(correct, total))

    # what opened up
    unlocked = []
    if first_clear:
        nxt = (await db.execute(select(Stage.id).where(Stage.level == stage.level, Stage.required.is_(True),
                                                       Stage.order_key > stage.order_key)
                                .order_by(Stage.order_key).limit(1))).scalar_one_or_none()
        if nxt and stage.required:
            unlocked.append(nxt)
        if stage.index == 12:
            unlocked += list((await db.execute(select(Stage.id).where(Stage.world_id == stage.world_id,
                                                                      Stage.required.is_(False)))).scalars())
    result = {"stars": stars, "best_stars": prog.best_stars, "first_clear": first_clear, "correct": correct,
              "total": total, "accuracy": round(acc, 3), "unverified": unverified,
              "rewards": {"xp": xp_player, "xp_base": xp, "boosted": boosted, "coins": coins, "gems": gems,
                          "items": items, "chest": chest},
              "hearts_lost": hearts_lost, "elixir_used": elixir_used, "level_up": level_up,
              "level_completed": level_completed, "unlocked": unlocked, "srs_updated": len(srs_rows),
              "league_points": lp, "graded": [{"qid": q, "correct": ok} for q, ok in graded]}
    sess.completed_at = now
    sess.result = result
    await db.flush()
    today = local_day(user.timezone)
    result.update({"wallet": W.wallet_out(w), "me": me_out(user, engage.live_streak(st, today)),
                   "streak": engage.streak_out(st, stat, today)})
    return result


# ---------------------------------------------------------------- review (Overnight Cauldron)
async def review_today(db: AsyncSession, user: User, limit: int) -> dict:
    end = end_of_local_day(user.timezone)
    due_q = select(SrsItem, Question).join(Question, Question.id == SrsItem.question_id).where(
        SrsItem.user_id == user.id, SrsItem.due_at < end, Question.active.is_(True))
    due_count = (await db.execute(select(func.count()).select_from(due_q.subquery()))).scalar_one()
    tomorrow = (await db.execute(select(func.count()).select_from(SrsItem).where(
        SrsItem.user_id == user.id, SrsItem.due_at >= end, SrsItem.due_at < end + timedelta(days=1)))).scalar_one()
    rows = (await db.execute(due_q.order_by(SrsItem.due_at).limit(limit * 3))).all()
    # interleave across topics: round-robin by topic, oldest first inside each
    buckets: dict[str, list] = {}
    for it, q in rows:
        buckets.setdefault(it.topic_id or q.game, []).append((it, q))
    ordered = []
    while len(ordered) < limit and any(buckets.values()):
        for k in list(buckets):
            if buckets[k]:
                ordered.append(buckets[k].pop(0))
                if len(ordered) >= limit:
                    break
    items = []
    for it, q in ordered:
        d = question_out(q, "review", it.topic_id)
        d.update({"box": it.box, "mastery": it.box, "due_at": it.due_at.isoformat()})
        items.append(d)
    return {"due_count": due_count, "new_tomorrow": tomorrow, "items": items}


async def review_submit(db: AsyncSession, user: User, answers: list[dict]) -> dict:
    now = utcnow()
    end = end_of_local_day(user.timezone)
    qids = list({a.get("qid") for a in answers if a.get("qid")})
    due = {it.question_id: it for it in (await db.execute(select(SrsItem).where(
        SrsItem.user_id == user.id, SrsItem.question_id.in_(qids), SrsItem.due_at < end))).scalars()}
    qs = {q.id: q for q in (await db.execute(select(Question).where(Question.id.in_(list(due))))).scalars()}
    results = []
    seen = set()
    for a in answers:
        qid = a.get("qid")
        if qid in due and qid in qs and qid not in seen:
            seen.add(qid)
            ok, _ = grade(qs[qid].game, qs[qid].payload, a.get("answer"), a.get("correct"))
            results.append((qid, ok, None))
    rows = await srs.record(db, user.id, results, now, only_existing=True)
    correct = sum(1 for r in results if r[1])
    stat = await engage.day_stat(db, user)
    before = stat.review_correct or 0
    stat.review_correct = before + correct
    stat.review_answered = (stat.review_answered or 0) + len(results)
    w = await W.get_wallet(db, user.id)
    hearts_gained = (stat.review_correct // 10) - (before // 10)
    if hearts_gained > 0:
        h0 = w.hearts
        W.change(db, w, "hearts", hearts_gained, "review_refill", local_day(user.timezone).isoformat())
        hearts_gained = w.hearts - h0
    st = await engage.touch_streak(db, user, stat)
    await db.flush()
    return {"graded": len(results), "correct": correct, "hearts_gained": max(0, hearts_gained),
            "srs": [{"qid": r.question_id, "box": r.box, "due_at": r.due_at.isoformat()} for r in rows],
            "wallet": W.wallet_out(w), "streak": engage.streak_out(st, stat, local_day(user.timezone))}


__all__ = ["start_stage", "complete", "review_today", "review_submit", "me_out", "question_out", "LEVEL_ORD"]
