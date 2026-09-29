import { lazy, type ComponentType } from 'react'
import type { MiniGameId } from '../types/game'
import type { MiniGameProps } from './types'
import { QuizGame } from './QuizGame'
import { BubblePop } from './BubblePop'
import { MatchBlitz } from './MatchBlitz'
import { MemoryCrystals } from './MemoryCrystals'
import { GapGate } from './GapGate'
import { OracleTrial } from './OracleTrial'
import { RuneOrder } from './RuneOrder'
import { WhisperScroll } from './WhisperScroll'
import { TavernTalk } from './TavernTalk'
import { EchoCave } from './EchoCave'
import { RuneType } from './RuneType'
import { PotionMix } from './PotionMix'
import { CurseBreaker } from './CurseBreaker'
import { SpellWeaver } from './SpellWeaver'
import { CrystalBall } from './CrystalBall'
import { BardsTale } from './BardsTale'
import { GuildLetters } from './GuildLetters'

// Boss Battle pulls in PixiJS (~450kB), so it is code-split into its own chunk
// and only fetched when a boss stage is actually played. Rendered under a
// <Suspense> boundary in StageScreen.
const BossBattle = lazy(() => import('./BossBattle').then((m) => ({ default: m.BossBattle })))

// MiniGameId -> implementation. Anything unmapped falls back to the quiz.
const REGISTRY: Partial<Record<MiniGameId, ComponentType<MiniGameProps>>> = {
  'bubble-pop': BubblePop,
  'match-blitz': MatchBlitz,
  'memory-crystals': MemoryCrystals,
  'gap-gate': GapGate,
  'oracle-trial': OracleTrial,
  'rune-order': RuneOrder,
  'whisper-scroll': WhisperScroll,
  'tavern-talk': TavernTalk,
  'echo': EchoCave,
  'rune-type': RuneType,
  'potion-mix': PotionMix,
  'curse-breaker': CurseBreaker,
  'spell-weaver': SpellWeaver,
  'crystal-ball': CrystalBall,
  'bards-tale': BardsTale,
  'guild-letters': GuildLetters,
  'boss-battle': BossBattle,
}

export function gameFor(id: MiniGameId): ComponentType<MiniGameProps> {
  return REGISTRY[id] ?? QuizGame
}
