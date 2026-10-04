import { useEffect, useState } from 'react'
import { ItemThumb } from '../components/ItemThumb'
import './serverstage.css'
import type { ShopOut, ChestInfo, ShopItem } from '../services/api'
import type { Currencies } from '../types/game'
import { useGame } from '../services/ServiceProvider'
import { Card, Row, Btn, Slot, art, PAGE_BG, type ArtName } from '../components/PageArt'
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
function PriceBtn({ o, onBuy, disabled, small }: { o: Offer; onBuy: () => void; disabled?: boolean; small?: boolean }) {
  const { currencies } = useGame()
  const short = (o.price.gems ?? 0) > (currencies?.gems ?? 0) || (o.price.coins ?? 0) > (currencies?.coins ?? 0)
  return (
    <Btn className={`${small ? 'sm ' : ''}${short ? 'short' : ''}`} onClick={onBuy} disabled={disabled}>
      <img src={skySrc(o.price.gems != null ? 'ic_gem' : 'ic_coin')} alt="" />{priceLabel(o.price)}
    </Btn>
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
    <Row className="reveal of-row">
      <Slot src={ICON_ART[o.icon]}>{o.icon === 'potion3' && <i className="of-x">×3</i>}</Slot>
      <span className="ui-main">
        <b className="ui-t">{o.title}</b>
        <small className={`ui-s${msg ? ' of-msg' : ''}`}>{msg ?? status ?? o.note}</small>
      </span>
      <span className="ui-trail"><PriceBtn o={o} onBuy={go} disabled={disabled} /></span>
    </Row>
  )
}

/** http mode: the server's shop (offer notes, wardrobe items for gems) and chests (published odds) */
function useServerShop() {
  const { http, currencies } = useGame()
  const [shop, setShop] = useState<ShopOut | null>(null)
  const [chests, setChests] = useState<ChestInfo[] | null>(null)
  useEffect(() => {
    if (!http) return
    http.shop().then(setShop).catch(() => {}); http.chests().then(setChests).catch(() => {})
  }, [http, currencies?.gems])
  return { shop, chests, http }
}
/** one-line notes written for the row width (the server's longer notes do not fit a list row) */
const SHORT_NOTE: Record<string, string> = {
  hearts_full: 'Refill all hearts now', elixir_1: 'Keeps your heart on a lost boss', elixir_3: 'Best value for rescues',
  xp_boost: 'Faster levels, no league effect', freeze: 'Covers one missed day', coin_sack: '1,000 coins',
  chest_wood: 'Odds shown', chest_silver: 'Odds shown', chest_epic: 'Odds shown',
}
const withServer = (o: Offer, shop: ShopOut | null): Offer => {
  const so = shop?.offers.find((x) => x.id === o.id)
  return so ? { ...o, title: o.id === 'freeze' ? 'Frost Ward' : o.title, note: SHORT_NOTE[o.id] ?? o.note, price: so.price } : o
}

