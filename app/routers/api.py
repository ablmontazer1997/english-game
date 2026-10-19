import hashlib
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .. import catalog as C
from ..catalog import DEFAULT_EQUIP, STARTING_WALLET
from ..curriculum import LEVEL_ORD, LEVELS
from ..db import get_db
from ..errors import ApiError
from ..models import GrammarTopic, LoginAttempt, LoginCode, Item, Level, Question, Streak, User, UserEquipment, UserItem, Wallet, WalletTx
from ..schemas import (BuyIn, CheckoutIn, CompleteIn, ContinueIn, DyeIn, EquipIn, GuestIn, LedgerRow, LevelOut,
                       LookIn, MeOut, MePatch, ReviewIn, SetIn, StartOut, TokenOut, WalletOut, WardrobeBuyIn,
                       ConfirmIn, PushSubIn, PushUnsubIn, SeasonClaimIn, RedeemIn, RedeemOut, LoginIn)
from ..passwords import verify_password
from ..security import current_user, make_token
from ..services import achievements as ach
from ..services import engage, play, shop
from ..services import events as EV
from ..services import payments as PAY
from ..services import push as PUSH
from ..services import season as SS
from ..services import wardrobe as WD
from ..services import wallet as W
from ..services.content import map_for
from ..timeutil import local_day, utcnow, valid_tz

router = APIRouter(prefix="/v1")


async def _streak_now(db, user) -> int:
    st = await db.get(Streak, user.id)
    return engage.live_streak(st, local_day(user.timezone)) if st else 0


# ---------------------------------------------------------------- auth
async def new_player(db: AsyncSession, *, device_id: str | None, kind: str = "guest", display_name: str | None = None,
                     tz: str | None = None, level: str | None = None) -> User:
    """a fresh player: wallet with the starting amounts, the free items worn, an empty streak (guest or account)"""
    tz = tz if tz and valid_tz(tz) else "Asia/Tehran"
    user = User(device_id=device_id, kind=kind, display_name=display_name or "Apprentice",
                timezone=tz, level=level or "A1", player_level=1, xp=0, xp_to_next=800, xp_total=0,
                league_opt_in=True)
    db.add(user)
    await db.flush()
    w = Wallet(user_id=user.id, gems=0, coins=0, hearts=STARTING_WALLET["hearts"],
               hearts_max=STARTING_WALLET["hearts_max"], elixir=0)
    db.add(w)
    await db.flush()
    for cur in ("gems", "coins", "elixir"):
        W.change(db, w, cur, STARTING_WALLET[cur], "signup")
    free = (await db.execute(select(Item.id).where(Item.tier == "free", Item.active.is_(True)))).scalars().all()
    for iid in free:
        db.add(UserItem(user_id=user.id, item_id=iid, source="free"))
    await db.flush()
    for slot, iid in DEFAULT_EQUIP.items():
        if iid in free:
            db.add(UserEquipment(user_id=user.id, slot=slot, item_id=iid))
    db.add(Streak(user_id=user.id, current=0, best=0, freezes=0, freezes_used=0))
    return user


@router.post("/auth/guest", response_model=TokenOut, tags=["auth"],
             summary="Create or resume a guest account for a device and get a JWT")
async def auth_guest(body: GuestIn, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.device_id == body.device_id))).scalar_one_or_none()
    created = False
    if user is None:
        created = True
        user = await new_player(db, device_id=body.device_id, display_name=body.display_name, tz=body.timezone,
                                level=body.level)
    user.last_seen_at = utcnow()
    await db.commit()
    await db.refresh(user)
    tok, exp = make_token(user.id)
    return {"token": tok, "expires_at": exp.isoformat(), "created": created,
            "user": play.me_out(user, await _streak_now(db, user))}


# admin 6018: username + password. Failed tries per username / per IP in a sliding window are capped (429).
LOGIN_WINDOW = timedelta(minutes=15)
LOGIN_MAX_PER_USER = 5
LOGIN_MAX_PER_IP = 20


