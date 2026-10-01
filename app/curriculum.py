"""The English Spell course map: 5 levels, 40 worlds, 3 related grammar topics per world, 13 required stages + bonus.

Grammar topics are Bingual's list (read-only snapshot in seed_data/bingual_grammar_topics.json):
A1 22, A2 24, B1 26, B2 24, C1 20. A level with a topic count that is not a multiple of 3 gets "mixed" consolidation
topics to fill its last slots (A1 +2, B1 +1, C1 +1), as the research recommended ("22 + 2 mixed" etc.).

Questions come from the runecast_qdb pipeline, which tags items with Core Inventory codes (A1-G01 ...). QDB_CODES maps
each Bingual topic to the pipeline codes that teach it (curated by hand; a code may sit one level away).
"""

LEVELS = [
    ("A1", 1, "Beginner Grimoire"),
    ("A2", 2, "Elementary Grimoire"),
    ("B1", 3, "Intermediate Grimoire"),
    ("B2", 4, "Upper-Intermediate Grimoire"),
    ("C1", 5, "Advanced Grimoire"),
]
LEVEL_ORD = {c: o for c, o, _ in LEVELS}
NEXT_LEVEL = {"A1": "A2", "A2": "B1", "B1": "B2", "B2": "C1", "C1": None}

# the 11 existing paintings, in the app's order (client screens/worlds.ts: w1..w11)
PAINTS = [
    ("w1", "Whispering Forest", "emerald"),
    ("w2", "Amethyst Grotto", "amethyst"),
    ("w3", "Floating Library", "amethyst"),
    ("w4", "Alchemist's Garden", "emerald"),
    ("w5", "Fairy Glade", "emerald"),
    ("w6", "Moon Temple", "cyan"),
    ("w7", "Frostspire Peaks", "cyan"),
    ("w8", "Dragon's Roost", "amethyst"),
    ("w9", "Rune Ruins", "cyan"),
    ("w10", "Wizard Academy", "emerald"),
    ("w11", "Celestial Observatory", "amethyst"),
]
# variant = how a reused painting is re-skinned: time of day by repetition, weather + tint by level
TIME_BY_REPEAT = ["day", "dusk", "night", "dawn"]
NAME_SUFFIX = ["", " at Dusk", " by Moonlight", " at Dawn"]
WEATHER_BY_LEVEL = {"A1": "clear", "A2": "mist", "B1": "rain", "B2": "snow", "C1": "starfall"}
TINT_BY_LEVEL = {"A1": "none", "A2": "warm", "B1": "cool", "B2": "violet", "C1": "gold"}

# mixed consolidation topics (not in Bingual): id -> (level, title, covered topic ids)
MIXED_TOPICS = {
    "a1-mixed-1": ("A1", "Mixed Review: Nouns, Articles and Determiners",
                   ["a1-a-an", "a1-the-basic", "a1-plural-nouns", "a1-demonstratives", "a1-some-any-basic",
                    "a1-there-is-are"]),
    "a1-mixed-2": ("A1", "Mixed Review: Present Simple, Questions and Pronouns",
                   ["a1-verb-to-be", "a1-present-simple-affirmative", "a1-present-simple-negatives-questions",
                    "a1-question-words", "a1-subject-pronouns", "a1-object-pronouns", "a1-possessive-adjectives"]),
    "b1-mixed-1": ("B1", "Mixed Review: Modals and Tense Choices",
                   ["b1-modals-of-deduction-present", "b1-modal-obligation-have-to-must-need-to",
                    "b1-present-perfect-vs-past-simple", "b1-past-perfect-simple"]),
    "c1-mixed-1": ("C1", "Capstone: Formal Register in Action",
                   ["c1-inversion-negative-adverbs-advanced", "c1-cleft-sentences-it-cleft",
                    "c1-subjunctive-formal-that-clauses", "c1-hedging-and-softening", "c1-discourse-markers-formal",
                    "c1-advanced-passive-reporting"]),
}

