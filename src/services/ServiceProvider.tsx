import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { GameService } from './GameService'
import { MockGameService } from './mockService'
import { HttpGameService, toCurrencies } from './httpService'
import { api, errorText, type CompleteOut, type Streak, type ReviewOut } from './api'
import type { Currencies, PlayerProfile, World, Quest, League, StageResult, Achievement, Inventory, Reward, ChestKind } from '../types/game'

// The app runs on the real backend (runecast-api). `?mock=1` keeps the old local mock for previews.
const MOCK = typeof location !== 'undefined' && new URLSearchParams(location.search).has('mock')
const http = MOCK ? null : new HttpGameService()
const service: GameService = http ?? new MockGameService()

interface GameStore {
  ready: boolean
  /** 'http' = the live backend; 'mock' = local test data (?mock=1) */
  mode: 'http' | 'mock'
  /** the first load failed (offline / server down): the app shows a retry card */
  error: string | null
  currencies: Currencies | null
  profile: PlayerProfile | null
  worlds: World[]
  quests: Quest[]
  league: League | null
  service: GameService
  http: HttpGameService | null
  streak: Streak | null
  /** review items due today in the Overnight Cauldron (http mode) */
  reviewDue: number
  refresh: () => Promise<void>
  submitResult: (r: StageResult) => Promise<void>
  /** http mode: a stage was graded by the server; apply its wallet/profile/streak and reload what it changed */
  applyComplete: (out: CompleteOut, level: string) => Promise<void>
  /** http mode: a review round was graded */
  applyReview: (out: ReviewOut) => Promise<void>
  refreshReview: () => Promise<void>
  refillHearts: () => Promise<void>
  /** pay with coins or gems; false (nothing spent) when the balance is too low */
  spend: (c: 'coins' | 'gems', amount: number) => Promise<boolean>
  drinkElixir: () => Promise<boolean>
  claimQuest: (id: string) => Promise<Reward>
  inventory: Inventory | null
  achievements: Achievement[]
  claimAchievement: (id: string) => Promise<Reward>
  openChest: (k: ChestKind) => Promise<Reward | null>
  buy: (offerId: string) => Promise<{ ok: boolean; reason?: string }>
  seenLeagueResult: () => Promise<void>
  noteHint: () => void
  /** a reward just granted, shown by the app-wide reward popup */
  toast: { title: string; reward: Reward } | null
  showReward: (title: string, reward: Reward) => void
  clearToast: () => void
  setCurrencies: (c: Currencies) => void
}

