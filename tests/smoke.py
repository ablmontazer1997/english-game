"""Smoke test against the deployed API (not collected by pytest).

    python -m tests.smoke [base_url]     default https://bingual.app/runecast-api

Uses one fixed device id, so re-runs reuse the same "smoke" account instead of creating new ones.
"""
import sys
import time

import httpx

from tests.conftest_answers import correct_answer

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://bingual.app/runecast-api").rstrip("/")


def check(cond, msg):
    print(("ok   " if cond else "FAIL ") + msg)
    if not cond:
        sys.exit(1)


def main():
    c = httpx.Client(base_url=BASE, timeout=20, headers={"User-Agent": "english-spell-smoke"})
    r = c.get("/health")
    check(r.status_code == 200 and r.json()["db"], f"health {r.status_code} {r.text[:80]}")
    check(c.get("/openapi.json").json()["info"]["title"] == "English Spell API", "openapi title")
    r = c.post("/v1/auth/guest", json={"device_id": "smoke-test-device-0001", "display_name": "Smoke Tester"})
    check(r.status_code == 200, f"auth/guest {r.status_code}")
    c.headers["Authorization"] = "Bearer " + r.json()["token"]
    check(c.get("/v1/me").status_code == 200, "me")
    lv = c.get("/v1/levels").json()
    check([x["code"] for x in lv] == ["A1", "A2", "B1", "B2", "C1"], "levels A1..C1")
    m = c.get("/v1/map/A1").json()
    check(len(m["worlds"]) == 9 and len(m["worlds"][0]["stages"]) == 14 and m["worlds"][-1]["consolidation"],
          "map A1: 8 topic worlds + 1 consolidation, 13+1 stages in W1")
    s = c.post("/v1/stages/A1-W01-S01/start").json()
    check(len(s["questions"]) > 0, f"stage start: {len(s['questions'])} questions, games "
                                   f"{sorted({q['game'] for q in s['questions']})}")
    answers = [{"qid": q["qid"], "answer": correct_answer(q), "correct": True} for q in s["questions"]]
    time.sleep(1.6 * len(answers))  # the server refuses impossibly fast completions
    r = c.post(f"/v1/sessions/{s['session_id']}/complete", json={"answers": answers})
    check(r.status_code == 200, f"complete {r.status_code} {r.text[:200]}")
    res = r.json()
    print(f"     stars {res['stars']} correct {res['correct']}/{res['total']} (unverified {res['unverified']}) "
          f"xp {res['rewards']['xp']} coins {res['rewards']['coins']} lp {res['league_points']}")
    check(res["srs_updated"] == res["total"], "srs updated for every question")
    check("hearts" in c.get("/v1/wallet").json(), "wallet")
    check(len(c.get("/v1/shop").json()["items"]) == 27, "shop: 27 gem items")
    check(len(c.get("/v1/chests").json()) == 3, "chests with odds")
    check(len(c.get("/v1/quests").json()) == 8, "quests 4 daily + 4 weekly")
    check("current" in c.get("/v1/streak").json(), "streak")
    check(len(c.get("/v1/league").json()["entries"]) == 15, "league table of 15")
    check("due_count" in c.get("/v1/review/today").json(), "review queue")
    check(len(c.get("/v1/inventory").json()["items"]) >= 19, "inventory")
    check(c.post("/v1/payments/checkout", json={"product_id": "gems_100"}).status_code == 503, "payments off (503 Coming soon)")
    print("SMOKE PASSED")


if __name__ == "__main__":
    main()
