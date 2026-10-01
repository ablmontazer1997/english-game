"""Map state: which stages a player can play, with stars, plus helpers to find topics around a stage."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..curriculum import CLIENT_KIND, LEVEL_ORD
from ..models import GrammarTopic, Item, Stage, User, UserItem, UserProgress, World, WorldTopic


def level_unlocked(user: User, level: str) -> bool:
    return LEVEL_ORD[level] <= LEVEL_ORD[user.level]


async def stars_for(db: AsyncSession, user_id, stage_ids) -> dict[str, int]:
    rows = await db.execute(select(UserProgress.stage_id, UserProgress.best_stars).where(
        UserProgress.user_id == user_id, UserProgress.stage_id.in_(list(stage_ids))))
    return {a: b for a, b in rows.all()}


def compute_unlocks(stages: list[Stage], stars: dict[str, int], level_open: bool) -> set[str]:
    """stages: every stage of ONE level. Required stages are linear; bonus stages open after stage 12 of their
    world."""
    if not level_open:
        return set()
    open_ids: set[str] = set()
    prev_done = True
    for st in sorted((s for s in stages if s.required), key=lambda s: s.order_key):
        if prev_done:
            open_ids.add(st.id)
        prev_done = stars.get(st.id, 0) > 0 and prev_done
    s12 = {s.world_id: s.id for s in stages if s.index == 12}
    for st in stages:
        if not st.required and stars.get(s12.get(st.world_id, ""), 0) > 0:
            open_ids.add(st.id)
    return open_ids


async def level_stages(db: AsyncSession, level: str) -> list[Stage]:
    return list((await db.execute(select(Stage).where(Stage.level == level).order_by(Stage.order_key))).scalars())


async def is_stage_open(db: AsyncSession, user: User, stage: Stage) -> bool:
    if not level_unlocked(user, stage.level):
        return False
    stages = await level_stages(db, stage.level)
    stars = await stars_for(db, user.id, [s.id for s in stages])
    return stage.id in compute_unlocks(stages, stars, True)


def stage_out(st: Stage, status: str | None = None, stars: int | None = None) -> dict:
    d = {"id": st.id, "world_id": st.world_id, "level": st.level, "index": st.index, "kind": st.kind,
         "client_kind": CLIENT_KIND[st.kind], "variant": st.variant, "required": st.required,
         "topic_id": st.topic_id, "mini_game": st.mini_game, "title": st.title, "hearts_apply": st.hearts_apply,
         "question_count": st.question_count, "review_ratio": st.review_ratio}
    if status is not None:
        d["status"] = status
        d["stars"] = stars or 0
    return d


async def map_for(db: AsyncSession, user: User, level: str) -> dict:
    worlds = list((await db.execute(select(World).where(World.level == level).order_by(World.index))).scalars())
    stages = await level_stages(db, level)
    stars = await stars_for(db, user.id, [s.id for s in stages])
    level_open = level_unlocked(user, level)
    open_ids = compute_unlocks(stages, stars, level_open)
    wt = (await db.execute(select(WorldTopic, GrammarTopic).join(GrammarTopic, GrammarTopic.id == WorldTopic.topic_id)
                           .where(WorldTopic.world_id.in_([w.id for w in worlds])))).all()
    topics_by_world: dict[str, list] = {}
    for link, t in wt:
        topics_by_world.setdefault(link.world_id, []).append(
            {"id": t.id, "slot": link.slot, "title": t.title, "kind": t.kind})
    drop_ids = [w.boss_drop_item_id for w in worlds if w.boss_drop_item_id]
    items = {i.id: i for i in (await db.execute(select(Item).where(Item.id.in_(drop_ids)))).scalars()}
    owned = set((await db.execute(select(UserItem.item_id).where(UserItem.user_id == user.id,
                                                                  UserItem.item_id.in_(drop_ids)))).scalars())
    by_world: dict[str, list[Stage]] = {}
    for s in stages:
        by_world.setdefault(s.world_id, []).append(s)
    out_worlds = []
    current_stage = None
    done_n = 0
    star_sum = 0
    required_total = 0
    for w in worlds:
        sts = []
        for s in by_world.get(w.id, []):
            n = stars.get(s.id, 0)
            status = "done" if n > 0 else ("current" if s.id in open_ids else "locked")
            if s.required:
                required_total += 1
                if n > 0:
                    done_n += 1
                elif status == "current" and current_stage is None:
                    current_stage = s.id
            star_sum += n
            sts.append(stage_out(s, status, n))
        boss = next((x for x in sts if x["kind"] == "boss"), None)
        wstatus = "done" if boss and boss["stars"] > 0 else (
            "current" if any(x["status"] == "current" for x in sts if x["required"]) else "locked")
        it = items.get(w.boss_drop_item_id)
        out_worlds.append({
            "id": w.id, "level": w.level, "index": w.index, "global_index": w.global_index, "name": w.name,
            "paint_id": w.paint_id, "paint_name": w.paint_name, "accent": w.accent, "variant": w.variant,
            "topics": sorted(topics_by_world.get(w.id, []), key=lambda t: t["slot"]),
            "boss_drop": ({"item_id": it.id, "name": it.name, "slot": it.slot, "owned": it.id in owned}
                          if it else None),
            "status": wstatus, "stages": sts})
    return {"level": level, "unlocked": level_open,
            "progress": {"stages_done": done_n, "stars": star_sum, "required_total": required_total,
                         "current_stage_id": current_stage},
            "worlds": out_worlds}


async def world_topic_ids(db: AsyncSession, world_id: str) -> list[str]:
    rows = await db.execute(select(WorldTopic.topic_id).where(WorldTopic.world_id == world_id)
                            .order_by(WorldTopic.slot))
    return list(rows.scalars())


async def earlier_topic_ids(db: AsyncSession, world: World, before_slot: int | None) -> list[str]:
    """Topics taught before this point in the level: earlier slots of this world, then earlier worlds (nearest
    first). For the first world of a level, the previous level's last world counts as 'earlier'."""
    out: list[str] = []
    if before_slot:
        rows = await db.execute(select(WorldTopic.topic_id).where(WorldTopic.world_id == world.id,
                                                                  WorldTopic.slot < before_slot)
                                .order_by(WorldTopic.slot.desc()))
        out += list(rows.scalars())
    rows = await db.execute(select(World.id).where(World.global_index < world.global_index)
                            .order_by(World.global_index.desc()).limit(3))
    for wid in rows.scalars():
        out += await world_topic_ids(db, wid)
    return out
