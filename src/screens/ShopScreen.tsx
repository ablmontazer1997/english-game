import { useState } from 'react'
import { useGame } from '../services/ServiceProvider'
import { Panel, art, PAGE_BG, type ArtName } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import { ChestStrip, useCountdown } from '../components/Rewards'
import { ESSENTIALS, BOOSTS, CHEST_OFFERS, GEM_PACKS, dealOfTheDay, priceLabel, type Offer, type OfferIcon } from '../services/shopCatalog'
import { dayEnd } from '../services/progress'
import './pages.css'
import '../components/progression.css'

const ICON_ART: Record<OfferIcon, string> = {
  heart: skySrc('ic_heart'), potion: art('qi_potion'), potion3: art('qi_potion'), flame: art('qi_flame'), xp: skySrc('ic_energy'),
  coins: skySrc('ic_coin'), coins_big: skySrc('ic_coin'), wood: art('chest_wood'), silver: art('chest_silver'), epic: art('chest_epic'),
}
const GEM_ART: ArtName[] = ['gem_s', 'gem_m', 'gem_l', 'gem_xl']

/** price button: coin or gem icon + amount; greys out when you can't afford it */
function PriceBtn({ o, onBuy, disabled }: { o: Offer; onBuy: () => void; disabled?: boolean }) {
  const { currencies } = useGame()
  const short = (o.price.gems ?? 0) > (currencies?.gems ?? 0) || (o.price.coins ?? 0) > (currencies?.coins ?? 0)
  return (
    <Panel name="btn_green" className={`sh-buy${short ? ' short' : ''}`} onClick={onBuy} disabled={disabled}>
      <img src={skySrc(o.price.gems != null ? 'ic_gem' : 'ic_coin')} alt="" />{priceLabel(o.price)}
    </Panel>
  )
}

export function OfferRow({ o, status, disabled, onDone }: { o: Offer; status?: string; disabled?: boolean; onDone?: () => void }) {
  const { buy, showReward } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const go = async () => {
    const r = await buy(o.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    const item = o.id.replace(/^deal:/, '')
    if (item.startsWith('chest_')) showReward('Added to your chests', { chest: item.slice(6) as 'wood' })
    else setMsg('Done!'), setTimeout(() => setMsg(null), 1400)
    onDone?.()
  }
  return (
    <Panel name="pnl_row6" inner="of-row" className="reveal">
      <span className="of-ic">
        <img src={ICON_ART[o.icon]} alt="" draggable={false} />
        {o.icon === 'potion3' && <i>×3</i>}
      </span>
      <span className="of-main">
        <b>{o.title}</b>
        <small className={msg ? 'of-msg' : ''}>{msg ?? status ?? o.note}</small>
      </span>
      <PriceBtn o={o} onBuy={go} disabled={disabled} />
    </Panel>
  )
}

export function ShopScreen() {
  const { currencies, inventory } = useGame()
  const deal = dealOfTheDay()
  const dealLeft = useCountdown(dayEnd())
  const boost = useCountdown(inventory?.xpBoostUntil ?? 0)
  const fullHearts = !!currencies && currencies.hearts >= currencies.heartsMax

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.shop} alt="" draggable={false} />
      <div className="pg-scroll">
        {/* deal of the day */}
        <Panel name="panel_banner" className="reveal" inner="sh-banner">
          <div className="sh-banner-main">
            <span className="sh-banner-t">{deal.title}</span>
            <span className="sh-banner-l">
              {deal.was && <s>{priceLabel(deal.was)}</s>}
              <img src={skySrc(deal.price.gems != null ? 'ic_gem' : 'ic_coin')} alt="" />{priceLabel(deal.price)}
            </span>
            <DealBuy deal={deal} bought={!!inventory?.dealBought} />
          </div>
          <img className="sh-banner-art" src={ICON_ART[deal.icon]} alt="" draggable={false} />
          <Panel name="ribbon_gold" className="sh-ribbon">Deal · {dealLeft.label}</Panel>
        </Panel>

        <ChestStrip />

        <div className="pg-h">Essentials</div>
        {ESSENTIALS.map((o) => (
          <OfferRow key={o.id} o={o} disabled={o.id === 'hearts_full' && fullHearts}
            status={o.id === 'hearts_full' && fullHearts ? 'Hearts are full' : o.id.startsWith('elixir') ? `You have ${currencies?.potion ?? 0}` : undefined} />
        ))}

        <div className="pg-h">Boosts</div>
        {BOOSTS.map((o) => (
          <OfferRow key={o.id} o={o}
            status={o.id === 'xp_boost' && boost.ms > 0 ? `Active · ${boost.label} left`
              : o.id === 'freeze' ? `You hold ${inventory?.freezes ?? 0} / 2` : undefined} />
        ))}

        <div className="pg-h">Chests</div>
        <div className="sh-grid3">
          {CHEST_OFFERS.map((o) => <ChestCard key={o.id} o={o} />)}
        </div>

        <div className="pg-h">Gems</div>
        <div className="sh-grid">
          {GEM_PACKS.map((p, i) => (
            <Panel key={p.n} name="card_square" className="reveal" inner="sh-card">
              <img className="sh-card-art" src={art(GEM_ART[i])} alt="" draggable={false} />
              <span className="sh-card-n"><img src={art('gem_s')} alt="" />{p.n.toLocaleString('en-US')}</span>
              <Panel name="btn_green" className="sh-price" disabled>{p.price}</Panel>
            </Panel>
          ))}
        </div>
        <p className="pg-note">Gem packs open when store payments go live. Until then, earn gems from quests, achievements, chests, level-ups and the league.</p>
      </div>
    </div>
  )
}

function DealBuy({ deal, bought }: { deal: Offer; bought: boolean }) {
  const { buy, showReward } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const go = async () => {
    const r = await buy(deal.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    if (deal.id.includes('chest_')) showReward('Added to your chests', { chest: 'silver' })
  }
  return (
    <Panel name="btn_green" className="sh-price" style={{ height: 38 }} onClick={go} disabled={bought}>
      {bought ? 'Bought' : msg ?? 'Buy'}
    </Panel>
  )
}

function ChestCard({ o }: { o: Offer }) {
  const { buy, showReward } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const go = async () => {
    const r = await buy(o.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    showReward('Added to your chests', { chest: o.id.slice(6) as 'wood' })
  }
  return (
    <Panel name="card_square" className="reveal" inner="sh-card">
      <img className="sh-card-art" src={ICON_ART[o.icon]} alt="" draggable={false} />
      <span className="sh-card-n">{msg ?? o.title.replace(' Chest', '')}</span>
      <PriceBtn o={o} onBuy={go} />
    </Panel>
  )
}
