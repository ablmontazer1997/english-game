"""Phase D (admin msg 4839, decision 5 A): the Season Pass.

- One season = one UTC calendar month (id "2026-10"); the theme rotates (catalog.SEASON_THEMES).
- The reset is server-authoritative by construction: progress rows are keyed by season id, and the season id comes
  only from the server clock. A new month starts every player at 0 with a fresh track; last month's unclaimed rewards
  are gone (the app says so before the month ends).
- Season XP comes only from the server: won/lost stages (Focus keeps its caps), claimed daily/weekly quests. A local
  day gives at most SEASON_XP_DAILY_CAP.
- Free track: claimable now. Premium track: visible, locked until the season's premium is bought (payments are OFF).
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from .. import catalog as C
from ..errors import ApiError
from ..models import SeasonProgress, User, UserItem
from ..timeutil import local_day, ms, utcnow
from . import wallet as W

UTC = timezone.utc


def season_id(now: datetime | None = None) -> str:
    n = (now or utcnow()).astimezone(UTC)
    return C.season_id_of(n.year, n.month)


def season_bounds(sid: str) -> tuple[datetime, datetime]:
    y, m = (int(x) for x in sid.split("-"))
    start = datetime(y, m, 1, tzinfo=UTC)
    end = datetime(y + (m == 12), 1 if m == 12 else m + 1, 1, tzinfo=UTC)
    return start, end


async def progress_row(db: AsyncSession, user: User, sid: str | None = None) -> SeasonProgress:
    sid = sid or season_id()
    row = await db.get(SeasonProgress, (user.id, sid), with_for_update=True)
    if row is None:
        row = SeasonProgress(user_id=user.id, season_id=sid, xp=0, premium=False, free_claimed=[],
                             premium_claimed=[], xp_today=0)
        db.add(row)
        await db.flush()
    return row


def stage_xp(stars: int, focus: bool) -> int:
    """season XP for a finished stage; Focus mode's stars are already capped at 2 and it gives at most SEASON_FOCUS_MAX"""
    xp = C.SEASON_XP_STAGE_WIN + C.SEASON_XP_PER_STAR * stars if stars > 0 else C.SEASON_XP_STAGE_LOST
    return min(xp, C.SEASON_FOCUS_MAX) if focus else xp


async def add_xp(db: AsyncSession, user: User, amount: int, now: datetime | None = None) -> dict:
    """adds season XP under the daily cap; returns {season_xp, added, tier, tier_up}"""
    if amount <= 0:
        return {"added": 0}
    sid = season_id(now)
    row = await progress_row(db, user, sid)
    today = local_day(user.timezone, now)
    if row.xp_day != today:
        row.xp_day, row.xp_today = today, 0
    add = max(0, min(amount, C.SEASON_XP_DAILY_CAP - (row.xp_today or 0)))
    before = tier_of(row.xp)
    row.xp = (row.xp or 0) + add
    row.xp_today = (row.xp_today or 0) + add
    await db.flush()
    after = tier_of(row.xp)
    return {"season_id": sid, "added": add, "season_xp": row.xp, "tier": after, "tier_up": after > before,
            "capped": add < amount}


