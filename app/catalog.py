"""Wardrobe item catalogue (from out/runecast_design/items_economy.md), chests with published odds, shop offers and
real-money SKUs (placeholders, not live). Cosmetic only: no item changes play, scoring or the league."""

# ---------------------------------------------------------------- wardrobe catalogue v2 (UX audit 10-11, Phase B)
# Every item the live 3D wardrobe (bingual.app/runecast-wardrobe) can show, and nothing else. Item ids are the
# wardrobe's own file ids, so the page, the shop and the server use ONE list.
# tier: free (starter, everyone) | boss (boss drop, never sold) | earned (streak / league, never sold)
#       | coin | gem | premium (subscription, NOT for sale yet: "Premium, coming soon")
# Cosmetic only: no item changes play, scoring or the league.
SLOTS = ["hair", "haircolor", "eyes", "hat", "top", "coat", "pants", "shoes", "wand"]   # wand: admin 5719/5762
OPTIONAL_SLOTS = {"hat", "top", "coat", "pants", "shoes"}   # "none" is allowed (no hat, no cloak...)

_FREE = [  # the starter set (audit 5.3 D): default outfit, 3 hairs, 4 natural hair colours, 2 eye colours
    ("hair_short", "Short", "hair"), ("hair_girllong", "Long", "hair"), ("hair_bobcut", "Bob cut", "hair"),
    ("haircolor_natural", "Natural", "haircolor"), ("haircolor_black", "Black", "haircolor"),
    ("haircolor_darkbrown", "Dark brown", "haircolor"), ("haircolor_blonde", "Blonde", "haircolor"),
    ("eyes_violet", "Violet eyes", "eyes"), ("eyes_brown", "Brown eyes", "eyes"),
    ("hat", "Wizard hat", "hat"), ("hat_apprentice", "Apprentice cap", "hat"),
    ("top_apprentice", "Apprentice tunic", "top"), ("coat", "Wizard coat", "coat"), ("pants", "Pants", "pants"),
    ("shoes", "Boots", "shoes"),
    ("wand_starter", "Starter wand", "wand"), ("wand_classic", "Classic wand", "wand"),   # admin 5725/5762: starter = default
]
DEFAULT_LOOK = {"body": "boy", "tone": 1, "blush": 80, "hair": "hair_short", "haircolor": "haircolor_natural",
                "eyes": "eyes_violet", "hat": "hat", "top": "top_apprentice", "coat": "coat", "pants": "pants",
                "shoes": "shoes", "wand": "wand_starter", "tint": {}}
DEFAULT_EQUIP = {s: DEFAULT_LOOK[s] for s in SLOTS}

