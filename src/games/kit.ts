// Small shared toolkit for the mini-games: shuffling, the player's CEFR level,
// browser speech synthesis (free, offline) and browser speech recognition.

import { duck, sfx } from '../services/audio'

export function shuffle<T>(a: readonly T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]] }
  return b
}

/** n random picks from a pool, never the same one twice */
export function pick<T>(pool: readonly T[], n: number): T[] { return shuffle(pool).slice(0, n) }

/** level index 0..4 (A1..C1); `?lv=2` in the URL overrides it for previews */
export function levelOf(level?: number): number {
  try {
    const q = new URLSearchParams(window.location.search).get('lv')
    if (q != null && /^[0-4]$/.test(q)) return +q
  } catch { /* no window */ }
  return Math.max(0, Math.min(4, level ?? 0))
}

export const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

type SpeakOpts = { rate?: number; pitch?: number; voice?: 'f' | 'm'; onState?: (on: boolean) => void; onEnd?: () => void }

function voiceFor(kind?: 'f' | 'm'): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis?.getVoices() ?? []
  const en = vs.filter((x) => /^en[-_]/i.test(x.lang))
  const f = /female|samantha|zira|victoria|karen|moira|tessa|google us english|google uk english female/i
  const m = /male|daniel|alex|fred|david|mark|google uk english male/i
  if (kind === 'm') return en.find((x) => m.test(x.name) && !/female/i.test(x.name)) ?? en[1] ?? en[0]
  if (kind === 'f') return en.find((x) => f.test(x.name)) ?? en[0]
  return en.find((x) => /en[-_]US/i.test(x.lang)) ?? en[0]
}

export function speak(text: string, o: SpeakOpts = {}) {
  try {
    const s = window.speechSynthesis
    if (!s) { o.onState?.(false); o.onEnd?.(); return }
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'; u.rate = o.rate ?? 0.95
    // with only one voice installed, pitch keeps two speakers apart
    u.pitch = o.pitch ?? (o.voice === 'm' ? 0.8 : o.voice === 'f' ? 1.2 : 1)
    const v = voiceFor(o.voice); if (v) u.voice = v
    u.onstart = () => { duck(true); o.onState?.(true) }
    u.onend = () => { duck(false); o.onState?.(false); o.onEnd?.() }
    u.onerror = () => { duck(false); o.onState?.(false); o.onEnd?.() }
    s.speak(u)
  } catch { o.onState?.(false); o.onEnd?.() }
}
export function hush() { try { window.speechSynthesis?.cancel() } catch { /* no speech */ } }

export const canListen = () => !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

/** one utterance of speech recognition; resolves with the alternatives heard ([] on silence/error) */
export function listen(onState?: (on: boolean) => void): Promise<string[]> {
  return new Promise((resolve) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { resolve([]); return }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 4
    let out: string[] = []
    r.onresult = (e: any) => { out = Array.from(e.results[0]).map((x: any) => x.transcript as string) }
    r.onerror = () => { /* resolved on end */ }
    r.onend = () => { onState?.(false); resolve(out) }
    onState?.(true)
    try { r.start() } catch { onState?.(false); resolve([]) }
  })
}

/** combo counter shared by every game; it also plays the reaction sounds */
export function makeScore() {
  const s = { right: 0, now: 0, max: 0 }
  return {
    hit() { s.right++; s.now++; s.max = Math.max(s.max, s.now); sfx(s.now >= 3 && s.now % 3 === 0 ? 'combo' : 'correct') },
    miss() { s.now = 0; sfx('wrong') },
    out(total: number) { return { correct: s.right, total, maxCombo: s.max } },
  }
}
