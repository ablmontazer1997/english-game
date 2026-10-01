"""Wardrobe item catalogue (from out/runecast_design/items_economy.md), chests with published odds, shop offers and
real-money SKUs (placeholders, not live). Cosmetic only: no item changes play, scoring or the league."""

# id, name, slot, tier, rarity, price_gems, theme, extra
_FREE = [
    ("eyes_violet", "Violet eyes", "eyes", "arcane"),
    ("eyes_brown", "Brown eyes", "eyes", "natural"),
    ("hair_short", "Short", "hair", "neutral"),
    ("hair_girllong", "Long", "hair", "neutral"),
    ("haircolor_natural", "Natural", "haircolor", "natural"),
    ("haircolor_black", "Black", "haircolor", "natural"),
    ("haircolor_darkbrown", "Dark brown", "haircolor", "natural"),
    ("haircolor_chestnut", "Chestnut", "haircolor", "natural"),
    ("haircolor_blonde", "Blonde", "haircolor", "natural"),
    ("hat", "Wizard hat", "hat", "arcane"),
    ("top_apprentice", "Apprentice tunic", "top", "neutral"),
    ("coat", "Wizard coat", "coat", "arcane"),
    ("pants", "Pants", "pants", "neutral"),
    ("shoes", "Boots", "shoes", "neutral"),
    ("pose_idle", "Idle", "pose", "neutral"),
    ("pose_walk", "Walk", "pose", "neutral"),
    ("pose_cast_a_spell", "Cast", "pose", "arcane"),
    ("pose_bow", "Bow", "pose", "neutral"),
    ("palette_basic", "Basic palette", "palette", "neutral"),
]
DEFAULT_EQUIP = {"eyes": "eyes_violet", "hair": "hair_short", "haircolor": "haircolor_natural", "hat": "hat",
                 "top": "top_apprentice", "coat": "coat", "pants": "pants", "shoes": "shoes", "pose": "pose_idle",
                 "palette": "palette_basic"}

