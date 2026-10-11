"""Phase B (UX audit 10-11): wardrobe ownership on the server + the economy sinks."""
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app import catalog as C
from app.db import SessionLocal
from app.models import Item, Streak, User, Wallet
from app.services import engage
from app.services.wardrobe import merchant_pick
from app.timeutil import local_day
from tests.conftest import correct_answer

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def _wallet(player, **vals):
    async with SessionLocal() as db:
        await db.execute(update(Wallet).where(Wallet.user_id == uuid.UUID(player["id"])).values(**vals))
        await db.commit()


async def _user(player, **vals):
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == uuid.UUID(player["id"])).values(**vals))
        await db.commit()


async def test_catalogue_tiers_and_wardrobe_view(client, player):
    wd = (await client.get("/v1/wardrobe")).json()
    items = {i["id"]: i for i in wd["items"]}
    tiers = {}
    for i in wd["items"]:
        tiers[i["tier"]] = tiers.get(i["tier"], 0) + 1
    assert tiers == {"free": 15, "coin": 14, "gem": 16, "earned": 3, "premium": 11, "boss": 45}  # Phase D: 2 cloaks + this month's set (4) + season cloak + starter outfit (4)
    assert all(i["owned"] for i in wd["items"] if i["tier"] == "free")
    assert not any(i["owned"] for i in wd["items"] if i["tier"] != "free")
    assert wd["look"] is None and wd["look_saved"] is False and wd["legacy"] is False
    # boss drops say where they come from and are never for sale; premium is "coming soon"
    assert items["shoes_forest"]["how"] == "Defeat the A1 World 1 boss" and not items["shoes_forest"]["buyable"]
    assert items["shoes_librarian"]["recolour"] == {"base": "shoes", "swatch": "ochre"}
    assert items["coat_star"]["how"] == "Premium, coming soon" and not items["coat_star"]["buyable"]
    assert items["hat_fire"]["how"] == "Keep a 7-day Hearthfire"
    assert items["hair_ponybow"]["price_coins"] == 900 and items["hat_witch"]["price_gems"] == 200
    assert items["coat_royal"]["limited"] and wd["merchant"]["ends_at"] and len(wd["merchant"]["items"]) == 4
    # retired first-catalogue items are gone from the list
    assert "hair_pony" not in items and "pose_idle" not in items
    for iid in ("coat_star", "shoes_forest", "hat_fire"):
        r = await client.post("/v1/wardrobe/buy", json={"item_id": iid})
        assert r.status_code == 409 and r.json()["detail"]["code"] == "not_for_sale"


