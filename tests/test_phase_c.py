"""Phase C (UX audit 10-11): tutorial flags, Focus mode reward cap, tutorial sample items."""
import pytest

from tests.conftest import correct_answer

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_tutorial_flags_merge(client, player):
    me = (await client.patch("/v1/me", json={"flags": {"tut": ["rune-order", "bogus"], "focus": "on"}})).json()
    assert me["flags"]["tut"] == ["rune-order"] and me["flags"]["focus"] == "on"
    me = (await client.patch("/v1/me", json={"flags": {"tut": ["gap-gate"], "focus": "maybe"}})).json()
    assert me["flags"]["tut"] == ["gap-gate", "rune-order"] and me["flags"]["focus"] == "on"
    me = (await client.patch("/v1/me", json={"flags": {"tut": "reset"}})).json()
    assert "tut" not in me["flags"]


async def test_focus_mode_caps_stars_and_league(client, player):
    s = (await client.post("/v1/stages/A1-W01-S01/start")).json()
    answers = [{"qid": q["qid"], "answer": correct_answer(q)} for q in s["questions"]]
    res = (await client.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers, "focus": True})).json()
    assert res["correct"] == res["total"] and res["stars"] == 2 and res["league_points"] == 0 and res["focus"] is True


async def test_samples(client):
    r = await client.get("/v1/samples/match-blitz?n=3")
    assert r.status_code == 200 and len(r.json()) == 3 and all(q["game"] == "match-blitz" and q["payload"] for q in r.json())
    assert (await client.get("/v1/samples/nope")).status_code == 404
