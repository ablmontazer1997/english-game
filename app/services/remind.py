"""English Spell reminder planner (admin msg 6138, 2026-10-20): Bingual's reminder LOGIC on English Spell's own rails.

🔴 Independent of Bingual: no Bingual FCM, keys, DB or services. Delivery is ES web push (push_worker.py) and, on
Android, the app's own local notifications built from GET /v1/push/plan.

ONE planner for every channel. `plan()` is pure (no DB) and unit-tested; `gather()` reads the player's state.

The ladder (as Bingual): anchored on the last day the Hearthfire was fed (a won stage or a review round), NOT on app
opens. Beats on day 1, 2, 3, 5, 7, 14 and 30 after it, at the player's reminder time, then silence. Playing moves the
anchor, so the whole ladder starts again from tomorrow.

The story: the Hearthfire slowly dims and the owl waits. Warm, never guilt: no crying, no "you failed".
  day 1  the fire flickers (streak at risk; a milestone day says so)
  day 2  a Frost Ward saved it / it went out and can be relit (30 gems, 2 missed days) / the owl missed you
  day 3  last day to relight / the owl waits on the tower
  day 5  the owl practises alone      day 7  the spellbook is quiet
  day 14 a letter from the owl        day 30 one last hello, then no more reminders

Events (ES calendar, the player's local weekday): League ends (Sunday), Season ends tomorrow (UTC month), Boss Rush
(Saturday), Double XP (Wednesday). An event takes a plain beat's place (never a milestone, Frost Ward or relight beat),
or an empty day in the first week after the anchor. At most 2 events a week, never on a day the player already played.

Same-day nudge (as Bingual's chest nudge): when the player played today BEFORE the reminder time, one later nudge:
"1 daily quest left" (3 h after the last stage) or "hearts are full again" (when they ran out).

Caps: at most ONE notification a local day. Events and nudges only 09:00-21:30 local; the ladder uses the player's
chosen time (auto = their usual play hour, kept in 09..21).
"""
from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from .. import catalog as C
from ..timeutil import tz_of

LADDER_DAYS = (1, 2, 3, 5, 7, 14, 30)
QUIET_START = time(21, 30)      # events and nudges never at or after this...
QUIET_END = time(9, 0)          # ...or before this (local)
DEFAULT_MINUTE = 18 * 60
EVENT_DAYS_AFTER_ANCHOR = 7     # an event may fill an empty day only in the first week away
EVENT_WEEK_CAP = 2
NUDGE_AFTER = timedelta(hours=3)
MILESTONES = (7, 14, 30, 50, 100, 200, 365)
MILESTONE_HATS = {7: "Fire hat", 30: "Dragon cap"}   # catalog: hat_fire / hat_dragon for 7 and 30 days
TITLE_MAX = 32
ART_READY = True               # true once the scene pictures are live under /runecast/notif/ (web push image)
REPLACEABLE = {"d1_streak", "d1_soft", "d2", "d3", "d5"}
EVENT_PRIORITY = ("league_end", "season_end", "boss_rush", "double_xp")