# level -> list of worlds, each = (world title, [topic ids for slots 1..3])
WORLDS = {
    "A1": [
        ("Who Am I", ["a1-verb-to-be", "a1-subject-pronouns", "a1-possessive-adjectives"]),
        ("Pointing and Naming", ["a1-demonstratives", "a1-a-an", "a1-the-basic"]),
        ("How Many Things", ["a1-plural-nouns", "a1-there-is-are", "a1-some-any-basic"]),
        ("Mine and Yours", ["a1-have-got", "a1-object-pronouns", "a1-possessive-pronouns"]),
        ("Every Day", ["a1-present-simple-affirmative", "a1-present-simple-negatives-questions", "a1-question-words"]),
        ("Commands and Abilities", ["a1-imperative", "a1-can-ability-permission", "a1-simple-connectors"]),
        ("Where and When", ["a1-prepositions-of-place", "a1-prepositions-of-time-basic", "a1-numbers-dates-time"]),
        ("Describing the World", ["a1-basic-adjective-placement", "a1-mixed-1", "a1-mixed-2"]),
    ],
    "A2": [
        ("Tales of Yesterday", ["a2-past-simple-regular", "a2-past-simple-irregular",
                                "a2-past-simple-negatives-questions"]),
        ("Old Stories", ["a2-past-continuous", "a2-used-to", "a2-so-because"]),
        ("Right Now", ["a2-present-continuous-now-temporary", "a2-adverbs-of-frequency",
                       "a2-prepositions-of-movement"]),
        ("Plans and Prophecies", ["a2-present-continuous-future-arrangements", "a2-be-going-to",
                                  "a2-will-predictions-decisions"]),
        ("Contests of Skill", ["a2-comparative-adjectives", "a2-superlative-adjectives", "a2-adverbs-of-manner"]),
        ("The Potion Pantry", ["a2-countable-vs-uncountable", "a2-quantifiers-basic", "a2-possessive-s"]),
        ("Rules of the Guild", ["a2-modals-must-mustnt-have-to", "a2-modals-should-shouldnt",
                                "a2-modals-could-would-basic"]),
        ("Asking and Wanting", ["a2-subject-vs-object-questions-intro", "a2-verb-ing-vs-to-intro",
                                "a2-reflexive-pronouns"]),
    ],
    "B1": [
        ("Have You Ever", ["b1-present-perfect-simple-experience", "b1-present-perfect-simple-unfinished-time",
                           "b1-for-since-yet-already-just"]),
        ("Chronicles", ["b1-present-perfect-vs-past-simple", "b1-past-perfect-simple",
                        "b1-used-to-vs-would-past-habits"]),
        ("If Spells", ["b1-zero-conditional", "b1-first-conditional", "b1-second-conditional"]),
        ("The Scribe's Craft", ["b1-passive-present-simple", "b1-passive-past-simple",
                                "b1-reported-speech-statements"]),
        ("Must and Might", ["b1-modals-of-deduction-present", "b1-modal-obligation-have-to-must-need-to",
                            "b1-mixed-1"]),
        ("Verb Patterns", ["b1-gerund-vs-infinitive-verb-ing", "b1-gerund-vs-infinitive-verb-to",
                           "b1-phrasal-verbs-introduction"]),
        ("Measures and Matches", ["b1-so-such-too-enough", "b1-as-as-not-as-as",
                                  "b1-adverbs-of-degree-quite-rather-fairly"]),
        ("Naming Things Precisely", ["b1-quantifiers-advanced", "b1-articles-zero-article-generic-the",
                                     "b1-defining-relative-clauses"]),
        ("Time and Questions", ["b1-future-plans-contrast", "b1-time-clauses", "b1-question-forms-subject-vs-object"]),
    ],
    "B2": [
        ("Ongoing Magic", ["b2-present-perfect-continuous", "b2-past-perfect-continuous", "b2-future-continuous"]),
        ("Unreal Pasts", ["b2-third-conditional", "b2-mixed-conditionals", "b2-wish-if-only-present-past"]),
        ("Looking Back, Looking Ahead", ["b2-modals-of-deduction-past", "b2-modal-perfect-should-could-would-have",
                                         "b2-future-perfect"]),
        ("Things Done", ["b2-passive-across-tenses", "b2-causative-have-get-something-done",
                         "b2-participle-clauses-basic"]),
        ("Messages Relayed", ["b2-reported-speech-questions", "b2-reported-speech-commands-requests",
                              "b2-reporting-verbs-patterns"]),
        ("Adding Detail", ["b2-non-defining-relative-clauses", "b2-reduced-relative-clauses",
                           "b2-adverb-placement-modifying-adverbs"]),
        ("Linking Arguments", ["b2-linking-contrast", "b2-linking-result-purpose",
                               "b2-inversion-intro-never-rarely-seldom"]),
        ("Small Words, Big Meaning", ["b2-articles-advanced-patterns", "b2-determiners-each-every-all-whole",
                                      "b2-phrasal-verbs-separable-inseparable"]),
    ],
    "C1": [
        ("The Art of Focus", ["c1-cleft-sentences-it-cleft", "c1-cleft-sentences-what-cleft-all-cleft",
                              "c1-emphasis-do-fronting"]),
        ("Formal Hypotheticals", ["c1-inversion-negative-adverbs-advanced", "c1-unreal-conditionals-without-if",
                                  "c1-subjunctive-formal-that-clauses"]),
        ("Stance and Possibility", ["c1-advanced-modality", "c1-hedging-and-softening", "c1-future-in-the-past"]),
        ("Reports and Patterns", ["c1-advanced-passive-reporting", "c1-advanced-reported-speech-patterns",
                                  "c1-verb-patterns-object-infinitive-gerund"]),
        ("Complex Sentences", ["c1-participle-clauses-perfect-passive", "c1-relative-clauses-advanced",
                               "c1-complex-subordination-linking"]),
        ("Cohesion", ["c1-discourse-markers-formal", "c1-ellipsis-and-substitution", "c1-punctuation-for-meaning"]),
        ("The Precise Scholar", ["c1-determiners-no-not-any-any-every-scarcely-any",
                                 "c1-articles-idiomatic-zero-patterns", "c1-mixed-1"]),
    ],
}

