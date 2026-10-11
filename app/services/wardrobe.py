"""Phase B (UX audit 10-11): the wardrobe on the server.

- ONE catalogue (catalog.py, table `items`) for the 3D wardrobe, the shop and the Wandering Merchant.
- Ownership in user_items; the look the player wears lives on the account (users.look) and is loaded on any device.
- Every price and every deduction is decided here; the client only asks.
- Fairness: accounts that existed before this (users.look_legacy) keep everything they wear on their first upload,
  and every account gets the starter set.
"""
import random
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import catalog as C
from ..errors import ApiError
from ..models import Item, LeagueMembership, Streak, User, UserItem, World
from ..timeutil import local_day, local_midnight_utc, ms, week_start
from . import wallet as W

TONES = 10
_MERCHANT_EPOCH = date(2026, 1, 5)   # a Monday: merchant week 0


# ---------------------------------------------------------------- reads
async def active_items(db: AsyncSession) -> list[Item]:
    return list((await db.execute(select(Item).where(Item.active.is_(True)).order_by(Item.sort, Item.id))).scalars())


async def owned_ids(db: AsyncSession, user_id) -> set[str]:
    return set((await db.execute(select(UserItem.item_id).where(UserItem.user_id == user_id))).scalars())


async def _drop_worlds(db: AsyncSession) -> dict[str, World]:
    rows = (await db.execute(select(World).where(World.boss_drop_item_id.is_not(None)))).scalars()
    return {w.boss_drop_item_id: w for w in rows}


def how_text(it: Item, world: World | None) -> str:
    if it.tier == "boss":
        if world is not None:
            return f"Defeat the {world.level} World {world.index} boss"
        return "Defeat a world boss"
    return it.how or ""


def item_out(it: Item, owned: set[str], worlds: dict[str, World], merchant: set[str]) -> dict:
    limited = it.id in C.MERCHANT_ONLY
    buyable = it.tier in ("coin", "gem") and it.id not in owned and (not limited or it.id in merchant)
    d = {"id": it.id, "name": it.name, "slot": it.slot, "tier": it.tier, "rarity": it.rarity,
         "price_gems": it.price_gems, "price_coins": it.price_coins, "theme": it.theme, "owned": it.id in owned,
         "is_default": it.is_default, "how": how_text(it, worlds.get(it.id)), "buyable": buyable,
         "limited": limited, "in_merchant": it.id in merchant}
    if it.is_new and it.base_mesh:
        d["recolour"] = {"base": it.base_mesh, "swatch": it.recolour}
    if it.tier == "boss" and it.id in worlds:
        w = worlds[it.id]
        d["world"] = {"id": w.id, "level": w.level, "index": w.index, "global_index": w.global_index}
    return d


# ---------------------------------------------------------------- grants
async def grant(db: AsyncSession, user_id, item_id: str, source: str) -> Item | None:
    """give an item once; returns the item when it is new for the player"""
    if await db.get(UserItem, (user_id, item_id)) is not None:
        return None
    it = await db.get(Item, item_id)
    if it is None:
        return None
    db.add(UserItem(user_id=user_id, item_id=item_id, source=source))
    await db.flush()
    return it


async def ensure_starter(db: AsyncSession, user: User, owned: set[str] | None = None) -> set[str]:
    """every account owns the whole starter set (old accounts got a different first free list)"""
    owned = owned if owned is not None else await owned_ids(db, user.id)
    free = (await db.execute(select(Item.id).where(Item.tier == "free", Item.active.is_(True)))).scalars().all()
    for iid in free:
        if iid not in owned:
            db.add(UserItem(user_id=user.id, item_id=iid, source="free"))
            owned.add(iid)
    await db.flush()
    return owned


