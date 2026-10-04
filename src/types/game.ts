// Domain types. The backend, when built, must satisfy these same shapes so the
// UI never changes — only the service implementation is swapped.

export type CurrencyId = 'hearts' | 'potion' | 'coins' | 'gems'

export interface Currencies {
  hearts: number
  heartsMax: number
  heartsRefillAt: number | null // epoch ms when next heart regenerates (null = full)
  potion: number
  coins: number
  gems: number
}

export interface PlayerProfile {
  id: string
  name: string
  level: number
  xp: number
  xpToNext: number
  streak: number
  avatar: AvatarConfig
  leagueTier: LeagueTier
}

export interface AvatarConfig {
  base: string        // silhouette id
  robeColor: string   // token or hex
  familiar: string    // pet id
  staff: string       // staff id
  aura: string        // aura id
}

export type StageStatus = 'locked' | 'current' | 'done'
export type StageKind = 'lesson' | 'practice' | 'boss' | 'treasure' | 'review'

export interface Stage {
  id: string
  index: number       // 1-based within world
  kind: StageKind
  status: StageStatus
  stars: number       // 0..3
  miniGame: MiniGameId
  title: string
  cefr?: string       // the world's level, 'A1' ...
  // ---- server-driven map (runecast-api /v1/map) ----
  /** server stage kind: lesson | practice | practice2 | trial | boss | bonus */
  serverKind?: string
  /** optional (bonus) stage: never blocks the road, never holds the hero */
  optional?: boolean
  heartsApply?: boolean
  topicId?: string | null
  worldId?: string
  questionCount?: number
}

export interface World {
  id: string
  name: string
  cefr: string        // 'A1' ...
  accent: string      // token name for themed glow
  stages: Stage[]
  // ---- server-driven map ----
  /** painting index 0..10 (w1..w11) the world is drawn with */
  paint?: number
  status?: 'locked' | 'current' | 'done'
  topics?: { id: string; slot: number; title: string; kind: string }[]
  consolidation?: boolean
  bossDrop?: { item_id: string; name: string; slot: string; owned: boolean } | null
  /** 1..45 across all levels */
  globalIndex?: number
  levelLocked?: boolean
}

export type MiniGameId =
  | 'boss-battle' | 'match-blitz' | 'bubble-pop'
  | 'spell-weaver' | 'rune-type' | 'potion-mix'
  | 'echo' | 'portal-run' | 'curse-breaker' | 'crystal-ball' | 'bards-tale' | 'guild-letters' | 'memory-crystals' | 'gap-gate' | 'oracle-trial' | 'rune-order' | 'whisper-scroll' | 'tavern-talk'

export interface Quest {
  id: string
  title: string
  progress: number
  target: number
  reward: Reward
  period: 'daily' | 'weekly'
  done: boolean
  /** the chest quest that completes a set (all dailies / dailies on 5 days) */
  bonus?: boolean
}

export interface Reward {
  coins?: number
  gems?: number
  potion?: number
  chest?: ChestKind
}

export type ChestKind = 'wood' | 'silver' | 'epic'

export type AchievementCat = 'journey' | 'stars' | 'scholar' | 'streak' | 'boss' | 'treasure' | 'wealth' | 'gems' | 'league' | 'quests' | 'elixir' | 'explorer'
export interface Achievement {
  id: string
  cat: AchievementCat
  title: string
  desc: string
  tier: number        // 1 bronze, 2 silver, 3 gold, 4 astral
  progress: number
  target: number
  reward: Reward
  claimed: boolean
}

/** what the player owns and has running, besides the four currencies */
export interface Inventory {
  chests: Record<ChestKind, number>
  freezes: number          // Streak Freeze charges (max 2)
  xpBoostUntil: number     // epoch ms, double XP while in the future
  dealBought: boolean      // today's deal already taken
}

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'ruby' | 'astral' | 'legend'

export interface LeagueEntry {
  playerId: string
  name: string
  lp: number
  isMe: boolean
}

export interface League {
  tier: LeagueTier
  endsAt: number
  entries: LeagueEntry[]
  promoteCount: number
  demoteCount: number
  /** the result of the week that just ended, until the player has seen it */
  last?: { tier: LeagueTier; rank: number; moved: -1 | 0 | 1; reward: Reward }
}

// One learning item scheduled by SRS and surfaced inside a mini-game.
export interface SrsItem {
  id: string
  front: string       // e.g. english word / prompt
  back: string        // e.g. meaning / answer
  distractors: string[]
  mastery: number     // 0..5
  /** server boss items made from grammar games: the line to show instead of "Choose the meaning of" */
  ask?: string
}

// Result reported by a mini-game back to the host.
export interface StageResult {
  stageId: string
  correct: number
  total: number
  stars: number
  heartsLost: number
  xpGained: number
  coinsGained: number
  gemsGained?: number
  miniGame?: MiniGameId
  boss?: boolean
  /** XP already includes the Double XP boost */
  boosted?: boolean
}

// ---- server play (runecast-api) ----
/** one question as the server sends it; payload = the pipeline game schema */
export interface ServerQuestion {
  qid: string
  game: MiniGameId
  level: string
  difficulty?: number
  topic_id?: string | null
  source?: 'new' | 'review' | 'fallback'
  payload: any
  box?: number
  due_at?: string
}
/** one answer in the server's grading shape (API.md "Grading") */
export interface ServerAnswer { qid: string; answer: unknown; correct: boolean; ms: number }
