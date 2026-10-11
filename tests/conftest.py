"""Tests run against the separate `runecast_test` database (same Postgres server, same `runecast` role).
The schema is rebuilt from the Alembic migrations, then seeded, then filled with a small synthetic question bank so
the tests do not depend on the live pipeline output."""
import os

os.environ["RUNECAST_DB_NAME"] = os.environ.get("RUNECAST_TEST_DB_NAME", "runecast_test")
os.environ["RUNECAST_MIN_SECONDS_PER_QUESTION"] = "0"
os.environ["RUNECAST_ROOT_PATH"] = ""

import asyncio  # noqa: E402
import uuid  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402

from app.config import get_settings  # noqa: E402
from tests.conftest_answers import correct_answer  # noqa: E402,F401

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


async def _reset_schema():
    eng = create_async_engine(get_settings().dsn)
    async with eng.begin() as c:
        await c.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await c.execute(text("CREATE SCHEMA public"))
    await eng.dispose()


def _questions():
    """small synthetic bank: oracle-trial items per A1 code + vocab + a few other game shapes"""
    rows = []
    codes = ["A1-G01", "A1-G02", "A1-G03", "A1-G11", "A1-G12", "A1-G04", "A1-G13", "A1-G18", "A1-G05", "A2-G21",
             "A1-G06", "A1-G17", "A1-G10", "A1-G09", "A1-G20", "A1-G15", "A1-G16", "A1-G23"]
    for code in codes:
        for i in range(14):
            rows.append(dict(id=f"t-or-{code}-{i}", game="oracle-trial", level="A1", difficulty=1 + i % 3,
                             grammar_codes=[code], skills=[], topic="home",
                             payload={"skill": "Grammar", "prompt": f"{code} ___ {i}", "answer": "is",
                                      "wrong": ["are", "am", "be"]}))
    for i in range(30):
        rows.append(dict(id=f"t-bp-{i}", game="bubble-pop", level="A1", difficulty=1, grammar_codes=[],
                         skills=["V-DEF"], topic="home",
                         payload={"front": f"word{i}", "back": f"meaning {i}", "distractors": ["a", "b", "c"],
                                  "mode": "synonym" if i < 20 else "definition"}))
    rows.append(dict(id="t-ro-1", game="rune-order", level="A1", difficulty=1, grammar_codes=["A1-G01"], skills=[],
                     topic="home", payload={"text": "Where is the golden key"}))
    rows.append(dict(id="t-cb-1", game="curse-breaker", level="A1", difficulty=1, grammar_codes=["A1-G01"],
                     skills=[], topic="home", payload={"text": "She are happy.", "bad": 1, "fix": "is",
                                                       "wrong": ["am", "be"], "why": "she uses is"}))
    rows.append(dict(id="t-ws-1", game="whisper-scroll", level="A1", difficulty=1, grammar_codes=["A1-G01"],
                     skills=[], topic="home", payload={"text": "I left my keys on the table", "gaps": [1, 3],
                                                       "extra": ["a", "b", "c"]}))
    return rows


@pytest.fixture(scope="session")
def migrated():
    asyncio.run(_reset_schema())
    cfg = Config(os.path.join(HERE, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(HERE, "alembic"))
    command.upgrade(cfg, "head")
    return True


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def seeded(migrated):
    from scripts import seed
    from app.db import SessionLocal
    from app.models import Question
    import hashlib
    import json
    await seed.main()
    async with SessionLocal() as db:
        for r in _questions():
            r["content_hash"] = hashlib.sha1(json.dumps(r["payload"], sort_keys=True).encode()).hexdigest()
            db.add(Question(**r))
        await db.commit()
    return True


@pytest.fixture(autouse=True)
def _events_off():
    """Phase E: the weekly events follow the real weekday; every test runs with them off unless it turns one on"""
    from app.services import events as EV
    EV.FORCE = set()
    yield
    EV.FORCE = set()


@pytest_asyncio.fixture(loop_scope="session")
async def client(seeded):
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture(loop_scope="session")
async def player(client):
    r = await client.post("/v1/auth/guest", json={"device_id": f"test-{uuid.uuid4()}", "timezone": "Asia/Tehran"})
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    client.headers["Authorization"] = f"Bearer {tok}"
    return r.json()["user"]