async def habit_rewards(db: AsyncSession, user: User, st: Streak | None = None) -> list[dict]:
    """streak (best Hearthfire) and league-promotion items; idempotent, so old accounts catch up too"""
    out = []
    st = st if st is not None else await db.get(Streak, user.id)
    best = max(st.best or 0, st.current or 0) if st else 0
    for days, iid in sorted(C.STREAK_REWARDS.items()):
        if best >= days:
            it = await grant(db, user.id, iid, "streak")
            if it:
                out.append({"item_id": it.id, "name": it.name, "slot": it.slot, "why": f"{days}-day Hearthfire"})
    promoted = (await db.execute(select(LeagueMembership.user_id).where(
        LeagueMembership.user_id == user.id, LeagueMembership.moved == 1).limit(1))).scalar_one_or_none()
    if promoted is not None:
        it = await grant(db, user.id, C.LEAGUE_PROMOTION_REWARD, "league")
        if it:
            out.append({"item_id": it.id, "name": it.name, "slot": it.slot, "why": "League promotion"})
    return out


# ---------------------------------------------------------------- the look
def _clean_tint(raw, owned: set[str], dyes: set[str]) -> dict:
    out = {}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        if not isinstance(k, str) or not isinstance(v, str) or v == "original":
            continue
        if v in C.DYE_SWATCHES and f"{k}:{v}" in dyes and k in owned:
            out[k] = v
    return out


def normalize(raw: dict | None, owned: set[str], by_id: dict[str, Item], dyes: set[str]) -> dict:
    """a look the player may wear: unknown, unowned or wrong-slot picks fall back to the starter item"""
    raw = raw if isinstance(raw, dict) else {}
    look = dict(C.DEFAULT_LOOK)
    look["body"] = "girl" if raw.get("body") == "girl" else "boy"
    try:
        look["tone"] = max(0, min(TONES - 1, int(raw.get("tone", look["tone"]))))
    except (TypeError, ValueError):
        pass
    try:
        look["blush"] = max(0, min(100, int(raw.get("blush", look["blush"]))))
    except (TypeError, ValueError):
        pass
    for slot in C.SLOTS:
        if slot not in raw:
            continue
        v = raw.get(slot)
        if v is None and slot in C.OPTIONAL_SLOTS:
            look[slot] = None
            continue
        it = by_id.get(v) if isinstance(v, str) else None
        if it is not None and it.slot == slot and it.active and v in owned:
            look[slot] = v
    look["tint"] = _clean_tint(raw.get("tint"), owned, dyes)
    return look


def worn_ids(raw: dict | None) -> list[str]:
    raw = raw if isinstance(raw, dict) else {}
    return [raw[s] for s in C.SLOTS if isinstance(raw.get(s), str)]


async def save_look(db: AsyncSession, user: User, raw: dict, migrate: bool = False) -> tuple[dict, list[str]]:
    """store the look. migrate=True is the app's first upload of a look kept only in the browser:
    - the server already has a look -> the server's look wins (nothing changes);
    - an account from before server ownership -> everything it wears now (and its dyes) becomes owned ("legacy")."""
    granted: list[str] = []
    if migrate and user.look is not None:
        return user.look, granted
    owned = await ensure_starter(db, user)
    by_id = {i.id: i for i in await active_items(db)}
    dyes = set(user.dyes or [])
    if migrate and user.look_legacy:
        for iid in worn_ids(raw):
            it = by_id.get(iid)
            if it is not None and iid not in owned and it.slot in C.SLOTS:
                db.add(UserItem(user_id=user.id, item_id=iid, source="legacy"))
                owned.add(iid)
                granted.append(iid)
        tint = raw.get("tint") if isinstance(raw.get("tint"), dict) else {}
        for k, v in tint.items():
            if isinstance(k, str) and v in C.DYE_SWATCHES and k in owned:
                dyes.add(f"{k}:{v}")
        user.dyes = sorted(dyes)
        user.look_legacy = False
        await db.flush()
    look = normalize(raw, owned, by_id, dyes)
    user.look = look
    await db.flush()
    return look, granted


