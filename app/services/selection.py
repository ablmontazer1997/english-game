"""Pick the question set for a stage.

- topic match: items whose topic_id is the topic (or a topic a mixed topic covers) come first; then items found via
  the topic's pipeline codes (curriculum.QDB_CODES) that are not tagged for a different topic;
- main share: the stage's topic (or the world's 3 topics for a boss / vault, the whole level in random order for the
  Oracle Gate and every stage of a level's consolidation world),
  preferred games first, unseen items first;
- review share (trials and bosses, 30-40%): earlier topics, SRS-due items of this player first; C1 topics pull from
  their B1/B2 precursors first ("deepening");
- vocab share (lessons/practice): the level's SrsItem pool (word round);
- if the bank is still thin, fall back to any grammar game for the topic, then the level's vocabulary, then any item
  of the level, so a stage is never empty. Those items are marked source="fallback".
"""
import random

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..curriculum import GRAMMAR_GAMES, LEVEL_ORD, SPELLING_GAMES, VOCAB_GAMES
from ..models import GrammarTopic, Question, SrsItem, Stage, User, World, WorldTopic
from ..timeutil import utcnow
from .content import earlier_topic_ids, world_topic_ids

ROUND_ORDER = {g: 0 for g in VOCAB_GAMES + SPELLING_GAMES}


async def _topics(db: AsyncSession, ids: list[str]) -> dict[str, GrammarTopic]:
    if not ids:
        return {}
    rows = (await db.execute(select(GrammarTopic).where(GrammarTopic.id.in_(ids)))).scalars()
    return {t.id: t for t in rows}


def _codes(t: GrammarTopic, all_topics: dict[str, GrammarTopic]) -> list[str]:
    codes = list(t.qdb_codes or [])
    for c in t.covers or []:  # a mixed topic teaches what it covers
        if c in all_topics:
            codes += all_topics[c].qdb_codes or []
    return sorted(set(codes))


def _tids(t: GrammarTopic) -> list[str]:
    return [t.id] + list(t.covers or [])


async def _pick(db, user_id, k, *, codes=None, topic_ids=None, games=None, level=None, max_level=None, no_grammar=False,
                prefer_difficulty=None, exclude=(), due_first=False, mode=None):
    if k <= 0:
        return []
    q = select(Question, SrsItem.due_at).outerjoin(
        SrsItem, and_(SrsItem.question_id == Question.id, SrsItem.user_id == user_id)).where(Question.active.is_(True))
    if codes is not None:
        if not codes:
            return []
        q = q.where(Question.grammar_codes.overlap(codes))
        if topic_ids:  # code-map match, but never an item generated for a different topic
            q = q.where(or_(Question.topic_id.is_(None), Question.topic_id.in_(topic_ids)))
    elif topic_ids is not None:
        if not topic_ids:
            return []
        q = q.where(Question.topic_id.in_(topic_ids))
    if games:
        q = q.where(Question.game.in_(games))
    if level:
        q = q.where(Question.level == level)
    if max_level:
        q = q.where(Question.level.in_([lv for lv, o in LEVEL_ORD.items() if o <= LEVEL_ORD[max_level]]))
    if mode:  # admin 4931: vocab rows by payload.mode ('synonym' = Bubble Pop)
        q = q.where(Question.payload["mode"].astext == mode)
    if no_grammar:
        q = q.where(func.cardinality(Question.grammar_codes) == 0)
    if exclude:
        q = q.where(Question.id.not_in(list(exclude)))
    rows = (await db.execute(q.limit(400))).all()
    now = utcnow()
    rnd = random.SystemRandom()

    def key(row):
        qq, due = row
        if due_first:
            pri = 0 if (due is not None and due <= now) else (1 if due is None else 2)
        else:
            pri = 0 if due is None else (1 if due <= now else 2)
        diff = 0 if (prefer_difficulty and qq.difficulty >= prefer_difficulty) else 1
        return (pri, diff, rnd.random())

    rows.sort(key=key)
    return [r[0] for r in rows[:k]]