def _client_ip(request: Request) -> str:
    h = request.headers
    ip = h.get("cf-connecting-ip") or (h.get("x-forwarded-for") or "").split(",")[0].strip()
    return (ip or (request.client.host if request.client else ""))[:64]


@router.post("/auth/login", response_model=TokenOut, tags=["auth"],
             summary="Sign in with a username and password and get a JWT on that account")
async def auth_login(body: LoginIn, request: Request, db: AsyncSession = Depends(get_db)):
    name = body.username.strip().lower()[:64]
    ip = _client_ip(request)
    now = utcnow()
    since = now - LOGIN_WINDOW
    await db.execute(delete(LoginAttempt).where(LoginAttempt.at < now - timedelta(days=1)))
    by_user = (await db.execute(select(func.count()).select_from(LoginAttempt).where(
        LoginAttempt.username == name, LoginAttempt.ok.is_(False), LoginAttempt.at > since))).scalar_one()
    by_ip = (await db.execute(select(func.count()).select_from(LoginAttempt).where(
        LoginAttempt.ip == ip, LoginAttempt.ok.is_(False), LoginAttempt.at > since))).scalar_one() if ip else 0
    if by_user >= LOGIN_MAX_PER_USER or by_ip >= LOGIN_MAX_PER_IP:
        await db.commit()
        raise ApiError(429, "too_many_attempts", "Too many tries. Wait 15 minutes and try again.")
    user = (await db.execute(select(User).where(User.username == name))).scalar_one_or_none()
    ok = await verify_password(body.password, user.password_hash if user else None)
    db.add(LoginAttempt(username=name, ip=ip, ok=ok))
    if not ok or user is None:
        await db.commit()
        raise ApiError(401, "bad_login", "Wrong username or password")
    user.last_seen_at = now
    await db.commit()
    await db.refresh(user)
    tok, exp = make_token(user.id)
    return {"token": tok, "expires_at": exp.isoformat(), "created": False,
            "user": play.me_out(user, await _streak_now(db, user))}


@router.post("/auth/redeem", response_model=RedeemOut, tags=["auth"],
             summary="Trade a single-use sign-in code for a JWT on its account (Android app sign-in link)")
async def auth_redeem(body: RedeemIn, db: AsyncSession = Depends(get_db)):
    h = hashlib.sha256(body.code.strip().encode()).hexdigest()
    now = utcnow()
    uid = (await db.execute(update(LoginCode).where(LoginCode.code_hash == h, LoginCode.used_at.is_(None),
                                                    LoginCode.expires_at > now)
                            .values(used_at=now).returning(LoginCode.user_id))).scalar_one_or_none()
    user = await db.get(User, uid) if uid else None
    if user is None:
        await db.rollback()
        raise ApiError(401, "bad_code", "This sign-in link is invalid, used or expired")
    user.last_seen_at = now
    await db.commit()
    await db.refresh(user)
    tok, exp = make_token(user.id)
    return {"token": tok, "expires_at": exp.isoformat(), "created": False, "device_id": user.device_id,
            "user": play.me_out(user, await _streak_now(db, user))}


@router.get("/me", response_model=MeOut, tags=["auth"])
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return play.me_out(user, await _streak_now(db, user))


