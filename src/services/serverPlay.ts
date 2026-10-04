// Server play: turn a stage session's questions into rounds of the existing mini-games,
// and collect the player's answers in the server's grading shape (API.md "Grading").
// Pure data, no React (reusable by the React Native client).

import type { MiniGameId, ServerQuestion, ServerAnswer, SrsItem } from '../types/game'

/** games that take SrsItem cards (front / back / distractors) */
export const SRS_GAMES = new Set<MiniGameId>(['bubble-pop', 'match-blitz', 'memory-crystals', 'gap-gate', 'boss-battle'])

export interface Round {
  game: MiniGameId
  /** the server questions this round plays */
  qs: ServerQuestion[]
  /** SrsItem games: the cards (id = qid) */
  items: SrsItem[]
}

/** an SrsItem card from a vocabulary payload */
export function srsOf(q: ServerQuestion): SrsItem {
  const p = q.payload ?? {}
  return { id: q.qid, front: String(p.front ?? ''), back: String(p.back ?? ''), distractors: (p.distractors ?? []).map(String), mastery: q.box ?? 0 }
}

const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean)
const overlap = (a: string, b: string) => { const B = new Set(words(b)); return words(a).filter((w) => B.has(w)).length }

/** a few wrong orders of a sentence: neighbouring words swapped */
function misorders(text: string, n: number): string[] {
  const w = text.split(' '), out = new Set<string>()
  for (let i = 0; i < w.length - 1 && out.size < n; i++) {
    const j = (i * 3 + 1) % (w.length - 1)
    const c = [...w]; [c[j], c[j + 1]] = [c[j + 1], c[j]]
    const s = c.join(' ')
    if (s !== text) out.add(s)
  }
  return [...out]
}
/** a few plausible misspellings */
function misspell(word: string): string[] {
  const out = new Set<string>()
  const dbl = word.match(/([a-z])\1/)
  if (dbl) out.add(word.replace(dbl[0], dbl[1]))
  else if (word.length > 3) out.add(word.slice(0, 2) + word[2] + word.slice(2))
  if (word.length > 3) out.add(word.slice(0, 1) + word[2] + word[1] + word.slice(3))
  out.add(word.replace(/[aeiou](?=[^aeiou]*$)/, (v) => ({ a: 'e', e: 'a', i: 'e', o: 'a', u: 'o' } as Record<string, string>)[v]))
  out.delete(word)
  return [...out].slice(0, 3)
}

/**
 * A boss card from any game item (the boss is a quick-fire multiple choice battle).
 * Returns the card and how to turn the chosen text back into the server answer, or
 * null when the item cannot be asked as a choice (speaking, dialogues, tales, letters).
 */
