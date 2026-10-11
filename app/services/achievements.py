"""Achievements on the server (audit 10-11 P0): progress comes from what the server already records, claiming pays the
gems the card shows, once. Families the server cannot count (hints used) are not listed at all.

Card ids are `<family>.<step>` (e.g. `journey.2`), the same as the app's old local list, so the medals and the
category tabs stay. Gem rewards are small on purpose (2..10, audit §5.3 C).
"""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..errors import ApiError
from ..models import (ChestOpen, DailyQuest, LeagueMembership, Stage, Streak, User, UserAchievement, UserDayStat,
                      UserProgress, WalletTx)
from . import wallet as W

S = [2, 4, 7, 10]
# (family, category, title, description template, steps, gems per step, stat key)
FAMILIES = [
    ("journey", "journey", "Pathfinder", "Clear {n} stages on the map", [5, 25, 60, 120], S, "stages_done"),
    ("worlds", "journey", "Realm Walker", "Finish {n} world{s}", [1, 3, 6, 11], [3, 5, 8, 10], "worlds_done"),
    ("level", "journey", "Rising Mage", "Reach level {n}", [5, 15, 25, 40], S, "player_level"),
    ("stars", "stars", "Stargazer", "Collect {n} stars", [15, 60, 150, 300], S, "stars"),
    ("perfect", "stars", "Flawless", "Earn 3 stars in {n} stages", [3, 15, 40, 90], S, "stars3"),
    ("correct", "scholar", "Scholar", "Answer {n} questions correctly", [50, 250, 1000, 3000], S, "correct"),
    ("accuracy", "scholar", "Sharp Mind", "Keep {n}% accuracy over 100+ answers", [75, 85, 92, 97], S, "accuracy"),
    ("played", "scholar", "Dedicated", "Play {n} stages", [10, 50, 150, 400], S, "played"),
    ("streak", "streak", "On Fire", "Reach a {n}-day streak", [3, 7, 30, 100], [3, 5, 8, 10], "streak_best"),
    ("boss", "boss", "Dragon Tamer", "Defeat {n} world boss{es}", [1, 3, 6, 11], [3, 5, 8, 10], "bosses"),
    ("bossperfect", "boss", "Untouchable", "Beat {n} boss{es} with 3 stars", [1, 3, 6], [4, 7, 10], "bosses3"),
    ("chests", "treasure", "Treasure Hunter", "Open {n} chests", [3, 15, 40, 100], S, "chests"),
    ("coins", "wealth", "Gold Hoarder", "Earn {n:,} coins", [1000, 5000, 20000, 60000], S, "coins"),
    ("gems", "gems", "Gem Collector", "Earn {n} gems", [50, 200, 600, 1500], S, "gems"),
    ("league", "league", "Contender", "Get promoted {n} time{s}", [1, 3, 5], [5, 8, 10], "promotions"),
    ("podium", "league", "On the Podium", "Finish in the top 3 of your league {n}×", [1, 5, 15], [5, 8, 10], "top3"),
    ("champion", "league", "Champion", "Win your league {n}×", [1, 3, 10], [5, 8, 10], "firsts"),
    ("quests", "quests", "Quest Keeper", "Claim {n} quests", [5, 30, 100, 300], S, "quests"),
    ("elixir", "elixir", "Second Wind", "Save {n} stage{s} with an elixir", [1, 10, 30], [2, 5, 8], "rescues"),
    ("explorer", "explorer", "Explorer", "Play {n} different mini-games", [4, 8, 12], [3, 6, 10], "games"),
    ("shopper", "wealth", "Good Deal", "Buy {n} thing{s} in the shop", [1, 10, 40], [2, 5, 8], "buys"),
]
BY_ID = {f[0]: f for f in FAMILIES}
ROMAN = ["I", "II", "III", "IV"]


def _desc(tpl: str, n: int) -> str:
    return tpl.format(n=n, s="" if n == 1 else "s", es="" if n == 1 else "es")


