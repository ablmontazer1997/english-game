"""Phase E (admin msg 4847): weekly events (Q8 = A: Boss Rush Sat+Sun, Double XP Wed) and the price rebalance (Q12)."""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select, update

from app import catalog as C
from app.db import SessionLocal
from app.models import Stage, User, UserProgress, Wallet
from app.services import events as EV
from app.services import season as SS
from app.timeutil import local_midnight_utc, ms
from tests.conftest import correct_answer

ASYNC = pytest.mark.asyncio(loop_scope="session")
TEH = "Asia/Tehran"


async def _wallet(player, **vals):
    async with SessionLocal() as db:
        await db.execute(update(Wallet).where(Wallet.user_id == uuid.UUID(player["id"])).values(**vals))
        await db.commit()


async def _win(client, stage_id):
    s = (await client.post(f"/v1/stages/{stage_id}/start")).json()
    answers = [{"qid": q["qid"], "answer": correct_answer(q)} for q in s["questions"]]
    r = await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers})
    assert r.status_code == 200, r.text
    return r.json()


def _at(y, m, d, h, tz=TEH):
    """a UTC instant for a local wall-clock time"""
    return local_midnight_utc(tz, datetime(y, m, d).date()) + timedelta(hours=h)


@ASYNC
async def test_events_endpoint(client, player):
    EV.FORCE = None
    r = (await client.get("/v1/events")).json()
    assert {e["id"] for e in r["events"]} == {"boss_rush", "double_xp"}
    for e in r["events"]:
        assert e["ends_at"] > e["starts_at"] and e["title"] and e["blurb"]
        assert e["active"] == (e["starts_at"] <= r["now"] < e["ends_at"])
    assert r["rules"]["boss_rush"] == {"gems": 5, "perfect_bonus": 3, "daily_max": 2}
    EV.FORCE = set()


# ---------------------------------------------------------------- Boss Rush
async def _open_boss(player):
    uid = uuid.UUID(player["id"])
    async with SessionLocal() as db:
        ids = (await db.execute(select(Stage.id).where(Stage.world_id == "A1-W01", Stage.index < 13))).scalars().all()
        for sid in ids:
            db.add(UserProgress(user_id=uid, stage_id=sid, best_stars=3, attempts=1, best_accuracy=1.0))
        boss = (await db.execute(select(Stage.id).where(Stage.world_id == "A1-W01", Stage.kind == "boss"))).scalar_one()
        await db.commit()
    return boss


@ASYNC
async def test_boss_rush_pays_gems_twice_a_day(client, player):
    boss = await _open_boss(player)
    # no event: a boss win pays no Boss Rush gems
    res = await _win(client, boss)
    assert res["stars"] == 3 and res["rewards"]["boss_rush"] is None and res["rewards"]["gems"] == 0
    EV.FORCE = {"boss_rush"}
    g0 = (await client.get("/v1/wallet")).json()["gems"]
    r1 = await _win(client, boss)     # a replay of a beaten boss
    assert r1["rewards"]["boss_rush"] == {"gems": 8, "left": 1} and r1["rewards"]["gems"] == 8
    r2 = await _win(client, boss)
    assert r2["rewards"]["boss_rush"] == {"gems": 8, "left": 0}
    r3 = await _win(client, boss)     # the daily cap
    assert r3["rewards"]["boss_rush"] == {"gems": 0, "left": 0} and r3["rewards"]["gems"] == 0
    led = (await client.get("/v1/wallet/ledger")).json()
    rush = [x for x in led if x["reason"] == "boss_rush"]
    assert len(rush) == 2 and sum(x["delta"] for x in rush) == 16 and all(x["currency"] == "gems" for x in rush)
    assert (await client.get("/v1/wallet")).json()["gems"] >= g0 + 16
    # a lesson pays nothing extra on a Boss Rush day
    r = await _win(client, "A1-W01-S01")
    assert r["rewards"]["boss_rush"] is None
    EV.FORCE = set()


@ASYNC
async def test_boss_rush_lost_boss_pays_nothing(client, player):
    boss = await _open_boss(player)
    EV.FORCE = {"boss_rush"}
    s = (await client.post(f"/v1/stages/{boss}/start")).json()
    answers = [{"qid": q["qid"], "answer": "definitely wrong"} for q in s["questions"]]
    res = (await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers})).json()
    assert res["stars"] == 0 and res["rewards"]["boss_rush"] is None and res["rewards"]["gems"] == 0
    EV.FORCE = set()


