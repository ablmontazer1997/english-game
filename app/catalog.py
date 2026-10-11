"""Wardrobe item catalogue (from out/runecast_design/items_economy.md), chests with published odds, shop offers and
real-money SKUs (placeholders, not live). Cosmetic only: no item changes play, scoring or the league."""

# ---------------------------------------------------------------- wardrobe catalogue v2 (UX audit 10-11, Phase B)
# Every item the live 3D wardrobe (bingual.app/runecast-wardrobe) can show, and nothing else. Item ids are the
# wardrobe's own file ids, so the page, the shop and the server use ONE list.
# tier: free (starter, everyone) | boss (boss drop, never sold) | earned (streak / league, never sold)
#       | coin | gem | premium (subscription, NOT for sale yet: "Premium, coming soon")
# Cosmetic only: no item changes play, scoring or the league.
SLOTS = ["hair", "haircolor", "eyes", "hat", "top", "coat", "pants", "shoes"]
OPTIONAL_SLOTS = {"hat", "top", "coat", "pants", "shoes"}   # "none" is allowed (no hat, no cloak...)

_FREE = [  # the starter set (audit 5.3 D): default outfit, 3 hairs, 4 natural hair colours, 2 eye colours
    ("hair_short", "Short", "hair"), ("hair_girllong", "Long", "hair"), ("hair_bobcut", "Bob cut", "hair"),
    ("haircolor_natural", "Natural", "haircolor"), ("haircolor_black", "Black", "haircolor"),
    ("haircolor_darkbrown", "Dark brown", "haircolor"), ("haircolor_blonde", "Blonde", "haircolor"),
    ("eyes_violet", "Violet eyes", "eyes"), ("eyes_brown", "Brown eyes", "eyes"),
    ("hat", "Wizard hat", "hat"), ("hat_apprentice", "Apprentice cap", "hat"),
    ("top_apprentice", "Apprentice tunic", "top"), ("coat", "Wizard coat", "coat"), ("pants", "Pants", "pants"),
    ("shoes", "Boots", "shoes"),
]
DEFAULT_LOOK = {"body": "boy", "tone": 1, "blush": 80, "hair": "hair_short", "haircolor": "haircolor_natural",
                "eyes": "eyes_violet", "hat": "hat", "top": "top_apprentice", "coat": "coat", "pants": "pants",
                "shoes": "shoes", "tint": {}}
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
]
# gems (audit 5.3 C/D): themed hats + fantasy colours 150-300 (rare); epic cloaks 400-600, sold ONLY by the
# Wandering Merchant while they are in its rotation (limited)
_GEM = [
    ("hat_mushroom", "Mushroom hat", "hat", 150, "rare"), ("hat_owl", "Owl beret", "hat", 150, "rare"),
    ("hat_witch", "Witch hat", "hat", 200, "rare"), ("hat_midnight", "Midnight hat", "hat", 200, "rare"),
    ("hat_scholar", "Scholar cap", "hat", 250, "rare"), ("hat_astronomer", "Astronomer hat", "hat", 250, "rare"),
    ("haircolor_pink", "Pink", "haircolor", 150, "rare"), ("haircolor_lilac", "Lilac", "haircolor", 150, "rare"),
    ("haircolor_blue", "Blue", "haircolor", 150, "rare"), ("haircolor_mint", "Mint", "haircolor", 150, "rare"),
    ("eyes_aqua", "Aqua eyes", "eyes", 150, "rare"), ("eyes_amber", "Amber eyes", "eyes", 150, "rare"),
    ("eyes_ruby", "Ruby eyes", "eyes", 150, "rare"), ("eyes_pink", "Pink eyes", "eyes", 150, "rare"),
    ("coat_sea", "Sea cloak", "coat", 450, "epic"), ("coat_royal", "Royal ermine cloak", "coat", 500, "epic"),
]
MERCHANT_ONLY = {"coat_sea", "coat_royal"}
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
    for w, (iid, name, slot, theme, new, base, rec) in _BOSS.items():
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
    dict(kind="wood", title="Wooden Chest", price_coins=400, price_gems=None, odds=[
        {"reward": "coins", "min": 80, "max": 150, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.35},
    ]),
    # Phase B (audit 5.3 C): a chest never pays gems back (gem-bought chests used to return 3-30 gems)
    dict(kind="silver", title="Silver Chest", price_coins=None, price_gems=30, odds=[
        {"reward": "coins", "min": 400, "max": 700, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.6},
    ]),
    dict(kind="epic", title="Epic Chest", price_coins=None, price_gems=80, odds=[
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
         price={"gems": 10}),
    dict(id="chest_wood", title="Wooden Chest", note="See the odds before you buy", kind="chest",
         price={"coins": 400}),
    dict(id="chest_silver", title="Silver Chest", note="See the odds before you buy", kind="chest",
         price={"gems": 30}),
    dict(id="chest_epic", title="Epic Chest", note="See the odds before you buy", kind="chest", price={"gems": 80}),
]
OFFER_BY_ID = {o["id"]: o for o in OFFERS}

# ---------------------------------------------------------------- real money (placeholder, disabled)
SKUS = [
    dict(sku="gems_80", kind="gems", gems=80, price_units=1, enabled=False),
    dict(sku="gems_250", kind="gems", gems=250, price_units=3, enabled=False),
    dict(sku="gems_650", kind="gems", gems=650, price_units=7, enabled=False),
    dict(sku="gems_1500", kind="gems", gems=1500, price_units=13, enabled=False),
    dict(sku="sub_monthly", kind="subscription", gems=100, price_units=5, enabled=False,
         includes=["coat_star", "coat_shadow", "monthly set", "unlimited hearts", "100 gems a month"]),
    dict(sku="sub_yearly", kind="subscription", gems=100, price_units=35, enabled=False,
         includes=["same as monthly, 7 months' price"]),
]

STARTING_WALLET = dict(gems=40, coins=1250, hearts=5, hearts_max=5, elixir=3)

# ---------------------------------------------------------------- Phase B sinks (audit 5.3 A-C)
HINT_FREE_PER_DAY = 3        # then HINT_COST_COINS each
HINT_COST_COINS = 20
CONTINUE_GEMS = 15           # or 1 elixir: "+3 questions" once per lost trial / boss / vault
CONTINUE_QUESTIONS = 3
STREAK_REPAIR_GEMS = 200     # restores a Hearthfire that went out, within 2 missed days (48 h)
STREAK_REPAIR_MAX_MISSED = 2
