import { useEffect, useRef, useState } from 'react'
import { sfx } from '../services/audio'
import './serverstage.css'
import { api, errorText, type ShopOut, type ChestInfo, type WardrobeItem, type Merchant } from '../services/api'
import { wearItem } from '../services/look'
import { toCurrencies } from '../services/httpService'
import { useGame } from '../services/ServiceProvider'
import { Card, Row, Btn, Slot, Chip, art, type ArtName } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import { ChestStrip, useCountdown } from '../components/Rewards'
import { Treasury, TreasuryPacks, PILE } from './Treasury'
import { ESSENTIALS, BOOSTS, CHEST_OFFERS, GEM_PACKS, dealOfTheDay, priceLabel, type Offer, type OfferIcon } from '../services/shopCatalog'
import { dayEnd } from '../services/progress'
import './pages.css'
import '../components/progression.css'
import '../components/eskit.css'
import './shop2.css'
import { ItemArt } from '../components/ItemArt'
import { SWATCH } from './SeasonPassScreen'
import bgShop2 from '../assets/es2/shop/bg_shop2.webp'
import signArt from '../assets/es2/shop/sign.webp'
import tabOn from '../assets/es2/shop/tab_on.webp'
import tabOff from '../assets/es2/shop/tab_off.webp'
import ribFeatured from '../assets/es2/shop/rib_featured.webp'
import ribRed from '../assets/es2/shop/rib_red.webp'
import { RibbonH } from '../components/RibbonH'
import dyePink from '../assets/es2/shop/dye_pink.webp'
import awning from '../assets/es2/shop/awning.webp'
import lanternPost from '../assets/es2/shop/lantern_post.webp'
import pedestal from '../assets/es2/shop/pedestal.webp'

const ICON_ART: Record<OfferIcon, string> = {
  heart: skySrc('ic_heart'), potion: art('qi_potion'), potion3: art('qi_potion'), flame: art('qi_flame'), xp: skySrc('ic_energy'),
  coins: skySrc('ic_coin'), coins_big: skySrc('ic_coin'), wood: art('chest_wood'), silver: art('chest_silver'), epic: art('chest_epic'),
}
/** rarity of a wardrobe item for the card colour: the server's rarity, else coin items common, gem items rare / epic by price */
type Rarity = 'common' | 'rare' | 'epic'
const rarityOf = (it: WardrobeItem): Rarity => {
  const r = (it.rarity ?? '').toLowerCase()
  if (r === 'epic' || r === 'legendary') return 'epic'
  if (r === 'rare') return 'rare'
  if (r === 'common') return 'common'
  return it.tier === 'coin' ? 'common' : (it.price_gems ?? 0) >= 100 ? 'epic' : 'rare'
}
const RAR_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic' }
const RAR_OF_CHEST: Record<string, Rarity> = { chest_wood: 'common', chest_silver: 'rare', chest_epic: 'epic' }
type ShopTab = 'featured' | 'merchant' | 'chests' | 'treasury'
const TABS: { id: ShopTab; t: string }[] = [{ id: 'featured', t: 'Featured' }, { id: 'merchant', t: 'Merchant' }, { id: 'chests', t: 'Chests' }, { id: 'treasury', t: 'Treasury' }]

/** price button: coin or gem icon + amount; greys out when you can't afford it */
function PriceBtn({ o, onBuy, disabled, small, card }: { o: Offer; onBuy: () => void; disabled?: boolean; small?: boolean; card?: boolean }) {
  const { currencies } = useGame()
  const short = (o.price.gems ?? 0) > (currencies?.gems ?? 0) || (o.price.coins ?? 0) > (currencies?.coins ?? 0)
  return (
    <Btn className={`${small ? 'sm ' : ''}${card ? 'shp-cbtn ' : ''}${short ? 'short' : ''}`} onClick={onBuy} disabled={disabled}>
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
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!http) return
    http.shop().then(setShop).catch(() => {}); http.chests().then(setChests).catch(() => {})
  }, [http, currencies?.gems, currencies?.coins, v])
  return { shop, chests, http, refresh: () => setV((n) => n + 1) }
}
/** one-line notes written for the row width (the server's longer notes do not fit a list row) */
const SHORT_NOTE: Record<string, string> = {
  hearts_full: 'Refill all hearts now', elixir_1: 'Continue a lost stage, or keep a heart', elixir_3: 'Best value for rescues',
  xp_boost: 'Faster levels, no league effect', freeze: 'Covers one missed day', coin_sack: '1,000 coins for looks and hints',
  chest_wood: 'Odds shown', chest_silver: 'Odds shown', chest_epic: 'Odds shown',
}
const withServer = (o: Offer, shop: ShopOut | null): Offer => {
  const so = shop?.offers.find((x) => x.id === o.id)
  return so ? { ...o, title: o.id === 'freeze' ? 'Frost Ward' : o.title, note: SHORT_NOTE[o.id] ?? o.note, price: so.price } : o
}