@router.patch("/me", response_model=MeOut, tags=["auth"])
async def me_patch(body: MePatch, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if body.display_name is not None:
        name = play.clean_name(body.display_name)
        if name is None:
            raise ApiError(422, "bad_name", "use 2 to 20 letters or numbers")
        user.display_name = name
    if body.timezone is not None:
        if not valid_tz(body.timezone):
            raise ApiError(422, "bad_timezone", "use an IANA zone like Asia/Tehran")
        user.timezone = body.timezone
    if body.league_opt_in is not None:
        user.league_opt_in = body.league_opt_in
    if body.level is not None:
        user.level = body.level
    if body.daily_goal is not None:
        user.daily_goal = body.daily_goal
        await engage.apply_daily_goal(db, user)
    if body.flags is not None:
        user.flags = play.merge_flags(user.flags, body.flags)
    if body.onboarded and user.onboarded_at is None:
        user.onboarded_at = utcnow()
    await db.commit()
    return play.me_out(user, await _streak_now(db, user))


# ---------------------------------------------------------------- map & content
@router.get("/levels", response_model=list[LevelOut], tags=["map"])
async def levels(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Level).order_by(Level.ordinal))).scalars().all()
    return [{"code": lv.code, "ordinal": lv.ordinal, "title": lv.title, "world_count": lv.world_count,
             "unlocked": lv.ordinal <= LEVEL_ORD[user.level], "current": lv.code == user.level} for lv in rows]


