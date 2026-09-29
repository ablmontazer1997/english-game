// Content bank shapes for the ten new mini-games. Every bank is indexed by CEFR
// level: index 0..4 = A1, A2, B1, B2, C1. English only, no other language.
// Prototype banks; the real content will come from the content service.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type ByLevel<T> = [T[], T[], T[], T[], T[]]

// Echo Cave: hear a sentence, say it back
export interface EchoLine { text: string }

// Rune Type: read the clue (and hear the word), type it
export interface TypeWord { word: string; clue: string }

// Potion Mix: pour the right pieces in order to brew the word
export interface PotionRecipe {
  clue: string        // meaning of the word to brew, e.g. 'not happy'
  parts: string[]     // correct pieces in order, e.g. ['un', 'happy']
  answer: string      // final word, may change spelling, e.g. 'happiness'
  extra: string[]     // 2-4 wrong bottles
}

// Curse Breaker: find the one wrong word, then choose the fix
export interface CurseLine {
  text: string        // sentence with exactly one error, tokens split by spaces
  bad: number         // index of the wrong token
  fix: string         // correct replacement for that token (may be 2 words or '' to delete)
  wrong: string[]     // 2 wrong fixes
  why: string         // max 16 words, simple English
}

// Spell Weaver: transform the source sentence as the command says
export interface WeaveSpell {
  source: string
  cmd: string         // short command shown on the badge, e.g. 'MAKE IT PASSIVE'
  answer: string[]    // chunks of the target sentence in order
  extra: string[]     // 1-3 decoy chunks
}

// Portal Run: sort each word into the left or right portal
export interface PortalSet {
  left: string        // portal label, e.g. 'PAST'
  right: string       // e.g. 'PRESENT'
  words: [string, 0 | 1][] // word and its side (0 left, 1 right); 12-16 words
}

// Crystal Ball: listen to a dialogue, answer questions
export interface Vision {
  title: string
  a: { name: string; voice: 'f' | 'm' }
  b: { name: string; voice: 'f' | 'm' }
  lines: ['a' | 'b', string][]
  questions: { q: string; answer: string; wrong: string[] }[] // 2-3 questions, 2 wrong each
}

// Bard's Tale: put the lines of a short tale in order
export interface Tale { title: string; lines: string[] } // lines in the correct order

// Guild Letters: answer a letter in writing
export interface Letter {
  from: string
  body: string        // the letter the player receives
  task: string        // what to write, e.g. 'Recommend a place to eat and say why.'
  minWords: number
  keys: string[][]    // groups of words; each group needs at least one hit, e.g. [['because','so'],['should','could']]
  sample: string      // a model answer at this level
}

// Picture Quest: describe the scene; each target found lights up
export interface SceneTarget { word: string; alts: string[]; x: number; y: number } // x, y in % of the picture
export interface Scene { id: string; title: string; targets: SceneTarget[] }