export function ShopScreen({ onSeason }: { onSeason?: () => void } = {}) {
  const { currencies, inventory, mode } = useGame()
  const { shop, chests, refresh } = useServerShop()
  const server = mode === 'http'
  const [tab, setTab] = useState<ShopTab>(() => (new URLSearchParams(location.search).get('shoptab') as ShopTab | null) ?? 'featured')
  // the server has no daily discount: the banner features one offer at its normal price
  const deal = server ? (() => { const d = dealOfTheDay(); const base = withServer({ ...d, id: d.id.replace(/^deal:/, ''), was: undefined }, shop); return { ...base, note: 'Featured today' } })() : dealOfTheDay()
  const dealLeft = useCountdown(dayEnd())
  const boost = useCountdown(inventory?.xpBoostUntil ?? 0)
  const fullHearts = !!currencies && currencies.hearts >= currencies.heartsMax
  // the red ribbon shows a REAL saving only: a bundle against its single item, or the mock deal's struck price
  const saving = (() => {
    const one = deal.id.replace(/_3$/, '_1')
    if (deal.was) { const w = deal.was.gems ?? deal.was.coins ?? 0, p = deal.price.gems ?? deal.price.coins ?? 0; return w > p ? Math.round((1 - p / w) * 100) : 0 }
    if (one === deal.id) return 0
    const single = withServer(ESSENTIALS.find((o) => o.id === one) ?? deal, shop)
    const s1 = single.price.gems ?? 0, p3 = deal.price.gems ?? 0
    return s1 && p3 ? Math.max(0, Math.round((1 - p3 / (3 * s1)) * 100)) : 0
  })()
  const merchant = server ? shop?.merchant : undefined
  const packs = shop?.store?.products.filter((p) => p.kind === 'gems') ?? []
  const scrollRef = useRef<HTMLDivElement>(null)
  const pick = (t: ShopTab) => { setTab(t); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <div className="screen pg shp">
      <img className="pg-bg" src={bgShop2} alt="" draggable={false} />
      <div className="esk-scrim" />
      <div className="pg-scroll shp-scroll" ref={scrollRef}>
        <div className="shp-sign esk-enter"><img src={signArt} alt="" draggable={false} /><h1 className="esk-title">Shop</h1></div>
        <div className="shp-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`shp-tab esk-press${tab === t.id ? ' on' : ''}`} onClick={() => pick(t.id)}>
              <img src={tab === t.id ? tabOn : tabOff} alt="" draggable={false} /><span>{t.t}</span>
            </button>
          ))}
        </div>

        {tab === 'featured' && <>
          <div className="shp-feat esk-enter">
            <div className="shp-feat-in">
              <div className="esk-rays shp-feat-rays" />
              <i className="esk-spark" style={{ left: '62%', top: '12%' }} /><i className="esk-spark" style={{ left: '92%', top: '34%', animationDelay: '-1s' }} /><i className="esk-spark" style={{ left: '70%', top: '74%', animationDelay: '-.5s' }} />
              <div className="shp-feat-l">
                <span className="shp-rib-f"><img src={ribFeatured} alt="" draggable={false} /><b className="esk-title">Featured</b></span>
                <b className="shp-feat-t">{deal.title}</b>
                <span className="shp-feat-row">
                  {saving > 0 && <span className="shp-rib-r"><img src={ribRed} alt="" draggable={false} /><b className="esk-title">-{saving}%</b></span>}
                  <span className="shp-clock"><i aria-hidden />{dealLeft.label}</span>
                </span>
                <DealBuy deal={deal} bought={!server && !!inventory?.dealBought} />
              </div>
              {deal.icon === 'potion3'
                ? <span className="shp-feat-art shp-trio" aria-hidden><img className="shp-ped" src={pedestal} alt="" /><img className="esk-float" src={dyePink} alt="" /><img className="esk-float d1" src={dyePink} alt="" /><img className="esk-float d2" src={dyePink} alt="" /></span>
                : <img className="shp-feat-art esk-float" src={ICON_ART[deal.icon]} alt="" draggable={false} />}
            </div>
          </div>

          {merchant && <MerchantSection m={merchant} onDone={refresh} preview onMore={() => pick('merchant')} />}

          {server && packs.length > 0 && <>
            <RibbonH i={2}>Treasury</RibbonH>
            <TreasuryPacks packs={packs} onOpen={() => pick('treasury')} />
          </>}

          <RibbonH i={3}>Essentials</RibbonH>
          {ESSENTIALS.map((o) => withServer(o, shop)).map((o) => (
            <OfferRow key={o.id} o={o} disabled={o.id === 'hearts_full' && fullHearts}
              status={o.id === 'hearts_full' && fullHearts ? 'Hearts are full' : o.id.startsWith('elixir') ? `You have ${currencies?.potion ?? 0}` : undefined} />
          ))}
          <RibbonH i={4}>Boosts</RibbonH>
          {BOOSTS.map((o) => withServer(o, shop)).map((o) => (
            <OfferRow key={o.id} o={o}
              status={o.id === 'xp_boost' && boost.ms > 0 ? `Active · ${boost.label} left`
                : o.id === 'freeze' ? `You hold ${inventory?.freezes ?? 0} / 2` : undefined} />
          ))}
        </>}

        {tab === 'merchant' && <>
          {merchant && <MerchantSection m={merchant} onDone={refresh} />}
          {server && shop && shop.items.length > 0 && <>
            <RibbonH i={2}>Wardrobe</RibbonH>
            <div className="shp-grid">
              {[...shop.items.filter((it) => it.tier === 'coin'), ...shop.items.filter((it) => it.tier === 'gem')].map((it, i) => <ItemCard key={it.id} it={it} onDone={refresh} i={i} />)}
            </div>
            <p className="ui-note">Looks only: nothing here changes your score. Try anything on in Profile, Edit. Boss treasures and Hearthfire hats cannot be bought; win them.</p>
          </>}
          {!server && <p className="ui-note">The Merchant opens when you play online.</p>}
        </>}

        {tab === 'chests' && <>
          <ChestStrip />
          <div className="shp-grid shp-grid3">
            {CHEST_OFFERS.map((o) => withServer(o, shop)).map((o, i) => <ChestCard key={o.id} o={o} i={i} odds={chests?.find((c) => 'chest_' + c.kind === o.id)?.odds} />)}
          </div>
          {server && <p className="ui-note">Tap a chest's name to see its odds. Chests hold coins and elixirs, never gems or wardrobe items.</p>}
        </>}

        {tab === 'treasury' && (server && shop?.store ? <Treasury st={shop.store} premium={shop.premium ?? []} onSeason={onSeason} /> : <>
          <RibbonH>Treasury</RibbonH>
          <div className="shp-grid shp-grid3 shp-tsy">
            {GEM_PACKS.map((p, i) => (
              <div key={p.n} className="shp-pack esk-enter" style={{ ['--i' as string]: i }}>
                <img className="shp-pack-art" src={PILE[Math.min(i, 2)]} alt="" draggable={false} />
                <span className="shp-pack-n"><img src={skySrc('ic_gem')} alt="" />{p.n.toLocaleString('en-US')}</span>
                <span className="shp-soon">Coming soon</span>
              </div>
            ))}
          </div>
        </>)}
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
    <Btn className="shp-buy esk-press" onClick={go} disabled={bought}>
      {bought ? 'Bought' : msg ?? <><img src={skySrc(deal.price.gems != null ? 'ic_gem' : 'ic_coin')} alt="" />{priceLabel(deal.price)}{deal.price.gems != null ? ' gems' : ' coins'}</>}
    </Btn>
  )
}

