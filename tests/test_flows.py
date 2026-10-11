import json
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.db import SessionLocal
from app.models import SrsItem, Stage, UserProgress, Wallet
from app.timeutil import utcnow
from tests.conftest import correct_answer

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def play(client, stage_id, right=True, use_elixir=False, extra=None):
    r = await client.post(f"/v1/stages/{stage_id}/start")
    assert r.status_code == 200, r.text
    s = r.json()
    answers = []
    for q in s["questions"]:
        a = correct_answer(q) if right else "definitely wrong"
        answers.append({"qid": q["qid"], "answer": a, "correct": True})
    body = {"answers": answers, "use_elixir": use_elixir, **(extra or {})}
    r2 = await client.post(f"/v1/sessions/{s['session_id']}/complete", json=body)
    assert r2.status_code == 200, r2.text
    return s, r2.json()


async def test_guest_auth_and_starting_state(client, player):
    assert player["level"] == "A1" and player["kind"] == "guest"
    w = (await client.get("/v1/wallet")).json()
    assert (w["gems"], w["coins"], w["elixir"], w["potion"], w["hearts"]) == (40, 1250, 3, 3, 5)
    inv = (await client.get("/v1/inventory")).json()
    assert len(inv["items"]) == 19
    assert inv["equipped"]["hair"] == "hair_short"
    led = (await client.get("/v1/wallet/ledger")).json()
    assert {r["reason"] for r in led} == {"signup"}
    # same device -> same account
    me = (await client.get("/v1/me")).json()
    assert me["id"] == player["id"]


async def test_same_device_resumes(client):
    a = (await client.post("/v1/auth/guest", json={"device_id": "device-resume-1"})).json()
    b = (await client.post("/v1/auth/guest", json={"device_id": "device-resume-1"})).json()
    assert a["created"] is True and b["created"] is False and a["user"]["id"] == b["user"]["id"]
    assert (await client.get("/v1/me")).status_code == 401


async def test_map_shape(client, player):
    lv = (await client.get("/v1/levels")).json()
    assert [x["code"] for x in lv] == ["A1", "A2", "B1", "B2", "C1"]
    assert [x["world_count"] for x in lv] == [9, 9, 10, 9, 8]  # 40 topic worlds + 5 consolidation (msg 3060)
    m = (await client.get("/v1/map/A1")).json()
    assert len(m["worlds"]) == 9 and m["unlocked"]
    assert [w["consolidation"] for w in m["worlds"]] == [False] * 8 + [True]
    cw = m["worlds"][-1]
    assert cw["id"] == "A1-W09" and cw["topics"] == [] and cw["boss_drop"]["item_id"] == "coat_fire"
    assert sum(1 for s in cw["stages"] if s["required"]) == 13 and cw["stages"][-1]["variant"] == "gate"
    assert all(s["variant"] != "gate" for s in m["worlds"][-2]["stages"])
    w1 = m["worlds"][0]
    assert w1["paint_id"] == "w1" and w1["variant"]["time"] == "day" and len(w1["topics"]) == 3
    assert [s["kind"] for s in w1["stages"]][:5] == ["lesson", "practice", "practice2", "trial", "lesson"]
    assert sum(1 for s in w1["stages"] if s["required"]) == 13
    assert w1["stages"][0]["status"] == "current" and w1["stages"][1]["status"] == "locked"
    assert m["worlds"][-1]["stages"][-1]["variant"] == "gate"  # Oracle Gate only in the last world
    assert w1["boss_drop"]["item_id"] == "shoes_forest"
    assert (await client.get("/v1/map/B1")).json()["unlocked"] is False
    assert (await client.get("/v1/map/C2")).status_code == 404
    total_req = 0
    for code in ["A1", "A2", "B1", "B2", "C1"]:
        mm = (await client.get(f"/v1/map/{code}")).json()
        total_req += mm["progress"]["required_total"]
    assert total_req == 45 * 13
    t = (await client.get(f"/v1/topics/{w1['topics'][0]['id']}")).json()
    assert t["rules"] and t["title"]


