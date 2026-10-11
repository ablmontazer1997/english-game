// English Spell API client (runecast-api, contract: runecast/v2/API.md + openapi.json).
// Same origin: the app is served from bingual.app/<dir>/ and the API from bingual.app/runecast-api.
// Guest auth with a stable device id; the JWT is kept in localStorage and renewed on a 401.
// Errors come back as ApiError { status, code, message } (API.md "Errors"); network failures and
// 5xx are retried with backoff for safe calls only (GET, and the session calls the server guards itself).

import type { Currencies, League, Quest, ServerQuestion, ServerAnswer } from '../types/game'

export const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || '/runecast-api'
const LS_TOKEN = 'es.api.token'
const LS_DEVICE = 'es.api.device'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code
  }
  /** no answer at all (offline, DNS, CORS, timeout) */
  get offline() { return this.status === 0 }
}

// ------------------------------------------------------------------ shapes (API.md)
export interface Me {
  id: string; display_name: string; kind: string; level: string; timezone: string
  player_level: number; xp: number; xp_to_next: number; xp_total: number; streak: number
  xp_boost_until: number; league_opt_in: boolean; created_at: string
  /** false = a new player who has not finished the first-run intro */
  onboarded?: boolean; daily_goal?: number | null; flags?: MeFlags
}
export interface MeFlags { tour?: 'pending' | 'done'; intro_step?: number; look?: 'boy' | 'girl' | 'custom'; placement?: string; guided?: 'pending' | 'done' }
export interface ServerAchievement { id: string; cat: string; title: string; desc: string; tier: number; progress: number; target: number; reward: { gems?: number }; claimed: boolean }
export type Wallet = Currencies & { elixir: number }
export interface LevelInfo { code: string; ordinal: number; title: string; world_count: number; unlocked: boolean; current: boolean }
export interface MapStage {
  id: string; world_id: string; level: string; index: number; kind: string; client_kind: string; variant: string | null
  required: boolean; topic_id: string | null; mini_game: string; title: string; hearts_apply: boolean
  question_count: number; review_ratio: number; status: 'locked' | 'current' | 'done'; stars: number
}
export interface MapWorld {
  id: string; level: string; index: number; global_index: number; name: string; paint_id: string; paint_name: string
  accent: string; variant: { tint: string; weather: string; time: string }
  topics: { id: string; slot: number; title: string; kind: string }[]; consolidation: boolean
  boss_drop: { item_id: string; name: string; slot: string; owned: boolean } | null
  status: 'locked' | 'current' | 'done'; stages: MapStage[]
}
export interface LevelMap {
  level: string; unlocked: boolean
  progress: { stages_done: number; stars: number; required_total: number; current_stage_id: string | null }
  worlds: MapWorld[]
}
export interface Topic {
  id: string; level: string; title: string; summary?: string; explanation?: string; rules?: any; examples?: any
  when_to_use?: any; common_mistakes?: any; kind?: string; covers?: string[]
}
export interface HintsState { free_left: number; free_per_day: number; cost_coins: number; used_today: number }
export interface ContinueOffer { questions: number; cost_gems: number; cost_elixir: number; left: number }
export interface StartOut { session_id: string; stage: MapStage; expires_at: string; review_ratio: number; questions: ServerQuestion[]; hearts: number; hints?: HintsState | null; continue?: ContinueOffer | null }
export interface Streak {
  current: number; best: number; today_done: boolean; today_progress: { stages_won: number; review_correct: number }
  rule: string; freezes: number; freezes_max: number; last_active_day: string | null
  /** Phase B: a Hearthfire that went out within 2 missed days can be relit for gems */
  repair?: { lost: number; cost_gems: number; restores: number } | null
}
export interface RewardOut { xp: number; xp_base?: number; boosted?: boolean; coins: number; gems: number; items: { item_id: string; name: string; slot?: string; why?: string }[]; chest: string | null }
export interface CompleteOut {
  stars: number; best_stars: number; first_clear: boolean; correct: number; total: number; accuracy: number; unverified?: number
  rewards: RewardOut; hearts_lost: number; elixir_used: boolean; level_up: boolean; level_completed: boolean
  unlocked: string[]; srs_updated: number; league_points: number; graded: { qid: string; correct: boolean }[]
  wallet: Wallet; me: Me; streak: Streak
}
export interface ReviewToday { due_count: number; new_tomorrow: number; items: ServerQuestion[] }
export interface ReviewOut { graded: number; correct: number; hearts_gained: number; srs: { qid: string; box: number; due_at: string }[]; wallet: Wallet; streak: Streak }
export interface ChestOdds { reward: string; min?: number; max?: number; amount?: number; chance: number }
export interface ShopItem { id: string; name: string; slot: string; tier: string; rarity: string | null; price_gems: number | null; theme?: string; owned: boolean }
export interface ShopOffer { id: string; title: string; note?: string; price: { gems?: number; coins?: number }; kind: string; odds?: ChestOdds[] }
export interface ShopOut { items: WardrobeItem[]; offers: ShopOffer[]; merchant?: Merchant; premium?: WardrobeItem[]; gem_packs: { sku: string; gems: number; price_units: number; enabled: boolean }[] }
/** Phase B: one wardrobe catalogue for the 3D wardrobe, the shop and the merchant */
export type Tier = 'free' | 'boss' | 'earned' | 'coin' | 'gem' | 'premium'
export interface WardrobeItem {
  id: string; name: string; slot: string; tier: Tier; rarity: string | null; price_gems: number | null; price_coins: number | null
  theme?: string; owned: boolean; is_default?: boolean; how: string; buyable: boolean; limited: boolean; in_merchant: boolean
  recolour?: { base: string; swatch: string }; world?: { id: string; level: string; index: number; global_index: number }
}
export interface Look {
  body: 'boy' | 'girl'; tone: number; blush: number; hair: string; haircolor: string; eyes: string
  hat: string | null; top: string | null; coat: string | null; pants: string | null; shoes: string | null; tint: Record<string, string>
}
export interface Merchant {
  ends_at: number; items: WardrobeItem[]
  set: { id: string; name: string; price_gems: number; full_gems: number; owned_all: boolean; items: WardrobeItem[] }
}
export interface WardrobeOut {
  items: WardrobeItem[]; look: Look | null; look_saved: boolean; legacy: boolean; dyes: string[]
  dye: { price_coins: number; swatches: string[] }; merchant: Merchant; default_look: Look
}
export interface ChestInfo { kind: 'wood' | 'silver' | 'epic'; title?: string; owned: number; price: { gems?: number; coins?: number }; odds: ChestOdds[] }
export interface InventoryOut {
  items: { item_id: string; slot: string; source: string; acquired_at: string }[]
  equipped: Record<string, string | null>; look?: Look; chests: { wood: number; silver: number; epic: number }; freezes: number; xpBoostUntil: number
}
export interface ServerQuest extends Quest { claimable?: boolean }
export type ServerLeague = League & { scoring?: string; week_start?: string; my_points?: number; entries: (League['entries'][number] & { bot?: boolean })[] }
export interface LedgerRow { id: number; currency: string; delta: number; balance_after: number; reason: string; ref: string | null; created_at: string }
export interface CatalogItem { id: string; name: string; slot: string; tier: string; rarity: string | null; price_gems: number | null; world_drop: number | null; theme?: string; is_default?: boolean; base_mesh?: string | null }