def tier_of(xp: int) -> int:
    return min(C.SEASON_TIERS, (xp or 0) // C.SEASON_TIER_XP)


async def view(db: AsyncSession, user: User, now: datetime | None = None) -> dict:
    from . import payments as P
    sid = season_id(now)
    row = await progress_row(db, user, sid)
    theme = C.theme_for(sid)
    start, end = season_bounds(sid)
    reached = tier_of(row.xp)
    premium_on = bool(row.premium)
    tiers = []
    for t in C.season_track(theme):
        n = t["tier"]
        tiers.append({**t, "reached": n <= reached,
                      "free_claimed": n in (row.free_claimed or []),
                      "premium_claimed": n in (row.premium_claimed or []),
                      "free_claimable": n <= reached and n not in (row.free_claimed or []),
                      "premium_claimable": premium_on and n <= reached and n not in (row.premium_claimed or [])})
    today = local_day(user.timezone, now)
    return {"season_id": sid, "name": theme["name"], "theme": theme["key"], "accent": theme["accent"],
            "starts_at": ms(start), "ends_at": ms(end), "xp": row.xp, "tier": reached,
            "tier_xp": C.SEASON_TIER_XP, "tiers_total": C.SEASON_TIERS,
            "xp_today": row.xp_today if row.xp_day == today else 0, "xp_daily_cap": C.SEASON_XP_DAILY_CAP,
            "premium": premium_on, "premium_available": P.enabled(),
            "rules": {"stage_win": C.SEASON_XP_STAGE_WIN, "per_star": C.SEASON_XP_PER_STAR,
                      "stage_lost": C.SEASON_XP_STAGE_LOST, "focus_max": C.SEASON_FOCUS_MAX,
                      "quest": C.SEASON_XP_QUEST},
            "tiers": tiers}


async def _pay(db: AsyncSession, user: User, w, reward: dict, ref: str) -> dict:
    """apply one track reward; an item / dye the player already owns turns into its fair value"""
    if "item" in reward:
        iid = reward["item"]
        if await db.get(UserItem, (user.id, iid)) is None:
            db.add(UserItem(user_id=user.id, item_id=iid, source="season"))
            await db.flush()
            return {"item": iid}
        W.change(db, w, "gems", 50, "season", ref)
        return {"gems": 50, "instead_of": iid}
    if "dye" in reward:
        key = reward["dye"]
        dyes = set(user.dyes or [])
        if key in dyes:
            W.change(db, w, "coins", C.DYE_PRICE_COINS, "season", ref)
            return {"coins": C.DYE_PRICE_COINS, "instead_of": key}
        dyes.add(key)
        user.dyes = sorted(dyes)
        await db.flush()
        return {"dye": key}
    await W.grant(db, w, reward, "season", ref)
    return dict(reward)


async def claim(db: AsyncSession, user: User, tier: int, track: str) -> tuple[dict, object]:
    if track not in ("free", "premium"):
        raise ApiError(422, "bad_track", "track must be free or premium")
    if not 1 <= tier <= C.SEASON_TIERS:
        raise ApiError(404, "not_found", "no such tier")
    sid = season_id()
    row = await progress_row(db, user, sid)
    if tier > tier_of(row.xp):
        raise ApiError(409, "tier_locked", "earn more season XP to reach this tier")
    if track == "premium" and not row.premium:
        raise ApiError(403, "premium_locked", "the premium track is coming soon")
    claimed = list((row.free_claimed if track == "free" else row.premium_claimed) or [])
    if tier in claimed:
        raise ApiError(409, "already_claimed")
    t = C.season_track(C.theme_for(sid))[tier - 1]
    w = await W.get_wallet(db, user.id)
    got = await _pay(db, user, w, t[track], f"{sid}:{track}:{tier}")
    claimed.append(tier)
    if track == "free":
        row.free_claimed = sorted(claimed)
    else:
        row.premium_claimed = sorted(claimed)
    await db.flush()
    return got, w


def visible_now(item_id: str, sid: str, owned: set[str]) -> bool:
    """monthly premium sets and season cloaks show only in their own month (or when owned); the starter outfit always"""
    for t in C.SEASON_THEMES:
        ids = [s[0] for s in t["set"]] + [t["pass_cloak"][0]]
        if item_id in ids:
            return item_id in owned or C.theme_for(sid)["key"] == t["key"]
    return True


def next_reset(now: datetime | None = None) -> datetime:
    return season_bounds(season_id(now))[1]


__all__ = ["season_id", "season_bounds", "progress_row", "stage_xp", "add_xp", "view", "claim", "visible_now",
           "next_reset", "timedelta"]
