# English Spell API contract (Phase 1)

Product name: **English Spell** (admin msg 3057). Internal identifiers stay `runecast` (database, paths, URL prefix).

Status: contract v1, 2026-10-01. The machine-readable spec is `openapi.json` next to this file
(regenerated from the code; if the two ever disagree, `openapi.json` wins).

- Base URL: `https://bingual.app/runecast-api`
- Interactive docs: `https://bingual.app/runecast-api/docs` (Swagger), `/redoc`
- All game endpoints are under `/v1`. JSON in, JSON out. Times are ISO-8601 UTC strings unless named `*_ms` (epoch ms).
- Auth: `Authorization: Bearer <token>` (JWT, HS256). Get a token from `POST /v1/auth/guest`.
- Levels: `A1, A2, B1, B2, C1` only (there is no C2).
- The server is authoritative for everything that changes a balance: stars, XP, coins, gems, items, hearts,
  SRS, streak, quests and league points are all computed on the server. The client never sends reward amounts.

## Errors

Every error is `{"detail": {"code": "<machine_code>", "message": "<human text>"}}` with a matching HTTP status
(401 `unauthorized`; 403 `stage_locked`, `not_owned`; 404 `not_found`; 409 `no_hearts`, `no_questions`, `already_completed`, `too_fast`, `not_enough_gems`, `not_enough_coins`, `not_enough_elixir`, `already_owned`, `not_for_sale`, `hearts_full`, `max_freezes`, `streak_not_alive`, `quest_not_done`, `already_claimed`, `no_chest`; 410 `session_expired`; 422 validation / `bad_slot` / `bad_item` / `bad_timezone`; 501 `payments_not_live`). FastAPI's own request-validation errors keep the standard 422 shape (`detail` is a list).

## Content model

```
level (A1..C1)
 └─ world  (A1 8, A2 8, B1 9, B2 8, C1 7 = 40 worlds; global_index 1..40)
     ├─ topics[3]           Bingual grammar topics (slot 1..3), or a "mixed" consolidation topic
     ├─ paint_id + variant  one of the 11 paintings (w1..w11) + {tint, weather, time}
     ├─ boss_drop           the wardrobe item the boss drops (first clear)
     └─ stages
         1  lesson    topic 1   "Spellbook": explanation + guided items
         2  practice  topic 1   retrieval game
         3  practice2 topic 1   same topic, other modality (listening/speaking/typing/reading)
         4  trial     topic 1   + 30-40% items from earlier topics (interleaved review)
         5..8   same pattern for topic 2
         9..12  same pattern for topic 3
         13 boss      all 3 topics + 30-40% from earlier worlds; hearts apply
         14 bonus     "Treasure Vault" (optional, harder, first clear = 10 gems)
         15 bonus     "Oracle Gate" (optional; only in the LAST world of each level; mixed across the whole level)
```

`kind` is one of `lesson, practice, practice2, trial, boss, bonus`. `client_kind` maps it to the current app's
`StageKind`: lesson→`lesson`, practice/practice2→`practice`, trial→`review`, boss→`boss`, bonus→`treasure`.

Stage ids: `A1-W01-S01` … `C1-W07-S15`. World ids: `A1-W01` … Topic ids: Bingual ids (`a1-verb-to-be`) or
`a1-mixed-1` style for mixed consolidation topics.

Unlocking: inside a level everything required is linear (stage n+1 opens when stage n has ≥1 star; the next world
opens when the boss is beaten). Bonus stages open when stage 12 of their world is done and never block anything.
Levels above the player's current level are locked; finishing the last boss of a level moves the player up.

## Endpoints

### Health
`GET /health` → `{"ok": true, "db": true, "version": "..."}` (no auth)

### Auth
`POST /v1/auth/guest`
```json
{ "device_id": "uuid-or-any-stable-string (8..128 chars)", "display_name": "Apprentice", "timezone": "Asia/Tehran", "level": "A1" }
```
→ `200 { "token": "<jwt>", "token_type": "bearer", "expires_at": "...", "created": true, "user": Me }`
Same `device_id` again returns the same account (`created: false`) and a fresh token. All fields except
`device_id` are optional. New accounts get 5 hearts, 3 elixirs, 1250 coins, 40 gems and the 19 free wardrobe items
(equipped defaults). Accounts are `kind: "guest"`; the schema already has `email` / `password_hash` for a later upgrade.