async def set_slot(db: AsyncSession, user: User, slot: str, item_id: str | None) -> dict:
    """wear one owned item (shop "Wear", My Items, a boss drop's "Wear now")"""
    if slot not in C.SLOTS:
        raise ApiError(422, "bad_slot", f"slot must be one of {C.SLOTS}")
    if item_id is None and slot not in C.OPTIONAL_SLOTS:
        item_id = C.DEFAULT_LOOK[slot]
    if item_id is not None:
        it = await db.get(Item, item_id)
        if it is None or it.slot != slot or not it.active:
            raise ApiError(422, "bad_item", "that item does not fit this slot")
        if await db.get(UserItem, (user.id, item_id)) is None:
            raise ApiError(403, "not_owned", "you do not own this item")
    base = dict(user.look or C.DEFAULT_LOOK)
    base[slot] = item_id
    look, _ = await save_look(db, user, base)
    return look


# ---------------------------------------------------------------- Wandering Merchant (7-day rotation)
def merchant_week(today: date) -> tuple[date, int]:
    wk = week_start(today)
    return wk, (wk - _MERCHANT_EPOCH).days // 7


def merchant_pick(today: date, items: list[Item]) -> tuple[list[str], dict]:
    """4 items a week (one of them an epic cloak 2 weeks in 3), the same for everyone, plus one set"""
    wk, n = merchant_week(today)
    rnd = random.Random(f"merchant:{wk.isoformat()}")
    limited = ["coat_royal", "coat_sea", None][n % 3]
    pool = sorted(i.id for i in items if i.tier in ("gem", "coin") and i.id not in C.MERCHANT_ONLY)
    gems = [i for i in pool if any(x.id == i and x.tier == "gem" for x in items)]
    picks = [limited] if limited else []
    first_gem = rnd.choice(gems) if gems else None
    if first_gem:
        picks.append(first_gem)
    rest = [i for i in pool if i not in picks]
    picks += rnd.sample(rest, max(0, 4 - len(picks)))
    return picks[:4], C.MERCHANT_SETS[n % len(C.MERCHANT_SETS)]


def set_price(s: dict, owned: set[str], by_id: dict[str, Item]) -> tuple[int, int]:
    """(price, full) in gems for the set's items the player does not own yet; coin items count at 100 coins = 1 gem"""
    full = 0
    for iid in s["items"]:
        it = by_id.get(iid)
        if it is None or iid in owned:
            continue
        full += it.price_gems or round((it.price_coins or 0) / 100)
    price = int(round(full * C.SET_DISCOUNT / 5.0) * 5)
    return price, full


async def merchant_view(db: AsyncSession, user: User, items: list[Item] | None = None,
                        owned: set[str] | None = None, worlds=None) -> dict:
    items = items if items is not None else await active_items(db)
    owned = owned if owned is not None else await owned_ids(db, user.id)
    worlds = worlds if worlds is not None else await _drop_worlds(db)
    today = local_day(user.timezone)
    picks, s = merchant_pick(today, items)
    by_id = {i.id: i for i in items}
    wk, _ = merchant_week(today)
    price, full = set_price(s, owned, by_id)
    mset = set(picks) | set(s["items"])
    return {"ends_at": ms(local_midnight_utc(user.timezone, wk + timedelta(days=7))),
            "items": [item_out(by_id[i], owned, worlds, mset) for i in picks if i in by_id],
            "set": {"id": s["id"], "name": s["name"], "price_gems": price, "full_gems": full,
                    "owned_all": price == 0 and full == 0,
                    "items": [item_out(by_id[i], owned, worlds, mset) for i in s["items"] if i in by_id]}}


# ---------------------------------------------------------------- the whole wardrobe for the client
async def view(db: AsyncSession, user: User) -> dict:
    await habit_rewards(db, user)
    owned = await ensure_starter(db, user)
    items = await active_items(db)
    worlds = await _drop_worlds(db)
    merch = await merchant_view(db, user, items, owned, worlds)
    mset = {i["id"] for i in merch["items"]} | {i["id"] for i in merch["set"]["items"]}
    return {"items": [item_out(i, owned, worlds, mset) for i in items],
            "look": user.look, "look_saved": user.look is not None, "legacy": bool(user.look_legacy),
            "dyes": list(user.dyes or []), "dye": {"price_coins": C.DYE_PRICE_COINS, "swatches": C.DYE_SWATCHES},
            "merchant": merch, "default_look": C.DEFAULT_LOOK}


