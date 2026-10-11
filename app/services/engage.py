"""Daily stats, Hearthfire streak + Frost Ward, Daily Rites (quests) and the Guild Tournament (league)."""
import random
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import ApiError
from ..models import DailyQuest, LeagueMembership, Streak, User, UserDayStat
from ..timeutil import local_day, local_midnight_utc, ms, utcnow, week_start
from .. import catalog as C
from . import wallet as W

# ---------------------------------------------------------------- day stats


async def day_stat(db: AsyncSession, user: User, day: date | None = None) -> UserDayStat:
    day = day or local_day(user.timezone)
    row = await db.get(UserDayStat, (user.id, day), with_for_update=True)
    if row is None:
        row = UserDayStat(user_id=user.id, day=day, stages_played=0, stages_won=0, stars=0, stars3=0, correct=0,
                          answered=0, xp=0, coins=0, gems=0, bosses=0, review_correct=0, review_answered=0,
                          league_points=0, games=[], dailies_all_claimed=False)
        db.add(row)
        await db.flush()
    return row


# ---------------------------------------------------------------- streak
FREEZES_MAX = 2
# admin msg 3060: ONE completed exercise a day is enough (a won stage, or one submitted review round)
STREAK_RULE = "A day counts when you complete one exercise: win one stage or finish one review round."


def day_qualifies(s: UserDayStat) -> bool:
    return (s.stages_won or 0) >= 1 or (s.review_answered or 0) >= 1


async def get_streak(db: AsyncSession, user_id) -> Streak:
    st = await db.get(Streak, user_id, with_for_update=True)
    if st is None:
        st = Streak(user_id=user_id, current=0, best=0, freezes=0, freezes_used=0)
        db.add(st)
        await db.flush()
    return st


def live_streak(st: Streak, today: date) -> int:
    if not st.last_active_day:
        return 0
    gap = (today - st.last_active_day).days - 1  # missed days
    if gap <= 0:
        return st.current
    return st.current if gap <= st.freezes else 0


async def touch_streak(db: AsyncSession, user: User, stat: UserDayStat) -> Streak:
    st = await get_streak(db, user.id)
    today = stat.day
    if st.last_active_day == today or not day_qualifies(stat):
        return st
    if st.last_active_day is None:
        st.current = 1
    else:
        gap = (today - st.last_active_day).days - 1
        if gap <= 0:
            st.current += 1
        elif gap <= st.freezes:
            st.freezes -= gap
            st.freezes_used += gap
            st.current += 1
        else:
            # Phase B: remember the Hearthfire that went out, so it can still be repaired (2 missed days at most)
            if gap - st.freezes <= C.STREAK_REPAIR_MAX_MISSED and st.current > 0:
                st.lost, st.lost_on = st.current, today
                st.freezes_used += st.freezes
                st.freezes = 0
            else:
                st.lost, st.lost_on = 0, None
            st.current = 1
    st.last_active_day = today
    st.best = max(st.best, st.current)
    return st


def repair_state(st: Streak, today: date) -> dict | None:
    """a Hearthfire that went out within 2 missed days (beyond the Frost Wards) can be repaired for 200 gems"""
    if not st.last_active_day:
        return None
    if st.last_active_day == today and st.lost > 0 and st.lost_on == today:
        # the player already lit a new one today: the repair joins the old fire to it
        return {"lost": st.lost, "cost_gems": C.STREAK_REPAIR_GEMS, "restores": st.lost + st.current}
    missed = (today - st.last_active_day).days - 1
    over = missed - st.freezes
    if st.current > 0 and 0 < over <= C.STREAK_REPAIR_MAX_MISSED:
        return {"lost": st.current, "cost_gems": C.STREAK_REPAIR_GEMS, "restores": st.current}
    return None


