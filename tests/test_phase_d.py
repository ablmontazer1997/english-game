"""Phase D (admin msg 4839): real-money store behind the switch, Season Pass, Web Push reminders."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, update

from app import catalog as C
from app.config import get_settings
from app.db import SessionLocal
from app.models import PushSubscription, SeasonProgress, Streak, User, UserItem
from app.services import payments as PAY
from app.services import push as PUSH
from app.services import season as SS
from app.timeutil import local_day, utcnow
from tests.conftest import correct_answer

pytestmark = pytest.mark.asyncio(loop_scope="session")
FCM = "https://fcm.googleapis.com/fcm/send/abc:"


async def _user(player, **vals):
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == uuid.UUID(player["id"])).values(**vals))
        await db.commit()


async def _win(client, stage_id="A1-W01-S01", focus=False):
    s = (await client.post(f"/v1/stages/{stage_id}/start")).json()
    answers = [{"qid": q["qid"], "answer": correct_answer(q)} for q in s["questions"]]
    r = await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers, "focus": focus})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- the store while payments are OFF
async def test_store_is_built_but_locked(client, player):
    assert get_settings().payments_enabled is False and not PAY.enabled()
    st = (await client.get("/v1/store")).json()
    ids = [p["id"] for p in st["products"]]
    assert st["payments_enabled"] is False
    assert ids == ["gems_100", "gems_300", "gems_1000", "starter_pack", "premium_month", "season_premium"]
    assert [p["gems"] for p in st["products"][:3]] == [100, 300, 1000]
    assert all(p["cta"] == "Coming soon" and p["price_label"] is None and not p["available"] for p in st["products"])
    assert st["starter"]["eligible"] and st["starter_gems"] == 200 and len(st["starter_items"]) == 4
    assert st["premium"]["cloaks"] == ["coat_star", "coat_shadow"] and len(st["premium"]["set"]["items"]) == 4
    for pid in ids:
        r = await client.post("/v1/payments/checkout", json={"product_id": pid})
        assert r.status_code == 503 and r.json()["detail"]["code"] == "payments_disabled"
    assert (await client.post("/v1/payments/checkout", json={"product_id": "nope"})).status_code == 404
    r = await client.post("/v1/payments/confirm", json={"purchase_id": str(uuid.uuid4())})
    assert r.status_code == 503
    # premium / starter / season items exist, are locked and cannot be bought with gems
    wd = {i["id"]: i for i in (await client.get("/v1/wardrobe")).json()["items"]}
    sid = SS.season_id()
    theme = C.theme_for(sid)
    for iid in [s[0] for s in theme["set"]] + [theme["pass_cloak"][0], "pack_wayfarer_coat", "coat_star"]:
        assert wd[iid]["tier"] == "premium" and not wd[iid]["owned"] and not wd[iid]["buyable"], iid
        r = await client.post("/v1/wardrobe/buy", json={"item_id": iid})
        assert r.json()["detail"]["code"] == "not_for_sale"
    assert wd[theme["set"][0][0]]["recolour"]["base"] == theme["set"][0][3]
    other = next(t for t in C.SEASON_THEMES if t["key"] != theme["key"])
    assert other["set"][0][0] not in wd          # other months' sets stay hidden
    # the shop carries the store too
    shop = (await client.get("/v1/shop")).json()
    assert shop["store"]["products"][0]["cta"] == "Coming soon"


async def test_starter_pack_first_week_only(client, player):
    await _user(player, created_at=utcnow() - timedelta(days=8))
    st = (await client.get("/v1/store")).json()
    assert not st["starter"]["eligible"] and "starter_pack" not in [p["id"] for p in st["products"]]


class FakeAdapter:
    """test-only provider: nothing real is wired in the app"""
    name = "fake"

    async def create_checkout(self, purchase, product, user):
        return {"redirect": f"https://pay.example/{purchase.id}"}

    async def verify(self, purchase, payload):
        return payload.get("ref") if payload.get("paid") else None


@pytest.fixture
def payments_on(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "payments_enabled", True)
    monkeypatch.setattr(s, "payment_provider", "fake")
    monkeypatch.setitem(PAY.ADAPTERS, "fake", FakeAdapter())
    yield


async def _buy(client, pid, ref):
    r = await client.post("/v1/payments/checkout", json={"product_id": pid})
    assert r.status_code == 200, r.text
    r = await client.post("/v1/payments/confirm", json={"purchase_id": r.json()["purchase_id"],
                                                        "payload": {"paid": True, "ref": ref}})
    assert r.status_code == 200, r.text
    return r.json()


async def test_flow_behind_the_switch(client, player, payments_on):
    assert PAY.enabled()
    st = (await client.get("/v1/store")).json()
    assert st["payments_enabled"] and st["products"][0]["cta"] == "Buy"
    w0 = (await client.get("/v1/wallet")).json()["gems"]
    out = await _buy(client, "gems_300", f"r-{uuid.uuid4()}")
    assert out["wallet"]["gems"] == w0 + 300
    # an unpaid confirm fails and grants nothing
    c = (await client.post("/v1/payments/checkout", json={"product_id": "gems_100"})).json()
    r = await client.post("/v1/payments/confirm", json={"purchase_id": c["purchase_id"], "payload": {"paid": False}})
    assert r.status_code == 402
    # starter pack: once
    out = await _buy(client, "starter_pack", f"r-{uuid.uuid4()}")
    assert out["granted"]["gems"] == 200 and set(out["granted"]["items"]) == {s[0] for s in C.STARTER_SET}
    r = await client.post("/v1/payments/checkout", json={"product_id": "starter_pack"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "not_eligible"
    # premium: cloaks + this month's set, ~30 days
    out = await _buy(client, "premium_month", f"r-{uuid.uuid4()}")
    theme = C.theme_for(SS.season_id())
    assert set(out["granted"]["items"]) >= set(C.PREMIUM_CLOAKS) | {s[0] for s in theme["set"]}
    assert out["granted"]["premium_until"] > (utcnow() + timedelta(days=29)).timestamp() * 1000
    # season premium track unlocks
    await _buy(client, "season_premium", f"r-{uuid.uuid4()}")
    sv = (await client.get("/v1/season")).json()
    assert sv["premium"] is True


# ---------------------------------------------------------------- Season Pass
async def test_season_xp_and_free_claims(client, player):
    sv = (await client.get("/v1/season")).json()
    assert sv["season_id"] == SS.season_id() and sv["xp"] == 0 and len(sv["tiers"]) == 30 and sv["premium"] is False
    assert sv["tiers"][29]["free"] == {"item": C.theme_for(sv["season_id"])["pass_hat"]}
    res = await _win(client)
    assert res["season"]["added"] == C.SEASON_XP_STAGE_WIN + C.SEASON_XP_PER_STAR * res["stars"]
    # not reached yet
    r = await client.post("/v1/season/claim", json={"tier": 1, "track": "free"})
    assert r.json()["detail"]["code"] == "tier_locked"
    async with SessionLocal() as db:
        await db.execute(update(SeasonProgress).where(SeasonProgress.user_id == uuid.UUID(player["id"]))
                         .values(xp=30 * C.SEASON_TIER_XP))
        await db.commit()
    coins0 = (await client.get("/v1/wallet")).json()["coins"]
    r = (await client.post("/v1/season/claim", json={"tier": 1, "track": "free"})).json()
    assert r["reward"] == {"coins": 100} and r["wallet"]["coins"] == coins0 + 100
    assert (await client.post("/v1/season/claim", json={"tier": 1, "track": "free"})).json()["detail"]["code"] == "already_claimed"
    # premium track is visible but locked
    r = await client.post("/v1/season/claim", json={"tier": 1, "track": "premium"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "premium_locked"
    # a dye on a starter garment, then the hat
    r = (await client.post("/v1/season/claim", json={"tier": 8, "track": "free"})).json()
    assert "dye" in r["reward"] and r["reward"]["dye"] in (await client.get("/v1/wardrobe")).json()["dyes"]
    r = (await client.post("/v1/season/claim", json={"tier": 30, "track": "free"})).json()
    hat = C.theme_for(SS.season_id())["pass_hat"]
    assert r["reward"] == {"item": hat}
    async with SessionLocal() as db:
        assert await db.get(UserItem, (uuid.UUID(player["id"]), hat)) is not None
    sv = r["season"]
    assert sv["tiers"][29]["free_claimed"] and sv["tiers"][1]["free_claimable"]


async def test_owned_hat_turns_into_gems(client, player):
    hat = C.theme_for(SS.season_id())["pass_hat"]
    async with SessionLocal() as db:
        db.add(UserItem(user_id=uuid.UUID(player["id"]), item_id=hat, source="shop"))
        db.add(SeasonProgress(user_id=uuid.UUID(player["id"]), season_id=SS.season_id(), xp=9999,
                              free_claimed=[], premium_claimed=[]))
        await db.commit()
    r = (await client.post("/v1/season/claim", json={"tier": 30, "track": "free"})).json()
    assert r["reward"] == {"gems": 50, "instead_of": hat}


async def test_focus_and_daily_caps(client, player):
    assert SS.stage_xp(3, False) == 50 and SS.stage_xp(2, True) == C.SEASON_FOCUS_MAX and SS.stage_xp(0, True) == 5
    res = await _win(client, focus=True)
    assert res["stars"] <= 2 and res["season"]["added"] <= C.SEASON_FOCUS_MAX
    async with SessionLocal() as db:
        u = await db.get(User, uuid.UUID(player["id"]))
        out = await SS.add_xp(db, u, 5000)
        assert out["capped"] and out["added"] == C.SEASON_XP_DAILY_CAP - res["season"]["added"]
        out = await SS.add_xp(db, u, 10)
        assert out["added"] == 0
        await db.commit()


async def test_monthly_reset_is_server_side(client, player):
    async with SessionLocal() as db:
        u = await db.get(User, uuid.UUID(player["id"]))
        await SS.add_xp(db, u, 300)
        now = utcnow()
        nxt = SS.next_reset(now) + timedelta(hours=1)
        v_now = await SS.view(db, u, now)
        v_next = await SS.view(db, u, nxt)
        await db.commit()
    assert v_now["xp"] == 300 and v_next["xp"] == 0 and v_next["season_id"] != v_now["season_id"]
    assert v_next["starts_at"] == v_now["ends_at"]
    assert C.theme_for(v_next["season_id"])["key"] != C.theme_for(v_now["season_id"])["key"]
    assert SS.season_bounds("2026-12")[1] == datetime(2027, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------- Web Push
async def test_push_subscribe_and_turn_off(client, player):
    k = (await client.get("/v1/push/key")).json()
    assert "enabled" in k
    bad = {"endpoint": "http://169.254.169.254/latest", "keys": {"p256dh": "x" * 40, "auth": "y" * 16}}
    assert (await client.post("/v1/push/subscribe", json=bad)).status_code == 422
    bad["endpoint"] = "https://evil.example.com/push"
    assert (await client.post("/v1/push/subscribe", json=bad)).status_code == 422
    sub = {"endpoint": FCM + uuid.uuid4().hex, "keys": {"p256dh": "B" * 87, "auth": "a" * 22}}
    st = (await client.post("/v1/push/subscribe", json=sub)).json()
    assert st["subscribed"] and st["devices"] == 1 and 9 <= st["reminder_hour"] <= 21
    st = (await client.post("/v1/push/subscribe", json=sub)).json()   # same browser again: still one row
    assert st["devices"] == 1
    st = (await client.post("/v1/push/unsubscribe", json={"endpoint": sub["endpoint"]})).json()
    assert not st["subscribed"]


async def test_reminder_rules_and_worker(client, player, monkeypatch):
    """10-20: the worker sends what the planner (services/remind.py) plans for today, once a day"""
    from app import push_worker
    from app.timeutil import tz_of
    uid = uuid.UUID(player["id"])
    sub = {"endpoint": FCM + uuid.uuid4().hex, "keys": {"p256dh": "B" * 87, "auth": "a" * 22}}
    await client.post("/v1/push/subscribe", json=sub)
    st = (await client.post("/v1/push/prefs", json={"minute": 18 * 60, "events": False})).json()
    assert st["minute"] == 1080 and st["on"] and st["events"] is False
    s = get_settings()
    monkeypatch.setattr(s, "vapid_public_key", "pub")
    monkeypatch.setattr(s, "vapid_private_key", "priv")
    sent = []
    monkeypatch.setattr(PUSH, "send_one", lambda sub, payload, ttl=0: sent.append(payload) or 201)
    async with SessionLocal() as db:
        u = await db.get(User, uid)
        tz = tz_of(u.timezone)
        now = datetime.now(tz).replace(hour=18, minute=5, second=0, microsecond=0).astimezone(timezone.utc)
        today = local_day(u.timezone, now)
        st = await db.get(Streak, uid)
        st.current, st.freezes, st.last_active_day = 4, 0, today       # played today -> nothing today
        await db.commit()
        assert (await PUSH.due(db, u, now))[1] == "nothing_today"
        st.last_active_day = today - timedelta(days=1)                   # yesterday -> day 1, fire at risk
        await db.commit()
        item, why = await PUSH.due(db, u, now)
        assert item and why == "d1_streak" and "4" in item["title"] + item["body"]
        assert (await PUSH.due(db, u, now - timedelta(hours=1)))[1] == "not_yet"
        u.notify_prefs = {**u.notify_prefs, "on": False}
        await db.commit()
        assert (await PUSH.due(db, u, now))[1] == "off"
        u.notify_prefs = {**u.notify_prefs, "on": True}
        u.last_reminder_day = None
        await db.commit()
    monkeypatch.setattr(push_worker, "utcnow", lambda: now)
    c = await push_worker.run()
    assert c["sent"] >= 1 and sent and "4" in (sent[-1]["title"] + sent[-1]["body"])
    assert "/runecast/?go=map" in sent[-1]["url"]
    n_before = len(sent)
    c = await push_worker.run()          # once a day at most
    assert len(sent) == n_before
    # a gone endpoint is deleted
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == uid).values(last_reminder_day=None))
        await db.commit()
    monkeypatch.setattr(PUSH, "send_one", lambda sub, payload, ttl=0: 410)
    c = await push_worker.run()
    assert c["gone"] >= 1
    async with SessionLocal() as db:
        left = (await db.execute(select(PushSubscription).where(PushSubscription.user_id == uid))).scalars().all()
        assert left == []
    # the Android plan: the whole ladder, day 1..30
    plan = (await client.get("/v1/push/plan")).json()
    assert plan["on"] and len(plan["items"]) >= 6
    assert plan["items"][-1]["tier"] == "d30"


async def test_vapid_payload_round_trip():
    """real encryption + VAPID signing with throwaway keys, decrypted like a browser would"""
    import base64
    import json as _json
    import http_ece
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from py_vapid import Vapid
    from pywebpush import WebPusher

    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
    ua = ec.generate_private_key(ec.SECP256R1())
    pub = ua.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    auth = b"0123456789abcdef"
    info = {"endpoint": FCM + "x", "keys": {"p256dh": b64(pub), "auth": b64(auth)}}
    body = _json.dumps({"title": "t", "body": "b"})
    enc = WebPusher(info).encode(body.encode(), "aes128gcm")
    plain = http_ece.decrypt(enc["body"], private_key=ua, auth_secret=auth, version="aes128gcm")
    assert _json.loads(plain) == {"title": "t", "body": "b"}
    v = Vapid()
    v.generate_keys()
    hdr = v.sign({"sub": "mailto:test@example.com", "aud": "https://fcm.googleapis.com"})
    assert hdr["Authorization"].startswith("vapid t=")
