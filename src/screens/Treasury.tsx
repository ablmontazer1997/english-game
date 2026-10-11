import { Card, Btn, Chip, art } from '../components/PageArt'
import { ItemArt } from '../components/ItemArt'
import { skySrc } from '../components/SkyIcon'
import { useCountdown } from '../components/Rewards'
import type { StoreOut, WardrobeItem, Product } from '../services/api'
import { SWATCH } from './SeasonPassScreen'
import './treasury.css'
import './shop2.css'
import { RibbonH } from '../components/RibbonH'
import ribSmall from '../assets/es2/shop/rib_small.webp'
import pedestal from '../assets/es2/shop/pedestal.webp'
import gemsS from '../assets/es2/shop/gems_s.webp'
import gemsM from '../assets/es2/shop/gems_m.webp'
import gemsChest from '../assets/es2/shop/gems_chest.webp'

/** ES redesign 10-11: the concept's gem piles, smallest to the chest of gems */
export const PACK_PILE: Record<string, string> = { gems_100: gemsS, gems_300: gemsM, gems_1000: gemsChest }
export const PILE = [gemsS, gemsM, gemsChest]


// Phase D (admin 4839): English Spell's own real-money store. Decision 1 = D: no payment yet, so every buy button
// says "Coming soon" and no price is shown ("TBD"). The server switch (payments_enabled) turns the real flow on later.

/** a wardrobe thumbnail; recolours show their base garment with the dye dot (the 3D wardrobe's convention) */
function RThumb({ id, items }: { id: string; items: Record<string, WardrobeItem> }) {
  const sw = items[id]?.recolour?.swatch
  return (
    <span className="tsy-th">
      <ItemArt id={id} />
      {sw && <i className="tsy-dot" style={{ background: SWATCH[sw] ?? '#999' }} />}
    </span>
  )
}

const Soon = ({ p }: { p?: Product }) => (
  <Btn className="sm" disabled>{p?.available && p.price_label ? p.price_label : 'Coming soon'}</Btn>
)

export function Treasury({ st, premium, onSeason }: { st: StoreOut; premium: WardrobeItem[]; onSeason?: () => void }) {
  const items = Object.fromEntries(premium.map((i) => [i.id, i]))
  const byId = Object.fromEntries(st.products.map((p) => [p.id, p]))
  const starter = byId.starter_pack
  const left = useCountdown(st.starter.ends_at ?? 0)
  const packs = st.products.filter((p) => p.kind === 'gems')
  const prem = byId.premium_month
  return <>
    <RibbonH>Treasury</RibbonH>
    {!st.payments_enabled && <Chip className="tsy-soon tsy-h">Purchases coming soon</Chip>}

    {starter && st.starter.eligible && (
      <Card name="panel_wide" className="reveal tsy-starter">
        <span className="tsy-row1">
          <b className="ui-t">Starter Pack</b>
          <Chip className="tsy-left">{left.label}</Chip>
        </span>
        <span className="tsy-starter-th">
          {st.starter_items.map((id) => <RThumb key={id} id={id} items={items} />)}
          <span className="tsy-plus"><img src={skySrc('ic_gem')} alt="" />{st.starter_gems}</span>
        </span>
        <span className="tsy-row2">
          <small className="ui-s">The Wayfarer outfit and {st.starter_gems} gems. Once, in your first week only.</small>
          <Soon p={starter} />
        </span>
      </Card>
    )}

    <TreasuryPacks packs={packs} />

    {prem && (
      <Card className="reveal tsy-prem">
        <span className="tsy-row1"><b className="ui-t">Archmage Circle</b>{st.premium.active && <Chip>Active</Chip>}</span>
        <span className="tsy-prem-th">
          {[...st.premium.cloaks, ...st.premium.set.items].map((id) => <RThumb key={id} id={id} items={items} />)}
        </span>
        <span className="tsy-row2">
          <small className="ui-s">Star and Shadow cloaks, plus a new outfit every month. This month: the {st.premium.set.name} set.</small>
          <Soon p={prem} />
        </span>
      </Card>
    )}

    {onSeason && (
      <Card className="reveal tsy-season" onClick={onSeason}>
        <img src={art('trophy_big')} alt="" draggable={false} />
        <span className="tsy-season-main">
          <b className="ui-t">Season Pass</b>
          <small className="ui-s">The free track is open now. The premium track opens with the store.</small>
        </span>
        <span className="sk sk-green ui-btn sm">Open</span>
      </Card>
    )}
    <p className="ui-note">Purchases are not open yet and prices are not set. Until then, earn gems from quests, achievements, level-ups, the league and the Season Pass.</p>
  </>
}

/** Treasury gem packs as the concept's three cards (ribbons from the server's tags). Real money is off: "Coming soon". */
export function TreasuryPacks({ packs, onOpen }: { packs: Product[]; onOpen?: () => void }) {
  const TAG: Record<string, string> = { gems_300: 'Popular', gems_1000: 'Best value' }
  return (
    <div className="shp-grid shp-grid3 shp-tsy">
      {packs.map((p, i) => {
        const tag = p.tag ?? TAG[p.id]
        return (
          <div key={p.id} className={`shp-pack esk-enter${onOpen ? ' esk-press' : ''}`} style={{ ['--i' as string]: i }} onClick={onOpen} role={onOpen ? 'button' : undefined}>
            {tag && <span className="shp-pack-tag"><img src={ribSmall} alt="" draggable={false} /><b className="esk-title">{tag}</b></span>}
            <span className={`shp-stage s-pack${p.id === 'gems_1000' ? ' own' : ''}`}>
              {p.id !== 'gems_1000' && <img className="shp-ped" src={pedestal} alt="" draggable={false} />}
              <img className="shp-pack-art" src={PACK_PILE[p.id] ?? PILE[Math.min(i, 2)]} alt="" draggable={false} />
            </span>
            <span className="shp-pack-n"><img src={skySrc('ic_gem')} alt="" />{p.gems.toLocaleString('en-US')}</span>
            <span className="shp-soon">{p.available && p.price_label ? p.price_label : 'Coming soon'}</span>
          </div>
        )
      })}
    </div>
  )
}

