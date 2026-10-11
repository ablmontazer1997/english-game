"""Phase B: upsert ONLY the wardrobe catalogue (items) + chest odds, and retire the first-catalogue items the live
wardrobe cannot show. Leaves worlds, stages and every player row alone (safe on the live DB).

    python -m scripts.seed_items      (inside the runecast-api container)
"""
import asyncio

from sqlalchemy import func, select

from app import catalog
from app.db import SessionLocal, engine
from app.models import ChestType, Item
from scripts.seed import item_rows, retire_items, upsert


async def main():
    async with SessionLocal() as db:
        rows = item_rows(with_world=False)
        await upsert(db, Item, rows, ["id"])
        await retire_items(db)
        await upsert(db, ChestType, [dict(c) for c in catalog.CHESTS], ["kind"])
        await db.commit()
        n = dict((await db.execute(select(Item.tier, func.count()).where(Item.active.is_(True))
                                   .group_by(Item.tier))).all())
        print("items upserted:", len(rows), "active per tier:", n)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