# ---------------------------------------------------------------- Double XP
@ASYNC
async def test_double_xp_doubles_player_and_season_xp(client, player):
    base = await _win(client, "A1-W01-S01")
    n = base["total"]
    assert base["rewards"]["xp"] == n * 12 + 30 and base["rewards"]["double_xp"] is False
    EV.FORCE = {"double_xp"}
    res = await _win(client, "A1-W01-S01")
    assert res["rewards"]["double_xp"] is True and res["rewards"]["xp"] == 2 * (res["total"] * 12 + 30)
    assert res["season"]["added"] == 2 * SS.stage_xp(3, False)
    assert res["league_points"] == base["league_points"]          # league points never see XP boosts
    # the bought boost does not stack with the event
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == uuid.UUID(player["id"]))
                         .values(xp_boost_until=datetime.now(timezone.utc) + timedelta(minutes=10)))
        await db.commit()
    res2 = await _win(client, "A1-W01-S01")
    assert res2["rewards"]["xp"] == 2 * (res2["total"] * 12 + 30)
    EV.FORCE = set()


# ---------------------------------------------------------------- Q12 prices (server-authoritative)
@ASYNC
async def test_rebalanced_prices(client, player):
    wd = {i["id"]: i for i in (await client.get("/v1/wardrobe")).json()["items"]}
    assert wd["haircolor_pink"]["price_gems"] == 40 and wd["eyes_ruby"]["price_gems"] == 40
    assert [wd[h]["price_gems"] for h in ("hat_owl", "hat_witch", "hat_astronomer")] == [50, 60, 70]
    assert wd["coat_sea"]["price_gems"] == 130 and wd["coat_royal"]["price_gems"] == 150
    assert wd["hair_twobuns"]["price_coins"] == 1000          # coin items unchanged
    shop = (await client.get("/v1/shop")).json()
    price = {o["id"]: o["price"] for o in shop["offers"]}
    assert price["chest_wood"] == {"coins": 300} and price["chest_silver"] == {"gems": 15}
    assert price["chest_epic"] == {"gems": 35} and price["coin_sack"] == {"gems": 15}
    assert C.CONTINUE_GEMS == 10 and C.STREAK_REPAIR_GEMS == 30
    # the price is charged by the server, whatever the client says
    await _wallet(player, gems=45)
    r = (await client.post("/v1/wardrobe/buy", json={"item_id": "haircolor_pink"})).json()
    assert r["wallet"]["gems"] == 5


# ---------------------------------------------------------------- the schedule (player's local weekday)
def test_schedule_by_local_weekday():   # sync: runs last (the session loop belongs to the db fixtures)
    EV.FORCE = None
    u = SimpleNamespace(timezone=TEH)
    sat = _at(2026, 10, 17, 10)          # Saturday 10:00 in Tehran
    assert datetime(2026, 10, 17).weekday() == 5
    assert EV.active_ids(u, sat) == {"boss_rush"}
    v = EV.view(u, sat)
    br = next(e for e in v["events"] if e["id"] == "boss_rush")
    dx = next(e for e in v["events"] if e["id"] == "double_xp")
    assert v["events"][0]["id"] == "boss_rush" and br["active"] and not dx["active"]
    assert br["starts_at"] == ms(_at(2026, 10, 17, 0)) and br["ends_at"] == ms(_at(2026, 10, 19, 0))   # Sat 00:00 -> Mon 00:00
    assert dx["starts_at"] == ms(_at(2026, 10, 21, 0)) and dx["ends_at"] == ms(_at(2026, 10, 22, 0))   # next Wednesday
    # Sunday: the same run, not a new one
    sun = EV.view(u, _at(2026, 10, 18, 23))
    assert next(e for e in sun["events"] if e["id"] == "boss_rush")["starts_at"] == br["starts_at"]
    # Wednesday: Double XP on, Boss Rush next Saturday
    wed = _at(2026, 10, 21, 8)
    assert EV.active_ids(u, wed) == {"double_xp"}
    w = EV.view(u, wed)
    assert w["events"][0]["id"] == "double_xp" and w["events"][0]["ends_at"] == ms(_at(2026, 10, 22, 0))
    assert w["events"][1]["starts_at"] == ms(_at(2026, 10, 24, 0))
    # Monday: nothing on
    assert EV.active_ids(u, _at(2026, 10, 19, 12)) == set()
    # the local day decides: Friday 22:00 UTC is already Saturday in Tehran (+03:30), not in UTC
    fri = datetime(2026, 10, 16, 22, 0, tzinfo=timezone.utc)
    assert EV.active_ids(u, fri) == {"boss_rush"} and EV.active_ids(SimpleNamespace(timezone="UTC"), fri) == set()
    EV.FORCE = set()