# coins (audit 5.3 B/D: common items 600-1,500 coins)
_COIN = [
    ("hair_twobuns", "Space buns", "hair", 1000), ("hair_ponybow", "Bow ponytail", "hair", 900),
    ("hair_wildspike", "Wild spikes", "hair", 900), ("hair_spikefade", "Spike crop + fade", "hair", 800),
    ("hair_curlyfro", "Big curls", "hair", 1000), ("hair_twinstar", "Star twin tails", "hair", 1200),
    ("haircolor_chestnut", "Chestnut", "haircolor", 600), ("haircolor_auburn", "Auburn", "haircolor", 600),
    ("haircolor_ginger", "Ginger", "haircolor", 600), ("haircolor_platinum", "Platinum", "haircolor", 800),
    ("eyes_blue", "Blue eyes", "eyes", 600), ("eyes_green", "Green eyes", "eyes", 600),
    ("eyes_hazel", "Hazel eyes", "eyes", 600), ("eyes_grey", "Grey eyes", "eyes", 600),
    # wands (admin 5762: coin 900-1200)
    ("wand_forest", "Vine wand", "wand", 900), ("wand_frost", "Frost wand", "wand", 1000),
    ("wand_fire", "Ember wand", "wand", 1100), ("wand_sea", "Coral wand", "wand", 1200),
]
# gems. Phase E (admin 4847, Q12) price rebalance from the measured earn rates (see ECONOMY_E below):
# a regular player (2 stages a day, 6 days a week) earns ~38 gems a week with the weekly events (~28 without), so
# fantasy colours / eyes (40) take ~1 week, hats (50-70) 1.3-1.8 weeks, and the epic cloaks, sold ONLY by the
# Wandering Merchant while they are in its rotation, 3.4-3.9 weeks. (Phase B prices were 150-250 / 450-500 = 5-18 weeks.)
_GEM = [
    ("hat_mushroom", "Mushroom hat", "hat", 50, "rare"), ("hat_owl", "Owl beret", "hat", 50, "rare"),
    ("hat_witch", "Witch hat", "hat", 60, "rare"), ("hat_midnight", "Midnight hat", "hat", 60, "rare"),
    ("hat_scholar", "Scholar cap", "hat", 70, "rare"), ("hat_astronomer", "Astronomer hat", "hat", 70, "rare"),
    ("haircolor_pink", "Pink", "haircolor", 40, "rare"), ("haircolor_lilac", "Lilac", "haircolor", 40, "rare"),
    ("haircolor_blue", "Blue", "haircolor", 40, "rare"), ("haircolor_mint", "Mint", "haircolor", 40, "rare"),
    ("eyes_aqua", "Aqua eyes", "eyes", 40, "rare"), ("eyes_amber", "Amber eyes", "eyes", 40, "rare"),
    ("eyes_ruby", "Ruby eyes", "eyes", 40, "rare"), ("eyes_pink", "Pink eyes", "eyes", 40, "rare"),
    ("coat_sea", "Sea cloak", "coat", 130, "epic"), ("coat_royal", "Royal ermine cloak", "coat", 150, "epic"),
    # wands (admin 5762: gem 50-70; royal = Wandering Merchant only)
    ("wand_stars", "Starry wand", "wand", 50, "rare"), ("wand_sun", "Sun wand", "wand", 60, "rare"),
    ("wand_shadow", "Shadow wand", "wand", 70, "rare"), ("wand_royal", "Royal wand", "wand", 90, "epic"),
]
MERCHANT_ONLY = {"coat_sea", "coat_royal", "wand_royal"}
# earned by habit (audit 5.3 D "Earned: habit"); never for sale
STREAK_REWARDS = {7: "hat_fire", 30: "hat_dragon"}
LEAGUE_PROMOTION_REWARD = "hat_frost"
_EARNED = [
    ("hat_fire", "Fire hat", "hat", "Keep a 7-day Hearthfire"),
    ("hat_dragon", "Dragon cap", "hat", "Keep a 30-day Hearthfire"),
    ("hat_frost", "Frost hat", "hat", "Move up a league"),
]
# subscription only. NO real-money payment is wired: shown locked as "Premium, coming soon"
_PREMIUM = [
    ("coat_star", "Star cloak", "coat", "Premium, coming soon"),
    ("coat_shadow", "Shadow cloak", "coat", "Premium, coming soon"),
]
# boss drops: topic-world number 1..40 in course order (consolidation worlds not counted; seed maps it to the world
# and stores the real global index in items.world_drop) -> (id, name, slot, theme, is_new, base_mesh, recolour)
# is_new = a recolour: the wardrobe shows base_mesh with the fixed dye `recolour` (a PALETTE key of the page)
_BOSS = {
    1: ("shoes_forest", "Forest boots", "shoes", "forest", False, None, None),
    2: ("shoes_crystal", "Crystal boots", "shoes", "crystal", False, None, None),
    3: ("shoes_librarian", "Librarian boots", "shoes", "academy", True, "shoes", "ochre"),
    4: ("shoes_curl", "Curled-toe slippers", "shoes", "alchemy / bazaar", False, None, None),
    5: ("shoes_wing", "Winged boots", "shoes", "fairy / sky", False, None, None),
    6: ("pants_shadow", "Shadow pants", "pants", "shadow / moon", False, None, None),
    7: ("shoes_frost", "Frost boots", "shoes", "frost", False, None, None),
    8: ("shoes_fire", "Fire boots", "shoes", "fire", False, None, None),
    9: ("shoes_runestone", "Runestone boots", "shoes", "rune", True, "shoes_crystal", "teal"),
    10: ("shoes_royal", "Royal boots", "shoes", "royal", False, None, None),
    11: ("shoes_star", "Star boots", "shoes", "star", False, None, None),
    12: ("pants_forest", "Forest pants", "pants", "forest", False, None, None),
    13: ("pants_geode", "Geode pants", "pants", "crystal", True, "pants_frost", "violet"),
    14: ("pants_page", "Page pants", "pants", "academy", True, "pants", "cream"),
    15: ("pants_alch", "Alchemist pants", "pants", "alchemy", False, None, None),
    16: ("pants_petal", "Petal pants", "pants", "fairy", True, "pants_forest", "rose"),
    17: ("shoes_moon", "Moon boots", "shoes", "moon", True, "shoes_star", "cream"),
    18: ("pants_frost", "Frost pants", "pants", "frost", False, None, None),
    19: ("pants_fire", "Fire pants", "pants", "fire", False, None, None),
    20: ("pants_rune", "Rune pants", "pants", "rune", False, None, None),
    21: ("pants_sun", "Sun pants", "pants", "sun / gold", False, None, None),
    22: ("pants_star", "Starry night pants", "pants", "star", False, None, None),
    23: ("top_forest", "Forest tunic", "top", "forest", False, None, None),
    24: ("top_crystal", "Crystal tunic", "top", "crystal", False, None, None),
    25: ("top_ink", "Ink tunic", "top", "academy", True, "top_scholar", "midnight"),
    26: ("shoes_alch", "Alchemist boots", "shoes", "alchemy", False, None, None),
    27: ("top_fairy", "Fairy tunic", "top", "fairy", True, "top_forest", "rose"),
    28: ("top_moon", "Moonlit tunic", "top", "moon", True, "top_star", "royal"),
    29: ("top_frost", "Frost tunic", "top", "frost", False, None, None),
    30: ("top_fire", "Fire tunic", "top", "fire", False, None, None),
    31: ("top_rune", "Rune tunic", "top", "rune", False, None, None),
    32: ("pants_royal", "Royal velvet pants", "pants", "royal", False, None, None),
    33: ("top_star", "Star tunic", "top", "star", False, None, None),
    34: ("coat_forest", "Forest cloak", "coat", "forest", False, None, None),
    35: ("coat_amethyst", "Amethyst cloak", "coat", "crystal", True, "coat_frost", "violet"),
    36: ("coat_scholar", "Scholar cloak", "coat", "academy", True, "coat", "midnight"),
    37: ("top_alchemist", "Alchemist vest", "top", "alchemy", False, None, None),
    38: ("coat_blossom", "Blossom cloak", "coat", "fairy", True, "coat_forest", "rose"),
    39: ("coat_midnight", "Midnight cloak", "coat", "moon / night", False, None, None),
    40: ("coat_frost", "Frost cloak", "coat", "frost", False, None, None),
}
# the boss drops of the 5 consolidation worlds (curriculum.CONSOLIDATION)
_GATE = [
    ("coat_fire", "Fire cloak", "coat", "fire", False, None, None),
    ("coat_runestone", "Runestone cloak", "coat", "rune", True, "coat_forest", "charcoal"),
    ("top_scholar", "Scholar tunic", "top", "academy", False, None, None),
    ("coat_sun", "Sun cloak", "coat", "sun / star", False, None, None),
    ("coat_autumn", "Autumn cloak", "coat", "forest", True, "coat_forest", "ochre"),
]
# items of the first catalogue that the live wardrobe cannot show (retired hairs, packs, poses, palettes):
# kept in the table (inactive) because user_items may point at them
RETIRED = ["hair_pony", "hair_bob", "hair_quiff", "hair_spiky", "hair_twin", "hair_braid", "hair_curly",
           "eyes_pack_enchanted", "haircolor_pack_fantasy", "pose_idle", "pose_walk", "pose_cast_a_spell", "pose_bow",
           "pose_clap", "pose_box_03", "pose_fold_arms", "pose_afraid", "pose_scared_01", "pose_cry", "palette_basic",
           "palette_jewel", "palette_night_gold", "palette_shimmer"]