PRICES = {"common": 50, "rare": 150, "epic": 400}
_GEM = [
    ("eyes_blue", "Blue eyes", "eyes", "common", "natural / frost"),
    ("eyes_green", "Green eyes", "eyes", "common", "natural / forest"),
    ("eyes_hazel", "Hazel eyes", "eyes", "common", "natural / forest"),
    ("eyes_grey", "Grey eyes", "eyes", "common", "natural / moon"),
    ("eyes_pack_enchanted", "Enchanted eyes (Amber, Aqua, Ruby, Pink)", "eyes", "rare", "sun / sea / dragon / fairy"),
    ("hair_pony", "Ponytail", "hair", "common", "neutral"),
    ("hair_bob", "Bob", "hair", "common", "neutral"),
    ("hair_quiff", "Quiff", "hair", "common", "academy"),
    ("hair_spiky", "Spiky", "hair", "common", "fire"),
    ("hair_twin", "Twin tails", "hair", "rare", "fairy"),
    ("hair_braid", "Braid", "hair", "rare", "forest / elf"),
    ("hair_curly", "Curly", "hair", "rare", "neutral"),
    ("hair_twobuns", "Space buns", "hair", "rare", "fairy / star"),
    ("haircolor_auburn", "Auburn", "haircolor", "common", "autumn / fire"),
    ("haircolor_ginger", "Ginger", "haircolor", "common", "fire"),
    ("haircolor_platinum", "Platinum", "haircolor", "common", "frost / moon"),
    ("haircolor_pack_fantasy", "Fantasy hair (Pink, Lilac, Blue, Mint)", "haircolor", "rare",
     "fairy / crystal / frost / forest"),
    ("pose_clap", "Clap", "pose", "common", "neutral"),
    ("pose_box_03", "Box", "pose", "common", "fire / duel"),
    ("pose_fold_arms", "Fold arms", "pose", "common", "neutral"),
    ("pose_afraid", "Afraid", "pose", "common", "neutral"),
    ("pose_scared_01", "Scared", "pose", "common", "neutral"),
    ("pose_cry", "Cry", "pose", "common", "neutral"),
    ("palette_jewel", "Jewel palette (Violet, Emerald, Teal)", "palette", "rare", "crystal / forest"),
    ("palette_night_gold", "Night and gold palette (Midnight, Gold, Rose)", "palette", "rare", "moon / royal"),
    ("coat_royal", "Royal ermine cloak", "coat", "epic", "royal"),
    ("coat_sea", "Sea cloak", "coat", "epic", "sea"),
]
_PREMIUM = [
    ("coat_star", "Star cloak", "coat", "star", True, "test-only model, not in the live wardrobe yet"),
    ("coat_shadow", "Shadow cloak", "coat", "shadow", True, "test-only model, not in the live wardrobe yet"),
    ("palette_shimmer", "Shimmer palette", "palette", "star", False, "future: needs a new shader"),
]
# boss drops: topic-world number 1..40 in course order (consolidation worlds not counted; seed maps it to the world
# and stores the real global index in items.world_drop) -> (id, name, slot, theme, is_new, base_mesh, recolour)
_BOSS = {
    1: ("shoes_forest", "Forest boots", "shoes", "forest", False, None, None),
    2: ("shoes_crystal", "Crystal boots", "shoes", "crystal", False, None, None),
    3: ("shoes_librarian", "Librarian boots", "shoes", "academy", True, "shoes", "leather brown + gold"),
    4: ("shoes_curl", "Curled-toe slippers", "shoes", "alchemy / bazaar", False, None, None),
    5: ("shoes_wing", "Winged boots", "shoes", "fairy / sky", False, None, None),
    6: ("pants_shadow", "Shadow pants", "pants", "shadow / moon", False, None, None),
    7: ("shoes_frost", "Frost boots", "shoes", "frost", False, None, None),
    8: ("shoes_fire", "Fire boots", "shoes", "fire", False, None, None),
    9: ("shoes_runestone", "Runestone boots", "shoes", "rune", True, "shoes_crystal", "grey teal"),
    10: ("shoes_royal", "Royal boots", "shoes", "royal", False, None, None),
    11: ("shoes_star", "Star boots", "shoes", "star", False, None, None),
    12: ("pants_forest", "Forest pants", "pants", "forest", False, None, None),
    13: ("pants_geode", "Geode pants", "pants", "crystal", True, "pants_frost", "amethyst violet"),
    14: ("pants_page", "Page pants", "pants", "academy", True, "pants", "parchment"),
    15: ("pants_alch", "Alchemist pants", "pants", "alchemy", False, None, None),
    16: ("pants_petal", "Petal pants", "pants", "fairy", True, "pants_forest", "rose"),
    17: ("shoes_moon", "Moon boots", "shoes", "moon", True, "shoes_star", "silver"),
    18: ("pants_frost", "Frost pants", "pants", "frost", False, None, None),
    19: ("pants_fire", "Fire pants", "pants", "fire", False, None, None),
    20: ("pants_rune", "Rune pants", "pants", "rune", False, None, None),
    21: ("pants_sun", "Sun pants", "pants", "sun / gold", False, None, None),
    22: ("pants_star", "Starry night pants", "pants", "star", False, None, None),
    23: ("top_forest", "Forest tunic", "top", "forest", False, None, None),
    24: ("top_crystal", "Crystal tunic", "top", "crystal", False, None, None),
    25: ("top_ink", "Ink tunic", "top", "academy", True, "top_scholar", "ink blue"),
    26: ("shoes_alch", "Alchemist boots", "shoes", "alchemy", False, None, None),
    27: ("top_fairy", "Fairy tunic", "top", "fairy", True, "top_forest", "lilac / rose"),
    28: ("top_moon", "Moonlit tunic", "top", "moon", True, "top_star", "silver blue"),
    29: ("top_frost", "Frost tunic", "top", "frost", False, None, None),
    30: ("top_fire", "Fire tunic", "top", "fire", False, None, None),
    31: ("top_rune", "Rune tunic", "top", "rune", False, None, None),
    32: ("pants_royal", "Royal velvet pants", "pants", "royal", False, None, None),
    33: ("top_star", "Star tunic", "top", "star", False, None, None),
    34: ("coat_forest", "Forest cloak", "coat", "forest", False, None, None),
    35: ("coat_amethyst", "Amethyst cloak", "coat", "crystal", True, "coat_frost", "amethyst violet"),
    36: ("coat_scholar", "Scholar cloak", "coat", "academy", True, "coat", "ink blue + gold"),
    37: ("top_alchemist", "Alchemist vest", "top", "alchemy", False, None, None),
    38: ("coat_blossom", "Blossom cloak", "coat", "fairy", True, "coat_forest", "pink"),
    39: ("coat_midnight", "Midnight cloak", "coat", "moon / night", False, None, None),
    40: ("coat_frost", "Frost cloak", "coat", "frost", False, None, None),
}
# the five drops planned for C2 worlds 41-45 -> boss drops of the 5 consolidation worlds (curriculum.CONSOLIDATION)
_GATE = [
    ("coat_fire", "Fire cloak", "coat", "fire", False, None, None),
    ("coat_runestone", "Runestone cloak", "coat", "rune", True, "coat_forest", "stone grey"),
    ("top_scholar", "Scholar tunic", "top", "academy", False, None, None),
    ("coat_sun", "Sun cloak", "coat", "sun / star", False, None, None),
    ("coat_autumn", "Autumn cloak", "coat", "forest", True, "coat_forest", "amber / rust"),
]


