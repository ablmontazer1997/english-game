import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { GameService } from './GameService'
import { MockGameService } from './mockService'
import type { Currencies, PlayerProfile, World, Quest, League, StageResult, Achievement, Inventory, Reward, ChestKind } from '../types/game'

// Swap this line for `new HttpGameService(baseUrl)` when the backend exists.
const service: GameService = new MockGameService()

interface GameStore {
  ready: boolean
  currencies: Currencies | null
  profile: PlayerProfile | null
  worlds: World[]
  quests: Quest[]
  league: League | null
  service: GameService
  refresh: () => Promise<void>
  submitResult: (r: StageResult) => Promise<void>
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
}

const Ctx = createContext<GameStore | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [currencies, setCurrencies] = useState<Currencies | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [worlds, setWorlds] = useState<World[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [league, setLeague] = useState<League | null>(null)
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [toast, setToast] = useState<{ title: string; reward: Reward } | null>(null)

  const refresh = useCallback(async () => {
    const [c, p, w, q, l, inv, ach] = await Promise.all([
      service.getCurrencies(), service.getProfile(), service.getWorlds(),
      service.getQuests(), service.getLeague(), service.getInventory(), service.getAchievements(),
    ])
    setCurrencies(c); setProfile(p); setWorlds(w); setQuests(q); setLeague(l); setInventory(inv); setAchievements(ach); setReady(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // regen hearts on an interval so the HUD ticks live
  useEffect(() => {
    const t = setInterval(async () => setCurrencies(await service.getCurrencies()), 15000)
    return () => clearInterval(t)
  }, [])

  const submitResult = useCallback(async (r: StageResult) => {
    const { currencies: c } = await service.submitStageResult(r)
    setCurrencies(c)
    const [p, w, q, l, ach] = await Promise.all([service.getProfile(), service.getWorlds(), service.getQuests(), service.getLeague(), service.getAchievements()])
    setProfile(p); setWorlds(w); setQuests(q); setLeague(l); setAchievements(ach)
  }, [])

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
    const { quests: qs, currencies: c, reward } = await service.claimQuest(id); setQuests(qs); setCurrencies(c)
    setInventory(await service.getInventory()); setAchievements(await service.getAchievements())
    if (Object.keys(reward).length) setToast({ title: 'Quest complete!', reward })
    return reward
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
    setCurrencies(r.currencies); setInventory(await service.getInventory()); setAchievements(await service.getAchievements())
    return { ok: r.ok, reason: r.reason }
  }, [])
  const seenLeagueResult = useCallback(async () => {
    await service.seenLeagueResult()
    setCurrencies(await service.getCurrencies()); setInventory(await service.getInventory()); setLeague(await service.getLeague())
  }, [])
  const noteHint = useCallback(() => { service.noteHint() }, [])

  const value: GameStore = { ready, currencies, profile, worlds, quests, league, service, refresh, submitResult, refillHearts, spend, drinkElixir, claimQuest,
    inventory, achievements, claimAchievement, openChest, buy, seenLeagueResult, noteHint, toast, showReward, clearToast }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGame(): GameStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGame must be used within GameProvider')
  return v
}