# img = the picture (Android drawable notif_<img>, web /runecast/notif/<img>.webp; 10-20 v2 story set: the four young
# wizards + the guild owl, admin 6153); route = what a tap opens.
# A variant is used only when every {var} in it has a value; "fallback" variants only when no other one fits.
TIERS: dict[str, dict[str, Any]] = {
    "d1_streak": {"img": "d1", "route": "map", "v": [
        ("Your {streak}-day fire is waiting", "One short spell today keeps your Hearthfire burning."),
        ("{streak} days! Make it {next}?", "One stage today keeps the fire warm."),
        ("The owl looked at the clock", "Your {streak}-day Hearthfire needs one spell today."),
        ("Time for a spell, {name}?", "One stage today keeps your {streak}-day fire alive."),
    ]},
    "d1_milestone": {"img": "milestone", "route": "map", "v": [
        ("Day {next} is a big one", "Play one stage today and your Hearthfire reaches {next} days."),
        ("Day {next} brings a {hat}", "One stage today and the {hat} is yours."),
    ]},
    "d1_soft": {"img": "d1", "route": "map", "v": [
        ("Ready for a spell, {name}?", "Your next stage is waiting on the map."),
        ("One small spell?", "A few minutes is enough. The owl is ready when you are."),
        ("The map is waiting", "Pick up where you stopped. One stage is enough today."),
    ]},
    "freeze": {"img": "frost", "route": "map", "v": [
        ("A Frost Ward saved your fire", "Your {streak}-day fire is safe. Play one stage today to keep it."),
        ("Your fire is safe", "A Frost Ward kept your {streak} days. One spell today keeps them."),
    ]},
    "fire_out": {"img": "d2", "route": "hearth", "v": [
        ("You can relight your fire", "Your {streak} days are not lost yet. Relight them for {gems} gems."),
        ("The embers are still warm", "Your {streak}-day Hearthfire can come back. You have {left} days."),
    ]},
    "fire_last": {"img": "d2", "route": "hearth", "v": [
        ("Last day to relight your fire", "Your {streak} days can come back today for {gems} gems."),
        ("The embers are still warm", "Relight your {streak}-day Hearthfire today. Tomorrow it is too late."),
    ]},
    "d2": {"img": "d5", "route": "map", "v": [
        ("The owl missed you", "Two days without spells. Your place on the map is saved."),
        ("Hi {name}, the owl says hi", "One short stage gets you back on track."),
        ("Hi, the owl says hi", "One short stage gets you back on track.", "fallback"),
    ]},
    "d3": {"img": "d5", "route": "map", "v": [
        ("The owl is waiting", "Three days on the tower. Come back for one quick spell?"),
        ("Come back for a spell?", "Your spellbook is open on the same page, {name}."),
        ("Come back for a spell?", "Your spellbook is open on the same page.", "fallback"),
    ]},
    "d5": {"img": "d5", "route": "map", "v": [
        ("The owl practised alone", "Five days of spells alone. Join for five minutes?"),
        ("Your spellbook misses you", "Your progress is saved, and a new stage is ready."),
    ]},
    "d7": {"img": "d7", "route": "map", "v": [
        ("A week of quiet spells", "The owl counted seven days. One stage brings the magic back."),
        ("Level {level} is still yours", "A week away is OK. Pick up right where you stopped."),
    ]},
    "d14": {"img": "d14", "route": "map", "v": [
        ("A letter from the owl", "\"Two weeks now. I kept your spells safe. Come back soon?\""),
        ("Still here for you, {name}", "The owl keeps a candle on for you. One spell is enough."),
        ("Still here for you", "The owl keeps a candle on for you. One spell is enough.", "fallback"),
    ]},
    "d30": {"img": "d30", "route": "map", "v": [
        ("One last hello", "We will stop the reminders now. Your progress is safe."),
        ("The door is always open", "Come back any time. Your hero is waiting for you."),
    ]},
    # events (the streak variants are used when the event takes the day-1 beat of a burning fire)
    "double_xp": {"img": "double_xp", "route": "map", "event": True, "v": [
        ("Double XP today", "Every stage gives 2x XP today. A good day for a spell!"),
        ("Double XP today", "Get 2x XP and keep your {streak}-day fire, all in one stage.", "streak"),
    ]},
    "boss_rush": {"img": "boss", "route": "map", "event": True, "v": [
        ("Boss Rush is on", "Beat a boss this weekend for {boss_gems} gems."),
        ("Boss Rush is on", "Beat a boss for {boss_gems} gems and keep your {streak}-day fire.", "streak"),
    ]},
    "league_end": {"img": "league", "route": "league", "event": True, "v": [
        ("League ends tonight", "You are number {rank}. One more stage can move you up."),
        ("League ends tonight", "Your points still count today. Play one stage?", "fallback"),
    ]},
    "season_end": {"img": "season", "route": "season", "event": True, "v": [
        ("Season ends tomorrow", "{rewards} Season Pass rewards are waiting. Claim them before they go."),
    ]},
    # same-day nudges
    "quests_left": {"img": "quests", "route": "quests", "v": [
        ("Almost there!", "Only {quests_txt} left today. Finish for a chest."),
        ("One more quest?", "{quests_txt} left today. Your chest is close."),
    ]},
    "hearts_full": {"img": "hearts", "route": "map", "v": [
        ("Your hearts are full", "All {hearts_max} hearts are back. Ready for a spell?"),
    ]},
}