def items() -> list[dict]:
    out = []
    for iid, name, slot, theme in _FREE:
        out.append(dict(id=iid, name=name, slot=slot, tier="free", rarity=None, price_gems=None, theme=theme,
                        is_default=DEFAULT_EQUIP.get(slot) == iid))
    for iid, name, slot, rarity, theme in _GEM:
        out.append(dict(id=iid, name=name, slot=slot, tier="gem", rarity=rarity, price_gems=PRICES[rarity],
                        theme=theme))
    for iid, name, slot, theme, active, notes in _PREMIUM:
        out.append(dict(id=iid, name=name, slot=slot, tier="premium", rarity=None, price_gems=None, theme=theme,
                        active=active, notes=notes))
    for w, (iid, name, slot, theme, new, base, rec) in _BOSS.items():
        out.append(dict(id=iid, name=name, slot=slot, tier="boss", rarity=None, price_gems=None, theme=theme,
                        world_drop=w, is_new=new, base_mesh=base, recolour=rec))
    for iid, name, slot, theme, new, base, rec in _GATE:
        out.append(dict(id=iid, name=name, slot=slot, tier="boss", rarity=None, price_gems=None, theme=theme,
                        is_new=new, base_mesh=base, recolour=rec,
                        notes="planned for a C2 world; now the boss drop of a consolidation world (no C2 level)"))
    return out


BOSS_DROP_BY_WORLD = {w: v[0] for w, v in _BOSS.items()}

# ---------------------------------------------------------------- chests (published odds = the RNG's table)
CHESTS = [
    dict(kind="wood", title="Wooden Chest", price_coins=400, price_gems=None, odds=[
        {"reward": "coins", "min": 80, "max": 150, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.35},
    ]),
    dict(kind="silver", title="Silver Chest", price_coins=None, price_gems=30, odds=[
        {"reward": "coins", "min": 200, "max": 350, "chance": 1.0},
        {"reward": "gems", "min": 3, "max": 8, "chance": 1.0},
        {"reward": "elixir", "amount": 1, "chance": 0.5},
    ]),
    dict(kind="epic", title="Epic Chest", price_coins=None, price_gems=80, odds=[
        {"reward": "coins", "min": 500, "max": 800, "chance": 1.0},
        {"reward": "gems", "min": 15, "max": 30, "chance": 1.0},
        {"reward": "elixir", "min": 1, "max": 2, "chance": 1.0},
    ]),
]

# ---------------------------------------------------------------- shop offers (game currencies)
OFFERS = [
    dict(id="hearts_full", title="Full Hearts", note="Refill all hearts now", kind="essential", price={"gems": 15}),
    dict(id="elixir_1", title="Elixir", note="Save a lost boss, keep your heart", kind="essential",
         price={"gems": 10}),
    dict(id="elixir_3", title="3 Elixirs", note="Best value for rescues", kind="essential", price={"gems": 25}),
    dict(id="xp_boost", title="Double XP - 15 min", note="Faster player levels. Never counts in the league.",
         kind="boost", price={"coins": 250}),
    dict(id="freeze", title="Frost Ward", note="Covers one missed day (hold up to 2). Only while your Hearthfire burns.",
         kind="boost", price={"coins": 300}),
    dict(id="coin_sack", title="Coin Sack", note="1,000 coins for hints and boosts", kind="boost",
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
         includes=["coat_star", "coat_shadow", "monthly item", "palette_shimmer", "100 gems a month"]),
    dict(sku="sub_yearly", kind="subscription", gems=100, price_units=35, enabled=False,
         includes=["same as monthly, 7 months' price"]),
]

STARTING_WALLET = dict(gems=40, coins=1250, hearts=5, hearts_max=5, elixir=3)
