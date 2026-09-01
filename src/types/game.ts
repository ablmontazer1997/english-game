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
}

export interface World {
  id: string
  name: string
  cefr: string        // 'A1' ...
  accent: string      // token name for themed glow
  stages: Stage[]
}

export type MiniGameId =
  | 'boss-battle' | 'match-blitz' | 'bubble-pop'
  | 'spell-weaver' | 'rune-type' | 'potion-mix'
  | 'echo' | 'portal-run' | 'memory-crystals' | 'gap-gate'

export interface Quest {
  id: string
  title: string
  progress: number
  target: number
  reward: Reward
  period: 'daily' | 'weekly'
  done: boolean
}

export interface Reward {
  coins?: number
  gems?: number
  potion?: number
  chest?: 'common' | 'rare' | 'epic' | 'legendary'
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
}

// One learning item scheduled by SRS and surfaced inside a mini-game.
export interface SrsItem {
  id: string
  front: string       // e.g. english word / prompt
  back: string        // e.g. meaning / answer
  distractors: string[]
  mastery: number     // 0..5
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
}