async def stats(db: AsyncSession, user: User) -> dict:
    uid = user.id
    one = lambda q: db.execute(q)  # noqa: E731
    prog = (await one(select(func.count(), func.coalesce(func.sum(UserProgress.best_stars), 0),
                             func.count().filter(UserProgress.best_stars == 3))
                      .where(UserProgress.user_id == uid, UserProgress.best_stars > 0))).one()
    boss = (await one(select(func.count(), func.count().filter(UserProgress.best_stars == 3))
                      .select_from(UserProgress).join(Stage, Stage.id == UserProgress.stage_id)
                      .where(UserProgress.user_id == uid, UserProgress.best_stars > 0, Stage.kind == "boss"))).one()
    day = (await one(select(func.coalesce(func.sum(UserDayStat.stages_played), 0),
                            func.coalesce(func.sum(UserDayStat.correct), 0),
                            func.coalesce(func.sum(UserDayStat.answered), 0),
                            func.coalesce(func.sum(UserDayStat.review_correct), 0),
                            func.coalesce(func.sum(UserDayStat.review_answered), 0))
                     .where(UserDayStat.user_id == uid))).one()
    games = set()
    for gs in (await one(select(UserDayStat.games).where(UserDayStat.user_id == uid))).scalars():
        games.update(gs or [])
    games.discard("portal-run")
    earned = dict((await one(select(WalletTx.currency, func.coalesce(func.sum(WalletTx.delta), 0))
                             .where(WalletTx.user_id == uid, WalletTx.delta > 0,
                                    WalletTx.reason.not_in(["signup", "achievement"]))
                             .group_by(WalletTx.currency))).all())
    rescues = (await one(select(func.count()).select_from(WalletTx)
                         .where(WalletTx.user_id == uid, WalletTx.reason == "rescue"))).scalar_one()
    buys = (await one(select(func.count()).select_from(WalletTx)
                      .where(WalletTx.user_id == uid, WalletTx.delta < 0,
                             WalletTx.reason.in_(["shop_item", "shop_offer"])))).scalar_one()
    chests = (await one(select(func.count()).select_from(ChestOpen).where(ChestOpen.user_id == uid))).scalar_one()
    quests = (await one(select(func.count()).select_from(DailyQuest)
                        .where(DailyQuest.user_id == uid, DailyQuest.claimed_at.is_not(None)))).scalar_one()
    lg = (await one(select(func.count().filter(LeagueMembership.moved == 1),
                           func.count().filter(LeagueMembership.final_rank <= 3),
                           func.count().filter(LeagueMembership.final_rank == 1))
                    .where(LeagueMembership.user_id == uid, LeagueMembership.settled.is_(True),
                           LeagueMembership.points > 0))).one()
    st = await db.get(Streak, uid)
    correct, answered = day[1] + day[3], day[2] + day[4]
    # a world is finished when its boss is beaten (the boss opens only after the world's required stages)
    return {
        "stages_done": prog[0], "stars": int(prog[1]), "stars3": prog[2], "worlds_done": boss[0], "bosses": boss[0],
        "bosses3": boss[1], "player_level": user.player_level, "played": day[0], "correct": correct,
        "accuracy": int(correct * 100 // answered) if answered >= 100 else 0,
        "streak_best": st.best if st else 0, "chests": chests, "coins": int(earned.get("coins", 0)),
        "gems": int(earned.get("gems", 0)), "promotions": lg[0], "top3": lg[1], "firsts": lg[2], "quests": quests,
        "rescues": rescues, "games": len(games), "buys": buys,
    }


async def listing(db: AsyncSession, user: User) -> list[dict]:
    st = await stats(db, user)
    claimed = {a.ach_id for a in (await db.execute(select(UserAchievement)
                                                   .where(UserAchievement.user_id == user.id))).scalars()}
    out = []
    for fam, cat, title, tpl, steps, gems, key in FAMILIES:
        v = st[key]
        for i, n in enumerate(steps):
            aid = f"{fam}.{i + 1}"
            out.append({"id": aid, "cat": cat, "title": f"{title} {ROMAN[i]}" if len(steps) > 1 else title,
                        "desc": _desc(tpl, n), "tier": i + 1, "progress": min(v, n), "target": n,
                        "reward": {"gems": gems[i]}, "claimed": aid in claimed})
    return out


async def claim(db: AsyncSession, user: User, ach_id: str):
    fam, _, step = ach_id.partition(".")
    f = BY_ID.get(fam)
    if f is None or not step.isdigit() or not (1 <= int(step) <= len(f[4])):
        raise ApiError(404, "not_found", "unknown achievement")
    if await db.get(UserAchievement, (user.id, ach_id), with_for_update=True) is not None:
        raise ApiError(409, "already_claimed")
    i = int(step) - 1
    st = await stats(db, user)
    if st[f[6]] < f[4][i]:
        raise ApiError(409, "not_done", "not reached yet")
    reward = {"gems": f[5][i]}
    db.add(UserAchievement(user_id=user.id, ach_id=ach_id, reward=reward))
    w = await W.get_wallet(db, user.id)
    await W.grant(db, w, reward, "achievement", ach_id)
    await db.flush()
    return reward, w
