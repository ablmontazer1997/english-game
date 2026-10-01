"""Idempotent seed: levels, grammar topics, items, chests, 40 worlds and their stages.

    python -m scripts.seed            (inside the runecast-api container)

Re-running updates rows in place (upsert). It never deletes stages, so player progress is safe; it prints stale
stage ids if the plan ever shrinks.
"""
import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app import catalog, curriculum as C
from app.db import SessionLocal, engine
from app.models import ChestType, GrammarTopic, Item, Level, Stage, World, WorldTopic

SNAP = Path(__file__).resolve().parent.parent / "app" / "seed_data" / "bingual_grammar_topics.json"


def check_plan(bingual: dict[str, dict]):
    used = [t for lv in C.WORLDS.values() for _, ts in lv for t in ts]
    assert len(used) == len(set(used)), "a topic is used twice"
    missing = set(bingual) - set(used)
    assert not missing, f"Bingual topics not placed: {missing}"
    unknown = set(used) - set(bingual) - set(C.MIXED_TOPICS)
    assert not unknown, f"unknown topics: {unknown}"
    counts = {lv: len(ws) for lv, ws in C.WORLDS.items()}
    assert counts == {"A1": 8, "A2": 8, "B1": 9, "B2": 8, "C1": 7}, counts
    for lv, ws in C.WORLDS.items():
        for name, ts in ws:
            assert len(ts) == 3, name
            for t in ts:
                lvl = bingual[t]["level"] if t in bingual else C.MIXED_TOPICS[t][0]
                assert lvl == lv, (t, lvl, lv)


async def upsert(db, model, rows: list[dict], keys: list[str]):
    if not rows:
        return
    cols = set(rows[0])
    stmt = insert(model).values(rows)
    stmt = stmt.on_conflict_do_update(index_elements=keys,
                                      set_={c: stmt.excluded[c] for c in cols if c not in keys})
    await db.execute(stmt)


async def main():
    bingual = {t["id"]: t for t in json.loads(SNAP.read_text())}
    check_plan(bingual)
    async with SessionLocal() as db:
        await upsert(db, Level, [dict(code=c, ordinal=o, title=t, world_count=len(C.WORLDS[c]))
                                 for c, o, t in C.LEVELS], ["code"])
        topics = []
        for tid, t in bingual.items():
            d = t["data"]
            topics.append(dict(id=tid, level=t["level"], order_in_level=t["order"], title=d.get("title", tid),
                               summary=d.get("summary", ""), category=d.get("category", ""), kind="core",
                               source="bingual", qdb_codes=C.QDB_CODES.get(tid, []),
                               precursors=C.PRECURSORS.get(tid, []), covers=[], data=d))
        for i, (tid, (lv, title, covers)) in enumerate(C.MIXED_TOPICS.items()):
            topics.append(dict(id=tid, level=lv, order_in_level=100 + i, title=title,
                               summary="A mixed review of the topics listed in `covers`.", category="Mixed Review",
                               kind="mixed", source="runecast", qdb_codes=[], precursors=[], covers=covers,
                               data={"title": title, "explanation": "Mixed practice: " + ", ".join(
                                   bingual[c]["data"]["title"] for c in covers),
                                   "rules": [], "examples": []}))
        await upsert(db, GrammarTopic, topics, ["id"])

        items = []
        for it in catalog.items():
            row = dict(id=it["id"], name=it["name"], slot=it["slot"], tier=it["tier"], rarity=it.get("rarity"),
                       price_gems=it.get("price_gems"), world_drop=it.get("world_drop"), drop_stage_id=None,
                       theme=it.get("theme", ""), base_mesh=it.get("base_mesh"), recolour=it.get("recolour"),
                       is_new=it.get("is_new", False), is_default=it.get("is_default", False),
                       active=it.get("active", True), notes=it.get("notes", ""))
            items.append(row)
        await upsert(db, Item, items, ["id"])
        await upsert(db, ChestType, [dict(c) for c in catalog.CHESTS], ["kind"])

        gi = 0
        worlds, links, stages = [], [], []
        for lv, ws in C.WORLDS.items():
            for wi, (wname, tids) in enumerate(ws, 1):
                gi += 1
                pid, pname, accent, rep = C.world_paint(gi)
                wid = f"{lv}-W{wi:02d}"
                worlds.append(dict(id=wid, level=lv, index=wi, global_index=gi,
                                   name=f"{pname}{C.NAME_SUFFIX[rep]}: {wname}", paint_id=pid, paint_name=pname,
                                   accent=accent,
                                   variant={"tint": C.TINT_BY_LEVEL[lv], "weather": C.WEATHER_BY_LEVEL[lv],
                                            "time": C.TIME_BY_REPEAT[rep]},
                                   boss_drop_item_id=catalog.BOSS_DROP_BY_WORLD.get(gi)))
                tinfo = []
                for slot, tid in enumerate(tids, 1):
                    links.append(dict(world_id=wid, slot=slot, topic_id=tid))
                    title = bingual[tid]["data"]["title"] if tid in bingual else C.MIXED_TOPICS[tid][1]
                    tinfo.append({"id": tid, "title": title})
                stages += C.build_stage_plan(lv, wi, wid, tinfo, wi == len(ws), f"{pname}{C.NAME_SUFFIX[rep]}")
        await upsert(db, World, worlds, ["id"])
        await upsert(db, WorldTopic, links, ["world_id", "slot"])
        for i in range(0, len(stages), 200):
            await upsert(db, Stage, stages[i:i + 200], ["id"])
        # gate drops: point the item at its stage
        for st in stages:
            if st["drop_item_id"]:
                it = await db.get(Item, st["drop_item_id"])
                it.drop_stage_id = st["id"]
        plan_ids = {s["id"] for s in stages}
        stale = [s for s in (await db.execute(select(Stage.id))).scalars() if s not in plan_ids]
        await db.commit()
    req = sum(1 for s in stages if s["required"])
    print(f"seed ok: levels 5, topics {len(topics)}, items {len(items)}, worlds {len(worlds)}, "
          f"stages {len(stages)} ({req} required + {len(stages) - req} bonus)")
    if stale:
        print("WARNING stale stages not in the plan (kept):", stale[:20])
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
