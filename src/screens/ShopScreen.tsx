import { useGame } from '../services/ServiceProvider'
import { Panel, art, PAGE_BG, type ArtName } from '../components/PageArt'
import './pages.css'

const GEM_PACKS: { art: ArtName; n: number; price: string }[] = [
  { art: 'gem_s', n: 80, price: '$0.99' },
  { art: 'gem_m', n: 250, price: '$2.99' },
  { art: 'gem_l', n: 650, price: '$6.99' },
  { art: 'gem_xl', n: 1500, price: '$12.99' },
]
const CHESTS: { art: ArtName; label: string; price: string }[] = [
  { art: 'chest_wood', label: 'Wooden', price: '$0.99' },
  { art: 'chest_silver', label: 'Silver', price: '$2.99' },
  { art: 'chest_epic', label: 'Epic', price: '$6.99' },
]

export function ShopScreen() {
  const { currencies, refillHearts } = useGame()
  const canRefill = !!currencies?.potion

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.shop} alt="" draggable={false} />
      <div className="pg-scroll">
        <Panel name="panel_banner" className="reveal" inner="sh-banner">
          <img className="sh-banner-art" src={art('chest_open')} alt="" draggable={false} />
          <div className="sh-banner-main">
            <span className="sh-banner-t">Treasure Pile</span>
            <span className="sh-banner-l"><img src={art('gem_s')} alt="" />2,500</span>
            <Panel name="btn_green" className="sh-price" style={{ height: 38 }}>$9.99</Panel>
          </div>
          <Panel name="ribbon_gold" className="sh-ribbon">Best value</Panel>
        </Panel>

        <div className="pg-h">Gems</div>
        <div className="sh-grid">
          {GEM_PACKS.map((p) => (
            <Panel key={p.n} name="card_square" className="reveal" inner="sh-card">
              <img className="sh-card-art" src={art(p.art)} alt="" draggable={false} />
              <span className="sh-card-n"><img src={art('gem_s')} alt="" />{p.n.toLocaleString('en-US')}</span>
              <Panel name="btn_green" className="sh-price">{p.price}</Panel>
            </Panel>
          ))}
        </div>

        <div className="pg-h">Chests</div>
        <div className="sh-grid3">
          {CHESTS.map((c) => (
            <Panel key={c.label} name="card_square" className="reveal" inner="sh-card">
              <img className="sh-card-art" src={art(c.art)} alt="" draggable={false} />
              <span className="sh-card-n">{c.label}</span>
              <Panel name="btn_green" className="sh-price">{c.price}</Panel>
            </Panel>
          ))}
        </div>

        <div className="pg-h">Quick refill</div>
        <Panel name="pnl_row6" inner="sh-row">
          <img className="sh-row-ic" src={art('qi_potion')} alt="" draggable={false} />
          <b>Refill hearts with a potion · {currencies?.potion ?? 0} left</b>
          <Panel name="btn_gold" className="q-cta" style={{ height: 36 }}
            disabled={!canRefill} onClick={() => refillHearts()}>Use</Panel>
        </Panel>
      </div>
    </div>
  )
}
