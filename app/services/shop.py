"""Gem/coin shop, chests (server RNG over the published odds), inventory and equipment."""
import random
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..catalog import DEFAULT_EQUIP, DEFAULT_LOOK, OFFER_BY_ID, OFFERS
from ..errors import ApiError
from ..models import ChestOpen, ChestType, Item, User, UserChest, UserItem
from ..timeutil import local_day, ms, utcnow
from . import engage
from . import wallet as W
from . import wardrobe as WD
from . import payments as PAY
from . import season as SS

RNG = random.SystemRandom()
XP_BOOST = timedelta(minutes=15)


async def owned_ids(db, user_id) -> set[str]:
    return set((await db.execute(select(UserItem.item_id).where(UserItem.user_id == user_id))).scalars())


async def chests_out(db: AsyncSession, user_id) -> list[dict]:
    types = (await db.execute(select(ChestType).order_by(ChestType.kind))).scalars().all()
    have = {c.kind: c.count for c in (await db.execute(select(UserChest).where(UserChest.user_id == user_id))).scalars()}
    order = {"wood": 0, "silver": 1, "epic": 2}
    out = []
    for t in sorted(types, key=lambda t: order.get(t.kind, 9)):
        price = {"coins": t.price_coins} if t.price_coins else {"gems": t.price_gems}
        out.append({"kind": t.kind, "title": t.title, "owned": have.get(t.kind, 0), "price": price, "odds": t.odds})
    return out


async def shop_view(db: AsyncSession, user: User) -> dict:
    """offers + chests + (Phase B) the wardrobe items for coins / gems from the ONE catalogue, and the Merchant"""
    wd = await WD.view(db, user)
    odds = {c["kind"]: c["odds"] for c in await chests_out(db, user.id)}
    offers = []
    for o in OFFERS:
        d = dict(o)
        if o["kind"] == "chest":
            d["odds"] = odds.get(o["id"].split("_", 1)[1])
        offers.append(d)
    items = [i for i in wd["items"] if i["tier"] in ("coin", "gem") and not i["limited"]]
    return {"items": items, "offers": offers, "merchant": wd["merchant"],
            "premium": [i for i in wd["items"] if i["tier"] == "premium"],
            # Phase D: the real-money store (all "Coming soon" while settings.payments_enabled is off)
            "store": await PAY.store_view(db, user, SS.season_id())}


async def buy(db: AsyncSession, user: User, item_id: str | None, offer_id: str | None) -> dict:
    w = await W.get_wallet(db, user.id)
    out: dict = {"ok": True}
    if item_id:
        r = await WD.buy_item(db, user, item_id)   # Phase B: the one wardrobe catalogue decides the price
        out["owned_item"] = r["owned_item"]
    elif offer_id:
        o = OFFER_BY_ID.get(offer_id)
        if o is None:
            raise ApiError(404, "not_found", "unknown offer")
        if offer_id == "hearts_full" and w.hearts >= w.hearts_max:
            raise ApiError(409, "hearts_full", "your hearts are already full")
        if offer_id == "freeze":
            st = await engage.get_streak(db, user.id)
            if st.freezes >= engage.FREEZES_MAX:
                raise ApiError(409, "max_freezes", "you already hold 2 Frost Wards")
            if engage.live_streak(st, local_day(user.timezone)) <= 0:
                raise ApiError(409, "streak_not_alive", "Frost Wards protect a burning Hearthfire; start one first")
        cur, price = next(iter(o["price"].items()))
        W.change(db, w, cur, -price, "shop_offer", offer_id)
        if offer_id == "hearts_full":
            W.change(db, w, "hearts", w.hearts_max - w.hearts, "shop_offer", offer_id)
        elif offer_id == "elixir_1":
            W.change(db, w, "elixir", 1, "shop_offer", offer_id)
        elif offer_id == "elixir_3":
            W.change(db, w, "elixir", 3, "shop_offer", offer_id)
        elif offer_id == "coin_sack":
            W.change(db, w, "coins", 1000, "shop_offer", offer_id)
        elif offer_id == "xp_boost":
            now = utcnow()
            base = user.xp_boost_until if (user.xp_boost_until and user.xp_boost_until > now) else now
            user.xp_boost_until = base + XP_BOOST
        elif offer_id == "freeze":
            st.freezes += 1
        elif offer_id.startswith("chest_"):
            await W.add_chest(db, user.id, offer_id.split("_", 1)[1], 1)
        out["offer_id"] = offer_id
    else:
        raise ApiError(422, "bad_request", "give item_id or offer_id")
    await db.flush()
    out["wallet"] = W.wallet_out(w)
    out["inventory"] = await inventory(db, user)
    return out


def roll(odds: list[dict]) -> dict:
    reward: dict = {}
    for line in odds:
        if RNG.random() >= line.get("chance", 1.0):
            continue
        amount = line["amount"] if "amount" in line else RNG.randint(line["min"], line["max"])
        key = "potion" if line["reward"] == "elixir" else line["reward"]
        reward[key] = reward.get(key, 0) + amount
    return reward


async def open_chest(db: AsyncSession, user: User, kind: str) -> dict:
    t = await db.get(ChestType, kind)
    if t is None:
        raise ApiError(404, "not_found", "unknown chest")
    row = await db.get(UserChest, (user.id, kind), with_for_update=True)
    if row is None or row.count <= 0:
        raise ApiError(409, "no_chest", "you have no chest of that kind")
    row.count -= 1
    reward = roll(t.odds)
    w = await W.get_wallet(db, user.id)
    await W.grant(db, w, reward, "chest", kind)
    db.add(ChestOpen(user_id=user.id, kind=kind, reward=reward))
    await db.flush()
    return {"kind": kind, "reward": reward, "wallet": W.wallet_out(w), "remaining": row.count}


async def inventory(db: AsyncSession, user: User) -> dict:
    items = (await db.execute(select(UserItem, Item.slot).join(Item, Item.id == UserItem.item_id)
                              .where(UserItem.user_id == user.id, Item.active.is_(True))
                              .order_by(Item.slot, Item.sort, UserItem.item_id))).all()
    look = user.look or DEFAULT_LOOK
    chests = {c["kind"]: c["owned"] for c in await chests_out(db, user.id)}
    st = await engage.get_streak(db, user.id)
    return {"items": [{"item_id": ui.item_id, "slot": slot, "source": ui.source,
                       "acquired_at": ui.acquired_at.isoformat() if ui.acquired_at else None} for ui, slot in items],
            "equipped": {s: look.get(s) for s in DEFAULT_EQUIP}, "look": look, "chests": chests,
            "freezes": st.freezes, "xpBoostUntil": ms(user.xp_boost_until) or 0}


async def equip(db: AsyncSession, user: User, slot: str, item_id: str | None) -> dict:
    """Phase B: wearing an item changes the look on the account, which the 3D wardrobe and hero load"""
    await WD.set_slot(db, user, slot, item_id)
    return await inventory(db, user)
