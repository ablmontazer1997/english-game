import { useGame } from '../services/ServiceProvider'
import { Sheet } from '../components/Sheet'
import { OfferRow } from './ShopScreen'
import { Row, Slot, Btn, art } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import { ESSENTIALS, BOOSTS } from '../services/shopCatalog'
import { useCountdown } from '../components/Rewards'
import type { CurrencyId } from '../types/game'
import './screens.css'
import './pages.css'
import '../components/progression.css'

const TITLES: Record<CurrencyId, string> = {
  hearts: 'More Hearts', potion: 'Elixirs', coins: 'Coins', gems: 'Gems',
}
const by = (id: string) => [...ESSENTIALS, ...BOOSTS].find((o) => o.id === id)!

// the "+" on a HUD pill: the same offers as the Shop tab, right where you need them
export type GemSource = 'quests' | 'achievements' | 'league'
/** where gems come from, each with a way to go there (audit 10-11 P0: the gem sheet was text only) */
const GEM_SOURCES: { id: GemSource; title: string; note: string; icon: string }[] = [
  { id: 'quests', title: 'Weekly quests', note: '8 to 15 gems each', icon: art('qi_chest') },
  { id: 'achievements', title: 'Achievements', note: '2 to 10 gems each', icon: art('badge_1') },
  { id: 'league', title: 'Weekly league', note: 'Top 10 win gems', icon: art('tier_2') },
]

export function ShopSheet({ currency, onClose, onGo }: { currency: CurrencyId | null; onClose: () => void; onGo?: (to: GemSource) => void }) {
  const { currencies, achievements } = useGame()
  const ready = achievements.filter((a) => a.progress >= a.target && !a.claimed).length
  if (!currency) return null
  const full = !!currencies && currencies.hearts >= currencies.heartsMax
  return <SheetBody currency={currency} full={full} ready={ready} onClose={onClose} onGo={onGo} />
}

function SheetBody({ currency, full, ready, onClose, onGo }: { currency: CurrencyId; full: boolean; ready: number; onClose: () => void; onGo?: (to: GemSource) => void }) {
  const { currencies } = useGame()
  const next = useCountdown(currencies?.heartsRefillAt ?? 0)
  return (
    <Sheet open={!!currency} title={TITLES[currency]} variant="light" onClose={onClose}>
      <div className="ss-list">
        {currency === 'hearts' && <>
          <OfferRow o={by('hearts_full')} disabled={full} status={full ? 'Hearts are full' : undefined} />
          <p className="ss-note">{full ? 'Your hearts are full.' : `Next heart in ${next.label}.`} One heart refills every 20 minutes, and 10 right answers in the Overnight Cauldron brew one.</p>
          <p className="ss-note">Trials, bosses and treasure vaults cost a heart when they end with no stars. Lessons and practice never do.</p>
        </>}
        {currency === 'potion' && <>
          <OfferRow o={by('elixir_1')} status={`You have ${currencies?.potion ?? 0}`} />
          <OfferRow o={by('elixir_3')} />
        </>}
        {currency === 'coins' && <>
          <OfferRow o={by('coin_sack')} />
          <p className="ss-note">Coins come from every stage you play, from quests and from chests. Spend them on hairstyles, eye and hair colours, dyes, boosts, and hints after your 3 free ones each day.</p>
        </>}
        {currency === 'gems' && <>
          {GEM_SOURCES.map((g) => (
            <Row key={g.id} className="reveal of-row">
              <Slot src={g.icon} />
              <span className="ui-main">
                <b className="ui-t">{g.title}</b>
                <small className="ui-s">{g.id === 'achievements' && ready ? `${ready} ready to claim` : g.note}</small>
              </span>
              <span className="ui-trail"><Btn onClick={() => { onClose(); onGo?.(g.id) }}><img src={skySrc('ic_gem')} alt="" />Go</Btn></span>
            </Row>
          ))}
          <p className="ss-note">Level-ups (+5) and Treasure Vaults pay gems too. Gem packs open when store payments go live.</p>
        </>}
      </div>
    </Sheet>
  )
}
