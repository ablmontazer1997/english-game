import type { SrsItem } from '../types/game'

// Outcome a mini-game reports back to the stage host.
export interface MiniGameOutcome {
  correct: number
  total: number
  maxCombo: number
}

// Every mini-game is a self-contained component that teaches/tests the given
// SRS items and calls onFinish exactly once when done. `front` is the prompt
// (e.g. the English word), `back` is the answer/meaning, `distractors` are wrong
// options. Keep it mobile-portrait (~390px wide), no external libraries.
export interface MiniGameProps {
  items: SrsItem[]
  onFinish: (o: MiniGameOutcome) => void
}

export type MiniGameComponent = (props: MiniGameProps) => React.ReactElement

export type { SrsItem }