_VAR = re.compile(r"\{(\w+)\}")


def _has(ctx: dict, k: str) -> bool:
    v = ctx.get(k)
    if v is None or v == "":
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v > 0
    return True


def _usable(v: tuple, ctx: dict) -> bool:
    return all(_has(ctx, k) for k in _VAR.findall(v[0] + " " + v[1]))


def _fill(s: str, ctx: dict) -> str:
    return _VAR.sub(lambda m: str(ctx[m.group(1)]), s)


def _hash(s: str) -> int:
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)


def pick(tier: str, ctx: dict, key: str, streak_variant: bool = False) -> tuple[str, str] | None:
    """one variant of a tier, stable for the same key (player + anchor day)"""
    vs = TIERS[tier]["v"]
    if streak_variant:
        pool = [v for v in vs if len(v) > 2 and v[2] == "streak" and _usable(v, ctx)]
        if pool:
            v = pool[_hash(f"{key}|{tier}") % len(pool)]
            return _fill(v[0], ctx), _fill(v[1], ctx)
    pool = [v for v in vs if len(v) == 2 and _usable(v, ctx)]
    if not pool:
        pool = [v for v in vs if len(v) > 2 and v[2] == "fallback" and _usable(v, ctx)]
    if not pool:
        return None
    v = pool[_hash(f"{key}|{tier}") % len(pool)]
    title, body = _fill(v[0], ctx), _fill(v[1], ctx)
    if len(title) > TITLE_MAX:   # a long number: fall back to a variant that fits
        short = [x for x in pool if len(_fill(x[0], ctx)) <= TITLE_MAX]
        if not short:
            return None
        x = short[0]
        title, body = _fill(x[0], ctx), _fill(x[1], ctx)
    return title, body


def copy_name(name: str | None) -> str | None:
    """the first name for copy, only when short and plain (it must fit a title line)"""
    first = (name or "").strip().split(" ")[0] if name else ""
    if first in ("Player", "Apprentice"):
        return None
    return first if re.fullmatch(r"[A-Za-z][A-Za-z'-]{1,9}", first or "") else None


def ladder_tier(day: int, streak: int, freezes: int) -> str:
    """which beat a ladder day gets, from the Hearthfire at the anchor (streak = days, freezes = Frost Wards)"""
    if streak >= 2:
        if day == 1:
            return "d1_milestone" if streak + 1 in MILESTONES else "d1_streak"
        missed = day - 1
        over = missed - freezes
        if over <= 0:
            return "freeze"
        if over <= C.STREAK_REPAIR_MAX_MISSED:
            return "fire_last" if over == C.STREAK_REPAIR_MAX_MISSED else "fire_out"
    elif day == 1:
        return "d1_soft"
    return {2: "d2", 3: "d3"}.get(day, f"d{day}")


