import type { GameService } from './GameService'
import type {
  Currencies, PlayerProfile, World, Quest, League, SrsItem,
  StageResult, MiniGameId, CurrencyId, Stage, StageKind,
} from '../types/game'

const HEART_REGEN_MS = 20 * 60 * 1000
const LS_KEY = 'runecast.save.v1'

interface SaveState {
  currencies: Currencies
  profile: PlayerProfile
  stars: Record<string, number>   // stageId -> stars
  unlockedUpTo: number            // linear unlock index across all stages
  claimed: string[]               // claimed quest ids
}

function defaultState(): SaveState {
  return {
    currencies: { hearts: 5, heartsMax: 5, heartsRefillAt: null, potion: 3, coins: 1250, gems: 40 },
    profile: {
      id: 'me', name: 'Apprentice', level: 12, xp: 320, xpToNext: 800, streak: 4,
      leagueTier: 'gold',
      avatar: { base: 'wolf-hood', robeColor: 'amethyst', familiar: 'owl', staff: 'crystal', aura: 'none' },
    },
    stars: { 'w1-s1': 3, 'w1-s2': 2, 'w1-s3': 1 }, unlockedUpTo: 3, claimed: [],
  }
}

function load(): SaveState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...defaultState(), ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return defaultState()
}
function save(s: SaveState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))

// --- static content (stands in for backend content packs) -----------------
const WORLD_DEFS: { id: string; name: string; cefr: string; accent: string; count: number }[] = [
  { id: 'w1', name: 'Whispering Forest', cefr: 'A1', accent: 'emerald', count: 8 },
  { id: 'w2', name: 'Crystal Caverns', cefr: 'A2', accent: 'amethyst', count: 8 },
  { id: 'w3', name: 'Sky Ruins', cefr: 'B1', accent: 'cyan', count: 8 },
]
const GAME_CYCLE: MiniGameId[] = ['bubble-pop', 'match-blitz', 'memory-crystals', 'gap-gate', 'boss-battle']
const KIND_FOR = (i: number, last: boolean): StageKind =>
  last ? 'boss' : i % 5 === 4 ? 'treasure' : i % 3 === 2 ? 'review' : i % 2 === 0 ? 'lesson' : 'practice'

let _idx = 0
function buildWorlds(s: SaveState): World[] {
  _idx = 0
  return WORLD_DEFS.map((w) => {
    const stages: Stage[] = Array.from({ length: w.count }, (_, k) => {
      const globalIdx = _idx++
      const last = k === w.count - 1
      const status = globalIdx < s.unlockedUpTo ? 'done' : globalIdx === s.unlockedUpTo ? 'current' : 'locked'
      return {
        id: `${w.id}-s${k + 1}`,
        index: k + 1,
        kind: KIND_FOR(k, last),
        status,
        stars: s.stars[`${w.id}-s${k + 1}`] ?? 0,
        miniGame: last ? 'boss-battle' : GAME_CYCLE[k % GAME_CYCLE.length],
        title: last ? 'Boss Fight' : `Stage ${k + 1}`,
      }
    })
    return { id: w.id, name: w.name, cefr: w.cefr, accent: w.accent, stages }
  })
}

// --- mock SRS items (English-to-English: word -> short English meaning) ------
const WORDS: [string, string, string[]][] = [
  ['ancient', 'very old', ['brand new', 'very loud', 'quite small']],
  ['portal', 'a magic doorway', ['a small garden', 'a broken promise', 'a deep pocket']],
  ['whisper', 'to speak very softly', ['to shout loudly', 'to run away', 'to fall down']],
  ['crystal', 'a clear shining stone', ['a wooden log', 'a soft cloud', 'a warm ember']],
  ['journey', 'a long trip', ['a tiny stone', 'a closed window', 'a short letter']],
  ['guardian', 'a protector', ['a stranger', 'a farmer', 'a poet']],
  ['spell', 'a magic charm', ['a cooking recipe', 'a bus ticket', 'a tall ladder']],
  ['moonlit', 'lit by the moon', ['full of sun', 'covered in dust', 'lost in fog']],
]

// --------------------------------------------------------------------------
export class MockGameService implements GameService {
  private s = load()