async def test_buy_in_place_and_wear(client, player):
    await _wallet(player, coins=1000, gems=0)
    r = (await client.post("/v1/wardrobe/buy", json={"item_id": "hair_ponybow", "wear": True})).json()
    assert r["wallet"]["coins"] == 100 and r["look"]["hair"] == "hair_ponybow"
    r = await client.post("/v1/wardrobe/buy", json={"item_id": "hair_twinstar"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_enough_coins"
    r = await client.post("/v1/wardrobe/buy", json={"item_id": "hat_owl"})
    assert r.json()["detail"]["code"] == "not_enough_gems"
    assert (await client.post("/v1/wardrobe/buy", json={"item_id": "hair_ponybow"})).json()["detail"]["code"] == "already_owned"
    wd = (await client.get("/v1/wardrobe")).json()
    assert wd["look"]["hair"] == "hair_ponybow" and next(i for i in wd["items"] if i["id"] == "hair_ponybow")["owned"]
    led = (await client.get("/v1/wallet/ledger")).json()
    assert led[0]["reason"] == "wardrobe_item" and led[0]["delta"] == -900


async def test_look_is_validated_and_new_accounts_get_nothing_free(client, player):
    look = dict(C.DEFAULT_LOOK, hat="hat_dragon", coat="coat_fire", hair="hair_bobcut", body="girl", tone=8,
                tint={"coat": "crimson"}, top=None)
    r = (await client.put("/v1/wardrobe/look", json={"look": look, "migrate": True})).json()
    # a new account: unowned picks fall back, nothing is granted, dyes need buying
    assert r["granted"] == [] and r["look"]["hat"] == "hat" and r["look"]["coat"] == "coat"
    assert r["look"]["hair"] == "hair_bobcut" and r["look"]["body"] == "girl" and r["look"]["tone"] == 8
    assert r["look"]["top"] is None and r["look"]["tint"] == {}
    # a second "first upload" never overwrites the server's look
    r2 = (await client.put("/v1/wardrobe/look", json={"look": dict(C.DEFAULT_LOOK), "migrate": True})).json()
    assert r2["look"]["hair"] == "hair_bobcut"


async def test_legacy_account_keeps_what_it_wears(client, player):
    await _user(player, look_legacy=True)
    look = dict(C.DEFAULT_LOOK, hat="hat_dragon", coat="coat_fire", hair="hair_curlyfro", eyes="eyes_ruby",
                shoes="shoes_moon", tint={"coat_fire": "teal", "pants": "nonsense"})
    r = (await client.put("/v1/wardrobe/look", json={"look": look, "migrate": True})).json()
    assert set(r["granted"]) == {"hat_dragon", "coat_fire", "hair_curlyfro", "eyes_ruby", "shoes_moon"}
    assert r["look"]["hat"] == "hat_dragon" and r["look"]["coat"] == "coat_fire" and r["look"]["shoes"] == "shoes_moon"
    assert r["look"]["tint"] == {"coat_fire": "teal"}
    wd = (await client.get("/v1/wardrobe")).json()
    assert wd["legacy"] is False and "coat_fire:teal" in wd["dyes"]
    inv = (await client.get("/v1/inventory")).json()
    assert {i["item_id"]: i["source"] for i in inv["items"]}["hat_dragon"] == "legacy"


async def test_dyes(client, player):
    await _wallet(player, coins=200)
    r = (await client.post("/v1/wardrobe/dye", json={"garment": "coat", "swatch": "crimson"})).json()
    assert r["wallet"]["coins"] == 50 and "coat:crimson" in r["dyes"]
    assert (await client.post("/v1/wardrobe/dye", json={"garment": "coat", "swatch": "crimson"})).json()["detail"]["code"] == "already_owned"
    assert (await client.post("/v1/wardrobe/dye", json={"garment": "coat", "swatch": "teal"})).json()["detail"]["code"] == "not_enough_coins"
    assert (await client.post("/v1/wardrobe/dye", json={"garment": "coat_fire", "swatch": "teal"})).status_code == 403
    assert (await client.post("/v1/wardrobe/dye", json={"garment": "hair_short", "swatch": "teal"})).status_code == 422
    r = (await client.put("/v1/wardrobe/look", json={"look": dict(C.DEFAULT_LOOK, tint={"coat": "crimson", "pants": "teal"})})).json()
    assert r["look"]["tint"] == {"coat": "crimson"}


async def test_merchant_rotation_and_sets(client, player):
    async with SessionLocal() as db:
        items = list((await db.execute(select(Item).where(Item.active.is_(True)))).scalars())
    today = local_day("Asia/Tehran")
    picks, s = merchant_pick(today, items)
    m = (await client.get("/v1/merchant")).json()
    assert [i["id"] for i in m["items"]] == picks and m["set"]["id"] == s["id"]
    full = sum(next(i for i in items if i.id == x).price_gems or 0 for x in s["items"])
    assert m["set"]["full_gems"] == full and m["set"]["price_gems"] == int(round(full * 0.8 / 5) * 5)
    # the same rotation for the whole week, a different one next week
    picks2, _ = merchant_pick(today + timedelta(days=7), items)
    assert picks2 != picks
    # a merchant-only cloak this week is buyable; one that is not on the cart is refused
    away = [x for x in C.MERCHANT_ONLY if x not in picks and x not in s["items"]]
    await _wallet(player, gems=2000)
    for x in away:
        r = await client.post("/v1/wardrobe/buy", json={"item_id": x})
        assert r.json()["detail"]["code"] == "not_in_merchant"
    r = (await client.post("/v1/merchant/buy-set", json={"set_id": s["id"]})).json()
    assert r["wallet"]["gems"] == 2000 - m["set"]["price_gems"] and set(r["owned_items"]) == set(s["items"])
    assert (await client.post("/v1/merchant/buy-set", json={"set_id": s["id"]})).json()["detail"]["code"] == "already_owned"
    other = next(x for x in C.MERCHANT_SETS if x["id"] != s["id"])
    assert (await client.post("/v1/merchant/buy-set", json={"set_id": other["id"]})).json()["detail"]["code"] == "not_in_merchant"


async def test_hints_three_free_then_coins(client, player):
    await _wallet(player, coins=25)
    h = (await client.get("/v1/hints")).json()
    assert h == {"free_left": 3, "free_per_day": 3, "cost_coins": 20, "used_today": 0}
    for left in (2, 1, 0):
        r = (await client.post("/v1/hints/use")).json()
        assert r["charged_coins"] == 0 and r["hints"]["free_left"] == left
    r = (await client.post("/v1/hints/use")).json()
    assert r["charged_coins"] == 20 and r["wallet"]["coins"] == 5
    r = await client.post("/v1/hints/use")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_enough_coins"
    s = (await client.post("/v1/stages/A1-W01-S01/start")).json()
    assert s["hints"]["free_left"] == 0 and s["continue"] is None  # lessons cannot be lost


async def test_trial_costs_a_heart_and_continue(client, player):
    async with SessionLocal() as db:
        from app.models import UserProgress, Stage
        uid = uuid.UUID(player["id"])
        ids = (await db.execute(select(Stage.id).where(Stage.world_id == "A1-W01", Stage.index < 4))).scalars().all()
        for sid in ids:
            db.add(UserProgress(user_id=uid, stage_id=sid, best_stars=3, attempts=1, best_accuracy=1.0))
        await db.commit()
    await _wallet(player, gems=20, elixir=0)
    s = (await client.post("/v1/stages/A1-W01-S04/start")).json()
    assert s["stage"]["kind"] == "trial" and s["stage"]["hearts_apply"] is True
    assert s["continue"] == {"questions": 3, "cost_gems": 15, "cost_elixir": 1, "left": 1}
    n0 = len(s["questions"])
    r = await client.post(f"/v1/sessions/{s['session_id']}/continue", json={"pay": "elixir"})
    assert r.json()["detail"]["code"] == "not_enough_elixir"
    c = (await client.post(f"/v1/sessions/{s['session_id']}/continue", json={"pay": "gems"})).json()
    assert len(c["questions"]) == 3 and c["wallet"]["gems"] == 5 and c["continue"]["left"] == 0
    assert not {q["qid"] for q in c["questions"]} & {q["qid"] for q in s["questions"]}
    r = await client.post(f"/v1/sessions/{s['session_id']}/continue", json={"pay": "gems"})
    assert r.json()["detail"]["code"] == "already_continued"
    # all wrong -> graded over n0 + 3, no stars, a heart lost (trials now cost hearts)
    answers = [{"qid": q["qid"], "answer": "definitely wrong"} for q in s["questions"] + c["questions"]]
    res = (await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers})).json()
    assert res["total"] == n0 + 3 and res["stars"] == 0 and res["hearts_lost"] == 1
    # a lesson cannot be continued
    s2 = (await client.post("/v1/stages/A1-W01-S01/start")).json()
    r = await client.post(f"/v1/sessions/{s2['session_id']}/continue", json={"pay": "gems"})
    assert r.json()["detail"]["code"] == "no_continue"
    # winning with the extra questions counts them
    s3 = (await client.post("/v1/stages/A1-W01-S04/start")).json()
    await _wallet(player, gems=15)
    c3 = (await client.post(f"/v1/sessions/{s3['session_id']}/continue", json={"pay": "gems"})).json()
    answers = [{"qid": q["qid"], "answer": correct_answer(q)} for q in s3["questions"] + c3["questions"]]
    res3 = (await client.post(f"/v1/sessions/{s3['session_id']}/complete", json={"answers": answers})).json()
    assert res3["total"] == len(s3["questions"]) + 3 and res3["stars"] >= 1