async def repair_streak(db: AsyncSession, user: User) -> Streak:
    st = await get_streak(db, user.id)
    today = local_day(user.timezone)
    rs = repair_state(st, today)
    if rs is None:
        raise ApiError(409, "nothing_to_repair", "your Hearthfire is burning, or it went out too long ago")
    w = await W.get_wallet(db, user.id)
    W.change(db, w, "gems", -C.STREAK_REPAIR_GEMS, "streak_repair", today.isoformat())
    if st.last_active_day == today and st.lost_on == today:
        st.current = st.lost + st.current
    else:
        st.last_active_day = today - timedelta(days=1)   # burning again: today's exercise keeps it going
        st.freezes_used += st.freezes
        st.freezes = 0
    st.lost, st.lost_on = 0, None
    st.best = max(st.best, st.current)
    await db.flush()
    return st


def streak_out(st: Streak, stat: UserDayStat | None, today: date) -> dict:
    return {"current": live_streak(st, today), "best": st.best, "today_done": st.last_active_day == today,
            "repair": repair_state(st, today),
            "today_progress": {"stages_won": stat.stages_won if stat else 0,
                               "review_correct": stat.review_correct if stat else 0},
            "rule": STREAK_RULE, "freezes": st.freezes, "freezes_max": FREEZES_MAX,
            "last_active_day": st.last_active_day.isoformat() if st.last_active_day else None}


# ---------------------------------------------------------------- quests (same pools as the app's progress.ts)
DAILY = [
    ("win", lambda n: "Win a stage" if n == 1 else f"Win {n} stages", [2, 3], lambda t: t["stages_won"], {"coins": 120}),
    ("three", lambda n: "Earn 3 stars in a stage" if n == 1 else f"Earn 3 stars in {n} stages", [1, 2],
     lambda t: t["stars3"], {"coins": 150}),
    ("correct", lambda n: f"Answer {n} questions correctly", [20, 30], lambda t: t["correct"], {"potion": 1}),
    ("xp", lambda n: f"Earn {n} XP", [150, 250], lambda t: t["xp"], {"coins": 100}),
    ("variety", lambda n: f"Play {n} different games", [2, 3], lambda t: len(t["games"]), {"coins": 110}),
    ("stars", lambda n: f"Collect {n} stars", [5, 8], lambda t: t["stars"], {"coins": 130}),
    ("cauldron", lambda n: f"Answer {n} review items correctly", [10, 15], lambda t: t["review_correct"],
     {"coins": 120}),
]
WEEKLY = [
    ("wwin", lambda n: f"Win {n} stages this week", [12, 15], lambda t: t["stages_won"], {"gems": 10}),
    ("wthree", lambda n: f"Earn 3 stars in {n} stages", [6, 8], lambda t: t["stars3"], {"gems": 15}),
    ("wcorrect", lambda n: f"Answer {n} questions correctly", [120, 160], lambda t: t["correct"],
     {"chest": "silver"}),
    ("wboss", lambda n: "Defeat a world boss", [1], lambda t: t["bosses"], {"gems": 15}),
    ("wxp", lambda n: f"Earn {n} XP", [1200, 1600], lambda t: t["xp"], {"gems": 8}),
]


def _tally(rows: list[UserDayStat]) -> dict:
    t = {k: 0 for k in ("stages_won", "stars3", "correct", "xp", "stars", "bosses", "review_correct")}
    games: set[str] = set()
    for r in rows:
        for k in t:
            t[k] += getattr(r, k) or 0
        games.update(r.games or [])
    t["games"] = games
    t["days_all"] = sum(1 for r in rows if r.dailies_all_claimed)
    return t