# Bingual topic -> pipeline grammar codes
QDB_CODES = {
    "a1-verb-to-be": ["A1-G01"],
    "a1-subject-pronouns": ["A1-G02"],
    "a1-object-pronouns": ["A1-G18"],
    "a1-possessive-adjectives": ["A1-G02"],
    "a1-demonstratives": ["A1-G03"],
    "a1-a-an": ["A1-G11"],
    "a1-the-basic": ["A1-G11"],
    "a1-plural-nouns": ["A1-G12"],
    "a1-there-is-are": ["A1-G04"],
    "a1-have-got": ["A1-G05"],
    "a1-possessive-pronouns": ["A2-G21"],
    "a1-present-simple-affirmative": ["A1-G06"],
    "a1-present-simple-negatives-questions": ["A1-G06"],
    "a1-imperative": ["A1-G10"],
    "a1-can-ability-permission": ["A1-G09"],
    "a1-question-words": ["A1-G17"],
    "a1-prepositions-of-place": ["A1-G15"],
    "a1-prepositions-of-time-basic": ["A1-G16"],
    "a1-some-any-basic": ["A1-G13", "A1-G04", "A2-G22"],
    "a1-numbers-dates-time": ["A1-G16"],
    "a1-basic-adjective-placement": ["A1-G23"],
    "a1-simple-connectors": ["A1-G20"],
    "a2-past-simple-regular": ["A2-G01", "A1-G21", "A1-G22"],
    "a2-past-simple-irregular": ["A2-G01", "A1-G22"],
    "a2-past-simple-negatives-questions": ["A2-G01"],
    "a2-past-continuous": ["A2-G02"],
    "a2-used-to": ["B1-G05"],
    "a2-present-continuous-now-temporary": ["A1-G08"],
    "a2-present-continuous-future-arrangements": ["A2-G03"],
    "a2-be-going-to": ["A2-G04"],
    "a2-will-predictions-decisions": ["A2-G05"],
    "a2-comparative-adjectives": ["A2-G08"],
    "a2-superlative-adjectives": ["A2-G08"],
    "a2-adverbs-of-frequency": ["A1-G07"],
    "a2-adverbs-of-manner": ["A2-G10"],
    "a2-quantifiers-basic": ["A2-G11"],
    "a2-countable-vs-uncountable": ["A1-G13", "A2-G11"],
    "a2-possessive-s": ["A1-G14"],
    "a2-subject-vs-object-questions-intro": ["A1-G17", "A2-G25"],
    "a2-modals-must-mustnt-have-to": ["A2-G13"],
    "a2-modals-should-shouldnt": ["A2-G14"],
    "a2-modals-could-would-basic": ["A2-G15"],
    "a2-prepositions-of-movement": ["A2-G23"],
    "a2-verb-ing-vs-to-intro": ["A2-G16", "A1-G19", "A2-G17"],
    "a2-so-because": ["A2-G19", "A1-G20"],
    "a2-reflexive-pronouns": ["B1-G22"],
    "b1-present-perfect-simple-experience": ["A2-G06", "B1-G01"],
    "b1-present-perfect-simple-unfinished-time": ["B1-G02", "B1-G01"],
    "b1-present-perfect-vs-past-simple": ["B1-G01"],
    "b1-for-since-yet-already-just": ["B1-G02", "A2-G07"],
    "b1-past-perfect-simple": ["B1-G04"],
    "b1-zero-conditional": ["A2-G18"],
    "b1-first-conditional": ["A2-G18"],
    "b1-second-conditional": ["B1-G10"],
    "b1-reported-speech-statements": ["B1-G12"],
    "b1-passive-present-simple": ["B1-G11"],
    "b1-passive-past-simple": ["B1-G11"],
    "b1-modals-of-deduction-present": ["B1-G08"],
    "b1-modal-obligation-have-to-must-need-to": ["B1-G09", "A2-G13"],
    "b1-defining-relative-clauses": ["B1-G14", "A2-G20"],
    "b1-gerund-vs-infinitive-verb-ing": ["B1-G15"],
    "b1-gerund-vs-infinitive-verb-to": ["B1-G16", "A2-G17"],
    "b1-phrasal-verbs-introduction": ["A2-G24", "B1-G25"],
    "b1-so-such-too-enough": ["B1-G19", "A2-G12"],
    "b1-quantifiers-advanced": ["B1-G21"],
    "b1-as-as-not-as-as": ["A2-G09", "B1-G26"],
    "b1-articles-zero-article-generic-the": ["A1-G11"],
    "b1-used-to-vs-would-past-habits": ["B1-G05", "B2-G15"],
    "b1-future-plans-contrast": ["B1-G06", "B1-G07"],
    "b1-question-forms-subject-vs-object": ["B1-G18", "B1-G17"],
    "b1-adverbs-of-degree-quite-rather-fairly": ["B1-G23", "B1-G26"],
    "b1-time-clauses": ["A2-G19", "B1-G20"],
    "b2-present-perfect-continuous": ["B1-G03"],
    "b2-past-perfect-continuous": ["B2-G01"],
    "b2-third-conditional": ["B2-G03"],
    "b2-mixed-conditionals": ["B2-G04", "B2-G05"],
    "b2-wish-if-only-present-past": ["B2-G06", "B1-G24", "B2-G24"],
    "b2-modals-of-deduction-past": ["B2-G12"],
    "b2-modal-perfect-should-could-would-have": ["B2-G13", "B2-G14"],
    "b2-passive-across-tenses": ["B2-G07", "B2-G08"],
    "b2-causative-have-get-something-done": ["B2-G09"],
    "b2-reported-speech-questions": ["B1-G13"],
    "b2-reported-speech-commands-requests": ["B1-G13"],
    "b2-reporting-verbs-patterns": ["B2-G10"],
    "b2-non-defining-relative-clauses": ["B2-G11"],
    "b2-reduced-relative-clauses": ["B2-G19"],
    "b2-linking-contrast": ["B2-G17", "B1-G20"],
    "b2-linking-result-purpose": ["B2-G18"],
    "b2-future-perfect": ["B2-G02"],
    "b2-future-continuous": ["B2-G02", "B1-G07"],
    "b2-articles-advanced-patterns": ["B2-G20"],
    "b2-determiners-each-every-all-whole": ["B1-G21"],
    "b2-inversion-intro-never-rarely-seldom": ["C1-G01"],
    "b2-participle-clauses-basic": ["B2-G19"],
    "b2-adverb-placement-modifying-adverbs": ["B2-G21"],
    "b2-phrasal-verbs-separable-inseparable": ["B1-G25", "B2-G23"],
    "c1-inversion-negative-adverbs-advanced": ["C1-G01"],
    "c1-cleft-sentences-it-cleft": ["C1-G04"],
    "c1-cleft-sentences-what-cleft-all-cleft": ["C1-G04"],
    "c1-unreal-conditionals-without-if": ["C1-G02", "C1-G03"],
    "c1-subjunctive-formal-that-clauses": ["C1-G05"],
    "c1-advanced-modality": ["C1-G09"],
    "c1-discourse-markers-formal": ["C1-G13"],
    "c1-hedging-and-softening": ["C1-G14"],
    "c1-emphasis-do-fronting": ["C1-G12"],
    "c1-ellipsis-and-substitution": ["C1-G11", "B2-G22"],
    "c1-advanced-passive-reporting": ["C1-G06", "B2-G08"],
    "c1-advanced-reported-speech-patterns": ["B2-G10"],
    "c1-participle-clauses-perfect-passive": ["C1-G07"],
    "c1-relative-clauses-advanced": ["C1-G16"],
    "c1-future-in-the-past": ["C1-G10"],
    "c1-verb-patterns-object-infinitive-gerund": ["B2-G16"],
    "c1-determiners-no-not-any-any-every-scarcely-any": [],
    "c1-articles-idiomatic-zero-patterns": ["B2-G20", "C1-G15"],
    "c1-punctuation-for-meaning": [],
    "c1-complex-subordination-linking": ["C1-G13", "C1-G08"],
}

