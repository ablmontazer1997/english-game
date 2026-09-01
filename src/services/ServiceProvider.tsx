import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { GameService } from './GameService'
import { MockGameService } from './mockService'
import type { Currencies, PlayerProfile, World, Quest, League, StageResult } from '../types/game'

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
  claimQuest: (id: string) => Promise<void>
}

const Ctx = createContext<GameStore | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [currencies, setCurrencies] = useState<Currencies | null>(null)
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [worlds, setWorlds] = useState<World[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [league, setLeague] = useState<League | null>(null)

  const refresh = useCallback(async () => {
    const [c, p, w, q, l] = await Promise.all([
      service.getCurrencies(), service.getProfile(), service.getWorlds(),
      service.getQuests(), service.getLeague(),
    ])
    setCurrencies(c); setProfile(p); setWorlds(w); setQuests(q); setLeague(l); setReady(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // regen hearts on an interval so the HUD ticks live
  useEffect(() => {
    const t = setInterval(async () => setCurrencies(await service.getCurrencies()), 15000)
    return () => clearInterval(t)
  }, [])

  const submitResult = useCallback(async (r: StageResult) => {
    const { currencies: c, profile: p } = await service.submitStageResult(r)
    setCurrencies(c); setProfile(p); setWorlds(await service.getWorlds())
  }, [])

  const refillHearts = useCallback(async () => { setCurrencies(await service.refillHearts()) }, [])
  const claimQuest = useCallback(async (id: string) => {
    const { quests: qs, currencies: c } = await service.claimQuest(id); setQuests(qs); setCurrencies(c)
  }, [])

  const value: GameStore = { ready, currencies, profile, worlds, quests, league, service, refresh, submitResult, refillHearts, claimQuest }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGame(): GameStore {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGame must be used within GameProvider')
  return v
}
