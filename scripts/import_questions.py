"""Idempotent import of the question pipeline output (runecast/qdb/db/<game>/<level>.jsonl, mounted read-only at
/qdb). Safe to re-run while the pipeline keeps writing: a half-written last line is skipped and picked up next time.

    python -m scripts.import_questions [--dir /qdb] [--dry-run]

- new id -> insert; same id + changed content -> update; same content -> untouched.
- C2 files are skipped (there is no C2 level).
- Vocabulary items (front/back) also fill the `words` table.
- `topic_id` (Bingual grammar topic id, set by the pipeline since 2026-10-01 and by its re-tag of older items) is
  stored in questions.topic_id when it names a known grammar topic; selection prefers it over the code map
  (curriculum.QDB_CODES). Unknown ids are counted (`unknown_topic`) and stored as NULL.
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.curriculum import LEVEL_ORD
from app.db import SessionLocal, engine
from app.models import GrammarTopic, Question, Word

KNOWN_GAMES = {"bubble-pop", "match-blitz", "memory-crystals", "gap-gate", "boss-battle", "oracle-trial", "rune-order",
               "whisper-scroll", "tavern-talk", "echo", "rune-type", "potion-mix", "curse-breaker", "spell-weaver",
               "crystal-ball", "bards-tale", "guild-letters"}


def chash(d: dict) -> str:
    core = {k: d.get(k) for k in ("game", "level", "difficulty", "grammar", "skills", "topic", "data")}
    if d.get("topic_id"):  # only when present, so hashes of untagged items stay stable
        core["topic_id"] = d["topic_id"]
    return hashlib.sha1(json.dumps(core, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def read_items(root: Path, stats: dict):
    for f in sorted(root.glob("*/*.jsonl")):
        level = f.stem
        if level not in LEVEL_ORD:
            stats["skipped_level"] += sum(1 for _ in f.open(encoding="utf-8"))
            continue
        for line in f.open(encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                stats["bad_json"] += 1
                continue
            if not isinstance(d, dict) or not d.get("id") or not isinstance(d.get("data"), dict):
                stats["bad_shape"] += 1
                continue
            if d.get("game") not in KNOWN_GAMES:
                stats["unknown_game"] += 1
                continue
            if d.get("level") != level:
                stats["level_mismatch"] += 1
                continue
            yield f, d


async def main(root: Path, dry: bool):
    stats = {k: 0 for k in ("read", "inserted", "updated", "unchanged", "bad_json", "bad_shape", "unknown_game",
                            "level_mismatch", "skipped_level", "words_added", "with_topic_id", "unknown_topic")}
    async with SessionLocal() as db:
        known_topics = set((await db.execute(select(GrammarTopic.id))).scalars())
    rows = []
    for f, d in read_items(root, stats):
        stats["read"] += 1
        tid = d.get("topic_id") if isinstance(d.get("topic_id"), str) else None
        if tid and tid not in known_topics:
            stats["unknown_topic"] += 1
            tid = None
        stats["with_topic_id"] += bool(tid)
        rows.append(dict(id=d["id"], game=d["game"], level=d["level"], difficulty=int(d.get("difficulty") or 2),
                         grammar_codes=[g for g in d.get("grammar") or [] if isinstance(g, str)],
                         skills=[s for s in d.get("skills") or [] if isinstance(s, str)],
                         topic=d.get("topic") or "", topic_id=tid, payload=d["data"], content_hash=chash(d),
                         source_file=str(f.relative_to(root))))
    rows = list({r["id"]: r for r in rows}.values())  # one row per id (last wins)
    async with SessionLocal() as db:
        existing = dict((await db.execute(select(Question.id, Question.content_hash))).all())
        new = [r for r in rows if r["id"] not in existing]
        changed = [r for r in rows if r["id"] in existing and existing[r["id"]] != r["content_hash"]]
        stats["inserted"], stats["updated"] = len(new), len(changed)
        stats["unchanged"] = len(rows) - len(new) - len(changed)
        if not dry:
            for i in range(0, len(new + changed), 300):
                chunk = (new + changed)[i:i + 300]
                stmt = insert(Question).values(chunk)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["id"],
                    set_={c: stmt.excluded[c] for c in chunk[0] if c != "id"} | {"updated_at": func.now()},
                    where=Question.content_hash != stmt.excluded.content_hash)
                await db.execute(stmt)
            words = []
            seen = set()
            for r in rows:
                p = r["payload"]
                if r["game"] in ("bubble-pop", "match-blitz", "memory-crystals", "gap-gate", "boss-battle") \
                        and p.get("front") and p.get("back"):
                    key = (r["level"], p["front"].strip().lower())
                    if key not in seen:
                        seen.add(key)
                        words.append(dict(level=r["level"], word=key[1], definition=p["back"], topic=r["topic"],
                                          question_id=r["id"]))
            before = (await db.execute(select(func.count()).select_from(Word))).scalar_one()
            for i in range(0, len(words), 500):
                await db.execute(insert(Word).values(words[i:i + 500]).on_conflict_do_nothing(
                    index_elements=["level", "word"]))
            await db.commit()
            after = (await db.execute(select(func.count()).select_from(Word))).scalar_one()
            stats["words_added"] = after - before
        total = (await db.execute(select(func.count()).select_from(Question))).scalar_one()
    await engine.dispose()
    print(json.dumps({"dry_run": dry, **stats, "questions_in_db": total}))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=get_settings().qdb_dir)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    asyncio.run(main(Path(a.dir), a.dry_run))