# dyes (audit 5.3 B "Dye / recolour any owned garment: 150 coins per dye"): one colour on one garment, kept for good
DYE_PRICE_COINS = 150
DYE_SWATCHES = ["violet", "royal", "emerald", "crimson", "midnight", "ochre", "teal", "rose", "charcoal", "cream"]

# Wandering Merchant sets (audit 5.3 C "full sets ~20% off the item sum"); one set a week
MERCHANT_SETS = [
    dict(id="set_seawitch", name="Sea Witch set", items=["coat_sea", "hat_witch", "eyes_aqua"]),
    dict(id="set_royal", name="Royal Court set", items=["coat_royal", "hat_scholar", "eyes_amber"]),
    dict(id="set_stargazer", name="Stargazer set", items=["hat_astronomer", "haircolor_lilac", "eyes_ruby"]),
    dict(id="set_sprite", name="Forest Sprite set", items=["hat_mushroom", "haircolor_mint", "eyes_pink"]),
]
SET_DISCOUNT = 0.8


def items() -> list[dict]:
    out = []
    k = 0

    def add(**d):
        nonlocal k
        k += 1
        d.setdefault("rarity", None)
        d.setdefault("price_gems", None)
        d.setdefault("price_coins", None)
        d.setdefault("theme", "")
        d.setdefault("how", "")
        d.setdefault("is_new", False)
        d.setdefault("base_mesh", None)
        d.setdefault("recolour", None)
        d.setdefault("active", True)
        d.setdefault("notes", "")
        d["sort"] = k
        out.append(d)

    for iid, name, slot in _FREE:
        add(id=iid, name=name, slot=slot, tier="free", how="Starter set", is_default=DEFAULT_EQUIP.get(slot) == iid)
    for iid, name, slot, price in _COIN:
        add(id=iid, name=name, slot=slot, tier="coin", rarity="common", price_coins=price, is_default=False)
    for iid, name, slot, price, rarity in _GEM:
        add(id=iid, name=name, slot=slot, tier="gem", rarity=rarity, price_gems=price, is_default=False,
            how="Wandering Merchant only" if iid in MERCHANT_ONLY else "")
    for iid, name, slot, how in _EARNED:
        add(id=iid, name=name, slot=slot, tier="earned", how=how, is_default=False)
    for iid, name, slot, how in _PREMIUM:
        add(id=iid, name=name, slot=slot, tier="premium", how=how, is_default=False)
    for d in phase_d_items():   # Phase D: monthly sets, season cloaks, starter outfit (recolours, real money only)
        add(id=d["id"], name=d["name"], slot=d["slot"], tier="premium", how=d["how"], theme=d["theme"], is_new=True,
            base_mesh=d["base"], recolour=d["sw"], is_default=False)
    for w,(iid, name, slot, theme, new, base, rec) in _BOSS.items():
        add(id=iid, name=name, slot=slot, tier="boss", theme=theme, world_drop=w, is_new=new, base_mesh=base,
            recolour=rec, is_default=False)
    for iid, name, slot, theme, new, base, rec in _GATE:
        add(id=iid, name=name, slot=slot, tier="boss", theme=theme, is_new=new, base_mesh=base, recolour=rec,
            is_default=False)
    return out


