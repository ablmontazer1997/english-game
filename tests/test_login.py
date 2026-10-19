"""admin 6018: username + password login (POST /v1/auth/login) and its failed-try rate limit."""
import uuid

import pytest
from sqlalchemy import delete

from app.db import SessionLocal
from app.models import LoginAttempt, User
from app.passwords import hash_password
from app.routers.api import new_player

ASYNC = pytest.mark.asyncio(loop_scope="session")


async def _account(name: str, pw: str) -> str:
    async with SessionLocal() as db:
        u = await new_player(db, device_id=None, kind="registered")
        u.username = name
        u.password_hash = hash_password(pw)
        await db.commit()
        return str(u.id)


@ASYNC
async def test_login_ok_wrong_and_guest_separate(client):
    name = "t" + uuid.uuid4().hex[:10]
    uid = await _account(name, "Secret-pass-42")
    client.headers.pop("Authorization", None)
    r = await client.post("/v1/auth/login", json={"username": name.upper() + " ", "password": "Secret-pass-42"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["user"]["id"] == uid and out["user"]["onboarded"] is False and out["user"]["kind"] == "registered"
    me = await client.get("/v1/me", headers={"Authorization": f"Bearer {out['token']}"})
    assert me.json()["id"] == uid
    w = await client.get("/v1/wallet", headers={"Authorization": f"Bearer {out['token']}"})
    assert w.status_code == 200 and w.json()["hearts"] > 0
    bad = await client.post("/v1/auth/login", json={"username": name, "password": "nope"})
    assert bad.status_code == 401 and bad.json()["detail"]["code"] == "bad_login"
    miss = await client.post("/v1/auth/login", json={"username": "no-such-" + name, "password": "x"})
    assert miss.status_code == 401 and miss.json()["detail"]["code"] == "bad_login"


@ASYNC
async def test_login_rate_limit(client):
    name = "r" + uuid.uuid4().hex[:10]
    await _account(name, "Right-pass-77")
    for _ in range(5):
        r = await client.post("/v1/auth/login", json={"username": name, "password": "wrong"},
                              headers={"cf-connecting-ip": "10.9.9.9"})
        assert r.status_code == 401
    r = await client.post("/v1/auth/login", json={"username": name, "password": "Right-pass-77"},
                          headers={"cf-connecting-ip": "10.9.9.10"})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "too_many_attempts"
    async with SessionLocal() as db:
        await db.execute(delete(LoginAttempt).where(LoginAttempt.username == name))
        await db.commit()
    r = await client.post("/v1/auth/login", json={"username": name, "password": "Right-pass-77"})
    assert r.status_code == 200
