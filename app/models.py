"""English Spell (internal: runecast) data model. Every table lives in the `runecast` database only."""
import uuid
from datetime import date, datetime

from sqlalchemy import (BigInteger, Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text,
                        UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base

TS = DateTime(timezone=True)


def _now():
    return func.now()


# ---------------------------------------------------------------- content
class Level(Base):
    __tablename__ = "levels"
    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    ordinal: Mapped[int] = mapped_column(Integer, unique=True)
    title: Mapped[str] = mapped_column(Text)
    world_count: Mapped[int] = mapped_column(Integer)


class GrammarTopic(Base):
    __tablename__ = "grammar_topics"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"))
    order_in_level: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(10), default="core")  # core | mixed
    source: Mapped[str] = mapped_column(String(10), default="bingual")
    # pipeline grammar codes (runecast_qdb master prompt, e.g. A1-G06) whose questions teach this topic
    qdb_codes: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    # earlier topics this one deepens (used for C1 review mixing); mixed topics list what they cover
    precursors: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    covers: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)


class Item(Base):
    __tablename__ = "items"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    slot: Mapped[str] = mapped_column(String(16))
    tier: Mapped[str] = mapped_column(String(10))  # free | boss | earned | coin | gem | premium
    rarity: Mapped[str | None] = mapped_column(String(10), nullable=True)  # common | rare | epic
    price_gems: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_coins: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Phase B: coin tier
    how: Mapped[str] = mapped_column(Text, default="", server_default="")  # how to get it (earned / premium)
    sort: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    world_drop: Mapped[int | None] = mapped_column(Integer, nullable=True)  # global world index 1..45
    drop_stage_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    theme: Mapped[str] = mapped_column(Text, default="")
    base_mesh: Mapped[str | None] = mapped_column(Text, nullable=True)
    recolour: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(Text, default="")


class World(Base):
    __tablename__ = "worlds"
    id: Mapped[str] = mapped_column(Text, primary_key=True)  # A1-W01
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"))
    index: Mapped[int] = mapped_column(Integer)
    global_index: Mapped[int] = mapped_column(Integer, unique=True)
    name: Mapped[str] = mapped_column(Text)
    paint_id: Mapped[str] = mapped_column(String(8))  # w1..w11 = the 11 existing paintings
    paint_name: Mapped[str] = mapped_column(Text)
    accent: Mapped[str] = mapped_column(String(16))
    variant: Mapped[dict] = mapped_column(JSONB, default=dict)  # {tint, weather, time}
    boss_drop_item_id: Mapped[str | None] = mapped_column(ForeignKey("items.id"), nullable=True)
    __table_args__ = (UniqueConstraint("level", "index"),)


class WorldTopic(Base):
    __tablename__ = "world_topics"
    world_id: Mapped[str] = mapped_column(ForeignKey("worlds.id", ondelete="CASCADE"), primary_key=True)
    slot: Mapped[int] = mapped_column(Integer, primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("grammar_topics.id"))


class Stage(Base):
    __tablename__ = "stages"
    id: Mapped[str] = mapped_column(Text, primary_key=True)  # A1-W01-S01
    world_id: Mapped[str] = mapped_column(ForeignKey("worlds.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"))
    index: Mapped[int] = mapped_column(Integer)
    order_key: Mapped[int] = mapped_column(Integer)  # world.index*100 + index, linear order inside a level
    kind: Mapped[str] = mapped_column(String(10))  # lesson|practice|practice2|trial|boss|bonus
    variant: Mapped[str | None] = mapped_column(String(10), nullable=True)  # bonus: vault | gate
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("grammar_topics.id"), nullable=True)
    mini_game: Mapped[str] = mapped_column(String(20))
    games: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    title: Mapped[str] = mapped_column(Text)
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    question_count: Mapped[int] = mapped_column(Integer)
    review_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    vocab_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    hearts_apply: Mapped[bool] = mapped_column(Boolean, default=False)
    drop_item_id: Mapped[str | None] = mapped_column(ForeignKey("items.id"), nullable=True)
    __table_args__ = (UniqueConstraint("world_id", "index"), Index("ix_stages_level_order", "level", "order_key"))


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    game: Mapped[str] = mapped_column(String(20))
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"))
    difficulty: Mapped[int] = mapped_column(Integer, default=2)
    grammar_codes: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    skills: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    topic: Mapped[str] = mapped_column(Text, default="")
    # Bingual grammar topic id the pipeline generated this item for (since 2026-10-01); None = only grammar_codes
    topic_id: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    payload: Mapped[dict] = mapped_column(JSONB)
    content_hash: Mapped[str] = mapped_column(String(40))
    source_file: Mapped[str] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    imported_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    __table_args__ = (Index("ix_questions_game_level", "game", "level"),
                      Index("ix_questions_codes", "grammar_codes", postgresql_using="gin"),
                      Index("ix_questions_topic_id", "topic_id"))