BOSS_DROP_BY_WORLD = {w: v[0] for w, v in _BOSS.items()}
RECOLOUR = {v[0]: (v[5], v[6]) for v in list(_BOSS.values()) + _GATE if v[4]}
GARMENT_SLOTS = {"hat", "top", "coat", "pants", "shoes"}

# ---------------------------------------------------------------- chests (published odds = the RNG's table)
CHESTS = [
    dict(kind="wood", title="Wooden Chest", price_coins=300, price_gems=None, odds=[
        {"reward": "coins", "min": 80, "max": 150, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.35},
    ]),
    # Phase B (audit 5.3 C): a chest never pays gems back (gem-bought chests used to return 3-30 gems)
    dict(kind="silver", title="Silver Chest", price_coins=None, price_gems=15, odds=[
        {"reward": "coins", "min": 400, "max": 700, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.6},
    ]),
    dict(kind="epic", title="Epic Chest", price_coins=None, price_gems=35, odds=[
        {"reward": "coins", "min": 1000, "max": 1600, "chance": 1.0},
        {"reward": "elixir", "min": 1, "max": 2, "chance": 1.0},
    ]),
]

# ---------------------------------------------------------------- shop offers (game currencies)
OFFERS = [
    dict(id="hearts_full", title="Full Hearts", note="Refill all hearts now", kind="essential", price={"gems": 15}),
    dict(id="elixir_1", title="Elixir", note="Continue a lost trial or boss, or keep your heart", kind="essential",
         price={"gems": 10}),
    dict(id="elixir_3", title="3 Elixirs", note="Best value for rescues", kind="essential", price={"gems": 25}),
    dict(id="xp_boost", title="Double XP - 15 min", note="Faster player levels. Never counts in the league.",
         kind="boost", price={"coins": 250}),
    dict(id="freeze", title="Frost Ward", note="Covers one missed day (hold up to 2). Only while your Hearthfire burns.",
         kind="boost", price={"coins": 300}),
    dict(id="coin_sack", title="Coin Sack", note="1,000 coins for hairstyles, dyes, boosts and extra hints",
         kind="boost",
         price={"gems": 15}),
    dict(id="chest_wood", title="Wooden Chest", note="See the odds before you buy", kind="chest",
         price={"coins": 300}),
    dict(id="chest_silver", title="Silver Chest", note="See the odds before you buy", kind="chest",
         price={"gems": 15}),
    dict(id="chest_epic", title="Epic Chest", note="See the odds before you buy", kind="chest", price={"gems": 35}),
]
OFFER_BY_ID = {o["id"]: o for o in OFFERS}

