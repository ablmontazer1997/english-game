// The GameService on the real backend (runecast-api). The UI keeps talking to the same
// GameService seam; everything that changes a balance is computed on the server.
// Extra server-only calls (stage sessions, the Overnight Cauldron, streak, shop items,
// chest odds, equip) live on the class and are reached through the store (ServiceProvider).

import type { GameService } from './GameService'
import type {
  Currencies, PlayerProfile, World, Quest, League, SrsItem, MiniGameId, CurrencyId,
  Achievement, ChestKind, Reward, Inventory, Stage, LeagueTier,
} from '../types/game'
import { api, ApiError, errorText, type Wallet, type Me, type LevelMap, type MapWorld, type Streak, type LevelInfo, type ShopOut, type ChestInfo, type InventoryOut } from './api'
import { buildAchievements, newProgress } from './progress'

export const LEVEL_CODES = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

const toCurrencies = (w: Wallet): Currencies => ({
  hearts: w.hearts, heartsMax: w.heartsMax, heartsRefillAt: w.heartsRefillAt, potion: w.potion, coins: w.coins, gems: w.gems,
})

const toReward = (r: { coins?: number; gems?: number; potion?: number; elixir?: number; chest?: string | null } | null | undefined): Reward => {
  const out: Reward = {}
  if (!r) return out
  if (r.coins) out.coins = r.coins
  if (r.gems) out.gems = r.gems
  const p = r.potion ?? r.elixir
  if (p) out.potion = p
  if (r.chest) out.chest = r.chest as ChestKind
  return out
}

export function toWorlds(maps: LevelMap[]): World[] {
  const out: World[] = []
  for (const m of maps) {
    for (const w of m.worlds) out.push(toWorld(w, !m.unlocked))
  }
  return out.sort((a, b) => (a.globalIndex ?? 0) - (b.globalIndex ?? 0))
}

function toWorld(w: MapWorld, levelLocked: boolean): World {
  const paint = Math.max(0, (parseInt(w.paint_id.replace(/\D/g, ''), 10) || 1) - 1)
  const stages: Stage[] = w.stages.map((s) => ({
    id: s.id, index: s.index,
    kind: (s.client_kind as Stage['kind']) || 'practice',
    status: levelLocked ? 'locked' : s.status,
    stars: s.stars,
    miniGame: s.mini_game as MiniGameId,
    title: s.title,
    cefr: s.level,
    serverKind: s.kind,
    optional: !s.required,
    heartsApply: s.hearts_apply,
    topicId: s.topic_id,
    worldId: s.world_id,
    paint,
    questionCount: s.question_count,
  }))
  return {
    id: w.id, name: w.name, cefr: w.level, accent: w.accent, stages,
    paint, status: levelLocked ? 'locked' : w.status, topics: w.topics, consolidation: w.consolidation,
    bossDrop: w.boss_drop, globalIndex: w.global_index, levelLocked,
  }
}

export class HttpGameService implements GameService {
  private me: Me | null = null
  private leagueTier: LeagueTier = 'bronze'
  private maps = new Map<string, LevelMap>()
  levels: LevelInfo[] = []
  streakBest = 0
  // achievements are not on the server yet: shown from the server stats, claimed locally (no reward)
  private achClaimed = new Set<string>(JSON.parse(lsGet('es.ach.claimed') ?? '[]'))

  // ---------------------------------------------------------------- reads
  async getProfile(): Promise<PlayerProfile> {
    this.me = await api.me()
    return this.profileOf(this.me)
  }
  profileOf(me: Me): PlayerProfile {
    this.me = me
    return {
      id: me.id, name: me.display_name, level: me.player_level, xp: me.xp, xpToNext: me.xp_to_next,
      streak: me.streak, leagueTier: this.leagueTier,
      avatar: { base: 'wolf-hood', robeColor: 'amethyst', familiar: 'owl', staff: 'crystal', aura: 'none' },
    }
  }
  async getCurrencies(): Promise<Currencies> { return toCurrencies(await api.wallet()) }

  /** every level's map (locked levels too: the atlas shows them veiled) */
  async getWorlds(): Promise<World[]> {
    this.levels = await api.levels()
    const maps = await Promise.all(this.levels.map((l) => api.map(l.code)))
    maps.forEach((m) => this.maps.set(m.level, m))
    return toWorlds(LEVEL_CODES.map((c) => this.maps.get(c)).filter(Boolean) as LevelMap[])
  }
  /** reload one level (after a stage) and return all worlds */
  async refreshLevel(level: string): Promise<World[]> {
    this.maps.set(level, await api.map(level))
    return toWorlds(LEVEL_CODES.map((c) => this.maps.get(c)).filter(Boolean) as LevelMap[])
  }
  levelMap(level: string) { return this.maps.get(level) ?? null }