class Word(Base):
    __tablename__ = "words"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"))
    word: Mapped[str] = mapped_column(Text)
    definition: Mapped[str] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(Text, default="")
    question_id: Mapped[str | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"), nullable=True)
    __table_args__ = (UniqueConstraint("level", "word"),)


# ---------------------------------------------------------------- players
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(10), default="guest")  # guest | registered
    display_name: Mapped[str] = mapped_column(Text, default="Apprentice")
    email: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # admin 6018: lower-case login name for POST /v1/auth/login (scripts/make_accounts.py); null for guests
    username: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    timezone: Mapped[str] = mapped_column(Text, default="Asia/Tehran")
    level: Mapped[str] = mapped_column(ForeignKey("levels.code"), default="A1")
    player_level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    xp_to_next: Mapped[int] = mapped_column(Integer, default=800)
    xp_total: Mapped[int] = mapped_column(BigInteger, default=0)
    xp_boost_until: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    league_opt_in: Mapped[bool] = mapped_column(Boolean, default=True)
    # first-run intro (10-11): None = the intro has not been finished; existing players were marked done by 0003
    onboarded_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    daily_goal: Mapped[int | None] = mapped_column(Integer, nullable=True)  # stages a day the player vowed (1..3)
    # small client flags kept on the account (e.g. {"tour": "pending" | "done"}); see play.FLAG_KEYS
    flags: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    # Phase B: the 3D look saved on the account (catalogue ids, see services/wardrobe.py); null = never saved
    look: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    dyes: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")  # "garment:swatch" owned
    # true for accounts that existed before server ownership: their first look upload keeps what they wear
    look_legacy: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Phase D: Archmage Circle (premium) entitlement end; null = never premium. Only a fulfilled purchase sets it.
    premium_until: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    # Phase D Web Push: the local day the last reminder went out (at most one a day)
    last_reminder_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    last_seen_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class UserAchievement(Base):
    """A claimed achievement step (id like `journey.2`); `reward` is what was paid."""
    __tablename__ = "user_achievements"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ach_id: Mapped[str] = mapped_column(Text, primary_key=True)
    reward: Mapped[dict] = mapped_column(JSONB, default=dict)
    claimed_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class Wallet(Base):
    """The four currencies of the current game (hearts, elixir = `potion` in the app, coins, gems)."""
    __tablename__ = "currencies"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    gems: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    hearts: Mapped[int] = mapped_column(Integer, default=5)
    hearts_max: Mapped[int] = mapped_column(Integer, default=5)
    hearts_regen_from: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    elixir: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=_now(), onupdate=_now())


class WalletTx(Base):
    __tablename__ = "wallet_tx"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    currency: Mapped[str] = mapped_column(String(10))  # gems | coins | hearts | elixir
    delta: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(40))
    ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    __table_args__ = (Index("ix_wallet_tx_user", "user_id", "id"),)


class UserProgress(Base):
    __tablename__ = "user_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    stage_id: Mapped[str] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), primary_key=True)
    best_stars: Mapped[int] = mapped_column(Integer, default=0)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    best_accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    completed_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)  # first time with >= 1 star
    last_played_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)


class StageSession(Base):
    __tablename__ = "stage_sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    stage_id: Mapped[str] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"))
    question_ids: Mapped[list[str]] = mapped_column(ARRAY(Text))
    sources: Mapped[dict] = mapped_column(JSONB, default=dict)  # qid -> {source, topic_id}
    started_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    expires_at: Mapped[datetime] = mapped_column(TS)
    completed_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    continues: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # Phase B "+3 questions"


class SrsItem(Base):
    __tablename__ = "srs_items"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[str] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True)
    topic_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    box: Mapped[int] = mapped_column(Integer, default=0)  # 0..5 (= app SrsItem.mastery)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    due_at: Mapped[datetime] = mapped_column(TS)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    last_result: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    __table_args__ = (Index("ix_srs_due", "user_id", "due_at"),)


class UserItem(Base):
    __tablename__ = "user_items"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"), primary_key=True)
    source: Mapped[str] = mapped_column(String(12))  # free | boss | bonus | shop | premium | admin
    acquired_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class UserEquipment(Base):
    __tablename__ = "user_equipment"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    slot: Mapped[str] = mapped_column(String(16), primary_key=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"))


class ChestType(Base):
    __tablename__ = "chest_types"
    kind: Mapped[str] = mapped_column(String(10), primary_key=True)  # wood | silver | epic
    title: Mapped[str] = mapped_column(Text)
    price_coins: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_gems: Mapped[int | None] = mapped_column(Integer, nullable=True)
    odds: Mapped[list] = mapped_column(JSONB)  # published odds, the RNG reads the same table


class UserChest(Base):
    __tablename__ = "user_chests"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    kind: Mapped[str] = mapped_column(ForeignKey("chest_types.kind"), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)


class ChestOpen(Base):
    __tablename__ = "chest_opens"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    reward: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class Purchase(Base):
    """Placeholder for real-money payments (not live). Nothing completes these yet."""
    __tablename__ = "purchases"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(20))  # e.g. google_play | app_store | zarinpal
    sku: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|completed|failed|refunded
    amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(8), nullable=True)
    gems_granted: Mapped[int] = mapped_column(Integer, default=0)
    provider_ref: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=_now(), onupdate=_now())