STARTING_WALLET = dict(gems=40, coins=1250, hearts=5, hearts_max=5, elixir=3)

# ---------------------------------------------------------------- Phase E economy (admin 4847, Q12)
# Earn rates per week (Monte Carlo of the live rules, scripts/earn_model.py; with the weekly events):
#   casual  1 stage x 4 days, 70%:   ~7 gems,   ~570 coins
#   regular 2 stages x 6 days, 80%: ~38 gems, ~2,170 coins  (~28 gems without Boss Rush)
#   serious 5 stages x 7 days, 88%: ~107 gems, ~7,400 coins
# Targets: a regular buys a gem item every 1-2 weeks, a coin item every few days (coin items 600-1,200 = 2-4 days,
# unchanged), an epic / Merchant cloak in 3-4 weeks; continue (10) and streak repair (30) are a few days of gems.
# Chests are priced at their expected value (1 gem ~ 50-70 coins): Wood 300 coins, Silver 15 gems, Epic 35 gems.

# ---------------------------------------------------------------- Phase B sinks (audit 5.3 A-C)
HINT_FREE_PER_DAY = 3        # then HINT_COST_COINS each
HINT_COST_COINS = 20
CONTINUE_GEMS = 10           # Phase E: = the price of 1 elixir (was 15); or 1 elixir: "+3 questions" once per lost trial / boss / vault
CONTINUE_QUESTIONS = 3
STREAK_REPAIR_GEMS = 30      # Phase E: ~5 days of a regular player's gems (was 200 = 7 weeks); restores a Hearthfire that went out, within 2 missed days (48 h)
STREAK_REPAIR_MAX_MISSED = 2

# ================================================================ Phase D (admin msg 4839): store, premium, season pass
# 🔴 English Spell is its own product: none of this touches Bingual's subscription, accounts or payments.
# Real money is OFF (decision 1 = D): every real-money product below is fully defined and shown, but its buy button
# says "Coming soon" and the server refuses checkout until settings.payments_enabled is true AND a provider adapter is
# registered (services/payments.py). Prices are "TBD" (price_label None) until the admin sets them.