function ChestCard({ o, odds, i = 0 }: { o: Offer; i?: number; odds?: { reward: string; min?: number; max?: number; amount?: number; chance: number }[] }) {
  const { buy, showReward } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const go = async () => {
    const r = await buy(o.id)
    if (!r.ok) { setMsg(r.reason ?? 'Not possible'); setTimeout(() => setMsg(null), 2200); return }
    showReward('Added to your chests', { chest: o.id.slice(6) as 'wood' })
  }
  const rar = RAR_OF_CHEST[o.id] ?? 'common'
  return (
    <div className={`shp-rc r-${rar} esk-enter`} style={{ ['--i' as string]: i }}>
      <div className="shp-rc-top">
        <span className="shp-rar">{RAR_LABEL[rar]}</span>
        <span className="shp-stage s-chest">
          <img className="shp-ped" src={pedestal} alt="" draggable={false} />
          <img className={`shp-rc-art esk-float d${i % 4}`} src={ICON_ART[o.icon]} alt="" draggable={false} />
        </span>
      </div>
      <div className="shp-rc-b">
        <span className="shp-rc-n" onClick={() => odds && setShow(!show)} role={odds ? 'button' : undefined}>{msg ?? o.title.replace(' Chest', '')}{odds ? ' ⓘ' : ''}</span>
        {show && odds && (
          <span className="sh-odds">{odds.map((x, k) => (
            <small key={k}>{Math.round(x.chance * 100)}% · {x.min != null ? `${x.min}–${x.max}` : x.amount} {x.reward === 'elixir' ? 'elixir' : x.reward}</small>
          ))}</span>
        )}
        <PriceBtn o={o} onBuy={go} card />
      </div>
    </div>
  )
}

