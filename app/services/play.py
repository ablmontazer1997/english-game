"""Stage start / complete and the review queue. All rewards are computed here, on the server."""
import re
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..curriculum import LEVEL_ORD, NEXT_LEVEL, TREASURE_GEMS
from ..errors import ApiError
from ..models import (Item, Question, SrsItem, Stage, StageSession, User, UserItem, UserProgress, World)  # noqa
from ..timeutil import end_of_local_day, local_day, utcnow
from .. import catalog as C
from . import engage, events as EV, srs, wardrobe
from . import season as season_svc
from . import wallet as W
from .content import is_stage_open, stage_out
from .grading import grade
from .selection import pick_for_stage


def served_game(q: Question) -> str:
    """admin 4931: Bubble Pop asks synonyms only. A definition-mode word row (the shared vocab pool is stored as bubble-pop)
    is played in Match Blitz instead: same item shape, same answer (payload.back), graded by the stored game as before."""
    if q.game == "bubble-pop" and (q.payload or {}).get("mode") != "synonym":
        return "match-blitz"
    return q.game


def question_out(q: Question, source: str | None = None, topic_id: str | None = None) -> dict:
    d = {"qid": q.id, "game": served_game(q), "level": q.level, "difficulty": q.difficulty, "grammar": q.grammar_codes,
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
            "league_opt_in": u.league_opt_in, "created_at": u.created_at.isoformat() if u.created_at else None,
            "onboarded": u.onboarded_at is not None, "daily_goal": u.daily_goal, "flags": dict(u.flags or {})}


# client flags kept on the account: key -> allowed values (anything else is ignored)
FLAG_KEYS = {"tour": {"pending", "done"}, "intro_step": None, "look": {"boy", "girl", "custom"},
             "placement": None, "guided": {"pending", "done"}, "focus": {"on", "off"}}
# Phase C: the games whose first-time tutorial the player has seen (merged as a set, known ids only)
TUT_GAMES = {"bubble-pop", "match-blitz", "memory-crystals", "gap-gate", "oracle-trial", "rune-order", "whisper-scroll",
             "tavern-talk", "echo", "rune-type", "potion-mix", "curse-breaker", "spell-weaver", "crystal-ball",
             "bards-tale", "guild-letters", "boss-battle"}
_NAME_OK = re.compile(r"[^\w .'\-]", re.UNICODE)


def clean_name(raw: str) -> str | None:
    """a league-safe display name: 2..20 visible characters, letters/digits/space . ' - only, no links"""
    n = " ".join(_NAME_OK.sub("", raw or "").split())[:20].strip()
    if len(n) < 2 or n.replace(" ", "").isdigit():
        return None
    return n


def merge_flags(old: dict | None, new: dict) -> dict:
    out = dict(old or {})
    for k, v in (new or {}).items():
        if k == "tut":   # list of game ids: added to what is stored ("reset" clears it)
            if v == "reset":
                out.pop("tut", None)
            elif isinstance(v, list):
                out["tut"] = sorted(set(out.get("tut") or []) | {g for g in v if g in TUT_GAMES})
            continue
        if k not in FLAG_KEYS:
            continue
        allowed = FLAG_KEYS[k]
        if allowed is None:
            if isinstance(v, (int, str)) and len(str(v)) <= 12:
                out[k] = v
        elif v in allowed:
            out[k] = v
    return out


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
    stat = await engage.day_stat(db, user)
    return {"session_id": str(sess.id), "stage": stage_out(stage), "expires_at": sess.expires_at.isoformat(),
            "review_ratio": stage.review_ratio,
            "questions": [question_out(q, s, t) for q, s, t in picked], "hearts": w.hearts,
            "hints": hints_state(stat), "continue": continue_offer(stage, sess)}


# ---------------------------------------------------------------- Phase B sinks: hints and "continue"
def hints_state(stat) -> dict:
    used = stat.hints_used or 0
    return {"free_left": max(0, C.HINT_FREE_PER_DAY - used), "free_per_day": C.HINT_FREE_PER_DAY,
            "cost_coins": C.HINT_COST_COINS, "used_today": used}


async def use_hint(db: AsyncSession, user: User) -> dict:
    """a hint the game just applied: the first 3 of the local day are free, then 20 coins each"""
    stat = await engage.day_stat(db, user)
    w = await W.get_wallet(db, user.id)
    charged = 0
    if (stat.hints_used or 0) >= C.HINT_FREE_PER_DAY:
        W.change(db, w, "coins", -C.HINT_COST_COINS, "hint", local_day(user.timezone).isoformat())
        charged = C.HINT_COST_COINS
    stat.hints_used = (stat.hints_used or 0) + 1
    await db.flush()
    return {"charged_coins": charged, "hints": hints_state(stat), "wallet": W.wallet_out(w)}


def continue_offer(stage: Stage, sess: StageSession) -> dict | None:
    if not stage.hearts_apply:
        return None
    return {"questions": C.CONTINUE_QUESTIONS, "cost_gems": C.CONTINUE_GEMS, "cost_elixir": 1,
            "left": max(0, 1 - (sess.continues or 0))}