# C1 "deepening": every C1 topic names the B1/B2 topics it builds on. Trials and the boss pull their 30-40% review
# share from these precursors first, so C1 revisits and stretches the earlier families instead of adding new ones.
PRECURSORS = {
    "c1-inversion-negative-adverbs-advanced": ["b2-inversion-intro-never-rarely-seldom"],
    "c1-cleft-sentences-it-cleft": ["b2-non-defining-relative-clauses", "b1-defining-relative-clauses"],
    "c1-cleft-sentences-what-cleft-all-cleft": ["b1-defining-relative-clauses"],
    "c1-unreal-conditionals-without-if": ["b2-third-conditional", "b2-mixed-conditionals"],
    "c1-subjunctive-formal-that-clauses": ["b2-wish-if-only-present-past", "b2-reporting-verbs-patterns"],
    "c1-advanced-modality": ["b2-modals-of-deduction-past", "b2-modal-perfect-should-could-would-have"],
    "c1-discourse-markers-formal": ["b2-linking-contrast", "b2-linking-result-purpose"],
    "c1-hedging-and-softening": ["b1-modals-of-deduction-present", "b2-modals-of-deduction-past"],
    "c1-emphasis-do-fronting": ["b2-inversion-intro-never-rarely-seldom"],
    "c1-ellipsis-and-substitution": ["b2-reported-speech-questions", "b1-question-forms-subject-vs-object"],
    "c1-advanced-passive-reporting": ["b2-passive-across-tenses", "b1-passive-past-simple"],
    "c1-advanced-reported-speech-patterns": ["b2-reporting-verbs-patterns", "b2-reported-speech-commands-requests"],
    "c1-participle-clauses-perfect-passive": ["b2-participle-clauses-basic"],
    "c1-relative-clauses-advanced": ["b2-non-defining-relative-clauses", "b2-reduced-relative-clauses"],
    "c1-future-in-the-past": ["b2-future-continuous", "b1-future-plans-contrast"],
    "c1-verb-patterns-object-infinitive-gerund": ["b1-gerund-vs-infinitive-verb-ing",
                                                  "b1-gerund-vs-infinitive-verb-to"],
    "c1-determiners-no-not-any-any-every-scarcely-any": ["b2-determiners-each-every-all-whole",
                                                         "b1-quantifiers-advanced"],
    "c1-articles-idiomatic-zero-patterns": ["b2-articles-advanced-patterns", "b1-articles-zero-article-generic-the"],
    "c1-punctuation-for-meaning": ["b2-non-defining-relative-clauses"],
    "c1-complex-subordination-linking": ["b1-time-clauses", "b2-linking-contrast"],
}