# ---------------------------------------------------------------- buying
async def buy_item(db: AsyncSession, user: User, item_id: str, wear: bool = False) -> dict:
    it = await db.get(Item, item_id)
    if it is None or not it.active:
        raise ApiError(404, "not_found", "unknown item")
    if it.tier not in ("coin", "gem"):
        raise ApiError(409, "not_for_sale", {"boss": "boss treasures are won, never sold",
                                             "earned": "this item is earned, never sold",
                                             "premium": "Premium items are coming soon"}.get(it.tier, "not for sale"))
    if await db.get(UserItem, (user.id, item_id)) is not None:
        raise ApiError(409, "already_owned")
    if item_id in C.MERCHANT_ONLY:
        picks, s = merchant_pick(local_day(user.timezone), await active_items(db))
        if item_id not in picks and item_id not in s["items"]:
            raise ApiError(409, "not_in_merchant", "the Wandering Merchant does not carry this item this week")
    w = await W.get_wallet(db, user.id)
    if it.tier == "coin":
        W.change(db, w, "coins", -int(it.price_coins or 0), "wardrobe_item", item_id)
    else:
        W.change(db, w, "gems", -int(it.price_gems or 0), "wardrobe_item", item_id)
    db.add(UserItem(user_id=user.id, item_id=item_id, source="shop"))
    await db.flush()
    out = {"ok": True, "owned_item": item_id, "wallet": W.wallet_out(w)}
    if wear:
        out["look"] = await set_slot(db, user, it.slot, item_id)
    return out


async def buy_set(db: AsyncSession, user: User, set_id: str) -> dict:
    items = await active_items(db)
    picks, s = merchant_pick(local_day(user.timezone), items)
    if s["id"] != set_id:
        raise ApiError(409, "not_in_merchant", "the Wandering Merchant does not carry this set this week")
    owned = await owned_ids(db, user.id)
    by_id = {i.id: i for i in items}
    price, full = set_price(s, owned, by_id)
    if full == 0:
        raise ApiError(409, "already_owned", "you own every item of this set")
    w = await W.get_wallet(db, user.id)
    W.change(db, w, "gems", -price, "merchant_set", set_id)
    got = []
    for iid in s["items"]:
        if iid not in owned and iid in by_id:
            db.add(UserItem(user_id=user.id, item_id=iid, source="merchant"))
            got.append(iid)
    await db.flush()
    return {"ok": True, "owned_items": got, "price_gems": price, "wallet": W.wallet_out(w)}


async def buy_dye(db: AsyncSession, user: User, garment: str, swatch: str) -> dict:
    if swatch not in C.DYE_SWATCHES:
        raise ApiError(422, "bad_swatch", f"swatch must be one of {C.DYE_SWATCHES}")
    it = await db.get(Item, garment)
    if it is None or it.slot not in C.GARMENT_SLOTS or not it.active:
        raise ApiError(422, "bad_item", "only garments (hat, top, cloak, trousers, boots) take a dye")
    if it.is_new:
        raise ApiError(409, "not_dyeable", "this treasure keeps its own colour")
    if await db.get(UserItem, (user.id, garment)) is None:
        raise ApiError(403, "not_owned", "you do not own this item")
    key = f"{garment}:{swatch}"
    dyes = set(user.dyes or [])
    if key in dyes:
        raise ApiError(409, "already_owned")
    w = await W.get_wallet(db, user.id)
    W.change(db, w, "coins", -C.DYE_PRICE_COINS, "dye", key)
    dyes.add(key)
    user.dyes = sorted(dyes)
    await db.flush()
    return {"ok": True, "dye": key, "dyes": user.dyes, "wallet": W.wallet_out(w)}
