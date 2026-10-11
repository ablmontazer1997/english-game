"""Phase D (admin msg 4839): English Spell's own real-money store, behind ONE switch.

Decision 1 = D: no real-money payment for now. Everything is built (products, starter pack rules, premium and the
Season Pass premium track, fulfilment), but:
- `settings.payments_enabled` is False, so `checkout` answers 503 `payments_disabled` ("Coming soon");
- no provider adapter is registered. Turning payments on later = write one adapter class (create_checkout + verify),
  register it in ADAPTERS, set RUNECAST_PAYMENT_PROVIDER and RUNECAST_PAYMENTS_ENABLED=true. Nothing else changes.

🔴 English Spell is independent: never Bingual's subscription, accounts or payment provider.
"""
from datetime import timedelta
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import catalog as C
from ..config import get_settings
from ..errors import ApiError
from ..models import Purchase, User, UserItem
from ..timeutil import ms, utcnow
from . import wallet as W


class PaymentAdapter(Protocol):
    """What a real provider must implement. `create_checkout` starts a payment for a pending Purchase and returns what
    the app needs to continue (a redirect URL or a store product id); `verify` checks a provider callback/receipt and
    returns the provider reference when it is genuinely paid (None when it is not)."""
    name: str

    async def create_checkout(self, purchase: Purchase, product: dict, user: User) -> dict: ...

    async def verify(self, purchase: Purchase, payload: dict) -> str | None: ...


ADAPTERS: dict[str, PaymentAdapter] = {}   # empty on purpose: no provider is wired (decision 1 = D)


def register(adapter: PaymentAdapter):
    ADAPTERS[adapter.name] = adapter


def enabled() -> bool:
    s = get_settings()
    return bool(s.payments_enabled and s.payment_provider in ADAPTERS)


def adapter() -> PaymentAdapter:
    if not enabled():
        raise ApiError(503, "payments_disabled", "Coming soon: purchases are not open yet")
    return ADAPTERS[get_settings().payment_provider]


# ---------------------------------------------------------------- eligibility + the store view
async def _done(db: AsyncSession, user_id, sku: str) -> bool:
    q = select(Purchase.id).where(Purchase.user_id == user_id, Purchase.sku == sku, Purchase.status == "completed")
    return (await db.execute(q.limit(1))).scalar_one_or_none() is not None


async def starter_state(db: AsyncSession, user: User) -> dict:
    ends = user.created_at + timedelta(days=C.STARTER_DAYS) if user.created_at else None
    bought = await _done(db, user.id, "starter_pack")
    return {"eligible": bool(ends and utcnow() < ends and not bought), "ends_at": ms(ends), "bought": bought}


def premium_active(user: User) -> bool:
    return bool(user.premium_until and user.premium_until > utcnow())


def product_out(p: dict, on: bool) -> dict:
    d = {k: v for k, v in p.items()}
    d["price_label"] = p.get("price_label") if on else None   # "TBD" until a provider and prices exist
    d["available"] = on
    d["cta"] = "Buy" if on else "Coming soon"
    return d


async def store_view(db: AsyncSession, user: User, season_id: str) -> dict:
    on = enabled()
    theme = C.theme_for(season_id)
    st = await starter_state(db, user)
    products = []
    for p in C.PRODUCTS:
        if p["kind"] == "starter" and not st["eligible"]:
            continue
        products.append(product_out(p, on))
    return {"payments_enabled": on, "products": products, "starter": st,
            "premium": {"active": premium_active(user), "until": ms(user.premium_until),
                        "cloaks": C.PREMIUM_CLOAKS, "set": {"name": theme["name"], "season_id": season_id,
                                                            "items": [s[0] for s in theme["set"]]}},
            "starter_items": [s[0] for s in C.STARTER_SET], "starter_gems": C.STARTER_GEMS}


# ---------------------------------------------------------------- checkout + fulfilment (unused while switched off)
async def checkout(db: AsyncSession, user: User, product_id: str) -> dict:
    p = C.PRODUCT_BY_ID.get(product_id)
    if p is None:
        raise ApiError(404, "not_found", "unknown product")
    ad = adapter()   # 503 payments_disabled while the switch is off
    if p["kind"] == "starter":
        st = await starter_state(db, user)
        if not st["eligible"]:
            raise ApiError(409, "not_eligible", "the Starter Pack is for the first week, once")
    pur = Purchase(user_id=user.id, provider=ad.name, sku=p["id"], status="pending")
    db.add(pur)
    await db.flush()
    return {"purchase_id": str(pur.id), **(await ad.create_checkout(pur, p, user))}


async def _grant_item(db, user_id, iid: str, source: str):
    if await db.get(UserItem, (user_id, iid)) is None:
        db.add(UserItem(user_id=user_id, item_id=iid, source=source))


async def premium_catch_up(db: AsyncSession, user: User, season_id: str) -> list[str]:
    """while premium is active, the cloaks and this month's set are owned (a new month adds the new set)"""
    if not premium_active(user):
        return []
    got = []
    for iid in C.PREMIUM_CLOAKS + [s[0] for s in C.theme_for(season_id)["set"]]:
        if await db.get(UserItem, (user.id, iid)) is None:
            db.add(UserItem(user_id=user.id, item_id=iid, source="premium"))
            got.append(iid)
    if got:
        await db.flush()
    return got


async def fulfil(db: AsyncSession, user: User, purchase: Purchase, provider_ref: str, season_id: str) -> dict:
    """grant what a VERIFIED purchase bought, exactly once (provider_ref is unique)."""
    if purchase.status == "completed":
        return {"already": True}
    p = C.PRODUCT_BY_ID[purchase.sku]
    if p["kind"] == "starter" and await _done(db, user.id, "starter_pack"):
        raise ApiError(409, "already_owned", "the Starter Pack was already bought")
    w = await W.get_wallet(db, user.id)
    granted: dict = {"gems": 0, "items": []}
    if p.get("gems"):
        W.change(db, w, "gems", int(p["gems"]), "purchase", purchase.sku)
        granted["gems"] = int(p["gems"])
    for iid in p.get("items", []):
        await _grant_item(db, user.id, iid, "purchase")
        granted["items"].append(iid)
    if p["kind"] == "premium":
        start = max(utcnow(), user.premium_until or utcnow())
        user.premium_until = start + timedelta(days=int(p.get("days") or C.PREMIUM_DAYS))
        await db.flush()
        granted["items"] += await premium_catch_up(db, user, season_id)
        granted["premium_until"] = ms(user.premium_until)
    if p["kind"] == "season":
        from . import season as S
        row = await S.progress_row(db, user, season_id)
        row.premium = True
        granted["season_premium"] = season_id
    purchase.status = "completed"
    purchase.provider_ref = provider_ref
    purchase.gems_granted = granted["gems"]
    await db.flush()
    return granted


async def confirm(db: AsyncSession, user: User, purchase_id, payload: dict, season_id: str) -> dict:
    ad = adapter()
    pur = await db.get(Purchase, purchase_id, with_for_update=True)
    if pur is None or pur.user_id != user.id:
        raise ApiError(404, "not_found", "unknown purchase")
    ref = await ad.verify(pur, payload)
    if not ref:
        pur.status = "failed"
        await db.flush()
        raise ApiError(402, "not_paid", "the payment was not completed")
    out = await fulfil(db, user, pur, ref, season_id)
    w = await W.get_wallet(db, user.id)
    return {"granted": out, "wallet": W.wallet_out(w)}