# ---------------------------------------------------------------- stage plan
VOCAB_GAMES = ["bubble-pop", "match-blitz", "memory-crystals", "gap-gate", "boss-battle"]
SPELLING_GAMES = ["rune-type", "potion-mix"]
GRAMMAR_GAMES = ["spell-weaver", "curse-breaker", "rune-order", "oracle-trial", "whisper-scroll", "echo",
                 "tavern-talk", "crystal-ball", "bards-tale", "guild-letters"]

LESSON_GAMES = ["spell-weaver", "curse-breaker", "oracle-trial", "rune-order"]
PRACTICE_GAMES = ["rune-order", "curse-breaker", "spell-weaver", "oracle-trial"]
MODALITY_GAMES = ["whisper-scroll", "echo", "crystal-ball", "tavern-talk", "bards-tale", "guild-letters", "rune-order"]

# kind -> (question_count, review_ratio, vocab_ratio, hearts_apply)
STAGE_RULES = {
    "lesson": (8, 0.0, 0.25, False),
    "practice": (10, 0.0, 0.2, False),
    "practice2": (6, 0.0, 0.0, False),
    "trial": (12, 0.35, 0.0, False),
    "boss": (15, 0.35, 0.0, True),
    "bonus_vault": (12, 0.0, 0.0, True),
    "bonus_gate": (20, 0.0, 0.0, True),
}
TREASURE_GEMS = 10