async def continue_session(db: AsyncSession, user: User, session_id, pay: str) -> dict:
    """"+3 questions" after a lost trial / boss / vault (audit 5.3 A), once per session, for 1 elixir or 10 gems.
    The questions join the session, so the result is graded over all of them."""
    sess = await db.get(StageSession, session_id, with_for_update=True)
    if sess is None or sess.user_id != user.id:
        raise ApiError(404, "not_found", "unknown session")
    if sess.completed_at is not None:
        raise ApiError(409, "already_completed", "this session was already completed")
    now = utcnow()
    if now > sess.expires_at:
        raise ApiError(410, "session_expired", "start the stage again")
    stage = await db.get(Stage, sess.stage_id)
    if not stage.hearts_apply:
        raise ApiError(409, "no_continue", "only trials, bosses and vaults can be continued")
    if (sess.continues or 0) >= 1:
        raise ApiError(409, "already_continued", "a stage can be continued once")
    if pay not in ("elixir", "gems"):
        raise ApiError(422, "bad_request", "pay with elixir or gems")
    picked = await pick_for_stage(db, user, stage)
    have = set(sess.question_ids)
    fresh = [(q, s, t) for q, s, t in picked if q.id not in have]
    # the stage's own game first (a boss stays a boss fight), then anything else it picked
    fresh.sort(key=lambda x: 0 if x[0].game == stage.mini_game else 1)
    fresh = fresh[:C.CONTINUE_QUESTIONS]
    if not fresh:
        raise ApiError(409, "no_questions", "no more questions for this stage")
    w = await W.get_wallet(db, user.id)
    ref = f"{stage.id}:{sess.id}"
    if pay == "elixir":
        W.change(db, w, "elixir", -1, "continue", ref)
    else:
        W.change(db, w, "gems", -C.CONTINUE_GEMS, "continue", ref)
    sess.question_ids = list(sess.question_ids) + [q.id for q, _, _ in fresh]
    src = dict(sess.sources or {})
    for q, s, t in fresh:
        src[q.id] = {"source": s, "topic_id": t}
    sess.sources = src
    sess.continues = (sess.continues or 0) + 1
    sess.expires_at = max(sess.expires_at, now + timedelta(minutes=15))
    await db.flush()
    return {"questions": [question_out(q, s, t) for q, s, t in fresh], "wallet": W.wallet_out(w),
            "paid": pay, "continue": continue_offer(stage, sess)}


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
                   use_elixir: bool, focus: bool = False) -> dict:
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
    if focus:   # Phase C Focus mode (untimed, calm): at most 2 stars and no league points, so it stays fair
        stars = min(stars, 2)

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
    # Phase E (admin 4847, Q8): the weekly events, from the server clock + the player's local weekday
    ev_on = EV.active_ids(user, now)
    double_xp = "double_xp" in ev_on
    xp_player = xp * 2 if (boosted or double_xp) else xp   # the event and the bought boost do not stack
    coins = correct * 5 + stars * 15
    if not improved:
        coins //= 2
    gems = TREASURE_GEMS if (stage.kind == "bonus" and first_clear) else 0
    W.change(db, w, "coins", coins, "stage", ref)
    W.change(db, w, "gems", gems, "stage", ref)
    rush = None
    if "boss_rush" in ev_on and stage.kind == "boss" and stars > 0:
        today_l = local_day(user.timezone, now)
        used = await EV.boss_rush_used(db, user, today_l)
        g = EV.boss_rush_gems(stars) if used < EV.BOSS_RUSH_DAILY_MAX else 0
        if g:
            W.change(db, w, "gems", g, "boss_rush", f"{today_l.isoformat()}:{ref}")
            gems += g
            used += 1
        rush = {"gems": g, "left": max(0, EV.BOSS_RUSH_DAILY_MAX - used)}
    level_up = _add_xp(db, user, w, xp_player)
    items = []
    chest = None
    if first_clear and stage.kind == "boss":
        it = await _give_item(db, user.id, world.boss_drop_item_id, "boss")
        if it:
            it["why"] = "Boss treasure"
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
    # every game the player actually played in this stage (lessons mix a grammar game and a word game)
    games.update(qs[qid].game for qid in by_qid if qid in qs)
    stat.games = sorted(games)
    if stars > 0:
        stat.stages_won += 1
        stat.stars += stars
        if stars == 3:
            stat.stars3 += 1
        if stage.kind == "boss":
            stat.bosses += 1
    st = await engage.touch_streak(db, user, stat)
    lp = 0 if focus else await engage.add_points(db, user, stat, engage.league_points(correct, total))
    items += await wardrobe.habit_rewards(db, user, st)   # Phase B: 7 / 30-day Hearthfire hats
    # Phase D: Season Pass XP (server only; Focus keeps its caps via its capped stars + SEASON_FOCUS_MAX)
    season = await season_svc.add_xp(db, user, season_svc.stage_xp(stars, focus) * (EV.DOUBLE_XP_MULT if double_xp else 1), now)

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
                          "items": items, "chest": chest,
                          "double_xp": double_xp, "boss_rush": rush},
              "hearts_lost": hearts_lost, "elixir_used": elixir_used, "level_up": level_up,
              "level_completed": level_completed, "unlocked": unlocked, "srs_updated": len(srs_rows),
              "league_points": lp, "focus": focus, "season": season, "graded": [{"qid": q, "correct": ok} for q, ok in graded]}
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
    items = await wardrobe.habit_rewards(db, user, st)
    await db.flush()
    return {"graded": len(results), "items": items, "correct": correct, "hearts_gained": max(0, hearts_gained),
            "srs": [{"qid": r.question_id, "box": r.box, "due_at": r.due_at.isoformat()} for r in rows],
            "wallet": W.wallet_out(w), "streak": engage.streak_out(st, stat, local_day(user.timezone))}


__all__ = ["start_stage", "complete", "review_today", "review_submit", "me_out", "question_out", "LEVEL_ORD"]