# Monthly themes. Each month (UTC calendar month = one season) uses one theme, in rotation:
# - set: the Premium monthly outfit (decision 3), recolours of existing Hunyuan garments (no new 3D work)
# - pass_cloak: the Season Pass premium-track final reward (a recolour as well)
# - pass_hat: the Season Pass FREE-track hat (an existing gem hat; owners get gems instead)
# - dyes: the free-track dyes, on starter garments everyone owns (garment id, PALETTE swatch)
# recolour bases must be garments the wardrobe can wear as a variant (top / coat / pants / shoes)
SEASON_THEMES = [
    dict(key="ember", name="Ember Hollow", accent="crimson",
         set=[("prem_ember_coat", "Ember Hollow cloak", "coat", "coat", "crimson"),
              ("prem_ember_top", "Ember tunic", "top", "top_scholar", "crimson"),
              ("prem_ember_pants", "Ember trousers", "pants", "pants_frost", "charcoal"),
              ("prem_ember_shoes", "Ember boots", "shoes", "shoes", "crimson")],
         pass_cloak=("pass_ember_cloak", "Harvest Moon cloak", "coat", "coat_frost", "ochre"),
         pass_hat="hat_mushroom", dyes=[("coat", "crimson"), ("top_apprentice", "ochre"), ("pants", "charcoal")]),
    dict(key="frost", name="Frostfall", accent="teal",
         set=[("prem_frost_coat", "Frostfall cloak", "coat", "coat_frost", "cream"),
              ("prem_frost_top", "Frostfall tunic", "top", "top_forest", "teal"),
              ("prem_frost_pants", "Frostfall trousers", "pants", "pants_forest", "teal"),
              ("prem_frost_shoes", "Frostfall boots", "shoes", "shoes_crystal", "cream")],
         pass_cloak=("pass_frost_cloak", "Glacier cloak", "coat", "coat_frost", "royal"),
         pass_hat="hat_owl", dyes=[("coat", "teal"), ("top_apprentice", "cream"), ("pants", "royal")]),
    dict(key="star", name="Starfall", accent="midnight",
         set=[("prem_star_coat", "Starfall cloak", "coat", "coat_forest", "midnight"),
              ("prem_star_top", "Starfall tunic", "top", "top_star", "midnight"),
              ("prem_star_pants", "Starfall trousers", "pants", "pants_forest", "royal"),
              ("prem_star_shoes", "Starfall boots", "shoes", "shoes_star", "royal")],
         pass_cloak=("pass_star_cloak", "Aurora cloak", "coat", "coat_frost", "rose"),
         pass_hat="hat_astronomer", dyes=[("coat", "midnight"), ("top_apprentice", "royal"), ("pants", "violet")]),
]
_THEME_EPOCH = (2026, 10)   # October 2026 = theme 0 (Ember Hollow)