// ------------------------------------------------------------------ transport
const ls = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* private mode */ } },
}

function deviceId(): string {
  let d = ls.get(LS_DEVICE)
  if (!d) {
    const r = (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    d = 'web-' + r
    ls.set(LS_DEVICE, d)
  }
  return d
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let authing: Promise<string> | null = null

async function guestLogin(): Promise<string> {
  if (!authing) {
    authing = (async () => {
      let tz: string | undefined
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* default on the server */ }
      const out = await raw<{ token: string }>('POST', '/v1/auth/guest', { device_id: deviceId(), display_name: 'Apprentice', ...(tz ? { timezone: tz } : {}) }, null, 3)
      ls.set(LS_TOKEN, out.token)
      return out.token
    })().finally(() => { authing = null })
  }
  return authing
}

async function raw<T>(method: string, path: string, body: unknown, token: string | null, tries: number): Promise<T> {
  let last: ApiError = new ApiError(0, 'offline', 'The realm cannot be reached')
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(400 * 2 ** (i - 1))   // 400, 800, 1600 ms
    let res: Response
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000)
      res = await fetch(API_BASE + path, {
        method, signal: ctl.signal,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }).finally(() => clearTimeout(t))
    } catch {
      last = new ApiError(0, 'offline', 'The realm cannot be reached. Check your connection.')
      continue
    }
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T
    let code = 'http_' + res.status, message = res.statusText || 'Request failed'
    try {
      const j = await res.json()
      if (j?.detail && typeof j.detail === 'object' && !Array.isArray(j.detail)) { code = j.detail.code ?? code; message = j.detail.message ?? message }
      else if (Array.isArray(j?.detail)) { code = 'validation'; message = j.detail.map((d: any) => d.msg).join('; ') }
    } catch { /* not json */ }
    last = new ApiError(res.status, code, message)
    if (res.status < 500 && res.status !== 429) throw last   // the server said no: retrying will not help
  }
  throw last
}