async def _ensure_period(db, user, period: str, key: date):
    exist = (await db.execute(select(DailyQuest).where(DailyQuest.user_id == user.id, DailyQuest.period == period,
                                                       DailyQuest.period_key == key))).scalars().all()
    if exist:
        return list(exist)
    pool, k = (DAILY, 3) if period == "daily" else (WEEKLY, 3)
    if period == "daily" and not await _review_possible(db, user, key):
        # audit 10-11 P0: no "answer N review items" quest on a day with nothing (or too little) due in the Cauldron
        pool = [q for q in pool if q[0] != "cauldron"]
    rnd = random.Random(f"{period}{key.isoformat()}")  # the same quests for everyone on the same day/week
    chosen = rnd.sample(pool, k)
    rows = []
    for qk, title, ns, _get, reward in chosen:
        n = rnd.choice(ns)
        if qk == "win" and user.daily_goal:  # the intro's daily vow sets the size of the "win stages" quest
            n = user.daily_goal
        rows.append(DailyQuest(user_id=user.id, quest_id=f"{period}:{key.isoformat()}:{qk}", period=period,
                               period_key=key, quest_key=qk, title=title(n), target=n, reward=reward, bonus=False))
    if period == "daily":
        rows.append(DailyQuest(user_id=user.id, quest_id=f"daily:{key.isoformat()}:all", period=period,
                               period_key=key, quest_key="all", title="Complete all daily quests", target=3,
                               reward={"chest": "wood", "gems": 2}, bonus=True))
    else:
        rows.append(DailyQuest(user_id=user.id, quest_id=f"weekly:{key.isoformat()}:days", period=period,
                               period_key=key, quest_key="days", title="Finish your dailies on 5 days", target=5,
                               reward={"chest": "epic"}, bonus=True))
    for r in rows:
        db.add(r)
    await db.flush()
    return rows


async def _review_possible(db, user: User, day: date) -> bool:
    """enough Cauldron items are due by the end of `day` to finish the largest review quest"""
    from ..models import SrsItem
    end = local_midnight_utc(user.timezone, day + timedelta(days=1))
    due = (await db.execute(select(func.count()).select_from(SrsItem).where(
        SrsItem.user_id == user.id, SrsItem.due_at < end))).scalar_one()
    return due >= 15


async def apply_daily_goal(db, user: User):
    """the vow changes today's unclaimed "win stages" quest at once (new days pick it up in _ensure_period)"""
    n = user.daily_goal
    if not n:
        return
    row = await db.get(DailyQuest, (user.id, f"daily:{local_day(user.timezone).isoformat()}:win"))
    if row is not None and row.claimed_at is None:
        row.target, row.title = n, ("Win a stage" if n == 1 else f"Win {n} stages")


async def quests_for(db: AsyncSession, user: User) -> list[dict]:
    today = local_day(user.timezone)
    wk = week_start(today)
    daily = await _ensure_period(db, user, "daily", today)
    weekly = await _ensure_period(db, user, "weekly", wk)
    drows = (await db.execute(select(UserDayStat).where(UserDayStat.user_id == user.id,
                                                        UserDayStat.day == today))).scalars().all()
    wrows = (await db.execute(select(UserDayStat).where(UserDayStat.user_id == user.id, UserDayStat.day >= wk,
                                                        UserDayStat.day < wk + timedelta(days=7)))).scalars().all()
    td, tw = _tally(list(drows)), _tally(list(wrows))
    getters = {q[0]: q[3] for q in DAILY + WEEKLY}
    out = []
    claimed_daily = sum(1 for q in daily if not q.bonus and q.claimed_at)
    for q in daily + weekly:
        if q.quest_key == "all":
            prog = claimed_daily
        elif q.quest_key == "days":
            prog = tw["days_all"]
        else:
            prog = getters[q.quest_key](td if q.period == "daily" else tw)
        prog = min(q.target, prog)
        out.append({"id": q.quest_id, "title": q.title, "progress": prog, "target": q.target, "reward": q.reward,
                    "period": q.period, "done": q.claimed_at is not None,
                    "claimable": q.claimed_at is None and prog >= q.target, "bonus": q.bonus})
    return out


async def claim_quest(db: AsyncSession, user: User, quest_id: str):
    quests = await quests_for(db, user)
    q = next((x for x in quests if x["id"] == quest_id), None)
    if q is None:
        raise ApiError(404, "not_found", "no such quest for this period")
    if q["done"]:
        raise ApiError(409, "already_claimed")
    if not q["claimable"]:
        raise ApiError(409, "quest_not_done")
    row = await db.get(DailyQuest, (user.id, quest_id), with_for_update=True)
    if row.claimed_at is not None:
        raise ApiError(409, "already_claimed")
    row.claimed_at = utcnow()
    w = await W.get_wallet(db, user.id)
    await W.grant(db, w, q["reward"], "quest", quest_id)
    if row.quest_key == "all":
        stat = await day_stat(db, user, row.period_key)
        stat.dailies_all_claimed = True
    await db.flush()
    return q["reward"], w