const SLOT_ART: Record<string, ArtName> = { hair: 'qi_crystal', haircolor: 'qi_potion', eyes: 'qi_star' }

/** a two-tap buy: the first tap asks "Sure?", the second spends (3 s to change your mind) */
function useConfirm() {
  const [armed, setArmed] = useState(false)
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 6000); return () => clearTimeout(t) }, [armed])
  return { armed, arm: () => setArmed(true), disarm: () => setArmed(false) }
}

/** price chip inside a button: coin or gem icon + amount */
const Price = ({ it }: { it: WardrobeItem }) => (
  <><img src={skySrc(it.tier === 'coin' ? 'ic_coin' : 'ic_gem')} alt="" />{(it.tier === 'coin' ? it.price_coins : it.price_gems)?.toLocaleString('en-US')}</>
)

/** a wardrobe item of the one catalogue: buy in place (server price), then Wear */
function ItemCard({ it, onDone, i = 0 }: { it: WardrobeItem; onDone?: () => void; i?: number }) {
  const { currencies, setCurrencies } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [owned, setOwned] = useState(it.owned)
  const [worn, setWorn] = useState(false)
  const [busy, setBusy] = useState(false)
  const c = useConfirm()
  useEffect(() => setOwned(it.owned), [it.owned])
  const cost = (it.tier === 'coin' ? it.price_coins : it.price_gems) ?? 0
  const short = cost > ((it.tier === 'coin' ? currencies?.coins : currencies?.gems) ?? 0)
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2200) }
  const go = async () => {
    if (short) { say(it.tier === 'coin' ? 'Not enough coins' : 'Not enough gems'); return }
    if (!c.armed) { c.arm(); return }
    c.disarm(); setBusy(true)
    try {
      const r = await api.wardrobeBuy(it.id)
      setOwned(true); sfx('reveal'); setCurrencies(toCurrencies(r.wallet)); onDone?.()
    } catch (e) { say(errorText(e)) }
    setBusy(false)
  }
  const wear = async () => {
    setBusy(true)
    try { await wearItem(it.slot, it.id); setWorn(true) } catch (e) { say(errorText(e)) }
    setBusy(false)
  }
  const rar = rarityOf(it)
  const label = it.slot === 'haircolor' ? `${it.name} dye` : it.name
  return (
    <div className={`shp-rc r-${rar} esk-enter`} style={{ ['--i' as string]: i }}>
      <div className="shp-rc-top">
        <span className="shp-rar">{RAR_LABEL[rar]}</span>
        <span className={`shp-stage s-${it.slot}`}>
          <img className="shp-ped" src={pedestal} alt="" draggable={false} />
          <ItemArt className={`shp-rc-art esk-float d${i % 4}`} id={it.id} fallback={SLOT_ART[it.slot] ?? 'qi_star'} />
        </span>
        {it.recolour?.swatch && <i className="shp-dot" style={{ background: SWATCH[it.recolour.swatch] ?? '#999' }} />}
      </div>
      <div className="shp-rc-b">
        <span className="shp-rc-n" title={label}>{msg ?? label}</span>
        {owned ? <Btn className="shp-cbtn" name={worn ? 'btn_gold' : 'btn_green'} disabled={busy || worn} onClick={wear}>{worn ? 'Worn' : 'Wear'}</Btn>
          : <Btn className={`shp-cbtn${short ? ' short' : ''}`} name={c.armed ? 'btn_gold' : 'btn_green'} disabled={busy} onClick={go}>{c.armed ? 'Sure?' : <Price it={it} />}</Btn>}
      </div>
    </div>
  )
}