async def test_streak_repair(client, player):
    uid = uuid.UUID(player["id"])
    today = local_day("Asia/Tehran")
    async with SessionLocal() as db:
        st = await db.get(Streak, uid)
        st.current, st.best, st.last_active_day, st.freezes = 9, 9, today - timedelta(days=3), 0
        await db.commit()
    st = (await client.get("/v1/streak")).json()
    assert st["current"] == 0 and st["repair"] == {"lost": 9, "cost_gems": 200, "restores": 9}
    await _wallet(player, gems=199)
    assert (await client.post("/v1/streak/repair")).json()["detail"]["code"] == "not_enough_gems"
    await _wallet(player, gems=250)
    r = (await client.post("/v1/streak/repair")).json()
    assert r["streak"]["current"] == 9 and r["streak"]["repair"] is None and r["wallet"]["gems"] == 50
    assert (await client.post("/v1/streak/repair")).json()["detail"]["code"] == "nothing_to_repair"
    # too late: 3 missed days -> gone for good
    async with SessionLocal() as db:
        st = await db.get(Streak, uid)
        st.last_active_day = today - timedelta(days=4)
        await db.commit()
    assert (await client.get("/v1/streak")).json()["repair"] is None


async def test_streak_repair_after_lighting_a_new_fire(client, player):
    uid = uuid.UUID(player["id"])
    today = local_day("Asia/Tehran")
    async with SessionLocal() as db:
        st = await db.get(Streak, uid)
        st.current, st.best, st.last_active_day, st.freezes = 6, 6, today - timedelta(days=2), 0
        await db.commit()
    from tests.test_flows import play
    await play(client, "A1-W01-S01")   # a new fire: 1 day, the old 6 remembered
    st = (await client.get("/v1/streak")).json()
    assert st["current"] == 1 and st["repair"] == {"lost": 6, "cost_gems": 200, "restores": 7}
    await _wallet(player, gems=200)
    r = (await client.post("/v1/streak/repair")).json()
    assert r["streak"]["current"] == 7