`GET /v1/me` → `Me`
```json
{ "id": "uuid", "display_name": "Apprentice", "kind": "guest", "level": "A1", "timezone": "Asia/Tehran",
  "player_level": 1, "xp": 0, "xp_to_next": 800, "xp_total": 0, "streak": 0, "xp_boost_until": 0,
  "league_opt_in": true, "created_at": "..." }
```
`PATCH /v1/me` body any of `{display_name, timezone, league_opt_in, level}`. `level` (placement / self-chosen start) may
only move the player's current level; earlier levels stay playable.

### Map and content
`GET /v1/levels` → `[{ "code": "A1", "ordinal": 1, "title": "...", "world_count": 8, "unlocked": true, "current": true }]`

`GET /v1/map/{level}` → 
```json
{ "level": "A1", "unlocked": true,
  "progress": { "stages_done": 3, "stars": 8, "required_total": 104, "current_stage_id": "A1-W01-S04" },
  "worlds": [{
    "id": "A1-W01", "level": "A1", "index": 1, "global_index": 1, "name": "...",
    "paint_id": "w1", "paint_name": "Whispering Forest", "accent": "emerald",
    "variant": { "tint": "none", "weather": "clear", "time": "day" },
    "topics": [{ "id": "a1-verb-to-be", "slot": 1, "title": "Verb To Be (am/is/are)", "kind": "core" }],
    "boss_drop": { "item_id": "shoes_forest", "name": "Forest boots", "slot": "shoes", "owned": false },
    "status": "current",            // locked | current | done
    "stages": [{ "id": "A1-W01-S01", "index": 1, "kind": "lesson", "client_kind": "lesson", "required": true,
                 "topic_id": "a1-verb-to-be", "mini_game": "spell-weaver", "title": "Spellbook: Verb To Be",
                 "hearts_apply": false, "question_count": 8,
                 "status": "current", "stars": 0 }]   // stage status: locked | current | done
  }]
}
```