  async getQuests(): Promise<Quest[]> {
    const qs = await api.quests()
    return qs.map((q) => ({ id: q.id, title: q.title, progress: q.progress, target: q.target, reward: toReward(q.reward as any), period: q.period, done: q.done, bonus: q.bonus }))
  }
  async getLeague(): Promise<League> {
    const l = await api.league()
    this.leagueTier = l.tier
    return l
  }
  async getInventory(): Promise<Inventory> {
    const inv = await api.inventory()
    return this.inventoryOf(inv)
  }
  inventoryOf(inv: InventoryOut): Inventory {
    return { chests: { wood: inv.chests.wood ?? 0, silver: inv.chests.silver ?? 0, epic: inv.chests.epic ?? 0 }, freezes: inv.freezes, xpBoostUntil: inv.xpBoostUntil, dealBought: false }
  }
  async getAchievements(): Promise<Achievement[]> {
    // the families that the server stats can fill; the rest stay at 0 until the server tracks them
    const p = newProgress(this.leagueTier)
    const worlds = toWorlds([...this.maps.values()])
    const all = worlds.flatMap((w) => w.stages)
    const done = all.filter((s) => s.stars > 0)
    p.all.won = done.length; p.all.played = done.length
    p.all.stars = done.reduce((a, s) => a + s.stars, 0); p.all.stars3 = done.filter((s) => s.stars === 3).length
    p.all.bosses = done.filter((s) => s.kind === 'boss').length; p.all.perfectBoss = done.filter((s) => s.kind === 'boss' && s.stars === 3).length
    p.streakBest = this.streakBest || (this.me?.streak ?? 0)
    const ctx = { worldsDone: worlds.filter((w) => w.status === 'done').length, stagesDone: done.length, starsTotal: p.all.stars, level: this.me?.player_level ?? 1 }
    return buildAchievements(p, ctx).map((a) => ({ ...a, claimed: this.achClaimed.has(a.id) }))
  }

  async getStageItems(): Promise<SrsItem[]> { return [] }   // server stages start a session instead (StageScreen)
  async submitStageResult(): Promise<{ currencies: Currencies; profile: PlayerProfile }> {
    // results are graded by the server in /complete; this only re-reads the state
    const [w, me] = await Promise.all([api.wallet(), api.me()])
    return { currencies: toCurrencies(w), profile: this.profileOf(me) }
  }

  // ---------------------------------------------------------------- economy
  async spend(_c: CurrencyId, _amount: number): Promise<Currencies> {
    // there is no free-form spending on the server (hints are free while the server does not charge them)
    return this.getCurrencies()
  }
  async drinkElixir(): Promise<{ ok: boolean; currencies: Currencies }> {
    // the elixir is spent by /complete (use_elixir) on a lost boss/bonus; here we only check one is held
    const c = await this.getCurrencies()
    return { ok: c.potion > 0, currencies: c }
  }
  async refillHearts(): Promise<Currencies> {
    try { const r = await api.buy({ offer_id: 'hearts_full' }); return toCurrencies(r.wallet) } catch { return this.getCurrencies() }
  }
  async claimQuest(questId: string) {
    const r = await api.claimQuest(questId)
    const quests = r.quests.map((q) => ({ id: q.id, title: q.title, progress: q.progress, target: q.target, reward: toReward(q.reward as any), period: q.period, done: q.done, bonus: q.bonus }))
    return { quests, currencies: toCurrencies(r.wallet), reward: toReward(r.reward) }
  }
  async claimAchievement(id: string) {
    this.achClaimed.add(id); lsSet('es.ach.claimed', JSON.stringify([...this.achClaimed]))
    return { achievements: await this.getAchievements(), currencies: await this.getCurrencies(), reward: {} as Reward }
  }
  async openChest(kind: ChestKind) {
    try {
      const r = await api.openChest(kind)
      return { ok: true, reward: toReward(r.reward), currencies: toCurrencies(r.wallet) }
    } catch {
      return { ok: false, reward: {} as Reward, currencies: await this.getCurrencies() }
    }
  }
  async buy(offerId: string) {
    const id = offerId.replace(/^deal:/, '')
    try {
      const r = await api.buy({ offer_id: id })
      return { ok: true, currencies: toCurrencies(r.wallet) }
    } catch (e) {
      return { ok: false, reason: errorText(e), currencies: await this.getCurrencies().catch(() => ({} as Currencies)) }
    }
  }
  async buyItem(itemId: string): Promise<{ ok: boolean; reason?: string; currencies?: Currencies }> {
    try { const r = await api.buy({ item_id: itemId }); return { ok: true, currencies: toCurrencies(r.wallet) } } catch (e) { return { ok: false, reason: errorText(e) } }
  }
  async seenLeagueResult() { try { await api.leagueSeen() } catch (e) { if (!(e instanceof ApiError)) throw e } }
  async noteHint() { /* counted per session (hints_used) */ }

  // ---------------------------------------------------------------- server-only extras
  streak(): Promise<Streak> { return api.streak() }
  shop(): Promise<ShopOut> { return api.shop() }
  chests(): Promise<ChestInfo[]> { return api.chests() }
}

function lsGet(k: string) { try { return localStorage.getItem(k) } catch { return null } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export { toCurrencies, toReward }
