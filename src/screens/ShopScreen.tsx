import { useGame } from '../services/ServiceProvider'
import { ImgIcon, type IconName } from '../components/ImgIcon'
import './screens.css'
import './screens2.css'

type Offer = { label: string; note: string; priceGems?: number; cta?: string; icon: IconName }

// Full shop, grouped by category. Paid purchases are inert until the backend is
// connected; the potion heart-refill is the one live action.
const SECTIONS: { label: string; offers: Offer[] }[] = [
  {
    label: 'Gems',
    offers: [
      { label: '100 Gems Pack', note: 'A small pile of shiny gems', cta: 'Buy', icon: 'gem' },
      { label: 'Seasonal Moon Pass', note: 'Premium reward track', cta: 'Buy', icon: 'bolt' },
    ],
  },
  {
    label: 'Hearts',
    offers: [
      { label: 'Unlimited Hearts · 30 min', note: 'Play without limits!', priceGems: 50, icon: 'bolt' },
      { label: '5 Hearts Pack', note: 'Instant refill', priceGems: 40, icon: 'heart' },
    ],
  },
  {
    label: 'Potions',
    offers: [
      { label: '3 Potions Pack', note: 'Three magical potions', priceGems: 60, icon: 'potion' },
    ],
  },
  {
    label: 'Coins',
    offers: [
      { label: '1000 Coins Bag', note: 'A bag of gleaming coins', priceGems: 40, icon: 'coin' },
    ],
  },
]

function Price({ o }: { o: Offer }) {
  if (o.priceGems == null) return <>{o.cta ?? 'Buy'}</>
  return <span className="rc-price"><ImgIcon name="gem" size={16} />{o.priceGems}</span>
}

function Row({ icon, children, cta }: { icon: IconName; children: React.ReactNode; cta: React.ReactNode }) {
  return (
    <div className="rc-crow">
      <div className="rc-medallion"><div className="rc-medallion-in"><ImgIcon name={icon} size={38} /></div></div>
      <div className="rc-crow-main">{children}</div>
      {cta}
    </div>
  )
}

export function ShopScreen() {
  const { currencies, refillHearts } = useGame()
  const canRefill = !!currencies?.potion

  return (
    <div className="screen">
      <div className="page reveal">
        <div className="rc-banner"><h1>Shop</h1><p>Gems, boosters, potions and cosmetics.</p></div>

        <div className="rc-hero">
          <ImgIcon name="chest_open" size={92} className="rc-hero-art" />
          <div className="rc-hero-main">
            <b>Daily Treasure</b>
            <p>Open a free chest of coins and gems.</p>
            <button className="btn-img gold rc-hero-cta">Open</button>
          </div>
        </div>

        <div className="rc-sec"><span className="rc-sec-t">Quick Refill</span></div>
        <Row icon="heart"
          cta={<button className="btn-img cyan rc-crow-btn" disabled={!canRefill} onClick={() => refillHearts()}>Refill</button>}>
          <b>Full Refill with Potion</b>
          <p>Restores all hearts to full · You have {currencies?.potion ?? 0}</p>
        </Row>

        {SECTIONS.map((s) => (
          <div key={s.label}>
            <div className="rc-sec"><span className="rc-sec-t">{s.label}</span></div>
            {s.offers.map((o) => (
              <Row key={o.label} icon={o.icon}
                cta={<button className="btn-img gold rc-crow-btn"><Price o={o} /></button>}>
                <b>{o.label}</b>
                <p>{o.note}</p>
              </Row>
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