`GET /v1/topics/{topic_id}` → the Spellbook page: `{id, level, title, summary, explanation, rules, examples, when_to_use,
common_mistakes, kind, covers}` (copied from Bingual's grammar list; English only).

### Play a stage
`POST /v1/stages/{stage_id}/start` → 
```json
{ "session_id": "uuid", "stage": Stage, "expires_at": "...",
  "review_ratio": 0.35,
  "questions": [{ "qid": "ro-A1-G06-12345", "game": "rune-order", "level": "A1", "difficulty": 2,
                  "grammar": ["A1-G06"], "skills": [], "topic": "home", "topic_id": "a1-present-simple-affirmative",
                  "source": "new",           // new | review (from an earlier topic) | fallback (bank too thin)
                  "payload": { "text": "..." } }],
  "hearts": 5 }
```
- `payload` is exactly the pipeline game schema (`runecast_qdb/master_prompt.md` §6), so each question says which game
  renders it. A stage may mix games (word round → grammar round → skill round); `stage.mini_game` is the frame game.
- Trials and bosses draw 30-40% of items from earlier topics (SRS-due ones first); bonus stages prefer difficulty 3.
- Boss and bonus stages need ≥1 heart (409 `no_hearts`). Locked stages → 403 `stage_locked`.
- A session lives 2 hours and can be completed once.

`POST /v1/sessions/{session_id}/complete`
```json
{ "answers": [{ "qid": "ro-A1-G06-12345", "answer": "<game-specific, see below>", "correct": true, "ms": 5300 }],
  "hints_used": 0, "use_elixir": false }
```
The server grades each answer itself when the game allows it (see "Grading"), ignores `qid`s it did not issue, counts
unanswered questions as wrong, and then computes everything:
```json
{ "stars": 3, "best_stars": 3, "first_clear": true, "correct": 9, "total": 10, "accuracy": 0.9,
  "rewards": { "xp": 138, "coins": 90, "gems": 0, "items": [{"item_id":"shoes_forest","name":"Forest boots"}], "chest": null },
  "hearts_lost": 0, "elixir_used": false, "level_up": false, "level_completed": false,
  "unlocked": ["A1-W01-S05"], "srs_updated": 10, "league_points": 81,
  "wallet": Wallet, "me": Me, "streak": Streak }
```
Rules: stars from accuracy (≥90% 3, ≥70% 2, ≥50% 1, else 0). XP = correct×12 + stars×10 (Double XP boost doubles the
XP for the player level only). Coins = correct×5 + stars×15 on a first clear or a star improvement, half on replays.
Bonus first clear +10 gems; boss first clear drops the world's item. Level up = +5 gems (next level needs 15% more XP).
A boss/bonus with 0 stars costs 1 heart unless `use_elixir` is true and an elixir is left (the elixir is spent instead).
League points never include the XP boost (see League).

### Review (Overnight Cauldron)
`GET /v1/review/today?limit=25` → `{ "due_count": 31, "new_tomorrow": 12, "items": [Question + {"box": 2, "due_at": "..."}] }`
Items due by the end of the player's local day, oldest first, interleaved across topics.

`POST /v1/review/submit` `{ "answers": [Answer] }` → `{ "graded": 20, "correct": 17, "hearts_gained": 1, "srs": [{qid, box, due_at}], "wallet": Wallet, "streak": Streak }`
Only items that are actually due are scheduled (others are ignored). Every 10 correct review answers refill 1 heart.

SRS: Leitner boxes 0..5 with intervals 1, 3, 7, 16, 35 days. Correct → next box; wrong → box 0, due tomorrow.
`box` doubles as the app's `SrsItem.mastery` (0..5).

### Wallet
`GET /v1/wallet` → `Wallet`
```json
{ "hearts": 5, "heartsMax": 5, "heartsRefillAt": null, "potion": 3, "elixir": 3, "coins": 1250, "gems": 40 }
```
Same shape as the app's `Currencies` (`potion` = elixir; `heartsRefillAt` epoch ms of the next regenerated heart, 20 min each).
`GET /v1/wallet/ledger?limit=50` → `[{ "id", "currency", "delta", "balance_after", "reason", "ref", "created_at" }]`

### Shop (gems and coins only; real money is a placeholder)
`GET /v1/shop` →
```json
{ "items":  [{ "id": "hair_pony", "name": "Ponytail", "slot": "hair", "tier": "gem", "rarity": "common", "price_gems": 50, "owned": false }],
  "offers": [{ "id": "hearts_full", "title": "Full Hearts", "price": {"gems": 15}, "kind": "essential" },
             { "id": "chest_silver", "title": "Silver Chest", "price": {"gems": 30}, "kind": "chest", "odds": ChestOdds }],
  "gem_packs": [{ "sku": "gems_80", "gems": 80, "price_units": 1, "enabled": false }] }
```
`POST /v1/shop/buy` `{ "item_id": "hair_pony" }` or `{ "offer_id": "freeze" }` → `{ "ok": true, "wallet": Wallet, "owned_item": "...", "inventory": Inventory }`
Boss and premium items are never for sale (409 `not_for_sale`). Frost Ward (`freeze`) max 2 and only while the streak is alive.

`GET /v1/payments/skus` → gem packs + subscriptions, all `enabled: false`. `POST /v1/payments/checkout` → 501 `payments_not_live`.

### Chests (server RNG, published odds)
`GET /v1/chests` → `[{ "kind": "wood", "owned": 1, "price": {"coins": 400}, "odds": [{"reward": "coins", "min": 80, "max": 150, "chance": 1.0}, {"reward": "elixir", "amount": 1, "chance": 0.35}] }]`
`POST /v1/chests/{kind}/open` → `{ "kind": "wood", "reward": {"coins": 112, "potion": 1}, "wallet": Wallet, "remaining": 0 }`
Chests never contain wardrobe items. RNG is `secrets.SystemRandom` on the server; every open is logged.

### Inventory and wardrobe
`GET /v1/inventory` → `{ "items": [{ "item_id", "slot", "source", "acquired_at" }], "equipped": {"hair": "hair_short", ...},
"chests": {"wood":0,"silver":0,"epic":0}, "freezes": 0, "xpBoostUntil": 0 }`
`PUT /v1/inventory/equip` `{ "slot": "hair", "item_id": "hair_pony" }` (`item_id: null` resets the slot to its free default).
`GET /v1/catalog/items` (no auth) → the whole item catalogue with tier, price, rarity, world drop.

### Quests (Three Daily Rites + weekly)
`GET /v1/quests` → `[{ "id": "daily:2026-10-01:win", "title": "Win 2 stages", "progress": 1, "target": 2,
"reward": {"coins": 120}, "period": "daily", "done": false, "claimable": false, "bonus": false }]`
(3 daily + "all dailies" bonus, 3 weekly + "dailies on 5 days" bonus; the app's progress.ts pools plus one
Cauldron quest "Answer N review items correctly". Quests are the same for everyone on the same local day/week.)
`POST /v1/quests/{quest_id}/claim` → `{ "reward": Reward, "quests": [...], "wallet": Wallet }`

### Streak (Hearthfire + Frost Ward)
`GET /v1/streak` → `{ "current": 4, "best": 9, "today_done": false, "today_progress": {"stages_won": 1, "review_correct": 3},
"rule": "...", "freezes": 1, "freezes_max": 2, "last_active_day": "2026-09-30" }`
A day counts when the player wins 2 stages, or wins 1 stage and answers 10 review items correctly (≈ the 10-minute
minimum). Missed days are covered automatically by Frost Wards (max 2 held). There is no paid streak repair.

### League (Guild Tournament)
`GET /v1/league` → same shape as the app's `League`:
`{ "tier": "bronze", "endsAt": <ms>, "promoteCount": 3, "demoteCount": 0, "entries": [{ "playerId", "name", "lp", "isMe", "bot" }], "last": {...}? , "scoring": "..." }`
`POST /v1/league/seen` → credits the last week's rank reward once.
Points (LP) per stage = round(10 × correct × accuracy), daily cap 400, **no boost ever applies** and nothing bought
changes LP (fixes the gems → coins → Double XP → rank path). Weekly, Monday 00:00 local; 15 per group (real players
filled up with labelled bots), top 3 promote, bottom 3 demote. Rewards: 1st 30 gems + epic chest, 2nd 20 + silver,
3rd 15 + silver, 4th-10th 5 gems.

## Grading (what `answer` should contain)

The complete response also lists `graded: [{qid, correct}]` so the client can show per-item results, and
`unverified` = how many items the server had to trust (echo without a matching transcript).


| game | `answer` | server check |
|---|---|---|
| bubble-pop, match-blitz, memory-crystals, boss-battle, gap-gate (SrsItem) | the chosen text | equals `back` (or `front` for gap-gate) |
| oracle-trial | chosen option | equals `payload.answer` |
| rune-order | the sentence as ordered tiles (string or list) | equals `payload.text` |
| whisper-scroll | list of the 2 words typed/chosen | equal the words at `gaps` |
| rune-type, potion-mix | the typed word | equals `word` / `answer` |
| curse-breaker | `{"bad": 1, "fix": "has"}` | both match |
| spell-weaver | list of chunks | equals `payload.answer` |
| crystal-ball | list of 3 chosen answers | ≥2 of 3 right = correct |
| bards-tale | list of lines (or indexes of the shuffled lines as given) | equals the original order |
| guild-letters | the written reply | ≥`minWords` words and a hit in every `keys` group |
| tavern-talk | list of chosen choice indexes per node | all chosen choices `ok` |
| echo | (speech) | client `correct` is trusted, flagged `verified: false` |

If `answer` is missing the server falls back to the client's `correct` flag only for `echo`; for every other game a
missing answer counts as wrong. Payloads include answers (games need them for instant feedback), so grading stops
fabricated "all correct" submissions from naive clients, not a determined cheater; rewards are still capped by the
session (issued questions only, one completion, minimum play time of 1.5 s per question).
