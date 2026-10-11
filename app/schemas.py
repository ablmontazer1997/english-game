from typing import Any, Literal

from pydantic import BaseModel, Field

LevelCode = Literal["A1", "A2", "B1", "B2", "C1"]


class GuestIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=128, description="stable per-install id")
    display_name: str | None = Field(None, max_length=40)
    timezone: str | None = Field(None, description="IANA zone, e.g. Asia/Tehran; days and weeks use it")
    level: LevelCode | None = None


class MeOut(BaseModel):
    id: str
    display_name: str
    kind: str
    level: str
    timezone: str
    player_level: int
    xp: int
    xp_to_next: int
    xp_total: int
    streak: int
    xp_boost_until: int
    league_opt_in: bool
    created_at: str | None
    onboarded: bool = True
    daily_goal: int | None = None
    flags: dict[str, Any] = Field(default_factory=dict)


class TokenOut(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_at: str
    created: bool
    user: MeOut


class MePatch(BaseModel):
    display_name: str | None = Field(None, max_length=40)
    timezone: str | None = None
    league_opt_in: bool | None = None
    level: LevelCode | None = Field(None, description="placement / chosen current level")
    daily_goal: int | None = Field(None, ge=1, le=3, description="stages a day (the intro's daily vow)")
    onboarded: bool | None = Field(None, description="true = the first-run intro is finished")
    flags: dict[str, Any] | None = Field(None, description="merged into the account's client flags (known keys only)")


class WalletOut(BaseModel):
    hearts: int
    heartsMax: int
    heartsRefillAt: int | None = Field(description="epoch ms of the next regenerated heart")
    potion: int = Field(description="= elixir (the app's name)")
    elixir: int
    coins: int
    gems: int


class LedgerRow(BaseModel):
    id: int
    currency: str
    delta: int
    balance_after: int
    reason: str
    ref: str | None
    created_at: str


class LevelOut(BaseModel):
    code: str
    ordinal: int
    title: str
    world_count: int
    unlocked: bool
    current: bool


class QuestionOut(BaseModel):
    qid: str
    game: str
    level: str
    difficulty: int
    grammar: list[str]
    skills: list[str]
    topic: str
    payload: dict[str, Any] = Field(description="the pipeline game schema (master_prompt.md section 6)")
    source: str | None = Field(None, description="new | review | fallback")
    topic_id: str | None = None
    box: int | None = None
    mastery: int | None = None
    due_at: str | None = None


class StageOut(BaseModel):
    id: str
    world_id: str
    level: str
    index: int
    kind: str
    client_kind: str
    variant: str | None
    required: bool
    topic_id: str | None
    mini_game: str
    title: str
    hearts_apply: bool
    question_count: int
    review_ratio: float
    status: str | None = None
    stars: int | None = None


class StartOut(BaseModel):
    session_id: str
    stage: StageOut
    expires_at: str
    review_ratio: float
    questions: list[QuestionOut]
    hearts: int
    hints: dict[str, Any] | None = Field(None, description="Phase B: free_left / cost_coins (3 free hints a day)")
    continue_: dict[str, Any] | None = Field(None, alias="continue",
                                             description="Phase B: the '+3 questions' offer after a loss")

    model_config = {"populate_by_name": True}


class AnswerIn(BaseModel):
    qid: str
    answer: Any = Field(None, description="game-specific, see API.md 'Grading'")
    correct: bool | None = Field(None, description="client's own verdict; trusted only for echo")
    ms: int | None = None


class CompleteIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=60)
    hints_used: int = 0
    use_elixir: bool = False
    focus: bool = Field(False, description="Focus mode: untimed; at most 2 stars and no league points")


class ReviewIn(BaseModel):
    answers: list[AnswerIn] = Field(max_length=200)


class BuyIn(BaseModel):
    item_id: str | None = None
    offer_id: str | None = None


class EquipIn(BaseModel):
    slot: str
    item_id: str | None = None


class CheckoutIn(BaseModel):
    product_id: str | None = None
    sku: str | None = None          # old name of product_id
    provider: str | None = None


# ---------------------------------------------------------------- Phase B: wardrobe + sinks
class LookIn(BaseModel):
    look: dict[str, Any] = Field(description="body, tone, blush, hair, haircolor, eyes, hat, top, coat, pants, shoes "
                                             "(catalogue ids; null = none for hat/top/coat/pants/shoes), tint {id: swatch}")
    migrate: bool = Field(False, description="the app's first upload of a look kept only in the browser")


class WardrobeBuyIn(BaseModel):
    item_id: str
    wear: bool = False


class DyeIn(BaseModel):
    garment: str
    swatch: str


class SetIn(BaseModel):
    set_id: str


class ContinueIn(BaseModel):
    pay: str = Field("gems", description="elixir | gems")


# ---------------------------------------------------------------- Phase D: store, season pass, web push
class ProductIn(BaseModel):
    product_id: str


class ConfirmIn(BaseModel):
    purchase_id: str
    payload: dict = {}


class SeasonClaimIn(BaseModel):
    tier: int
    track: str = "free"


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubIn(BaseModel):
    endpoint: str
    keys: PushKeys
    user_agent: str = ""


class PushUnsubIn(BaseModel):
    endpoint: str | None = None
