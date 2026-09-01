import type { ReactNode } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Sheet } from '../components/Sheet'
import { HeartIcon, PotionIcon, CoinIcon, GemIcon, BoltIcon } from '../components/Icon'
import type { CurrencyId } from '../types/game'
import './screens.css'

const TITLES: Record<CurrencyId, string> = {
  hearts: 'More Hearts', potion: 'Potions', coins: 'Coins', gems: 'Gems',
}

export function ShopSheet({ currency, onClose }: { currency: CurrencyId | null; onClose: () => void }) {
  const { currencies, refillHearts } = useGame()
  if (!currency) return null

  const offers = OFFERS[currency]
  return (
    <Sheet open={!!currency} title={TITLES[currency]} onClose={onClose}>
      <p className="page-sub" style={{ marginTop: -6 }}>Shop right here, no separate tab.</p>
      {currency === 'hearts' && (
        <div className="tile">
          <div className="tile-ic" style={{ color: 'var(--rose)' }}><HeartIcon size={20} /></div>
          <div className="tile-main"><b>Full Refill with Potion</b><p>Spends one potion · You have: {currencies?.potion}</p></div>
          <button className="btn btn-cyan" disabled={!currencies?.potion} onClick={() => { refillHearts(); onClose() }}>Refill</button>
        </div>
      )}
      {offers.map((o) => (
        <div className="tile" key={o.label}>
          <div className="tile-ic" style={{ color: o.tint }}>{o.icon}</div>
          <div className="tile-main"><b>{o.label}</b><p>{o.note}</p></div>
          <button className="btn btn-gold" disabled>{o.price}</button>
        </div>
      ))}
      <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, margin: '14px 0 4px' }}>
        Paid purchases unlock once the backend is connected.
      </p>
    </Sheet>
  )
}

const OFFERS: Record<CurrencyId, { label: string; note: string; price: string; icon: ReactNode; tint: string }[]> = {
  hearts: [
    { label: 'Unlimited Hearts 30 min', note: 'Play without heart worries', price: '20 💎', icon: <BoltIcon size={20} />, tint: 'var(--gold)' },
    { label: '5 Hearts Pack', note: 'Instant refill', price: '15 💎', icon: <HeartIcon size={20} />, tint: 'var(--rose)' },
  ],
  potion: [
    { label: '3 Potions Pack', note: 'Refill / boost / hint', price: '25 💎', icon: <PotionIcon size={20} />, tint: 'var(--potion)' },
  ],
  coins: [
    { label: '1000 Coins Bag', note: 'For boosters and cosmetics', price: '10 💎', icon: <CoinIcon size={20} />, tint: 'var(--gold)' },
  ],
  gems: [
    { label: '100 Gems Pack', note: 'Premium currency', price: 'Buy', icon: <GemIcon size={20} />, tint: 'var(--amethyst-soft)' },
    { label: 'Seasonal Moon Pass', note: 'Premium reward track', price: 'Buy', icon: <BoltIcon size={20} />, tint: 'var(--cyan)' },
  ],
}
