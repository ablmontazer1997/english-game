// The Hearthfire (daily streak) with its Frost Wards: what keeps it burning, and the ward shop row.
import { useGame } from '../services/ServiceProvider'
import { Sheet } from '../components/Sheet'
import { art } from '../components/PageArt'
import { OfferRow } from './ShopScreen'
import type { Offer } from '../services/shopCatalog'
import './screens.css'
import './pages.css'
import './serverstage.css'
import '../components/progression.css'

const WARD: Offer = { id: 'freeze', title: 'Frost Ward', note: 'Covers one missed day. Hold up to 2.', icon: 'flame', price: { coins: 300 } }

export function HearthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { streak } = useGame()
  if (!open || !streak) return null
  return (
    <Sheet open={open} title="Hearthfire" variant="light" onClose={onClose}>
      <div className="ss-list hf">
        <div className="hf-top">
          <img className={streak.today_done ? '' : 'hf-out'} src={art('qi_flame')} alt="" draggable={false} />
          <div>
            <b className="hf-n">{streak.current} day{streak.current === 1 ? '' : 's'}</b>
            <small>Best: {streak.best} · {streak.today_done ? 'lit today' : 'not lit yet today'}</small>
          </div>
        </div>
        <p className="ss-note">{streak.rule}</p>
        <div className="hf-wards" aria-label={`${streak.freezes} of ${streak.freezes_max} Frost Wards`}>
          {Array.from({ length: streak.freezes_max }, (_, i) => <span key={i} className={i < streak.freezes ? 'on' : ''}>❄</span>)}
          <small>Frost Wards cover a missed day by themselves.</small>
        </div>
        <OfferRow o={WARD} disabled={streak.freezes >= streak.freezes_max || streak.current === 0}
          status={streak.freezes >= streak.freezes_max ? 'You hold the most (2)' : streak.current === 0 ? 'Light your Hearthfire first' : `You hold ${streak.freezes} / ${streak.freezes_max}`} />
      </div>
    </Sheet>
  )
}