# ---------------------------------------------------------------- league
TIERS = ["bronze", "silver", "gold", "ruby", "astral", "legend"]
GROUP_SIZE, PROMOTE, DEMOTE = 15, 3, 3
DAILY_LP_CAP = 400
LEAGUE_RULE = ("Points per stage = round(10 x correct x accuracy), at most 400 a day. Boosts and purchases never "
               "count. Top 3 move up, bottom 3 move down every Monday.")
BOT_NAMES = ["Elowen", "Thorne", "Mirabel", "Caspian", "Isolde", "Rowan", "Seraphine", "Alaric", "Wren", "Lysander",
             "Odette", "Faelan", "Brielle", "Corwin", "Nimue", "Percival", "Tamsin", "Evander", "Liora", "Gideon"]


# players who never picked a name (the old default "Apprentice") get a stable rune-name in the table, so the league is
# not a column of identical rows; the player can rename from the League or Settings at any time
RUNE_NAMES = ["Ash", "Birch", "Cedar", "Ember", "Fern", "Frost", "Hazel", "Iris", "Jade", "Lark", "Moss", "Onyx", "Opal",
              "Quill", "Raven", "Sorrel", "Thistle", "Willow", "Yarrow", "Zephyr", "Amber", "Briar", "Clover", "Dusk"]


def shown_name(name: str | None, user_id) -> str:
    if name and name != "Apprentice":
        return name
    h = int(str(user_id).replace("-", "")[:8], 16)
    return f"Mage {RUNE_NAMES[h % len(RUNE_NAMES)]}"


def league_points(correct: int, total: int) -> int:
    if total <= 0:
        return 0
    return round(10 * correct * (correct / total))


def rank_reward(rank: int, tier: str = "bronze") -> dict:
    """Phase B (audit 5.3 C): rank 1 = 20 gems, the Epic chest only above Bronze"""
    if rank == 1:
        return {"gems": 20} if tier == "bronze" else {"gems": 20, "chest": "epic"}
    if rank == 2:
        return {"gems": 15, "chest": "silver"}
    if rank == 3:
        return {"gems": 10, "chest": "silver"}
    if rank <= 10:
        return {"gems": 3}
    return {}


def _bots(week: date, tier: str, group: int, n: int, frac: float) -> list[dict]:
    rnd = random.Random(f"league:{week.isoformat()}:{tier}:{group}")
    ti = TIERS.index(tier)
    names = rnd.sample(BOT_NAMES, min(n, len(BOT_NAMES)))
    out = []
    for i in range(n):
        # Phase B (audit 5.3 C): beatable but not free. Bronze tops out near 1,500 a week (was ~810), so 3 stages a
        # day still wins, 2 a day lands mid-table
        target = int(1100 * (0.7 + 0.3 * ti) * rnd.uniform(0.2, 1.9))
        # bots earn through the week (a little faster early on), so the table moves while you play
        out.append({"playerId": f"bot-{group}-{i}", "name": names[i % len(names)],
                    "lp": int(target * min(1.0, frac ** 0.8)), "isMe": False, "bot": True})
    return out


async def _group_table(db, week: date, tier: str, group: int, frac: float, me_id=None, names=None) -> list[dict]:
    rows = (await db.execute(select(LeagueMembership, User.display_name).join(User, User.id == LeagueMembership.user_id)
                             .where(LeagueMembership.week_start == week, LeagueMembership.tier == tier,
                                    LeagueMembership.group_no == group))).all()
    entries = [{"playerId": str(m.user_id), "name": shown_name(name, m.user_id), "lp": m.points,
                "isMe": m.user_id == me_id, "bot": False}
               for m, name in rows]
    entries += _bots(week, tier, group, max(0, GROUP_SIZE - len(entries)), frac)
    entries.sort(key=lambda e: (-e["lp"], e["bot"], e["name"]))
    return entries