export function ShopScreen() {
  const { currencies, inventory, mode } = useGame()
  const { shop, chests, http } = useServerShop()
  const server = mode === 'http'
  // the server has no daily discount: the banner features one offer at its normal price
  const deal = server ? (() => { const d = dealOfTheDay(); const base = withServer({ ...d, id: d.id.replace(/^deal:/, ''), was: undefined }, shop); return { ...base, note: 'Featured today' } })() : dealOfTheDay()
  const dealLeft = useCountdown(dayEnd())
  const boost = useCountdown(inventory?.xpBoostUntil ?? 0)
  const fullHearts = !!currencies && currencies.hearts >= currencies.heartsMax

  return (
    <div className="screen pg">
      <img className="pg-bg" src={PAGE_BG.shop} alt="" draggable={false} />
      <div className="pg-scroll">
        {/* deal of the day */}
        <Card name="panel_banner" className="reveal sh-banner">
          <div className="sh-banner-main">
            <span className="sk sk-ribbon sh-ribbon">{server ? 'Featured' : `Deal · ${dealLeft.label}`}</span>
            <span className="sh-banner-t">{deal.title}</span>
            <span className="sh-banner-l">
              {deal.was && <s>{priceLabel(deal.was)}</s>}
              <img src={skySrc(deal.price.gems != null ? 'ic_gem' : 'ic_coin')} alt="" />{priceLabel(deal.price)}
            </span>
            <DealBuy deal={deal} bought={!server && !!inventory?.dealBought} />
          </div>
          <img className="sh-banner-art" src={ICON_ART[deal.icon]} alt="" draggable={false} />
        </Card>

        <ChestStrip />

        <div className="ui-h">Essentials</div>
        {ESSENTIALS.map((o) => withServer(o, shop)).map((o) => (
          <OfferRow key={o.id} o={o} disabled={o.id === 'hearts_full' && fullHearts}
            status={o.id === 'hearts_full' && fullHearts ? 'Hearts are full' : o.id.startsWith('elixir') ? `You have ${currencies?.potion ?? 0}` : undefined} />
        ))}

        <div className="ui-h">Boosts</div>
        {BOOSTS.map((o) => withServer(o, shop)).map((o) => (
          <OfferRow key={o.id} o={o}
            status={o.id === 'xp_boost' && boost.ms > 0 ? `Active · ${boost.label} left`
              : o.id === 'freeze' ? `You hold ${inventory?.freezes ?? 0} / 2` : undefined} />
        ))}

        <div className="ui-h">Chests</div>
        <div className="sh-grid3">
          {CHEST_OFFERS.map((o) => withServer(o, shop)).map((o) => <ChestCard key={o.id} o={o} odds={chests?.find((c) => 'chest_' + c.kind === o.id)?.odds} />)}
        </div>
        {server && <p className="ui-note">Tap a chest's name to see its odds. Chests hold coins, gems and elixirs, never wardrobe items.</p>}

        {server && shop && shop.items.length > 0 && <>
          <div className="ui-h">Wardrobe</div>
          <div className="sh-grid3">
            {shop.items.filter((it) => it.tier === 'gem').map((it) => <ItemCard key={it.id} it={it} onBuy={(id) => http!.buyItem(id)} />)}
          </div>
          <p className="ui-note">Looks only: nothing here changes your score. Boss treasures cannot be bought; win them.</p>
        </>}

        <div className="ui-h">Gems</div>
        <div className="sh-grid">
          {GEM_PACKS.map((p, i) => (
            <Card key={p.n} name="card_square" className="reveal sh-card">
              <img className="sh-card-art" src={art(GEM_ART[i])} alt="" draggable={false} />
              <span className="sh-card-n"><img src={art('gem_s')} alt="" />{p.n.toLocaleString('en-US')}</span>
              <Btn className="sm" disabled>{p.price}</Btn>
            </Card>
          ))}
        </div>
        <p className="ui-note">Gem packs open when store payments go live. Until then, earn gems from quests, achievements, chests, level-ups and the league.</p>
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
    <Btn onClick={go} disabled={bought}>{bought ? 'Bought' : msg ?? 'Buy'}</Btn>
  )
}

function ChestCard({ o, odds }: { o: Offer; odds?: { reward: string; min?: number; max?: number; amount?: number; chance: number }[] }) {
  const { buy, showReward } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const go = async () => {
    const r = await buy(o.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    showReward('Added to your chests', { chest: o.id.slice(6) as 'wood' })
  }
  return (
    <Card name="card_square" className="reveal sh-card">
      <img className="sh-card-art" src={ICON_ART[o.icon]} alt="" draggable={false} />
      <span className="sh-card-n" onClick={() => odds && setShow(!show)} role={odds ? 'button' : undefined}>{msg ?? o.title.replace(' Chest', '')}{odds ? ' ⓘ' : ''}</span>
      {show && odds && (
        <span className="sh-odds">{odds.map((x, i) => (
          <small key={i}>{Math.round(x.chance * 100)}% · {x.min != null ? `${x.min}–${x.max}` : x.amount} {x.reward === 'elixir' ? 'elixir' : x.reward}</small>
        ))}</span>
      )}
      <PriceBtn o={o} onBuy={go} small />
    </Card>
  )
}

const SLOT_ART: Record<string, ArtName> = { hair: 'qi_crystal', haircolor: 'qi_potion', eyes: 'qi_star', palette: 'qi_potion' }
/** a wardrobe item for gems (server catalogue); the 3D wardrobe's own thumbnail when it has one */
function ItemCard({ it, onBuy }: { it: ShopItem; onBuy: (id: string) => Promise<{ ok: boolean; reason?: string; currencies?: Currencies }> }) {
  const { currencies, setCurrencies } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [owned, setOwned] = useState(it.owned)
  const short = (it.price_gems ?? 0) > (currencies?.gems ?? 0)
  const go = async () => {
    const r = await onBuy(it.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    setOwned(true); if (r.currencies) setCurrencies(r.currencies)
  }
  return (
    <Card name="card_square" className="reveal sh-card">
      <ItemThumb className="sh-card-art" id={it.id} fallback={SLOT_ART[it.slot] ?? 'qi_star'} />
      <span className="sh-card-n sh-item-n" title={it.name}>{msg ?? it.name.replace(/\s*\(.*\)\s*$/, '')}</span>
      {owned ? <Btn className="sm" disabled>Owned</Btn>
        : <Btn className={`sm${short ? ' short' : ''}`} onClick={go}><img src={skySrc('ic_gem')} alt="" />{it.price_gems}</Btn>}
    </Card>
  )
}
