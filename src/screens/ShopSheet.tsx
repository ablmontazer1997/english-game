import { useGame } from '../services/ServiceProvider'
import { Sheet } from '../components/Sheet'
import { OfferRow } from './ShopScreen'
import { ESSENTIALS, BOOSTS } from '../services/shopCatalog'
import type { CurrencyId } from '../types/game'
import './screens.css'
import './pages.css'
import '../components/progression.css'

const TITLES: Record<CurrencyId, string> = {
  hearts: 'More Hearts', potion: 'Elixirs', coins: 'Coins', gems: 'Gems',
}
const by = (id: string) => [...ESSENTIALS, ...BOOSTS].find((o) => o.id === id)!

// the "+" on a HUD pill: the same offers as the Shop tab, right where you need them
export function ShopSheet({ currency, onClose }: { currency: CurrencyId | null; onClose: () => void }) {
  const { currencies } = useGame()
  if (!currency) return null
  const full = !!currencies && currencies.hearts >= currencies.heartsMax
  return (
    <Sheet open={!!currency} title={TITLES[currency]} onClose={onClose}>
      <div className="ss-list">
        {currency === 'hearts' && <>
          <OfferRow o={by('hearts_full')} disabled={full} status={full ? 'Hearts are full' : undefined} />
          <p className="ss-note">Hearts refill by themselves: one every 20 minutes. You only lose a heart when a stage ends with no stars.</p>
        </>}
        {currency === 'potion' && <>
          <OfferRow o={by('elixir_1')} status={`You have ${currencies?.potion ?? 0}`} />
          <OfferRow o={by('elixir_3')} />
        </>}
        {currency === 'coins' && <>
          <OfferRow o={by('coin_sack')} />
          <p className="ss-note">Coins come from every stage you play, from quests and from chests.</p>
        </>}
        {currency === 'gems' && (
          <p className="ss-note">Earn gems from weekly quests, achievements, level-ups, chests and top league finishes. Gem packs open when store payments go live.</p>
        )}
      </div>
    </Sheet>
  )
}