# The 5 drops planned for the dropped C2 worlds 41-45 move to the Oracle Gate (bonus stage 15 of each level's last
# world), so all 45 planned boss-tier items stay earnable by learning only.
GATE_DROPS = {"A1": "coat_fire", "A2": "coat_runestone", "B1": "top_scholar", "B2": "coat_sun", "C1": "coat_autumn"}


def short_title(title: str) -> str:
    return title.split(" (")[0]


def world_paint(global_index: int):
    pid, pname, accent = PAINTS[(global_index - 1) % 11]
    repeat = (global_index - 1) // 11
    return pid, pname, accent, repeat


def build_stage_plan(level: str, world_index: int, world_id: str, topics: list[dict], last_in_level: bool,
                     world_name: str):
    """Return the list of stage dicts for one world. `topics` = [{id, title}] for slots 1..3."""
    stages = []
    gi = world_index  # rotation seed so neighbouring worlds use different frame games

    def mk(idx, kind, topic_id, mini, title, games, rule_key=None, variant=None, required=True, drop=None):
        qc, rr, vr, hearts = STAGE_RULES[rule_key or kind]
        stages.append(dict(id=f"{world_id}-S{idx:02d}", world_id=world_id, level=level, index=idx,
                           order_key=world_index * 100 + idx, kind=kind, variant=variant, topic_id=topic_id,
                           mini_game=mini, games=games, title=title, required=required, question_count=qc,
                           review_ratio=rr, vocab_ratio=vr, hearts_apply=hearts, drop_item_id=drop))

    for slot, t in enumerate(topics):
        base = slot * 4
        st = short_title(t["title"])
        r = gi + slot
        mk(base + 1, "lesson", t["id"], LESSON_GAMES[r % 2], f"Spellbook: {st}", LESSON_GAMES)
        mk(base + 2, "practice", t["id"], PRACTICE_GAMES[r % len(PRACTICE_GAMES)], f"Practice: {st}",
           PRACTICE_GAMES)
        mk(base + 3, "practice2", t["id"], MODALITY_GAMES[r % len(MODALITY_GAMES)], f"Echoes: {st}",
           MODALITY_GAMES)
        mk(base + 4, "trial", t["id"], "oracle-trial", f"Trial: {st}", GRAMMAR_GAMES)
    mk(13, "boss", None, "boss-battle", f"Boss of {world_name}", GRAMMAR_GAMES)
    mk(14, "bonus", None, "curse-breaker", "Treasure Vault", GRAMMAR_GAMES, rule_key="bonus_vault",
       variant="vault", required=False)
    if last_in_level:
        mk(15, "bonus", None, "oracle-trial", "Oracle Gate", GRAMMAR_GAMES, rule_key="bonus_gate", variant="gate",
           required=False, drop=GATE_DROPS[level])
    return stages


CLIENT_KIND = {"lesson": "lesson", "practice": "practice", "practice2": "practice", "trial": "review",
               "boss": "boss", "bonus": "treasure"}