class DailyQuest(Base):
    """Quests generated for a player per period (daily / weekly). Progress is computed from user_day_stats."""
    __tablename__ = "daily_quests"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    quest_id: Mapped[str] = mapped_column(Text, primary_key=True)  # daily:2026-10-01:win
    period: Mapped[str] = mapped_column(String(8))
    period_key: Mapped[date] = mapped_column(Date)
    quest_key: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(Text)
    target: Mapped[int] = mapped_column(Integer)
    reward: Mapped[dict] = mapped_column(JSONB)
    bonus: Mapped[bool] = mapped_column(Boolean, default=False)
    claimed_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    __table_args__ = (Index("ix_quests_user_period", "user_id", "period", "period_key"),)


class UserDayStat(Base):
    __tablename__ = "user_day_stats"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)  # the player's local day
    stages_played: Mapped[int] = mapped_column(Integer, default=0)
    stages_won: Mapped[int] = mapped_column(Integer, default=0)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    stars3: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    answered: Mapped[int] = mapped_column(Integer, default=0)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    gems: Mapped[int] = mapped_column(Integer, default=0)
    bosses: Mapped[int] = mapped_column(Integer, default=0)
    review_correct: Mapped[int] = mapped_column(Integer, default=0)
    review_answered: Mapped[int] = mapped_column(Integer, default=0)
    league_points: Mapped[int] = mapped_column(Integer, default=0)
    games: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    dailies_all_claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    hints_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # Phase B: 3 free a day


class Streak(Base):
    """Hearthfire (streak) + Frost Ward (freeze charges, max 2)."""
    __tablename__ = "streaks"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    current: Mapped[int] = mapped_column(Integer, default=0)
    best: Mapped[int] = mapped_column(Integer, default=0)
    last_active_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    freezes: Mapped[int] = mapped_column(Integer, default=0)
    freezes_used: Mapped[int] = mapped_column(Integer, default=0)
    # Phase B streak repair: the Hearthfire that went out (days) and the day a new one was lit after it
    lost: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    lost_on: Mapped[date | None] = mapped_column(Date, nullable=True)


class LeagueMembership(Base):
    """Guild Tournament: one row per player per week. Points are accuracy XP without any boost."""
    __tablename__ = "leagues"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    week_start: Mapped[date] = mapped_column(Date, primary_key=True)
    tier: Mapped[str] = mapped_column(String(10))
    group_no: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    settled: Mapped[bool] = mapped_column(Boolean, default=False)
    final_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    moved: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reward: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    seen: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (Index("ix_league_group", "week_start", "tier", "group_no"),)


# ---------------------------------------------------------------- Phase D (admin msg 4839)
class SeasonProgress(Base):
    """Season Pass: one row per player per season (UTC calendar month, id like 2026-10). A new month = a new row,
    so the reset is server-side by construction."""
    __tablename__ = "season_progress"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    season_id: Mapped[str] = mapped_column(String(7), primary_key=True)
    xp: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    premium: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    free_claimed: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list, server_default="{}")
    premium_claimed: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list, server_default="{}")
    xp_day: Mapped[date | None] = mapped_column(Date, nullable=True)        # local day of xp_today
    xp_today: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated_at: Mapped[datetime] = mapped_column(TS, server_default=_now(), onupdate=_now())


class PushSubscription(Base):
    """English Spell's OWN Web Push (VAPID) subscriptions; one row per browser endpoint."""
    __tablename__ = "push_subscriptions"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(Text)
    auth: Mapped[str] = mapped_column(Text)
    user_agent: Mapped[str] = mapped_column(Text, default="", server_default="")
    fails: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_ok_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class LoginCode(Base):
    """Single-use sign-in codes (admin 5935): `scripts/mint_login.py` makes one for an account; the app trades it
    once at POST /v1/auth/redeem for a JWT + the account device id. Only the SHA-256 of the code is stored."""
    __tablename__ = "login_codes"
    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    note: Mapped[str] = mapped_column(Text, default="", server_default="")
    expires_at: Mapped[datetime] = mapped_column(TS)
    used_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, server_default=_now())


class LoginAttempt(Base):
    """Every POST /v1/auth/login try (admin 6018). Failed tries in the last 15 minutes per username and per IP drive
    the rate limit; rows older than a day are pruned on the way."""
    __tablename__ = "login_attempts"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(Text)
    ip: Mapped[str] = mapped_column(Text, default="", server_default="")
    ok: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    at: Mapped[datetime] = mapped_column(TS, server_default=_now())