def _local(tz, d: date, minute: int) -> datetime:
    return datetime.combine(d, time(minute // 60, minute % 60), tzinfo=tz).astimezone(timezone.utc)


def _quiet(local: datetime) -> bool:
    t = local.timetz().replace(tzinfo=None)
    return t >= QUIET_START or t < QUIET_END


def _clamp_event_minute(minute: int) -> int:
    lo, hi = QUIET_END.hour * 60 + QUIET_END.minute, QUIET_START.hour * 60 + QUIET_START.minute - 30
    return max(lo, min(hi, minute))


def events_on(d: date, s: dict) -> list[str]:
    """the events worth a notification on local day d, best first"""
    out = []
    if s.get("league_sunday") and d == s["league_sunday"]:   # only this week's group (next week's may not exist)
        out.append("league_end")
    se = s.get("season_end_local")          # the local day the season ends on
    if se and d == se - timedelta(days=1) and (s.get("season_rewards") or 0) > 0:
        out.append("season_end")
    if d.weekday() == 5:
        out.append("boss_rush")
    if d.weekday() == 2:
        out.append("double_xp")
    return sorted(out, key=EVENT_PRIORITY.index)


def plan(s: dict, now: datetime) -> list[dict]:
    """The notifications this player should get from `now` on, at most one a local day, sorted by time.

    s: uid, tz, minute (reminder minute of day), events (bool), anchor (local date of the last Hearthfire day, None =
       never played: today), streak (Hearthfire days at the anchor), freezes, name, level, league_sunday, league_rank,
       season_end_local, season_rewards, today_reminded, played_at (last stage today, UTC), quests_left, hearts,
       hearts_max, hearts_full_at (UTC).
    item: id, at (UTC), day (local date), tier, title, body, img, route.
    """
    tz = tz_of(s.get("tz"))
    today = now.astimezone(tz).date()
    anchor: date = s.get("anchor") or today
    if anchor > today:
        anchor = today
    minute = int(s.get("minute") if s.get("minute") is not None else DEFAULT_MINUTE) % (24 * 60)
    streak, freezes = int(s.get("streak") or 0), int(s.get("freezes") or 0)
    key = f"{s.get('uid', '')}|{anchor.isoformat()}"
    ctx = {"name": copy_name(s.get("name")), "streak": streak, "next": streak + 1, "level": s.get("level"),
           "gems": C.STREAK_REPAIR_GEMS, "hat": MILESTONE_HATS.get(streak + 1), "rank": s.get("league_rank"),
           "rewards": s.get("season_rewards"), "boss_gems": 5, "hearts_max": s.get("hearts_max") or 5}
    by_day: dict[date, dict] = {}

    for k in LADDER_DAYS:
        d = anchor + timedelta(days=k)
        tier = ladder_tier(k, streak, freezes)
        over = (k - 1) - freezes
        c = {**ctx, "left": max(1, C.STREAK_REPAIR_MAX_MISSED - over + 1)}
        by_day[d] = {"day": d, "tier": tier, "at": _local(tz, d, minute), "ctx": c, "ladder_day": k}

    if s.get("events", True):
        cands: dict[date, list[tuple[int, date, str]]] = {}      # week (Monday) -> (priority, day, event)
        last = anchor + timedelta(days=30)
        d = max(today, anchor + timedelta(days=1))
        while d <= last:
            evs = events_on(d, s)
            slot = by_day.get(d)
            fits = (slot is not None and slot["tier"] in REPLACEABLE) or \
                   (slot is None and (d - anchor).days <= EVENT_DAYS_AFTER_ANCHOR)
            if evs and fits:
                cands.setdefault(d - timedelta(days=d.weekday()), []).append((EVENT_PRIORITY.index(evs[0]), d, evs[0]))
            d += timedelta(days=1)
        for week in cands.values():                              # the most important ones win the weekly cap
            for _, d, ev in sorted(week)[:EVENT_WEEK_CAP]:
                slot = by_day.get(d)
                streak_v = bool(slot and slot["tier"] == "d1_streak")
                by_day[d] = {"day": d, "tier": ev, "at": _local(tz, d, _clamp_event_minute(minute)),
                             "ctx": {**ctx}, "streak_variant": streak_v, "ladder_day": (d - anchor).days}

    # same-day nudge: the player played today, before today's reminder time
    played_at: datetime | None = s.get("played_at")
    if anchor == today and played_at and not s.get("today_reminded") and played_at < _local(tz, today, minute):
        nudge = None
        ql = s.get("quests_left")
        if ql in (1, 2):
            nudge = ("quests_left", played_at + NUDGE_AFTER,
                     {**ctx, "quests_txt": "1 daily quest" if ql == 1 else "2 daily quests"})
        elif s.get("hearts") == 0 and s.get("hearts_full_at"):
            nudge = ("hearts_full", s["hearts_full_at"], ctx)
        if nudge:
            at = nudge[1]
            loc = at.astimezone(tz)
            if loc.date() == today and not _quiet(loc):
                by_day[today] = {"day": today, "tier": nudge[0], "at": at, "ctx": nudge[2], "ladder_day": 0}

    out = []
    for d in sorted(by_day):
        it = by_day[d]
        if it["at"] <= now:
            continue
        p = pick(it["tier"], it["ctx"], key, it.get("streak_variant", False))
        if p is None:
            continue
        t = TIERS[it["tier"]]
        out.append({"id": f"es-{it['ladder_day']}-{it['tier']}", "at": it["at"], "day": d.isoformat(),
                    "tier": it["tier"], "title": p[0], "body": p[1], "img": t["img"], "route": t["route"]})
    return out


# ---------------------------------------------------------------- the player's state (DB)
async def gather(db, user, now: datetime | None = None) -> dict:
    """everything plan() may use, read from the DB (no writes except quest rows the quest screen would make too)"""
    from sqlalchemy import func, select

    from ..models import LeagueMembership, StageSession, Streak
    from ..timeutil import local_day, utcnow, week_start
    from . import engage, season as SS, wallet as W
    from . import push as P

    now = now or utcnow()
    tz = tz_of(user.timezone)
    today = local_day(user.timezone, now)
    prefs = prefs_of(user)
    minute = prefs["minute"] if prefs["minute"] is not None else (await P.usual_hour(db, user, now)) * 60
    st = await db.get(Streak, user.id)
    anchor = st.last_active_day if st and st.last_active_day else None
    created = user.created_at.astimezone(tz).date() if user.created_at else today
    s: dict[str, Any] = {
        "uid": str(user.id), "tz": user.timezone, "minute": minute, "events": prefs["events"],
        "anchor": anchor or min(created, today), "streak": st.current if st else 0, "freezes": st.freezes if st else 0,
        "name": user.display_name, "level": user.player_level, "today_reminded": user.last_reminder_day == today,
    }
    # league: only when the player is in this week's group
    if user.league_opt_in:
        m = await db.get(LeagueMembership, (user.id, week_start(today)))
        if m is not None:
            s["league_sunday"] = week_start(today) + timedelta(days=6)
            if today.weekday() == 6:     # the rank moves all week: only say it on the last day
                try:
                    entries = (await engage.league_view(db, user)).get("entries", [])
                    rank = next((i + 1 for i, e in enumerate(entries) if e.get("isMe")), None)
                    if rank:
                        s["league_rank"] = rank
                except Exception:
                    pass
    # season: the local day it ends + free rewards reached and not claimed
    try:
        sv = await SS.view(db, user, now)
        end = datetime.fromtimestamp(sv["ends_at"] / 1000, timezone.utc)
        s["season_end_local"] = (end - timedelta(seconds=1)).astimezone(tz).date()
        s["season_rewards"] = sum(1 for t in sv["tiers"] if t.get("free_claimable"))
    except Exception:
        pass
    # same-day nudge inputs, only when the player played today
    if anchor == today:
        s["played_at"] = (await db.execute(select(func.max(StageSession.started_at)).where(
            StageSession.user_id == user.id))).scalar()
        try:
            qs = await engage.quests_for(db, user)
            daily = [q for q in qs if q["period"] == "daily" and not q.get("bonus")]
            left = [q for q in daily if q["progress"] < q["target"] and not q["done"]]
            if daily and len(left) < len(daily):
                s["quests_left"] = len(left)
        except Exception:
            pass
        w = await W.get_wallet(db, user.id, lock=False)
        s["hearts"], s["hearts_max"] = w.hearts, w.hearts_max
        if w.hearts == 0 and w.hearts_regen_from is not None:
            s["hearts_full_at"] = w.hearts_regen_from + W.HEART_REGEN * w.hearts_max
    return s


# ---------------------------------------------------------------- the player's reminder settings
def prefs_of(user) -> dict:
    """users.notify_prefs: {"on": bool, "minute": int | None (None = auto, the usual play hour), "events": bool}"""
    p = getattr(user, "notify_prefs", None) or {}
    m = p.get("minute")
    return {"on": p.get("on", True) is not False, "events": p.get("events", True) is not False,
            "minute": int(m) if isinstance(m, int) and 0 <= m < 1440 else None}


def plan_out(items: list[dict]) -> list[dict]:
    """JSON for the app (times in ms)"""
    return [{**i, "at": int(i["at"].timestamp() * 1000)} for i in items]