async def test_habit_items_streak_and_league(client, player):
    uid = uuid.UUID(player["id"])
    async with SessionLocal() as db:
        st = await db.get(Streak, uid)
        st.current, st.best, st.last_active_day = 7, 7, local_day("Asia/Tehran") - timedelta(days=1)
        await db.commit()
    wd = (await client.get("/v1/wardrobe")).json()
    owned = {i["id"] for i in wd["items"] if i["owned"]}
    assert "hat_fire" in owned and "hat_dragon" not in owned and "hat_frost" not in owned
    assert engage.rank_reward(1) == {"gems": 20} and engage.rank_reward(1, "silver") == {"gems": 20, "chest": "epic"}
    assert engage.rank_reward(10) == {"gems": 3} and engage.rank_reward(11) == {}


async def test_boss_drop_is_owned_and_wearable(client, player):
    from tests.test_flows import play
    async with SessionLocal() as db:
        from app.models import UserProgress, Stage
        uid = uuid.UUID(player["id"])
        ids = (await db.execute(select(Stage.id).where(Stage.world_id == "A1-W01", Stage.index < 13,
                                                       Stage.required.is_(True)))).scalars().all()
        for sid in ids:
            db.add(UserProgress(user_id=uid, stage_id=sid, best_stars=3, attempts=1, best_accuracy=1.0))
        await db.commit()
    _, won = await play(client, "A1-W01-S13")
    assert won["rewards"]["items"][0]["item_id"] == "shoes_forest"
    inv = (await client.put("/v1/inventory/equip", json={"slot": "shoes", "item_id": "shoes_forest"})).json()
    assert inv["look"]["shoes"] == "shoes_forest"
    wd = (await client.get("/v1/wardrobe")).json()
    assert wd["look"]["shoes"] == "shoes_forest"