async def test_locked_stage_and_win_flow(client, player):
    assert (await client.post("/v1/stages/A1-W01-S02/start")).status_code == 403
    w0 = (await client.get("/v1/wallet")).json()
    s, res = await play(client, "A1-W01-S01")
    assert res["stars"] == 3 and res["first_clear"] and res["correct"] == res["total"]
    n = res["total"]
    assert res["rewards"]["xp"] == n * 12 + 30 and res["rewards"]["coins"] == n * 5 + 45
    assert res["wallet"]["coins"] == w0["coins"] + res["rewards"]["coins"]
    assert "A1-W01-S02" in res["unlocked"] and res["srs_updated"] == n
    # the session cannot be replayed
    r = await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": []})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "already_completed"
    assert (await client.post("/v1/stages/A1-W01-S02/start")).status_code == 200


async def test_client_cannot_claim_correct(client, player):
    r = await client.post("/v1/stages/A1-W01-S01/start")
    s = r.json()
    answers = [{"qid": q["qid"], "correct": True} for q in s["questions"]]  # no answers, just claims
    res = (await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers})).json()
    assert res["stars"] == 0 and res["correct"] == 0 and res["rewards"]["gems"] == 0
    # foreign qids are ignored
    r = await client.post("/v1/stages/A1-W01-S01/start")
    s = r.json()
    res = (await client.post(f"/v1/sessions/{s['session_id']}/complete",
                             json={"answers": [{"qid": "t-or-A1-G01-0", "answer": "is"}] * 3})).json()
    assert res["total"] == len(s["questions"]) and res["correct"] <= 1


async def test_trial_mixes_earlier_topics_and_world_progress(client, player):
    for i in range(1, 8):
        await play(client, f"A1-W01-S{i:02d}")
    s, res = await play(client, "A1-W01-S08")  # trial of topic 2
    sources = [q["source"] for q in s["questions"]]
    assert 0 < sources.count("review") <= round(len(sources) * 0.4)
    topics = {q["topic_id"] for q in s["questions"] if q["source"] == "review"}
    assert topics == {"a1-verb-to-be"}


