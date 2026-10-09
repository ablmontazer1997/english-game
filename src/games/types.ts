import type { SrsItem, ServerQuestion } from '../types/game'

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
  /** the player's CEFR level for this stage: 0..4 = A1..C1 */
  level?: number
  /** painting index 0..10 (w1..w11) of the world this stage belongs to (Boss Battle: the world's boss) */
  world?: number
  /** server mode: the questions of this round (payload per game). When set, the game plays exactly
   *  these instead of its local bank and reports every answer through onAnswer. */
  srv?: ServerQuestion[]
  /** server mode: one item answered, in the server's grading shape (API.md "Grading") */
  onAnswer?: (qid: string, answer: unknown, correct: boolean) => void
}

export type MiniGameComponent = (props: MiniGameProps) => React.ReactElement

export type { SrsItem }