const Ctx = createContext<GameStore | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currencies, setCurrencies] = useState<Currencies | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [worlds, setWorlds] = useState<World[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [streak, setStreak] = useState<Streak | null>(null)
  const [reviewDue, setReviewDue] = useState(0)
  const [toast, setToast] = useState<{ title: string; reward: Reward } | null>(null)

  const refreshReview = useCallback(async () => {
    if (!http) return
    try { setReviewDue((await api.reviewToday(1)).due_count) } catch { /* keep the last count */ }
  }, [])

  const refresh = useCallback(async () => {
    setError(null)
    try {
      // the league first: it sets the tier the profile shows
      const l = await service.getLeague()
      const [c, p, w, q, inv] = await Promise.all([
        service.getCurrencies(), service.getProfile(), service.getWorlds(), service.getQuests(), service.getInventory(),
      ])
      if (http) {
        const st = await http.streak(); setStreak(st); http.streakBest = st.best
        refreshReview()
      }
      const ach = await service.getAchievements()
      setCurrencies(c); setProfile(p); setWorlds(w); setQuests(q); setLeague(l); setInventory(inv); setAchievements(ach); setReady(true)
    } catch (e) {
      setError(errorText(e))
    }
  }, [refreshReview])

  useEffect(() => { refresh() }, [refresh])

  // hearts regenerate on the server; read the wallet now and then (and right after the next heart is due)
  useEffect(() => {
    const t = setInterval(async () => {
      try { setCurrencies(await service.getCurrencies()) } catch { /* offline: keep the last balance */ }
    }, http ? 60000 : 15000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const at = currencies?.heartsRefillAt
    if (!http || !at) return
    const t = setTimeout(async () => { try { setCurrencies(await service.getCurrencies()) } catch { /* offline */ } }, Math.max(1000, at - Date.now() + 1500))
    return () => clearTimeout(t)
  }, [currencies?.heartsRefillAt])

  const submitResult = useCallback(async (r: StageResult) => {
    const { currencies: c } = await service.submitStageResult(r)
    setCurrencies(c)
    const [p, w, q, l, ach] = await Promise.all([service.getProfile(), service.getWorlds(), service.getQuests(), service.getLeague(), service.getAchievements()])
    setProfile(p); setWorlds(w); setQuests(q); setLeague(l); setAchievements(ach)
  }, [])

  const applyComplete = useCallback(async (out: CompleteOut, level: string) => {
    if (!http) return
    setCurrencies(toCurrencies(out.wallet)); setProfile(http.profileOf(out.me)); setStreak(out.streak); http.streakBest = out.streak.best
    try {
      // a finished level opens the next one: reload every map then
      const w = out.level_completed ? await service.getWorlds() : await http.refreshLevel(level)
      setWorlds(w)
      const [q, l, inv] = await Promise.all([service.getQuests(), service.getLeague(), service.getInventory()])
      setQuests(q); setLeague(l); setInventory(inv); setAchievements(await service.getAchievements())
      refreshReview()
    } catch { /* the next refresh catches up */ }
  }, [refreshReview])

  const applyReview = useCallback(async (out: ReviewOut) => {
    if (!http) return
    setCurrencies(toCurrencies(out.wallet)); setStreak(out.streak)
    try {
      const [p, q] = await Promise.all([service.getProfile(), service.getQuests()])
      setProfile(p); setQuests(q)
    } catch { /* later */ }
    refreshReview()
  }, [refreshReview])

  const refillHearts = useCallback(async () => { setCurrencies(await service.refillHearts()) }, [])
  const spend = useCallback(async (cur: 'coins' | 'gems', amount: number) => {
    const now = await service.getCurrencies()
    if (now[cur] < amount) return false
    setCurrencies(await service.spend(cur, amount)); return true
  }, [])
  const drinkElixir = useCallback(async () => {
    const r = await service.drinkElixir(); setCurrencies(r.currencies); return r.ok
  }, [])
  const showReward = useCallback((title: string, reward: Reward) => setToast({ title, reward }), [])
  const clearToast = useCallback(() => setToast(null), [])
  const claimQuest = useCallback(async (id: string) => {
    try {
      const { quests: qs, currencies: c, reward } = await service.claimQuest(id); setQuests(qs); setCurrencies(c)
      setInventory(await service.getInventory()); setAchievements(await service.getAchievements())
      if (Object.keys(reward).length) setToast({ title: 'Quest complete!', reward })
      return reward
    } catch { return {} }
  }, [])
  const claimAchievement = useCallback(async (id: string) => {
    const { achievements: a, currencies: c, reward } = await service.claimAchievement(id); setAchievements(a); setCurrencies(c)
    if (Object.keys(reward).length) setToast({ title: 'Achievement unlocked!', reward })
    return reward
  }, [])
  const openChest = useCallback(async (k: ChestKind) => {
    const r = await service.openChest(k)
    setCurrencies(r.currencies); setInventory(await service.getInventory()); setAchievements(await service.getAchievements())
    return r.ok ? r.reward : null
  }, [])
  const buy = useCallback(async (offerId: string) => {
    const r = await service.buy(offerId)
    if (r.currencies && 'coins' in r.currencies) setCurrencies(r.currencies)
    try {
      setInventory(await service.getInventory()); setAchievements(await service.getAchievements())
      if (http && r.ok && offerId.includes('freeze')) setStreak(await http.streak())
    } catch { /* later */ }
    return { ok: r.ok, reason: r.reason }
  }, [])
  const seenLeagueResult = useCallback(async () => {
    await service.seenLeagueResult()
    setCurrencies(await service.getCurrencies()); setInventory(await service.getInventory()); setLeague(await service.getLeague())
  }, [])
  const noteHint = useCallback(() => { service.noteHint() }, [])

  const value: GameStore = { ready, mode: http ? 'http' : 'mock', error, currencies, profile, worlds, quests, league, service, http, streak, reviewDue,
    refresh, submitResult, applyComplete, applyReview, refreshReview, refillHearts, spend, drinkElixir, claimQuest,
    inventory, achievements, claimAchievement, openChest, buy, seenLeagueResult, noteHint, toast, showReward, clearToast, setCurrencies }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGame(): GameStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGame must be used within GameProvider')
  return v
}
