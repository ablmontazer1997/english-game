// What the shop sells, in the game's own currencies (see project economy):
// coins = everyday spending (boosts, wooden chests), gems = premium (hearts,
// elixirs, better chests). Real-money gem packs stay listed but locked until
// payments exist. The service applies purchases by id; the UI only renders.
import type { ChestKind } from '../types/game'
import { seeded, dayKey } from './progress'

export type Price = { coins?: number; gems?: number }
export type OfferIcon = 'heart' | 'potion' | 'potion3' | 'flame' | 'xp' | 'coins' | 'coins_big' | ChestKind
export interface Offer {
  id: string
  title: string
  note: string
  icon: OfferIcon
  price: Price
  was?: Price           // crossed-out price on the deal of the day
}

export const ESSENTIALS: Offer[] = [
  { id: 'hearts_full', title: 'Full Hearts', note: 'Refill all hearts now', icon: 'heart', price: { gems: 15 } },
  { id: 'elixir_1', title: 'Elixir', note: 'Continue a lost stage or keep your heart', icon: 'potion', price: { gems: 10 } },
  { id: 'elixir_3', title: '3 Elixirs', note: 'Best value for rescues', icon: 'potion3', price: { gems: 25 } },
]
export const BOOSTS: Offer[] = [
  { id: 'xp_boost', title: 'Double XP · 15 min', note: 'Climb the league twice as fast', icon: 'xp', price: { coins: 250 } },
  { id: 'freeze', title: 'Streak Freeze', note: 'Covers one missed day (hold up to 2)', icon: 'flame', price: { coins: 300 } },
  { id: 'coin_sack', title: 'Coin Sack', note: '1,000 coins', icon: 'coins', price: { gems: 15 } },
]
export const CHEST_OFFERS: Offer[] = [
  { id: 'chest_wood', title: 'Wooden Chest', note: '80–150 coins, maybe an elixir', icon: 'wood', price: { coins: 300 } },
  { id: 'chest_silver', title: 'Silver Chest', note: '400–700 coins, maybe an elixir', icon: 'silver', price: { gems: 15 } },
  { id: 'chest_epic', title: 'Epic Chest', note: '1,000–1,600 coins and elixirs', icon: 'epic', price: { gems: 35 } },
]
/** one featured offer per day, the same for everyone. Every id here must be a server offer (catalog.OFFERS):
 *  'Treasure Pile' (coin_big) was removed 10-11 because the server never sold it (Buy failed with 404). */
const DEALS: Offer[] = [
  { id: 'elixir_3', title: '3 Elixirs', note: 'Deal of the day', icon: 'potion3', price: { gems: 16 }, was: { gems: 25 } },
  { id: 'chest_silver', title: 'Silver Chest', note: 'Deal of the day', icon: 'silver', price: { gems: 10 }, was: { gems: 15 } },
  { id: 'xp_boost', title: 'Double XP · 15 min', note: 'Deal of the day', icon: 'xp', price: { coins: 150 }, was: { coins: 250 } },
]
export function dealOfTheDay(t = Date.now()): Offer {
  const d = DEALS[Math.floor(seeded('deal' + dayKey(t))() * DEALS.length)]
  return { ...d, id: 'deal:' + d.id }
}
export const GEM_PACKS = [
  { n: 80, price: '$0.99' }, { n: 250, price: '$2.99' }, { n: 650, price: '$6.99' }, { n: 1500, price: '$12.99' },
]
export const findOffer = (id: string) =>
  id.startsWith('deal:') ? dealOfTheDay() : [...ESSENTIALS, ...BOOSTS, ...CHEST_OFFERS].find((o) => o.id === id)
export const priceLabel = (p: Price) => p.gems != null ? `${p.gems}` : `${(p.coins ?? 0).toLocaleString('en-US')}`