@router.get("/map/{level}", tags=["map"], summary="Worlds, stages and this player's state for one level")
async def map_level(level: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if level not in LEVEL_ORD:
        raise ApiError(404, "not_found", f"level must be one of {[c for c, _, _ in LEVELS]}")
    return await map_for(db, user, level)


@router.get("/topics/{topic_id}", tags=["map"], summary="Spellbook page for a grammar topic")
async def topic(topic_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    t = await db.get(GrammarTopic, topic_id)
    if t is None:
        raise ApiError(404, "not_found", "unknown topic")
    d = t.data or {}
    return {"id": t.id, "level": t.level, "title": t.title, "summary": t.summary, "category": t.category,
            "kind": t.kind, "covers": t.covers, "precursors": t.precursors,
            "explanation": d.get("explanation", ""), "rules": d.get("rules", []), "examples": d.get("examples", []),
            "when_to_use": d.get("whenToUse", []), "common_mistakes": d.get("commonMistakes", []),
            "contrast_with": d.get("contrastWith", ""), "quiz": d.get("quiz", []),
            "estimated_minutes": d.get("estimatedMinutes")}


# ---------------------------------------------------------------- play
@router.post("/stages/{stage_id}/start", response_model=StartOut, response_model_by_alias=True, tags=["play"])
async def stage_start(stage_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await play.start_stage(db, user, stage_id)
    await db.commit()
    return out


@router.post("/sessions/{session_id}/complete", tags=["play"],
             summary="Finish a stage: the server grades, awards and updates SRS")
async def session_complete(session_id: uuid.UUID, body: CompleteIn, user: User = Depends(current_user),
                           db: AsyncSession = Depends(get_db)):
    out = await play.complete(db, user, session_id, [a.model_dump() for a in body.answers], body.hints_used,
                              body.use_elixir, body.focus)
    await db.commit()
    return out


@router.post("/sessions/{session_id}/continue", tags=["play"],
             summary="'+3 questions' after a lost trial / boss / vault: 1 elixir or 10 gems, once per session")
async def session_continue(session_id: uuid.UUID, body: ContinueIn, user: User = Depends(current_user),
                           db: AsyncSession = Depends(get_db)):
    out = await play.continue_session(db, user, session_id, body.pay)
    await db.commit()
    return out


@router.get("/hints", tags=["play"], summary="Hints left free today (3 a day, then 20 coins each)")
async def hints(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = play.hints_state(await engage.day_stat(db, user))
    await db.commit()
    return out


@router.post("/hints/use", tags=["play"], summary="A hint the game just applied: free 3 a day, then 20 coins")
async def hint_use(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await play.use_hint(db, user)
    await db.commit()
    return out


@router.get("/review/today", tags=["review"], summary="Overnight Cauldron: items due by the end of the local day")
async def review_today(limit: int = Query(25, ge=1, le=100), user: User = Depends(current_user),
                       db: AsyncSession = Depends(get_db)):
    return await play.review_today(db, user, limit)


@router.post("/review/submit", tags=["review"])
async def review_submit(body: ReviewIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await play.review_submit(db, user, [a.model_dump() for a in body.answers])
    await db.commit()
    return out


# ---------------------------------------------------------------- wallet & shop
@router.get("/wallet", response_model=WalletOut, tags=["wallet"])
async def wallet(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    w = await W.get_wallet(db, user.id)
    out = W.wallet_out(w)
    await db.commit()
    return out


@router.get("/wallet/ledger", response_model=list[LedgerRow], tags=["wallet"])
async def ledger(limit: int = Query(50, ge=1, le=500), user: User = Depends(current_user),
                 db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(WalletTx).where(WalletTx.user_id == user.id).order_by(WalletTx.id.desc())
                             .limit(limit))).scalars().all()
    return [{"id": r.id, "currency": r.currency, "delta": r.delta, "balance_after": r.balance_after,
             "reason": r.reason, "ref": r.ref, "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/shop", tags=["shop"])
async def shop_list(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await shop.shop_view(db, user)


@router.post("/shop/buy", tags=["shop"], summary="Buy a gem-shop item or an offer (gems/coins only)")
async def shop_buy(body: BuyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await shop.buy(db, user, body.item_id, body.offer_id)
    await db.commit()
    return out


@router.get("/chests", tags=["shop"], summary="Chest kinds with published odds and how many you hold")
async def chests(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await shop.chests_out(db, user.id)


@router.post("/chests/{kind}/open", tags=["shop"])
async def chest_open(kind: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await shop.open_chest(db, user, kind)
    await db.commit()
    return out


@router.get("/payments/skus", tags=["payments"], summary="Real-money products (all 'Coming soon' while payments are off)")
async def skus():
    on = PAY.enabled()
    return [PAY.product_out(p, on) for p in C.PRODUCTS]


@router.get("/store", tags=["payments"],
            summary="The real-money store: gem packs, Starter Pack (first week, once), Archmage Circle, Season Pass")
async def store(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await PAY.store_view(db, user, SS.season_id())
    await db.commit()
    return out


@router.post("/payments/checkout", tags=["payments"],
             summary="Start a purchase. 503 payments_disabled until settings.payments_enabled + a provider adapter")
async def checkout(body: CheckoutIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await PAY.checkout(db, user, body.product_id or body.sku or "")
    await db.commit()
    return out


@router.post("/payments/confirm", tags=["payments"], summary="Verify a payment with the provider and grant it once")
async def payment_confirm(body: ConfirmIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    try:
        pid = uuid.UUID(body.purchase_id)
    except ValueError:
        raise ApiError(404, "not_found", "unknown purchase")
    out = await PAY.confirm(db, user, pid, body.payload, SS.season_id())
    await db.commit()
    return out


# ---------------------------------------------------------------- Season Pass (Phase D)
@router.get("/events", tags=["engagement"],
            summary="The weekly events (Boss Rush Sat+Sun, Double XP Wed, player's local days): active or next, with bounds")
async def events(user: User = Depends(current_user)):
    return EV.view(user)


@router.get("/season", tags=["engagement"], summary="This month's Season Pass: XP, 30 tiers, free + premium tracks")
async def season(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await SS.view(db, user)
    await db.commit()
    return out


@router.post("/season/claim", tags=["engagement"], summary="Claim a reached tier (free now; premium when bought)")
async def season_claim(body: SeasonClaimIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    got, w = await SS.claim(db, user, body.tier, body.track)
    out = {"reward": got, "wallet": W.wallet_out(w), "season": await SS.view(db, user)}
    await db.commit()
    return out


# ---------------------------------------------------------------- Web Push reminders (Phase D, English Spell's own)
@router.get("/push/key", tags=["engagement"], summary="The VAPID public key for the browser (no auth)")
async def push_key():
    from ..config import get_settings
    return {"enabled": PUSH.configured(), "public_key": get_settings().vapid_public_key or None}


@router.get("/push/status", tags=["engagement"])
async def push_status(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await PUSH.status(db, user)


@router.post("/push/subscribe", tags=["engagement"], summary="Save this browser's push subscription")
async def push_subscribe(body: PushSubIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await PUSH.subscribe(db, user, body.endpoint, body.keys.p256dh, body.keys.auth, body.user_agent)
    await db.commit()
    return out


@router.post("/push/unsubscribe", tags=["engagement"], summary="Turn reminders off (this browser, or all when empty)")
async def push_unsubscribe(body: PushUnsubIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await PUSH.unsubscribe(db, user, body.endpoint)
    await db.commit()
    return out


# ---------------------------------------------------------------- inventory
@router.get("/inventory", tags=["inventory"])
async def inventory(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await shop.inventory(db, user)


@router.put("/inventory/equip", tags=["inventory"])
async def equip(body: EquipIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await shop.equip(db, user, body.slot, body.item_id)
    await db.commit()
    return out


@router.get("/catalog/items", tags=["inventory"], summary="The whole wardrobe catalogue (no auth)")
async def catalog_items(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Item).where(Item.active.is_(True)).order_by(Item.sort, Item.id))).scalars().all()
    return [{"id": i.id, "name": i.name, "slot": i.slot, "tier": i.tier, "rarity": i.rarity,
             "price_gems": i.price_gems, "price_coins": i.price_coins, "how": i.how,
             "world_drop": i.world_drop, "drop_stage_id": i.drop_stage_id,
             "theme": i.theme, "is_new": i.is_new, "base_mesh": i.base_mesh, "recolour": i.recolour,
             "is_default": i.is_default, "active": i.active, "notes": i.notes} for i in rows]


# ---------------------------------------------------------------- wardrobe (Phase B: ownership on the server)
@router.get("/wardrobe", tags=["inventory"],
            summary="The one catalogue with ownership, prices and how to earn, the saved look, dyes and the Merchant")
async def wardrobe(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await WD.view(db, user)
    await db.commit()
    return out


@router.put("/wardrobe/look", tags=["inventory"],
            summary="Save the look on the account (unowned picks fall back); migrate=true = first upload from the browser")
async def wardrobe_look(body: LookIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    look, granted = await WD.save_look(db, user, body.look, body.migrate)
    await db.commit()
    return {"look": look, "granted": granted}


@router.post("/wardrobe/buy", tags=["inventory"], summary="Buy a coin / gem item in place (server price), optionally wear it")
async def wardrobe_buy(body: WardrobeBuyIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await WD.buy_item(db, user, body.item_id, body.wear)
    await db.commit()
    return out


@router.post("/wardrobe/dye", tags=["inventory"], summary="Dye one owned garment one colour for good (150 coins)")
async def wardrobe_dye(body: DyeIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await WD.buy_dye(db, user, body.garment, body.swatch)
    await db.commit()
    return out


@router.get("/merchant", tags=["shop"], summary="The Wandering Merchant: 4 items + 1 set, rotating every Monday")
async def merchant(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await WD.merchant_view(db, user)


@router.post("/merchant/buy-set", tags=["shop"], summary="Buy this week's set (20% off the items you do not own)")
async def merchant_set(body: SetIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await WD.buy_set(db, user, body.set_id)
    await db.commit()
    return out


# ---------------------------------------------------------------- quests, streak, league
@router.get("/quests", tags=["engagement"])
async def quests(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await engage.quests_for(db, user)
    await db.commit()
    return out


@router.post("/quests/{quest_id}/claim", tags=["engagement"])
async def quest_claim(quest_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    reward, w = await engage.claim_quest(db, user, quest_id)
    season_xp = await SS.add_xp(db, user, C.SEASON_XP_QUEST.get(quest_id.split(":", 1)[0], 0))   # Phase D
    q = await engage.quests_for(db, user)
    out = {"reward": reward, "quests": q, "wallet": W.wallet_out(w), "season": season_xp}
    await db.commit()
    return out


@router.get("/streak", tags=["engagement"])
async def streak(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    st = await engage.get_streak(db, user.id)
    today = local_day(user.timezone)
    from ..models import UserDayStat
    stat = await db.get(UserDayStat, (user.id, today))
    out = engage.streak_out(st, stat, today)
    await db.commit()
    return out


@router.post("/streak/repair", tags=["engagement"],
             summary="Relight a Hearthfire that went out within 2 missed days, for 30 gems")
async def streak_repair(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    st = await engage.repair_streak(db, user)
    today = local_day(user.timezone)
    from ..models import UserDayStat
    stat = await db.get(UserDayStat, (user.id, today))
    w = await W.get_wallet(db, user.id)
    out = {"streak": engage.streak_out(st, stat, today), "wallet": W.wallet_out(w)}
    await db.commit()
    return out


@router.get("/league", tags=["engagement"])
async def league(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    out = await engage.league_view(db, user)
    await db.commit()
    return out


@router.post("/league/seen", tags=["engagement"], summary="Collect last week's league reward (once)")
async def league_seen(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    granted, w = await engage.league_seen(db, user)
    await db.commit()
    return {"granted": granted, "wallet": W.wallet_out(w)}


# ---------------------------------------------------------------- achievements (audit 10-11 P0)
@router.get("/achievements", tags=["engagement"], summary="Every achievement step with progress from server stats")
async def achievements(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await ach.listing(db, user)


@router.post("/achievements/{ach_id}/claim", tags=["engagement"], summary="Claim a reached step: pays its gems once")
async def achievement_claim(ach_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    reward, w = await ach.claim(db, user, ach_id)
    out = {"reward": reward, "wallet": W.wallet_out(w), "achievements": await ach.listing(db, user)}
    await db.commit()
    return out


# ---------------------------------------------------------------- placement (first-run intro)
@router.get("/placement/items", tags=["map"],
            summary="Oracle Trial items per level for the app's adaptive placement test (no rewards, no hearts)")
async def placement_items(per_level: int = Query(6, ge=2, le=12), user: User = Depends(current_user),
                          db: AsyncSession = Depends(get_db)):
    out = []
    for code, _, _ in LEVELS:
        rows = (await db.execute(select(Question).where(Question.game == "oracle-trial", Question.level == code,
                                                        Question.active.is_(True))
                                 .order_by(func.random()).limit(per_level))).scalars().all()
        out += [play.question_out(q) for q in rows]
    return out


# ---------------------------------------------------------------- tutorials (Phase C)
_SAMPLE_MODE = {"bubble-pop": "synonym", "match-blitz": "definition", "memory-crystals": "definition"}
_SAMPLE_SRC = {"match-blitz": "bubble-pop", "memory-crystals": "bubble-pop", "gap-gate": "bubble-pop", "boss-battle": "bubble-pop"}


@router.get("/samples/{game}", tags=["play"],
            summary="A few easy items of one game for its first-time tutorial practice and app previews (not graded)")
async def game_samples(game: str, level: str = Query("A1", pattern="^(A1|A2|B1|B2|C1)$"), n: int = Query(1, ge=1, le=6),
                       db: AsyncSession = Depends(get_db)):
    src = _SAMPLE_SRC.get(game, game)
    if game not in play.TUT_GAMES:
        raise ApiError(404, "not_found", "unknown game")
    q = select(Question).where(Question.game == src, Question.level == level, Question.active.is_(True))
    mode = _SAMPLE_MODE.get(game)
    if mode:  # admin 4931: Bubble Pop shows synonyms, the pair games show definitions
        q = q.where(Question.payload["mode"].astext == mode)
    rows = list((await db.execute(q.where(Question.difficulty <= 1).order_by(func.random()).limit(n))).scalars().all())
    if len(rows) < n:
        have = [r.id for r in rows]
        rows += (await db.execute(q.where(Question.id.notin_(have) if have else True)
                                  .order_by(func.random()).limit(n - len(rows)))).scalars().all()
    return [{**play.question_out(r), "game": game} for r in rows]