/** the Wandering Merchant: 4 items + one set, the same for everyone, rotating every Monday (audit 5.3 C) */
function MerchantSection({ m, onDone, preview, onMore }: { m: Merchant; onDone: () => void; preview?: boolean; onMore?: () => void }) {
  const left = useCountdown(m.ends_at)
  const { currencies, setCurrencies } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const c = useConfirm()
  const set = m.set
  const short = set.price_gems > (currencies?.gems ?? 0)
  const buySet = async () => {
    if (short) { setMsg('Not enough gems'); setTimeout(() => setMsg(null), 2200); return }
    if (!c.armed) { c.arm(); return }
    c.disarm(); setBusy(true)
    try { const r = await api.buySet(set.id); sfx('reveal'); setCurrencies(toCurrencies(r.wallet)); onDone() } catch (e) { setMsg(errorText(e)); setTimeout(() => setMsg(null), 2200) }
    setBusy(false)
  }
  return <section className="shp-merch esk-enter" style={{ ['--i' as string]: 1 }}>
    <div className="shp-awn"><img src={awning} alt="" draggable={false} /><h2 className="esk-title">Wandering Merchant</h2></div>
    <img className="shp-post l" src={lanternPost} alt="" draggable={false} />
    <img className="shp-post r" src={lanternPost} alt="" draggable={false} />
    <div className="shp-board">
      <Chip className="shp-left">New wares in {left.label}</Chip>
      <div className="shp-grid">
        {m.items.map((it, i) => <ItemCard key={it.id} it={it} onDone={onDone} i={i} />)}
      </div>
      {preview ? (onMore && <button className="shp-more esk-press" onClick={onMore}>See the set and all wares ›</button>) : <>
        <Card className="reveal wm-set">
          <span className="wm-set-th">{set.items.map((it) => <ItemArt key={it.id} id={it.id} fallback={SLOT_ART[it.slot] ?? 'qi_star'} />)}</span>
          <span className="wm-set-main">
            <b className="ui-t">{set.name}</b>
            <small className="ui-s">{msg ?? (set.owned_all ? 'You own the whole set' : `${set.items.filter((i) => !i.owned).length} items · 20% off`)}</small>
          </span>
          {set.owned_all ? <Btn className="sm" disabled>Owned</Btn> : (
            <span className="wm-set-buy">
              {set.full_gems > set.price_gems && <s>{set.full_gems}</s>}
              <Btn className={`sm${short ? ' short' : ''}`} name={c.armed ? 'btn_gold' : 'btn_green'} disabled={busy} onClick={buySet}>
                {c.armed ? 'Sure?' : <><img src={skySrc('ic_gem')} alt="" />{set.price_gems}</>}
              </Btn>
            </span>
          )}
        </Card>
        <p className="ui-note">New wares every Monday. Epic cloaks and sets are sold only here, and some return months later.</p>
      </>}
    </div>
  </section>
}