async def test_boss_hearts_items_elixir(client, player):
    for i in range(1, 13):
        await play(client, f"A1-W01-S{i:02d}")
    # a lost boss costs a heart
    _, lost = await play(client, "A1-W01-S13", right=False)
    assert lost["stars"] == 0 and lost["hearts_lost"] == 1 and lost["wallet"]["hearts"] == 4
    assert lost["wallet"]["heartsRefillAt"] is not None
    # an elixir rescues instead
    _, saved = await play(client, "A1-W01-S13", right=False, use_elixir=True)
    assert saved["elixir_used"] and saved["hearts_lost"] == 0 and saved["wallet"]["elixir"] == 2
    _, won = await play(client, "A1-W01-S13")
    assert won["stars"] == 3 and won["rewards"]["items"][0]["item_id"] == "shoes_forest"
    assert "A1-W02-S01" in won["unlocked"]
    assert "A1-W01-S14" in (await client.get("/v1/map/A1")).json()["worlds"][0]["stages"][13]["id"]
    m = (await client.get("/v1/map/A1")).json()
    assert m["worlds"][0]["status"] == "done" and m["worlds"][0]["boss_drop"]["owned"]
    # treasure vault: first clear +10 gems
    g0 = won["wallet"]["gems"]
    _, vault = await play(client, "A1-W01-S14")
    assert vault["rewards"]["gems"] == 10 and vault["wallet"]["gems"] == g0 + 10
    # no hearts -> boss refused
    async with SessionLocal() as db:
        await db.execute(update(Wallet).where(Wallet.user_id == __import__("uuid").UUID(player["id"]))
                         .values(hearts=0, hearts_regen_from=utcnow()))
        await db.commit()
    r = await client.post("/v1/stages/A1-W01-S13/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "no_hearts"


async def test_review_queue(client, player):
    await play(client, "A1-W01-S01")
    import uuid
    uid = uuid.UUID(player["id"])
    async with SessionLocal() as db:
        await db.execute(update(SrsItem).where(SrsItem.user_id == uid).values(due_at=utcnow() - timedelta(hours=1)))
        await db.commit()
    q = (await client.get("/v1/review/today?limit=50")).json()
    assert q["due_count"] >= 1 and q["items"]
    boxes = {it["qid"]: it["box"] for it in q["items"]}
    answers = [{"qid": it["qid"], "answer": correct_answer(it)} for it in q["items"]]
    res = (await client.post("/v1/review/submit", json={"answers": answers})).json()
    assert res["graded"] == len(q["items"]) and res["correct"] == len(q["items"])
    for row in res["srs"]:
        assert row["box"] == boxes[row["qid"]] + 1
    # nothing is due any more today
    assert (await client.get("/v1/review/today")).json()["due_count"] == 0
    # submitting again schedules nothing
    res2 = (await client.post("/v1/review/submit", json={"answers": answers})).json()
    assert res2["graded"] == 0


async def _set_wallet(player, **vals):
    import uuid
    async with SessionLocal() as db:
        await db.execute(update(Wallet).where(Wallet.user_id == uuid.UUID(player["id"])).values(**vals))
        await db.commit()


async def test_shop_chests_inventory(client, player):
    shop = (await client.get("/v1/shop")).json()
    assert len(shop["items"]) == 27 and all(not g["enabled"] for g in shop["gem_packs"])
    assert next(o for o in shop["offers"] if o["id"] == "chest_wood")["odds"][1]["chance"] == 0.35
    r = await client.post("/v1/shop/buy", json={"item_id": "shoes_forest"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_for_sale"
    r = await client.post("/v1/shop/buy", json={"item_id": "coat_star"})
    assert r.json()["detail"]["code"] == "not_for_sale"
    r = await client.post("/v1/shop/buy", json={"item_id": "hair_pony"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_enough_gems"
    await _set_wallet(player, gems=500)
    r = (await client.post("/v1/shop/buy", json={"item_id": "hair_pony"})).json()
    assert r["wallet"]["gems"] == 450 and r["owned_item"] == "hair_pony"
    assert (await client.post("/v1/shop/buy", json={"item_id": "hair_pony"})).json()["detail"]["code"] == "already_owned"
    # equip
    inv = (await client.put("/v1/inventory/equip", json={"slot": "hair", "item_id": "hair_pony"})).json()
    assert inv["equipped"]["hair"] == "hair_pony"
    r = await client.put("/v1/inventory/equip", json={"slot": "hair", "item_id": "hair_bob"})
    assert r.status_code == 403
    r = await client.put("/v1/inventory/equip", json={"slot": "coat", "item_id": "hair_pony"})
    assert r.status_code == 422
    # chests: buy with published price, open with server RNG inside the published ranges
    r = (await client.post("/v1/shop/buy", json={"offer_id": "chest_silver"})).json()
    assert r["wallet"]["gems"] == 420 and r["inventory"]["chests"]["silver"] == 1
    o = (await client.post("/v1/chests/silver/open")).json()
    assert 200 <= o["reward"]["coins"] <= 350 and 3 <= o["reward"]["gems"] <= 8 and o["remaining"] == 0
    assert (await client.post("/v1/chests/silver/open")).json()["detail"]["code"] == "no_chest"
    # hearts already full
    assert (await client.post("/v1/shop/buy", json={"offer_id": "hearts_full"})).json()["detail"]["code"] == "hearts_full"
    # Frost Ward only while the streak is alive
    assert (await client.post("/v1/shop/buy", json={"offer_id": "freeze"})).json()["detail"]["code"] == "streak_not_alive"
    # payments are a placeholder
    assert (await client.post("/v1/payments/checkout", json={"sku": "gems_80"})).status_code == 501
    led = (await client.get("/v1/wallet/ledger")).json()
    assert any(x["reason"] == "shop_item" and x["delta"] == -50 for x in led)


async def test_streak_quests_freeze(client, player):
    st = (await client.get("/v1/streak")).json()
    assert st["current"] == 0 and not st["today_done"]
    await play(client, "A1-W01-S01")  # one completed exercise is enough (admin msg 3060)
    st = (await client.get("/v1/streak")).json()
    assert st["current"] == 1 and st["today_done"]
    await play(client, "A1-W01-S02")  # a second one the same day does not add a day
    assert (await client.get("/v1/streak")).json()["current"] == 1
    await _set_wallet(player, coins=2000)
    for _ in range(2):
        assert (await client.post("/v1/shop/buy", json={"offer_id": "freeze"})).status_code == 200
    r = await client.post("/v1/shop/buy", json={"offer_id": "freeze"})
    assert r.json()["detail"]["code"] == "max_freezes"
    qs = (await client.get("/v1/quests")).json()
    assert len([q for q in qs if q["period"] == "daily"]) == 4 and len([q for q in qs if q["period"] == "weekly"]) == 4
    bonus = next(q for q in qs if q["id"].endswith(":all"))
    r = await client.post(f"/v1/quests/{bonus['id']}/claim")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "quest_not_done"
    for q in qs:
        if q["claimable"]:
            r = (await client.post(f"/v1/quests/{q['id']}/claim")).json()
            assert r["reward"] == q["reward"]
            again = await client.post(f"/v1/quests/{q['id']}/claim")
            assert again.json()["detail"]["code"] == "already_claimed"


async def test_streak_freeze_covers_missed_day(client, player):
    import uuid
    from app.models import Streak
    from app.timeutil import local_day
    uid = uuid.UUID(player["id"])
    today = local_day("Asia/Tehran")
    async with SessionLocal() as db:
        st = await db.get(Streak, uid)
        st.current, st.best, st.last_active_day, st.freezes = 5, 5, today - timedelta(days=2), 1
        await db.commit()
    assert (await client.get("/v1/streak")).json()["current"] == 5  # frozen, not broken
    await play(client, "A1-W01-S01")
    st = (await client.get("/v1/streak")).json()
    assert st["current"] == 6 and st["freezes"] == 0
    async with SessionLocal() as db:
        s = await db.get(Streak, uid)
        s.last_active_day = today - timedelta(days=3)
        await db.commit()
    assert (await client.get("/v1/streak")).json()["current"] == 0


async def test_league_ignores_boost(client, player):
    await _set_wallet(player, coins=1000)
    assert (await client.post("/v1/shop/buy", json={"offer_id": "xp_boost"})).status_code == 200
    _, res = await play(client, "A1-W01-S01")
    n = res["total"]
    assert res["rewards"]["boosted"] and res["rewards"]["xp"] == 2 * res["rewards"]["xp_base"]
    assert res["league_points"] == 10 * n  # all correct: 10 x correct x accuracy, never boosted
    lg = (await client.get("/v1/league")).json()
    me = next(e for e in lg["entries"] if e["isMe"])
    assert me["lp"] == 10 * n and len(lg["entries"]) == 15 and lg["tier"] == "bronze"
    assert "never" in lg["scoring"]


async def test_level_up_on_last_boss(client, player):
    """complete the whole of A1 quickly by marking earlier stages done, then beat the last boss"""
    import uuid
    uid = uuid.UUID(player["id"])
    async with SessionLocal() as db:
        ids = (await db.execute(select(Stage.id).where(Stage.level == "A1", Stage.required.is_(True),
                                                       Stage.id != "A1-W09-S13"))).scalars().all()
        for sid in ids:
            db.add(UserProgress(user_id=uid, stage_id=sid, best_stars=3, attempts=1, best_accuracy=1.0,
                                completed_at=utcnow()))
        await db.commit()
    _, res = await play(client, "A1-W09-S13")  # the consolidation world's boss closes the level
    assert res["level_completed"] and res["me"]["level"] == "A2"
    assert (await client.get("/v1/map/A2")).json()["worlds"][0]["stages"][0]["status"] == "current"
    assert any(i["item_id"] == "coat_fire" for i in res["rewards"]["items"])  # ex-C2 item = consolidation boss drop
    # the Oracle Gate (in the consolidation world) opened once stage 12 was done
    m = (await client.get("/v1/map/A1")).json()
    gate = m["worlds"][-1]["stages"][-1]
    assert gate["variant"] == "gate" and gate["status"] == "current"


async def test_import_is_idempotent(tmp_path, seeded):
    from scripts import import_questions as imp
    d = tmp_path / "qdb" / "echo"
    d.mkdir(parents=True)
    line = {"game": "echo", "id": "ec-A1-G01-99999", "level": "A1", "difficulty": 1, "grammar": ["A1-G01"],
            "skills": [], "topic": "home", "data": {"text": "Where is the station?"}}
    (d / "A1.jsonl").write_text(json.dumps(line) + "\n" + '{"half": ')
    (d / "C2.jsonl").write_text(json.dumps({**line, "id": "ec-C2-x", "level": "C2"}) + "\n")
    import io, contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        await imp.main(tmp_path / "qdb", False)
    first = json.loads(buf.getvalue())
    assert first["inserted"] == 1 and first["bad_json"] == 1 and first["skipped_level"] == 1
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        await imp.main(tmp_path / "qdb", False)
    second = json.loads(buf.getvalue())
    assert second["inserted"] == 0 and second["unchanged"] == 1
    line["data"]["text"] = "Where is the bus stop?"
    (d / "A1.jsonl").write_text(json.dumps(line) + "\n")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        await imp.main(tmp_path / "qdb", False)
    assert json.loads(buf.getvalue())["updated"] == 1


async def test_import_topic_id_and_topic_first_selection(tmp_path, seeded):
    import contextlib
    import io
    import uuid
    from app.services import selection
    from scripts import import_questions as imp
    d = tmp_path / "qdb" / "oracle-trial"
    d.mkdir(parents=True)
    base = {"game": "oracle-trial", "level": "A1", "difficulty": 2, "grammar": ["A1-G02"], "skills": [],
            "topic": "home", "data": {"skill": "Grammar", "prompt": "This is ___ bag.", "answer": "my",
                                      "wrong": ["me", "I", "mine"]}}
    lines = [{**base, "id": "or-A1-possessive-adjectives-1", "topic_id": "a1-possessive-adjectives"},
             {**base, "id": "or-A1-subject-pronouns-1", "topic_id": "a1-subject-pronouns"},
             {**base, "id": "or-A1-bogus-1", "topic_id": "a1-no-such-topic"}]
    (d / "A1.jsonl").write_text("".join(json.dumps(x) + "\n" for x in lines))
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        await imp.main(tmp_path / "qdb", False)
    st = json.loads(buf.getvalue())
    assert st["with_topic_id"] == 2 and st["unknown_topic"] == 1
    uid = uuid.uuid4()
    async with SessionLocal() as db:
        exact = await selection._pick(db, uid, 50, topic_ids=["a1-possessive-adjectives"])
        assert [q.id for q in exact] == ["or-A1-possessive-adjectives-1"]
        # code-map pass: untagged A1-G02 items and our own topic, never an item generated for another topic
        via_codes = {q.id for q in await selection._pick(db, uid, 400, codes=["A1-G02"],
                                                         topic_ids=["a1-possessive-adjectives"])}
        assert "or-A1-possessive-adjectives-1" in via_codes and "or-A1-bogus-1" in via_codes
        assert "or-A1-subject-pronouns-1" not in via_codes


async def test_onboarding_name_level_goal_flags(client, player):
    assert player["onboarded"] is False and player["flags"] == {}
    r = await client.patch("/v1/me", json={"display_name": "  Mira   Vale ", "level": "B1", "daily_goal": 1,
                                           "flags": {"tour": "pending", "bogus": 1, "look": "nope"}})
    me = r.json()
    assert r.status_code == 200 and me["display_name"] == "Mira Vale" and me["level"] == "B1"
    assert me["daily_goal"] == 1 and me["flags"] == {"tour": "pending"} and me["onboarded"] is False
    assert (await client.patch("/v1/me", json={"display_name": "x"})).status_code == 422
    me = (await client.patch("/v1/me", json={"onboarded": True, "flags": {"tour": "done"}})).json()
    assert me["onboarded"] is True and me["flags"]["tour"] == "done"
    lv = (await client.get("/v1/levels")).json()
    assert [x["unlocked"] for x in lv] == [True, True, True, False, False]
    b1 = (await client.get("/v1/map/B1")).json()
    assert b1["worlds"][0]["stages"][0]["status"] == "current"
    qs = (await client.get("/v1/quests")).json()
    win = [q for q in qs if q["id"].endswith(":win")]
    assert not win or (win[0]["target"] == 1 and win[0]["title"] == "Win a stage")
    # nothing is due in the Cauldron on day one: no review quest
    assert not any(q["id"].endswith(":cauldron") for q in qs)
    items = (await client.get("/v1/placement/items?per_level=3")).json()
    assert items and all(q["game"] == "oracle-trial" for q in items)


async def test_lesson_starts_with_its_own_grammar(client, player):
    r = await client.post("/v1/stages/A1-W01-S01/start")
    qs = r.json()["questions"]
    first = qs[0]
    assert first["game"] not in ("bubble-pop", "match-blitz", "memory-crystals", "gap-gate")
    assert first["topic_id"] == r.json()["stage"]["topic_id"]
    vocab = [i for i, q in enumerate(qs) if q["game"] in ("bubble-pop", "match-blitz", "memory-crystals", "gap-gate")]
    assert all(i >= len(qs) - len(vocab) for i in vocab)


async def test_achievements_pay_once(client, player):
    a = (await client.get("/v1/achievements")).json()
    assert len(a) > 60 and not any(x["id"].startswith("hints.") for x in a)
    assert (await client.post("/v1/achievements/journey.1/claim")).status_code == 409
    await play(client, "A1-W01-S01")
    a = {x["id"]: x for x in (await client.get("/v1/achievements")).json()}
    assert a["played.1"]["progress"] == 1 and a["correct.1"]["progress"] > 0 and a["explorer.1"]["progress"] >= 1
    # reach "Rising Mage I" (level 5) directly and claim it
    from app.models import User
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.display_name == "Apprentice").values(player_level=5))
        await db.commit()
    g0 = (await client.get("/v1/wallet")).json()["gems"]
    r = await client.post("/v1/achievements/level.1/claim")
    assert r.status_code == 200 and r.json()["reward"] == {"gems": 2} and r.json()["wallet"]["gems"] == g0 + 2
    assert next(x for x in r.json()["achievements"] if x["id"] == "level.1")["claimed"] is True
    assert (await client.post("/v1/achievements/level.1/claim")).status_code == 409
    assert (await client.post("/v1/achievements/nope.1/claim")).status_code == 404


async def test_league_names_are_not_all_apprentice(client, player):
    await play(client, "A1-W01-S01")
    lg = (await client.get("/v1/league")).json()
    me = next(e for e in lg["entries"] if e["isMe"])
    assert me["name"].startswith("Apprentice ") and me["name"] != "Apprentice"