def season_id_of(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def theme_for(season_id: str) -> dict:
    y, m = (int(x) for x in season_id.split("-"))
    n = (y * 12 + m - 1) - (_THEME_EPOCH[0] * 12 + _THEME_EPOCH[1] - 1)
    return SEASON_THEMES[n % len(SEASON_THEMES)]


# the one-time Starter Pack outfit (decision 4): recolours of starter garments
STARTER_SET = [("pack_wayfarer_coat", "Wayfarer cloak", "coat", "coat_forest", "emerald"),
               ("pack_wayfarer_top", "Wayfarer tunic", "top", "top_scholar", "teal"),
               ("pack_wayfarer_pants", "Wayfarer trousers", "pants", "pants", "charcoal"),
               ("pack_wayfarer_shoes", "Wayfarer boots", "shoes", "shoes_crystal", "emerald")]
STARTER_GEMS = 200
STARTER_DAYS = 7            # offered only in the account's first week, once
PREMIUM_CLOAKS = ["coat_star", "coat_shadow"]
PREMIUM_DAYS = 30

# real-money products (decision 2 A, 3 A, 4 A, 5 A). price_label None = "TBD": the app shows no price.
PRODUCTS = [
    dict(id="gems_100", kind="gems", title="Pouch of Gems", gems=100, price_label=None),
    dict(id="gems_300", kind="gems", title="Chest of Gems", gems=300, price_label=None, tag="Popular"),
    dict(id="gems_1000", kind="gems", title="Dragon's Hoard", gems=1000, price_label=None, tag="Best value"),
    dict(id="starter_pack", kind="starter", title="Starter Pack", gems=STARTER_GEMS, price_label=None,
         items=[s[0] for s in STARTER_SET], once=True, days=STARTER_DAYS),
    dict(id="premium_month", kind="premium", title="Archmage Circle", gems=0, price_label=None, days=PREMIUM_DAYS,
         includes=["Star cloak", "Shadow cloak", "The monthly outfit set"]),
    dict(id="season_premium", kind="season", title="Season Pass: Premium track", gems=0, price_label=None),
]
PRODUCT_BY_ID = {p["id"]: p for p in PRODUCTS}


def phase_d_items() -> list[dict]:
    """recolour items for the store / premium / season pass, all locked behind real money (tier premium)"""
    out = []
    for t in SEASON_THEMES:
        for iid, name, slot, base, sw in t["set"]:
            out.append(dict(id=iid, name=name, slot=slot, base=base, sw=sw, how=f"Premium: {t['name']} set",
                            theme=t["key"]))
        iid, name, slot, base, sw = t["pass_cloak"]
        out.append(dict(id=iid, name=name, slot=slot, base=base, sw=sw, how="Season Pass premium track",
                        theme=t["key"]))
    for iid, name, slot, base, sw in STARTER_SET:
        out.append(dict(id=iid, name=name, slot=slot, base=base, sw=sw, how="Starter Pack", theme="starter"))
    return out


# ---------------------------------------------------------------- Season Pass (decision 5 A)
SEASON_TIERS = 30
SEASON_TIER_XP = 150        # 4,500 season XP for the whole track: ~20 days of 3 stages + dailies
# season XP sources (from the server, never the client). Focus mode keeps its caps: its stars are already capped at 2,
# and a Focus stage gives at most SEASON_FOCUS_MAX.
SEASON_XP_STAGE_WIN = 20    # + SEASON_XP_PER_STAR per star
SEASON_XP_PER_STAR = 10
SEASON_XP_STAGE_LOST = 5
SEASON_FOCUS_MAX = 30
SEASON_XP_QUEST = {"daily": 25, "weekly": 60}
SEASON_XP_DAILY_CAP = 600   # most season XP one local day can give (no grinding the month away in a day)


def season_track(theme: dict) -> list[dict]:
    """30 tiers: free rewards (coins, a few gems, dyes, elixir, a hat) and premium rewards (locked until bought)"""
    dyes = theme["dyes"]
    tiers = []
    for n in range(1, SEASON_TIERS + 1):
        free: dict = {"coins": 100 + 20 * (n // 5)}
        if n in (5, 15, 25):
            free = {"gems": 5}
        if n in (8, 18, 28):
            g, sw = dyes[(n // 10) % len(dyes)]
            free = {"dye": f"{g}:{sw}"}
        if n in (10, 20):
            free = {"elixir": 1}
        if n == 12:
            free = {"chest": "wood"}
        if n == SEASON_TIERS:
            free = {"item": theme["pass_hat"]}
        prem: dict = {"coins": 250}
        if n % 3 == 0:
            prem = {"gems": 15}
        if n in (7, 17, 27):
            prem = {"elixir": 2}
        if n == 10:
            prem = {"chest": "silver"}
        if n == 22:
            prem = {"chest": "epic"}
        if n == SEASON_TIERS:
            prem = {"item": theme["pass_cloak"][0]}
        tiers.append({"tier": n, "xp": n * SEASON_TIER_XP, "free": free, "premium": prem})
    return tiers