async def _settle(db, m: LeagueMembership):
    table = await _group_table(db, m.week_start, m.tier, m.group_no, 1.0, me_id=m.user_id)
    rank = next(i for i, e in enumerate(table, 1) if e["isMe"])
    ti = TIERS.index(m.tier)
    moved = 1 if (rank <= PROMOTE and ti < len(TIERS) - 1) else (-1 if (rank > GROUP_SIZE - DEMOTE and ti > 0) else 0)
    m.final_rank, m.moved, m.reward, m.settled = rank, moved, rank_reward(rank, m.tier), True
    if moved == 1:   # Phase B: the first promotion earns the Frost hat
        from .wardrobe import grant
        await grant(db, m.user_id, C.LEAGUE_PROMOTION_REWARD, "league")


async def membership(db: AsyncSession, user: User, create: bool = True) -> LeagueMembership | None:
    if not user.league_opt_in:
        return None
    wk = week_start(local_day(user.timezone))
    m = await db.get(LeagueMembership, (user.id, wk), with_for_update=True)
    if m is not None or not create:
        return m
    prev = (await db.execute(select(LeagueMembership).where(LeagueMembership.user_id == user.id,
                                                            LeagueMembership.week_start < wk)
                             .order_by(LeagueMembership.week_start.desc()).limit(1))).scalar_one_or_none()
    tier = "bronze"
    if prev is not None:
        if not prev.settled:
            await _settle(db, prev)
        tier = TIERS[max(0, min(len(TIERS) - 1, TIERS.index(prev.tier) + (prev.moved or 0)))]
    count = (await db.execute(select(func.count()).select_from(LeagueMembership)
                              .where(LeagueMembership.week_start == wk, LeagueMembership.tier == tier))).scalar_one()
    m = LeagueMembership(user_id=user.id, week_start=wk, tier=tier, group_no=count // GROUP_SIZE, points=0,
                         settled=False, seen=False)
    db.add(m)
    await db.flush()
    return m


async def add_points(db: AsyncSession, user: User, stat: UserDayStat, lp: int) -> int:
    m = await membership(db, user)
    if m is None:
        return 0
    lp = max(0, min(lp, DAILY_LP_CAP - (stat.league_points or 0)))
    stat.league_points = (stat.league_points or 0) + lp
    m.points += lp
    return lp


async def league_view(db: AsyncSession, user: User) -> dict:
    if not user.league_opt_in:
        return {"opted_out": True, "tier": None, "entries": [], "scoring": LEAGUE_RULE}
    m = await membership(db, user)
    now = utcnow()
    start = local_midnight_utc(user.timezone, m.week_start)
    end = local_midnight_utc(user.timezone, m.week_start + timedelta(days=7))
    frac = max(0.0, min(1.0, (now - start) / (end - start)))
    table = await _group_table(db, m.week_start, m.tier, m.group_no, frac, me_id=user.id)
    ti = TIERS.index(m.tier)
    out = {"tier": m.tier, "endsAt": ms(end), "entries": table,
           "promoteCount": PROMOTE if ti < len(TIERS) - 1 else 0, "demoteCount": DEMOTE if ti > 0 else 0,
           "scoring": LEAGUE_RULE, "week_start": m.week_start.isoformat(), "my_points": m.points}
    last = (await db.execute(select(LeagueMembership).where(
        LeagueMembership.user_id == user.id, LeagueMembership.week_start < m.week_start,
        LeagueMembership.settled.is_(True), LeagueMembership.seen.is_(False))
        .order_by(LeagueMembership.week_start.desc()).limit(1))).scalar_one_or_none()
    if last is not None:
        out["last"] = {"tier": last.tier, "rank": last.final_rank, "moved": last.moved, "reward": last.reward or {},
                       "week": last.week_start.isoformat()}
    return out


async def league_seen(db: AsyncSession, user: User):
    rows = (await db.execute(select(LeagueMembership).where(
        LeagueMembership.user_id == user.id, LeagueMembership.settled.is_(True), LeagueMembership.seen.is_(False))
        .with_for_update())).scalars().all()
    w = await W.get_wallet(db, user.id)
    granted = {}
    for m in rows:
        m.seen = True
        if m.reward:
            await W.grant(db, w, m.reward, "league", m.week_start.isoformat())
            for k, v in m.reward.items():
                granted[k] = v if k == "chest" else granted.get(k, 0) + v
    return granted, w
