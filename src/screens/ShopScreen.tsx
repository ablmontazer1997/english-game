import { useGame } from '../services/ServiceProvider'
import { ImgIcon, type IconName } from '../components/ImgIcon'
import './screens.css'

type Offer = { label: string; note: string; priceGems?: number; cta?: string; icon: IconName }

// Full shop, grouped by category. Paid purchases are inert until the backend is
// connected; the potion heart-refill is the one live action.
const SECTIONS: { label: string; offers: Offer[] }[] = [
  {
    label: 'Gems',
    offers: [
      { label: '100 Gems Pack', note: 'Premium currency', cta: 'Buy', icon: 'gem' },
      { label: 'Seasonal Moon Pass', note: 'Premium reward track', cta: 'Buy', icon: 'bolt' },
    ],
  },
  {
    label: 'Hearts',
    offers: [
      { label: 'Unlimited Hearts · 30 min', note: 'Play without heart worries', priceGems: 20, icon: 'bolt' },
      { label: '5 Hearts Pack', note: 'Instant refill', priceGems: 15, icon: 'heart' },
    ],
  },
  {
    label: 'Potions',
    offers: [
      { label: '3 Potions Pack', note: 'Refill / boost / hint', priceGems: 25, icon: 'potion' },
    ],
  },
  {
    label: 'Coins',
    offers: [
      { label: '1000 Coins Bag', note: 'For boosters and cosmetics', priceGems: 10, icon: 'coin' },
    ],
  },
]

function Price({ o }: { o: Offer }) {
  if (o.priceGems == null) return <>{o.cta ?? 'Buy'}</>
  return <span className="price"><b>{o.priceGems}</b><ImgIcon name="gem" size={16} /></span>
}

export function ShopScreen() {
  const { currencies, refillHearts } = useGame()
  const canRefill = !!currencies?.potion

  return (
    <div className="screen">
      <div className="page reveal">
        <h1 className="page-title">Shop</h1>
        <p className="page-sub">Gems, boosters, potions and cosmetics.</p>

        <div className="shop-hero">
          <ImgIcon name="chest_open" size={78} className="shop-hero-art" />
          <div className="shop-hero-main">
            <b>Daily Treasure</b>
            <p>Open a free chest of coins and gems.</p>
          </div>
          <button className="btn-img gold shop-hero-cta">Open</button>
        </div>

        <div className="section-label">Quick Refill</div>
        <div className="tile">
          <div className="tile-ic tile-ic-img"><ImgIcon name="heart" size={38} /></div>
          <div className="tile-main">
            <b>Full Refill with Potion</b>
            <p>Spends one potion · You have: {currencies?.potion ?? 0}</p>
          </div>
          <button className="btn-img cyan tile-cta" disabled={!canRefill} onClick={() => refillHearts()}>Refill</button>
        </div>

        {SECTIONS.map((s) => (
          <div key={s.label}>
            <div className="section-label">{s.label}</div>
            {s.offers.map((o) => (
              <div className="tile" key={o.label}>
                <div className="tile-ic tile-ic-img"><ImgIcon name={o.icon} size={38} /></div>
                <div className="tile-main"><b>{o.label}</b><p>{o.note}</p></div>
                <button className="btn-img gold tile-cta" disabled><Price o={o} /></button>
              </div>
            ))}
          </div>
        ))}

        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12, margin: '14px 0 4px' }}>
          Paid purchases unlock once the backend is connected.
        </p>
      </div>
    </div>
  )
}