/** an authorised call; a 401 renews the guest token once and repeats the call */
async function call<T>(method: string, path: string, body?: unknown, opts: { retry?: boolean } = {}): Promise<T> {
  const tries = (opts.retry ?? method === 'GET') ? 3 : 1
  let token = ls.get(LS_TOKEN) || await guestLogin()
  try {
    return await raw<T>(method, path, body, token, tries)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      ls.del(LS_TOKEN); token = await guestLogin()
      return raw<T>(method, path, body, token, tries)
    }
    throw e
  }
}

// ------------------------------------------------------------------ endpoints
export const api = {
  health: () => raw<{ ok: boolean; db: boolean; version: string }>('GET', '/health', undefined, null, 2),
  login: guestLogin,
  me: () => call<Me>('GET', '/v1/me'),
  patchMe: (b: Partial<Pick<Me, 'display_name' | 'timezone' | 'league_opt_in' | 'level' | 'daily_goal'>> & { onboarded?: boolean; flags?: MeFlags }) => call<Me>('PATCH', '/v1/me', b),
  achievements: () => call<ServerAchievement[]>('GET', '/v1/achievements'),
  claimAchievement: (id: string) => call<{ reward: { gems?: number }; wallet: Wallet; achievements: ServerAchievement[] }>('POST', `/v1/achievements/${encodeURIComponent(id)}/claim`),
  placementItems: (perLevel = 6) => call<ServerQuestion[]>('GET', `/v1/placement/items?per_level=${perLevel}`),
  levels: () => call<LevelInfo[]>('GET', '/v1/levels'),
  map: (level: string) => call<LevelMap>('GET', `/v1/map/${encodeURIComponent(level)}`),
  topic: (id: string) => call<Topic>('GET', `/v1/topics/${encodeURIComponent(id)}`),
  // a stage start only opens a session (nothing is spent), so it is safe to retry
  start: (stageId: string) => call<StartOut>('POST', `/v1/stages/${encodeURIComponent(stageId)}/start`, undefined, { retry: true }),
  // a session completes once (409 already_completed on a repeat), so a retry can never pay twice
  complete: (sessionId: string, answers: ServerAnswer[], hintsUsed = 0, useElixir = false) =>
    call<CompleteOut>('POST', `/v1/sessions/${encodeURIComponent(sessionId)}/complete`, { answers, hints_used: hintsUsed, use_elixir: useElixir }, { retry: true }),
  reviewToday: (limit = 25) => call<ReviewToday>('GET', `/v1/review/today?limit=${limit}`),
  // only due items are scheduled; a repeat finds nothing due, so it is safe to retry
  reviewSubmit: (answers: ServerAnswer[]) => call<ReviewOut>('POST', '/v1/review/submit', { answers }, { retry: true }),
  wallet: () => call<Wallet>('GET', '/v1/wallet'),
  ledger: (limit = 50) => call<LedgerRow[]>('GET', `/v1/wallet/ledger?limit=${limit}`),
  shop: () => call<ShopOut>('GET', '/v1/shop'),
  buy: (b: { item_id: string } | { offer_id: string }) => call<{ ok: boolean; wallet: Wallet; owned_item?: string; inventory?: InventoryOut }>('POST', '/v1/shop/buy', b),
  chests: () => call<ChestInfo[]>('GET', '/v1/chests'),
  openChest: (kind: string) => call<{ kind: string; reward: { coins?: number; gems?: number; potion?: number }; wallet: Wallet; remaining: number }>('POST', `/v1/chests/${kind}/open`),
  inventory: () => call<InventoryOut>('GET', '/v1/inventory'),
  equip: (slot: string, itemId: string | null) => call<InventoryOut>('PUT', '/v1/inventory/equip', { slot, item_id: itemId }),
  catalog: () => raw<CatalogItem[]>('GET', '/v1/catalog/items', undefined, null, 3),
  // ---- Phase B: wardrobe ownership + economy sinks (every price is the server's)
  wardrobe: () => call<WardrobeOut>('GET', '/v1/wardrobe'),
  saveLook: (look: Partial<Look>, migrate = false) => call<{ look: Look; granted: string[] }>('PUT', '/v1/wardrobe/look', { look, migrate }),
  wardrobeBuy: (itemId: string, wear = false) => call<{ ok: boolean; owned_item: string; wallet: Wallet; look?: Look }>('POST', '/v1/wardrobe/buy', { item_id: itemId, wear }),
  merchant: () => call<Merchant>('GET', '/v1/merchant'),
  buySet: (setId: string) => call<{ ok: boolean; owned_items: string[]; price_gems: number; wallet: Wallet }>('POST', '/v1/merchant/buy-set', { set_id: setId }),
  hints: () => call<HintsState>('GET', '/v1/hints'),
  useHint: () => call<{ charged_coins: number; hints: HintsState; wallet: Wallet }>('POST', '/v1/hints/use'),
  continueSession: (sessionId: string, pay: 'elixir' | 'gems') => call<{ questions: ServerQuestion[]; wallet: Wallet; paid: string; continue: ContinueOffer }>('POST', `/v1/sessions/${encodeURIComponent(sessionId)}/continue`, { pay }),
  repairStreak: () => call<{ streak: Streak; wallet: Wallet }>('POST', '/v1/streak/repair'),
  quests: () => call<ServerQuest[]>('GET', '/v1/quests'),
  claimQuest: (id: string) => call<{ reward: { coins?: number; gems?: number; potion?: number; chest?: 'wood' | 'silver' | 'epic' }; quests: ServerQuest[]; wallet: Wallet }>('POST', `/v1/quests/${encodeURIComponent(id)}/claim`),
  streak: () => call<Streak>('GET', '/v1/streak'),
  league: () => call<ServerLeague>('GET', '/v1/league'),
  leagueSeen: () => call<unknown>('POST', '/v1/league/seen'),
}

/** a short line for the player from any error */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'offline': return 'The realm cannot be reached. Check your connection and try again.'
      case 'no_hearts': return 'You are out of hearts. Brew some in the Overnight Cauldron, wait, or use an elixir.'
      case 'stage_locked': return 'This stage is still locked.'
      case 'not_enough_gems': return 'Not enough gems'
      case 'not_enough_coins': return 'Not enough coins'
      case 'max_freezes': return 'You already hold 2 Frost Wards'
      case 'streak_not_alive': return 'Light your Hearthfire first: finish one exercise today'
      case 'hearts_full': return 'Your hearts are already full'
      case 'already_owned': return 'You already own it'
      case 'not_for_sale': return e.message || 'Not for sale'
      case 'not_in_merchant': return 'The Wandering Merchant does not carry it this week'
      case 'not_enough_elixir': return 'No elixir left'
      case 'already_continued': return 'You can continue a stage once'
      case 'nothing_to_repair': return 'There is nothing to repair'
      case 'session_expired': return 'This round took too long. Start the stage again.'
      case 'bad_name': return 'Use 2 to 20 letters or numbers'
      default: return e.message || 'Something went wrong'
    }
  }
  return 'Something went wrong'
}