export function bossCard(q: ServerQuestion): { item: SrsItem; toAnswer: (choice: string) => unknown } | null {
  const p = q.payload ?? {}
  const card = (ask: string, front: string, back: string, wrong: string[], toAnswer: (c: string) => unknown = (c) => c) =>
    ({ item: { id: q.qid, ask, front, back, distractors: wrong.filter((x) => x && x !== back).slice(0, 3), mastery: q.box ?? 0 }, toAnswer })
  switch (q.game) {
    case 'bubble-pop': case 'match-blitz': case 'memory-crystals': case 'boss-battle':
      return { item: srsOf(q), toAnswer: (c) => c }
    case 'gap-gate':
      return card('Which word means:', String(p.back), String(p.front), (p.distractors ?? []).map(String))
    case 'oracle-trial':
      return card('Fill the gap:', String(p.prompt), String(p.answer), p.wrong ?? [])
    case 'curse-breaker': {
      const toks = String(p.text).split(' ')
      const marked = toks.map((t, i) => (i === p.bad ? `[${t}]` : t)).join(' ')
      return card('Break the curse on the word in brackets:', marked, p.fix === '' ? '(delete it)' : String(p.fix),
        (p.wrong ?? []).map((w: string) => (w === '' ? '(delete it)' : w)), (c) => ({ bad: p.bad, fix: c === '(delete it)' ? '' : c }))
    }
    case 'spell-weaver': {
      const ans: string[] = (p.answer ?? []).map(String)
      const wrong = (p.extra ?? []).map((e: string) => {
        let best = 0, at = 0
        ans.forEach((a, i) => { const s = overlap(a, e) + (a.split(' ').length === e.split(' ').length ? 0.5 : 0); if (s > best) { best = s; at = i } })
        return ans.map((a, i) => (i === at ? e : a)).join(' ')
      })
      return card(`${p.cmd}:`, String(p.source), ans.join(' '), wrong)
    }
    case 'rune-order': {
      const text = String(p.text)
      const shuffled = [...text.split(' ')].sort((a, b) => a.localeCompare(b)).join(' · ')
      return card('Put the runes in order:', shuffled, text, misorders(text, 3))
    }
    case 'rune-type':
      return card('Which spelling is right?', String(p.clue), String(p.word), misspell(String(p.word)))
    case 'potion-mix': {
      const base = String(p.parts?.[0] ?? '')
      return card('Brew the word that means:', String(p.clue), String(p.answer), (p.extra ?? []).map((e: string) => /^[a-z]/.test(e) && e.length <= 5 ? base + e : e + base))
    }
    case 'whisper-scroll': {
      const w = String(p.text).split(' '), gaps: number[] = p.gaps ?? []
      const right = gaps.map((g) => w[g]).join(' / ')
      const ex: string[] = p.extra ?? []
      const wrong = ex.map((e, i) => gaps.map((g, k) => (k === i % gaps.length ? e : w[g])).join(' / '))
      return card('Fill both gaps:', w.map((x, i) => (gaps.includes(i) ? '___' : x)).join(' '), right, wrong, (c) => c.split(' / '))
    }
    default:
      return null
  }
}

/**
 * Rounds for a stage: questions grouped by game, in the order the server sent them
 * (word round, grammar round, skill round). A boss stage asks everything it can as one
 * boss battle; items that cannot be a choice (dialogues, tales, letters, speaking) are
 * played first in their own games.
 */
export function planRounds(qs: ServerQuestion[], boss: boolean): { rounds: Round[]; answerMap: Map<string, (c: string) => unknown> } {
  const answerMap = new Map<string, (c: string) => unknown>()
  const rounds: Round[] = []
  const byGame = new Map<MiniGameId, ServerQuestion[]>()
  const bossItems: SrsItem[] = [], bossQs: ServerQuestion[] = []
  for (const q of qs) {
    if (boss) {
      const c = bossCard(q)
      if (c) { bossItems.push(c.item); bossQs.push(q); answerMap.set(q.qid, c.toAnswer); continue }
    }
    if (!byGame.has(q.game)) byGame.set(q.game, [])
    byGame.get(q.game)!.push(q)
  }
  for (const [game, list] of byGame) {
    rounds.push({ game, qs: list, items: SRS_GAMES.has(game) ? list.map(srsOf) : [] })
  }
  if (bossItems.length) rounds.push({ game: 'boss-battle', qs: bossQs, items: bossItems })
  return { rounds, answerMap }
}

/** collects answers: the FIRST answer to each item counts (retries inside a game teach, they do not score) */
export class AnswerSheet {
  private got = new Map<string, ServerAnswer>()
  private t0 = Date.now()
  private last = Date.now()
  private answerMap: Map<string, (c: string) => unknown>
  constructor(answerMap: Map<string, (c: string) => unknown> = new Map()) { this.answerMap = answerMap }
  record(qid: string, answer: unknown, correct: boolean) {
    if (this.got.has(qid)) return
    const now = Date.now()
    const conv = this.answerMap.get(qid)
    this.got.set(qid, { qid, answer: conv && typeof answer === 'string' ? conv(answer) : answer, correct, ms: Math.max(1, now - this.last) })
    this.last = now
  }
  has(qid: string) { return this.got.has(qid) }
  get answers(): ServerAnswer[] { return [...this.got.values()] }
  get correct() { return this.answers.filter((a) => a.correct).length }
  get elapsed() { return Date.now() - this.t0 }
}
