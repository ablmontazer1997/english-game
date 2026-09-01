import type {
  Currencies, PlayerProfile, World, Quest, League, SrsItem,
  StageResult, MiniGameId, CurrencyId,
} from '../types/game'

// The single seam between UI and data. `MockGameService` implements it now;
// a future `HttpGameService` will implement the exact same interface against the
// real backend, and nothing in the UI has to change.
export interface GameService {
  getProfile(): Promise<PlayerProfile>
  getCurrencies(): Promise<Currencies>
  getWorlds(): Promise<World[]>
  getQuests(): Promise<Quest[]>
  getLeague(): Promise<League>

  // Pull the SRS-scheduled items for a stage's mini-game.
  getStageItems(stageId: string, miniGame: MiniGameId): Promise<SrsItem[]>

  // Persist the outcome of a played stage; returns updated currencies + profile.
  submitStageResult(result: StageResult): Promise<{ currencies: Currencies; profile: PlayerProfile }>

  // Economy actions.
  spend(currency: CurrencyId, amount: number): Promise<Currencies>
  refillHearts(): Promise<Currencies>          // e.g. via potion / purchase
  claimQuest(questId: string): Promise<{ quests: Quest[]; currencies: Currencies }>
}
