"""Currencies + the wallet_tx ledger. Every balance change goes through change() so the ledger is complete."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import ApiError
from ..models import UserChest, Wallet, WalletTx
from ..timeutil import ms, utcnow

HEART_REGEN = timedelta(minutes=20)
_ATTR = {"gems": "gems", "coins": "coins", "hearts": "hearts", "elixir": "elixir", "potion": "elixir"}


async def get_wallet(db: AsyncSession, user_id, lock: bool = True) -> Wallet:
    q = select(Wallet).where(Wallet.user_id == user_id)
    if lock:
        q = q.with_for_update()
    w = (await db.execute(q)).scalar_one()
    sync_hearts(w)
    return w


def sync_hearts(w: Wallet, now: datetime | None = None):
    now = now or utcnow()
    if w.hearts >= w.hearts_max:
        w.hearts_regen_from = None
        return
    if w.hearts_regen_from is None:
        w.hearts_regen_from = now
        return
    n = int((now - w.hearts_regen_from) / HEART_REGEN)
    if n > 0:
        w.hearts = min(w.hearts_max, w.hearts + n)
        w.hearts_regen_from = None if w.hearts >= w.hearts_max else w.hearts_regen_from + n * HEART_REGEN


def wallet_out(w: Wallet) -> dict:
    refill = w.hearts_regen_from + HEART_REGEN if (w.hearts < w.hearts_max and w.hearts_regen_from) else None
    return {"hearts": w.hearts, "heartsMax": w.hearts_max, "heartsRefillAt": ms(refill), "potion": w.elixir,
            "elixir": w.elixir, "coins": w.coins, "gems": w.gems}


def change(db: AsyncSession, w: Wallet, currency: str, delta: int, reason: str, ref: str | None = None):
    if delta == 0:
        return
    attr = _ATTR[currency]
    new = getattr(w, attr) + delta
    if new < 0:
        raise ApiError(409, f"not_enough_{'elixir' if attr == 'elixir' else attr}", f"not enough {attr}")
    if attr == "hearts":
        new = min(new, w.hearts_max)
        delta = new - w.hearts
        if delta == 0:
            return
    setattr(w, attr, new)
    if attr == "hearts":
        if w.hearts >= w.hearts_max:
            w.hearts_regen_from = None
        elif w.hearts_regen_from is None:
            w.hearts_regen_from = utcnow()
    db.add(WalletTx(user_id=w.user_id, currency=attr, delta=delta, balance_after=new, reason=reason, ref=ref))


async def add_chest(db: AsyncSession, user_id, kind: str, n: int = 1):
    row = await db.get(UserChest, (user_id, kind), with_for_update=True)
    if row is None:
        row = UserChest(user_id=user_id, kind=kind, count=0)
        db.add(row)
    row.count = (row.count or 0) + n
    if row.count < 0:
        raise ApiError(409, "no_chest", "no chest of that kind")
    return row


async def grant(db: AsyncSession, w: Wallet, reward: dict, reason: str, ref: str | None = None):
    """reward = {coins?, gems?, potion?/elixir?, chest?}"""
    change(db, w, "coins", int(reward.get("coins", 0) or 0), reason, ref)
    change(db, w, "gems", int(reward.get("gems", 0) or 0), reason, ref)
    change(db, w, "elixir", int(reward.get("potion", 0) or reward.get("elixir", 0) or 0), reason, ref)
    if reward.get("chest"):
        await add_chest(db, w.user_id, reward["chest"], 1)