  private syncHearts() {
    const c = this.s.currencies
    if (c.hearts >= c.heartsMax) { c.heartsRefillAt = null; return }
    const now = Date.now()
    if (c.heartsRefillAt == null) c.heartsRefillAt = now + HEART_REGEN_MS
    while (c.hearts < c.heartsMax && c.heartsRefillAt != null && now >= c.heartsRefillAt) {
      c.hearts += 1
      c.heartsRefillAt = c.hearts < c.heartsMax ? c.heartsRefillAt + HEART_REGEN_MS : null
    }
    save(this.s)
  }

  async getProfile() { return delay({ ...this.s.profile }) }
  async getCurrencies() { this.syncHearts(); return delay({ ...this.s.currencies }) }
  async getWorlds() { return delay(buildWorlds(this.s)) }

  async getQuests() {
    const quests: Quest[] = [
      { id: 'd1', title: 'Reach the next stage', progress: 1, target: 1, reward: { chest: 'rare' }, period: 'daily', done: this.s.claimed.includes('d1') },
      { id: 'd2', title: 'Earn 3 stars in one stage', progress: 0, target: 1, reward: { coins: 150 }, period: 'daily', done: this.s.claimed.includes('d2') },
      { id: 'd3', title: 'Answer 20 correctly', progress: 8, target: 20, reward: { potion: 1 }, period: 'daily', done: this.s.claimed.includes('d3') },
      { id: 'w1q', title: 'Complete 5 stages', progress: 3, target: 5, reward: { gems: 20 }, period: 'weekly', done: this.s.claimed.includes('w1q') },
    ]
    return delay(quests)
  }

  async getLeague() {
    const names = ['Aria', 'Sam', 'Kai', 'Mia', 'Leo', 'Nia', 'Max', 'Zoe', 'Ivy']
    const entries = names.map((n, i) => ({ playerId: `p${i}`, name: n, lp: 900 - i * 70 + (i % 2 ? 15 : 0), isMe: false }))
    entries.splice(3, 0, { playerId: 'me', name: this.s.profile.name, lp: 690, isMe: true })
    entries.sort((a, b) => b.lp - a.lp)
    const league: League = { tier: this.s.profile.leagueTier, endsAt: Date.now() + 3 * 864e5, entries, promoteCount: 3, demoteCount: 3 }
    return delay(league)
  }

  async getStageItems(_stageId: string, _mini: MiniGameId): Promise<SrsItem[]> {
    const items = WORDS.map(([front, back, distractors], i) => ({
      id: `it${i}`, front, back, distractors, mastery: (i % 5),
    }))
    // rotate a bit so different stages feel different
    return delay(items.slice(0, 6))
  }

  async submitStageResult(res: StageResult) {
    const c = this.s.currencies
    if (res.heartsLost > 0) { c.hearts = Math.max(0, c.hearts - res.heartsLost); this.syncHearts() }
    c.coins += res.coinsGained
    const p = this.s.profile
    p.xp += res.xpGained
    while (p.xp >= p.xpToNext) { p.xp -= p.xpToNext; p.level += 1; p.xpToNext = Math.round(p.xpToNext * 1.15); c.gems += 5 }
    const prev = this.s.stars[res.stageId] ?? 0
    if (res.stars > prev) this.s.stars[res.stageId] = res.stars
    // unlock next stage if passed
    if (res.stars > 0) this.s.unlockedUpTo = Math.max(this.s.unlockedUpTo, indexOfStage(res.stageId) + 1)
    save(this.s)
    return delay({ currencies: { ...c }, profile: { ...p } })
  }

  async spend(currency: CurrencyId, amount: number) {
    const c = this.s.currencies
    c[currency] = Math.max(0, c[currency] - amount)
    save(this.s); return delay({ ...c })
  }

  async refillHearts() {
    const c = this.s.currencies
    if (c.potion > 0) c.potion -= 1
    c.hearts = c.heartsMax; c.heartsRefillAt = null
    save(this.s); return delay({ ...c })
  }

  async claimQuest(questId: string) {
    if (!this.s.claimed.includes(questId)) this.s.claimed.push(questId)
    save(this.s)
    const quests = await this.getQuests()
    return { quests, currencies: { ...this.s.currencies } }
  }
}

// helper: linear index of a stage id across all worlds
function indexOfStage(stageId: string): number {
  let idx = 0
  for (const w of WORLD_DEFS) {
    for (let k = 0; k < w.count; k++) {
      if (`${w.id}-s${k + 1}` === stageId) return idx
      idx++
    }
  }
  return idx
}
