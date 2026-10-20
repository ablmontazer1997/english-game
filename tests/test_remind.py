"""10-20 reminder planner (admin 6138): pure rules, no DB."""
from datetime import date, datetime, timedelta, timezone

from app.services import remind as R

TZ = "Asia/Tehran"
UTC = timezone.utc
WED = date(2026, 10, 21)        # a Wednesday


def at(d: date, h: int, m: int = 0, tz: str = TZ) -> datetime:
    from app.timeutil import tz_of
    return datetime(d.year, d.month, d.day, h, m, tzinfo=tz_of(tz)).astimezone(UTC)


def base(**k):
    s = {"uid": "u1", "tz": TZ, "minute": 19 * 60, "events": False, "anchor": WED, "streak": 5, "freezes": 0,
         "name": "Sara", "level": 4}
    s.update(k)
    return s


def tiers(items):
    return [(i["day"], i["tier"]) for i in items]


def test_ladder_days_and_tiers_with_streak():
    items = R.plan(base(), at(WED, 20))
    days = [(date.fromisoformat(i["day"]) - WED).days for i in items]
    assert days == [1, 2, 3, 5, 7, 14, 30]
    t = [i["tier"] for i in items]
    assert t[:3] == ["d1_streak", "fire_out", "fire_last"] and t[3:] == ["d5", "d7", "d14", "d30"]
    assert all(i["at"].astimezone(UTC) == at(date.fromisoformat(i["day"]), 19) for i in items)


def test_one_a_day_and_titles_fit():
    items = R.plan(base(events=True), at(WED, 20))
    assert len({i["day"] for i in items}) == len(items)
    assert all(len(i["title"]) <= R.TITLE_MAX for i in items)
    assert all("{" not in i["title"] + i["body"] for i in items)


def test_frost_wards_and_relight():
    t = [i["tier"] for i in R.plan(base(freezes=1), at(WED, 20))]
    assert t[:3] == ["d1_streak", "freeze", "fire_out"]
    t = [i["tier"] for i in R.plan(base(freezes=2), at(WED, 20))]
    assert t[:3] == ["d1_streak", "freeze", "freeze"]


def test_no_streak_soft_story():
    t = [i["tier"] for i in R.plan(base(streak=0), at(WED, 20))]
    assert t == ["d1_soft", "d2", "d3", "d5", "d7", "d14", "d30"]


def test_milestone_and_hat():
    it = R.plan(base(streak=6), at(WED, 20))[0]
    assert it["tier"] == "d1_milestone" and "7" in it["title"]


def test_past_items_skipped_and_anchor_never_future():
    items = R.plan(base(anchor=WED - timedelta(days=2)), at(WED, 20))
    assert all(i["at"] > at(WED, 20) for i in items)
    assert R.plan(base(anchor=WED + timedelta(days=3)), at(WED, 8))[0]["day"] == (WED + timedelta(days=1)).isoformat()


def test_events_replace_plain_beats_only():
    # anchor Tuesday: day 1 = Wednesday (Double XP) takes the streak beat with a streak variant
    tue = WED - timedelta(days=1)
    items = R.plan(base(anchor=tue, events=True), at(tue, 20))
    first = items[0]
    assert first["tier"] == "double_xp" and "5-day" in first["body"]
    # day 2 is a relight beat: never replaced
    assert items[1]["tier"] == "fire_out"


def test_event_week_cap_and_quiet():
    # streak 0, events on: Sat (boss) + Sun (league) + Wed (xp) in one week -> at most 2 that week
    mon = date(2026, 10, 19)
    s = base(anchor=mon, streak=0, events=True, league_sunday=date(2026, 10, 25), minute=23 * 60)
    items = R.plan(s, at(mon, 8))
    ev = [i for i in items if R.TIERS[i["tier"]].get("event")]
    wk = {}
    for i in ev:
        d = date.fromisoformat(i["day"])
        wk[d - timedelta(days=d.weekday())] = wk.get(d - timedelta(days=d.weekday()), 0) + 1
    assert ev and max(wk.values()) <= R.EVENT_WEEK_CAP
    from app.timeutil import tz_of
    for i in ev:   # events at 21:00 at the latest even when the reminder is at 23:00
        assert i["at"].astimezone(tz_of(TZ)).hour <= 21
    tiers_ev = [i["tier"] for i in ev]
    assert "league_end" in tiers_ev and "boss_rush" in tiers_ev and "double_xp" not in tiers_ev[:2]
    # a day-7 story beat is never replaced: league on day 7 is skipped
    s2 = base(anchor=mon - timedelta(days=1), streak=0, events=True, league_sunday=date(2026, 10, 25))
    assert "league_end" not in [i["tier"] for i in R.plan(s2, at(mon, 8))]


def test_league_only_this_week():
    mon = date(2026, 10, 19)
    s = base(anchor=mon, streak=0, events=True, league_sunday=date(2026, 10, 25))
    items = R.plan(s, at(mon, 20))
    assert [i["day"] for i in items if i["tier"] == "league_end"] == ["2026-10-25"]


def test_season_end_needs_rewards():
    s = base(anchor=date(2026, 10, 28), streak=0, events=True, season_end_local=date(2026, 11, 1), season_rewards=0)
    assert "season_end" not in [i["tier"] for i in R.plan(s, at(date(2026, 10, 28), 20))]
    s["season_rewards"] = 3
    it = [i for i in R.plan(s, at(date(2026, 10, 28), 20)) if i["tier"] == "season_end"]
    assert it and it[0]["day"] == "2026-10-31" and "3" in it[0]["body"]


def test_same_day_quest_nudge():
    now = at(WED, 12)
    s = base(anchor=WED, played_at=at(WED, 11), quests_left=1)
    items = R.plan(s, now)
    assert items[0]["tier"] == "quests_left" and items[0]["day"] == WED.isoformat()
    assert items[0]["at"] == at(WED, 14)
    # played after the reminder time: no nudge (the day already had its notification)
    s["played_at"] = at(WED, 19, 30)
    assert R.plan(s, at(WED, 19, 40))[0]["day"] != WED.isoformat()
    # nudge in quiet hours is dropped
    s["played_at"], s["minute"] = at(WED, 20), 22 * 60
    assert all(i["day"] != WED.isoformat() for i in R.plan(s, at(WED, 20, 5)))


def test_hearts_nudge():
    s = base(anchor=WED, played_at=at(WED, 10), hearts=0, hearts_max=5, hearts_full_at=at(WED, 11, 40))
    it = R.plan(s, at(WED, 10, 5))[0]
    assert it["tier"] == "hearts_full" and "5 hearts" in it["body"]


def test_names_and_copy_rules():
    assert R.copy_name("Player") is None and R.copy_name("Sara Ahmadi") == "Sara"
    assert R.copy_name("Bartholomewzz") is None and R.copy_name("x1") is None
    for t in R.TIERS.values():
        for v in t["v"]:
            txt = (v[0] + " " + v[1]).lower()
            assert "apprentice" not in txt and "midnight" not in txt
            assert len(v[0]) <= 40


def test_variant_stable_per_anchor():
    a = R.plan(base(), at(WED, 20))
    b = R.plan(base(), at(WED, 20, 30))
    assert [(i["title"], i["body"]) for i in a] == [(i["title"], i["body"]) for i in b]


def test_prefs_defaults():
    class U:
        notify_prefs = {}
    assert R.prefs_of(U()) == {"on": True, "events": True, "minute": None}
    U.notify_prefs = {"on": False, "minute": 2000}
    assert R.prefs_of(U())["on"] is False and R.prefs_of(U())["minute"] is None
