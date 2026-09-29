import type { GameService } from './GameService'
import type {
  Currencies, PlayerProfile, World, League, SrsItem,
  StageResult, MiniGameId, CurrencyId, Stage, StageKind, Reward, ChestKind, Inventory,
} from '../types/game'
import {
  type Progress, newProgress, rollPeriods, recordStage, recordHint, recordElixir, recordEarn, recordBuy, liveStreak,
  buildQuests, buildAchievements, rollChest, leagueTable, weekEnd, dayKey, TIERS, PROMOTE, DEMOTE, XP_BOOST_MS,
} from './progress'
import { findOffer } from './shopCatalog'

const HEART_REGEN_MS = 20 * 60 * 1000
const LS_KEY = 'runecast.save.v1'

interface SaveState {
  currencies: Currencies
  profile: PlayerProfile
  stars: Record<string, number>   // stageId -> stars
  unlockedUpTo: number            // linear unlock index across all stages
  claimed: string[]               // (v1) claimed quest ids, unused now
  prog: Progress                  // stats, quests, achievements, chests, boosts, league
  dealDay?: string                // day the deal of the day was bought
  layout?: number                 // 2 = stage counts from the stage map (tall scrolling worlds)
}

function defaultState(): SaveState {
  return {
    currencies: { hearts: 5, heartsMax: 5, heartsRefillAt: null, potion: 3, coins: 1250, gems: 40 },
    profile: {
      id: 'me', name: 'Apprentice', level: 12, xp: 320, xpToNext: 800, streak: 4,
      leagueTier: 'gold',
      avatar: { base: 'wolf-hood', robeColor: 'amethyst', familiar: 'owl', staff: 'crystal', aura: 'none' },
    },
    stars: { 'w1-s1': 3, 'w1-s2': 2, 'w1-s3': 1 }, unlockedUpTo: 3, claimed: [], layout: 2,
    prog: newProgress('bronze'),
  }
}

function load(): SaveState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SaveState>
      const s = { ...defaultState(), ...saved, layout: saved.layout } as SaveState
      // saves from before progress tracking: start the tallies now, keep the old tier
      if (!s.prog || !s.prog.all) s.prog = newProgress(s.profile.leagueTier ?? 'bronze')
      // saves from the one-screen maps (8 stages a world): keep the player on the same world
      // and stage now that each world is longer
      if (!s.layout) {
        const w = Math.floor(s.unlockedUpTo / 8), k = s.unlockedUpTo % 8
        const before = STAGE_COUNT.slice(0, w).reduce((a, n) => a + n, 0)
        s.unlockedUpTo = w < STAGE_COUNT.length ? before + k : before
        s.layout = 2
      }
      return s
    }
  } catch { /* ignore */ }
  return defaultState()
}
function save(s: SaveState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

const delay = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))