async def pick_for_stage(db: AsyncSession, user: User, stage: Stage) -> list[tuple[Question, str, str | None]]:
    world = await db.get(World, stage.world_id)
    n = stage.question_count
    # which topics are "main"
    if stage.kind in ("boss",) or (stage.kind == "bonus" and stage.variant == "vault"):
        main_ids = await world_topic_ids(db, world.id)
    elif stage.kind == "bonus" and stage.variant == "gate":
        rows = await db.execute(select(WorldTopic.topic_id).join(World, World.id == WorldTopic.world_id)
                                .where(World.level == stage.level))
        main_ids = list(rows.scalars())
    else:
        main_ids = [stage.topic_id] if stage.topic_id else []
    if not main_ids or (stage.kind == "bonus" and stage.variant == "gate"):
        # consolidation world (no topics of its own) and the Oracle Gate: the whole level, in random order
        rows = await db.execute(select(WorldTopic.topic_id).join(World, World.id == WorldTopic.world_id)
                                .where(World.level == stage.level))
        main_ids = list(rows.scalars())
        random.SystemRandom().shuffle(main_ids)
    review_ids: list[str] = []
    if stage.review_ratio > 0:
        slot = None
        if stage.kind == "trial":
            slot = (stage.index - 1) // 4 + 1
        review_ids = await earlier_topic_ids(db, world, slot if stage.kind == "trial" else None)
    topics = await _topics(db, main_ids + review_ids)
    cover_ids = [c for t in topics.values() for c in (t.covers or [])]
    prec_ids = [p for tid in main_ids if tid in topics for p in (topics[tid].precursors or [])]
    extra = await _topics(db, cover_ids + prec_ids)
    topics.update(extra)
    if prec_ids:  # C1 deepening: precursors first in the review share
        review_ids = prec_ids + [r for r in review_ids if r not in prec_ids]
    review_ids = [r for r in review_ids if r in topics and r not in main_ids]

    review_n = round(n * stage.review_ratio) if review_ids else 0
    vocab_n = round(n * stage.vocab_ratio)
    main_n = n - review_n - vocab_n
    picked: list[tuple[Question, str, str | None]] = []
    used: set[str] = set()

    def take(qs, source, topic_id):
        for qq in qs:
            if qq.id not in used:
                used.add(qq.id)
                picked.append((qq, source, topic_id))

    prefer_diff = 3 if stage.kind == "bonus" else None
    # main share, spread evenly over the main topics
    per = max(1, -(-main_n // max(1, len(main_ids))))
    for tid in main_ids:
        t = topics.get(tid)
        if not t:
            continue
        want = min(per, main_n - sum(1 for p in picked if p[1] == "new"))
        codes, tids = _codes(t, topics), _tids(t)
        for kw in (dict(topic_ids=tids, games=stage.games), dict(codes=codes, topic_ids=tids, games=stage.games),
                   dict(topic_ids=tids, games=GRAMMAR_GAMES), dict(codes=codes, topic_ids=tids, games=GRAMMAR_GAMES)):
            short = want - sum(1 for p in picked if p[2] == tid and p[1] == "new")
            if short <= 0:
                break
            take(await _pick(db, user.id, short, exclude=used,
                             prefer_difficulty=prefer_diff if kw["games"] is stage.games else None, **kw), "new", tid)
    # review share: SRS-due items from earlier topics first
    if review_n:
        per_r = max(1, -(-review_n // min(len(review_ids), 4)))
        for tid in review_ids:
            have = sum(1 for p in picked if p[1] == "review")
            if have >= review_n:
                break
            want_r = min(per_r, review_n - have)
            got = await _pick(db, user.id, want_r, topic_ids=_tids(topics[tid]), games=GRAMMAR_GAMES, exclude=used,
                              due_first=True)
            take(got, "review", tid)
            if len(got) < want_r:
                take(await _pick(db, user.id, want_r - len(got), codes=_codes(topics[tid], topics),
                                 topic_ids=_tids(topics[tid]), games=GRAMMAR_GAMES, exclude=used, due_first=True),
                     "review", tid)
    # vocab round
    if vocab_n:
        # admin 4931: the word round is Bubble Pop, and Bubble Pop asks SYNONYMS only. Seen items may repeat (unseen first),
        # so the synonym pool never runs dry; a definition item only enters through the fallbacks below (served as Match Blitz)
        take(await _pick(db, user.id, vocab_n, games=["bubble-pop"], level=stage.level, exclude=used, mode="synonym"), "new", None)
        short_v = vocab_n - sum(1 for p in picked if p[2] is None and p[1] == "new")
        if short_v > 0:
            take(await _pick(db, user.id, short_v, games=VOCAB_GAMES, level=stage.level, exclude=used), "new", None)
    # fallbacks while the bank is thin
    short = n - len(picked)
    if short > 0:
        take(await _pick(db, user.id, short, games=stage.games, level=stage.level, exclude=used), "fallback", None)
    short = n - len(picked)
    if short > 0:
        take(await _pick(db, user.id, short, games=VOCAB_GAMES + SPELLING_GAMES, level=stage.level, exclude=used),
             "fallback", None)
    short = n - len(picked)
    if short > 0:
        take(await _pick(db, user.id, short, max_level=stage.level, exclude=used), "fallback", None)
    # rounds: words first, then grammar, then skills; review items interleaved
    rnd = random.SystemRandom()
    rnd.shuffle(picked)
    if stage.kind == "lesson":
        # audit 10-11 P0: a lesson opens on its OWN grammar (an untimed grammar game), the word round comes last
        lead = next((p[0].game for p in picked if p[2] == stage.topic_id and p[0].game in GRAMMAR_GAMES), None)

        def lesson_key(p):
            g = p[0].game
            if g in VOCAB_GAMES or g in SPELLING_GAMES:
                return 3
            if p[2] == stage.topic_id:
                return 0 if g == lead else 1
            return 2
        picked.sort(key=lesson_key)
        return picked[:n]
    picked.sort(key=lambda p: ROUND_ORDER.get(p[0].game, 1 if p[0].game in ("spell-weaver", "curse-breaker",
                                                                             "rune-order", "oracle-trial") else 2))
    return picked[:n]