// --- static content (stands in for backend content packs) -----------------
// eleven worlds A1..C1, each with its own painted scene (screens/worlds.ts, same
// order) and its own mix of games (seven stages + a boss)
const G1: MiniGameId[] = ['rune-type', 'echo', 'potion-mix', 'bards-tale', 'crystal-ball', 'curse-breaker', 'match-blitz']
const G2: MiniGameId[] = ['curse-breaker', 'spell-weaver', 'guild-letters', 'match-blitz', 'gap-gate', 'rune-order', 'whisper-scroll']
const G3: MiniGameId[] = ['tavern-talk', 'memory-crystals', 'crystal-ball', 'bubble-pop', 'spell-weaver', 'echo', 'curse-breaker']
const G4: MiniGameId[] = ['potion-mix', 'guild-letters', 'echo', 'bards-tale', 'crystal-ball', 'rune-type', 'tavern-talk']
const G5: MiniGameId[] = ['spell-weaver', 'curse-breaker', 'crystal-ball', 'guild-letters', 'potion-mix', 'bards-tale', 'echo']
const WORLDS: { id: string; name: string; cefr: string; accent: string; games: MiniGameId[] }[] = [
  { id: 'w1', name: 'Whispering Forest', cefr: 'A1', accent: 'emerald', games: G1 },
  { id: 'w2', name: 'Amethyst Grotto', cefr: 'A1', accent: 'amethyst', games: G2 },
  { id: 'w3', name: 'Floating Library', cefr: 'A2', accent: 'amethyst', games: G3 },
  { id: 'w4', name: 'Alchemist\'s Garden', cefr: 'A2', accent: 'emerald', games: G4 },
  { id: 'w5', name: 'Fairy Glade', cefr: 'B1', accent: 'emerald', games: G5 },
  { id: 'w6', name: 'Moon Temple', cefr: 'B1', accent: 'cyan', games: G1 },
  { id: 'w7', name: 'Frostspire Peaks', cefr: 'B1', accent: 'cyan', games: G2 },
  { id: 'w8', name: 'Dragon\'s Roost', cefr: 'B2', accent: 'amethyst', games: G3 },
  { id: 'w9', name: 'Rune Ruins', cefr: 'B2', accent: 'cyan', games: G4 },
  { id: 'w10', name: 'Wizard Academy', cefr: 'C1', accent: 'emerald', games: G5 },
  { id: 'w11', name: 'Celestial Observatory', cefr: 'C1', accent: 'amethyst', games: G1 },
]
// stages per world from the stage map (runecast_qdb/stagemap: lessons + reviews + a boss); the world's
// games repeat along its road
const STAGE_COUNT = [15, 14, 17, 15, 17, 17, 15, 15, 10, 10, 13]
const WORLD_DEFS = WORLDS.map((w, i) => ({ ...w, count: STAGE_COUNT[i] ?? w.games.length + 1 }))
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
        miniGame: last ? 'boss-battle' : w.games[k % w.games.length],
        cefr: w.cefr,
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

  async getProfile() {
    rollPeriods(this.s.prog)
    return delay({ ...this.s.profile, streak: liveStreak(this.s.prog), leagueTier: this.s.prog.league.tier })
  }

  /** add a reward to the wallet (chests go to the inventory, unopened) */
  private grant(r: Reward) {
    const c = this.s.currencies
    c.coins += r.coins ?? 0; c.gems += r.gems ?? 0; c.potion += r.potion ?? 0
    if (r.chest) this.s.prog.chests[r.chest]++
    recordEarn(this.s.prog, r.coins ?? 0, r.gems ?? 0)
  }
  private ctx() {
    const worlds = buildWorlds(this.s)
    const stagesDone = Object.values(this.s.stars).filter((n) => n > 0).length
    const worldsDone = worlds.filter((w) => w.stages[w.stages.length - 1].stars > 0).length
    const starsTotal = Object.values(this.s.stars).reduce((a, b) => a + b, 0)
    return { stagesDone, worldsDone, starsTotal, level: this.s.profile.level }
  }
  async getCurrencies() { this.syncHearts(); return delay({ ...this.s.currencies }) }
  async getWorlds() { return delay(buildWorlds(this.s)) }

  async getQuests() { const q = buildQuests(this.s.prog); save(this.s); return delay(q) }

  async getLeague() {
    const p = this.s.prog
    rollPeriods(p)
    const ti = TIERS.indexOf(p.league.tier)
    const league: League = {
      tier: p.league.tier, endsAt: weekEnd(), entries: leagueTable(p, this.s.profile.name),
      promoteCount: ti < TIERS.length - 1 ? PROMOTE : 0, demoteCount: ti > 0 ? DEMOTE : 0,
      ...(p.league.last ? { last: p.league.last } : {}),
    }
    save(this.s)
    return delay(league)
  }
  async seenLeagueResult() {
    const last = this.s.prog.league.last
    if (last) { this.grant(last.reward); delete this.s.prog.league.last; save(this.s) }
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
    const gemsBefore = c.gems
    if (res.heartsLost > 0) { c.hearts = Math.max(0, c.hearts - res.heartsLost); this.syncHearts() }
    c.coins += res.coinsGained
    c.gems += res.gemsGained ?? 0
    const p = this.s.profile
    p.xp += res.xpGained
    while (p.xp >= p.xpToNext) { p.xp -= p.xpToNext; p.level += 1; p.xpToNext = Math.round(p.xpToNext * 1.15); c.gems += 5 }
    const prev = this.s.stars[res.stageId] ?? 0
    if (res.stars > prev) this.s.stars[res.stageId] = res.stars
    // unlock next stage if passed
    if (res.stars > 0) this.s.unlockedUpTo = Math.max(this.s.unlockedUpTo, indexOfStage(res.stageId) + 1)
    recordStage(this.s.prog, { miniGame: res.miniGame ?? 'spell-weaver', stars: res.stars, correct: res.correct, total: res.total,
      xp: res.xpGained, coins: res.coinsGained, boss: !!res.boss })
    recordEarn(this.s.prog, 0, c.gems - gemsBefore)
    save(this.s)
    return delay({ currencies: { ...c }, profile: { ...p } })
  }

  async spend(currency: CurrencyId, amount: number) {
    const c = this.s.currencies
    c[currency] = Math.max(0, c[currency] - amount)
    save(this.s); return delay({ ...c })
  }

  /** spend one elixir (potion); false when there is none */
  async drinkElixir() {
    const c = this.s.currencies
    if (c.potion <= 0) return { ok: false, currencies: { ...c } }
    c.potion -= 1
    recordElixir(this.s.prog)
    save(this.s); return delay({ ok: true, currencies: { ...c } })
  }

  async refillHearts() {
    const c = this.s.currencies
    if (c.potion > 0) c.potion -= 1
    c.hearts = c.heartsMax; c.heartsRefillAt = null
    save(this.s); return delay({ ...c })
  }

  async claimQuest(questId: string) {
    const p = this.s.prog
    const q = buildQuests(p).find((x) => x.id === questId)
    let reward: Reward = {}
    if (q && !q.done && q.progress >= q.target) {
      p.claimedQuests.push(questId); reward = q.reward; this.grant(reward)
      rollPeriods(p); p.all.quests++; p.day.quests++; p.week.quests++
      // all of today's dailies claimed -> one more day toward the weekly chest
      const dailies = buildQuests(p).filter((x) => x.period === 'daily' && !x.bonus)
      if (q.period === 'daily' && !q.bonus && dailies.every((x) => x.done)) p.week.dailyDone++
      // keep the claimed list short: only this week's ids matter
      p.claimedQuests = p.claimedQuests.filter((id) => id.includes(p.day.key) || id.includes(p.week.key))
      save(this.s)
    }
    return delay({ quests: buildQuests(p), currencies: { ...this.s.currencies }, reward })
  }

  async getInventory(): Promise<Inventory> {
    const p = this.s.prog
    return delay({ chests: { ...p.chests }, freezes: p.freezes, xpBoostUntil: p.xpBoostUntil, dealBought: this.s.dealDay === dayKey() })
  }
  async getAchievements() { return delay(buildAchievements(this.s.prog, this.ctx())) }
  async claimAchievement(id: string) {
    const a = buildAchievements(this.s.prog, this.ctx()).find((x) => x.id === id)
    let reward: Reward = {}
    if (a && !a.claimed && a.progress >= a.target) { this.s.prog.claimedAch.push(id); reward = a.reward; this.grant(reward); save(this.s) }
    return delay({ achievements: buildAchievements(this.s.prog, this.ctx()), currencies: { ...this.s.currencies }, reward })
  }
  async openChest(kind: ChestKind) {
    const p = this.s.prog
    if (p.chests[kind] <= 0) return { ok: false, reward: {}, currencies: { ...this.s.currencies } }
    p.chests[kind]--
    const reward = rollChest(kind)
    this.grant(reward); rollPeriods(p); p.all.chests++; p.day.chests++; p.week.chests++
    save(this.s)
    return delay({ ok: true, reward, currencies: { ...this.s.currencies } }, 250)
  }
  async buy(offerId: string) {
    const o = findOffer(offerId), c = this.s.currencies, p = this.s.prog
    const fail = (reason: string) => ({ ok: false, reason, currencies: { ...c } })
    if (!o) return fail('Unknown item')
    if (offerId.startsWith('deal:') && this.s.dealDay === dayKey()) return fail('Already bought today')
    const item = offerId.replace(/^deal:/, '')
    if (item === 'hearts_full' && c.hearts >= c.heartsMax) return fail('Your hearts are already full')
    if (item === 'freeze' && p.freezes >= 2) return fail('You already hold 2 freezes')
    if ((o.price.gems ?? 0) > c.gems) return fail('Not enough gems')
    if ((o.price.coins ?? 0) > c.coins) return fail('Not enough coins')
    c.gems -= o.price.gems ?? 0; c.coins -= o.price.coins ?? 0
    switch (item) {
      case 'hearts_full': c.hearts = c.heartsMax; c.heartsRefillAt = null; break
      case 'elixir_1': c.potion += 1; break
      case 'elixir_3': c.potion += 3; break
      case 'xp_boost': p.xpBoostUntil = Math.max(Date.now(), p.xpBoostUntil) + XP_BOOST_MS; break
      case 'freeze': p.freezes += 1; break
      case 'coin_sack': c.coins += 1000; break
      case 'coin_big': c.coins += 2500; break
      case 'chest_wood': p.chests.wood++; break
      case 'chest_silver': p.chests.silver++; break
      case 'chest_epic': p.chests.epic++; break
    }
    if (offerId.startsWith('deal:')) this.s.dealDay = dayKey()
    recordBuy(p)
    save(this.s)
    return delay({ ok: true, currencies: { ...c } })
  }
  async noteHint() { recordHint(this.s.prog); save(this.s) }
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
