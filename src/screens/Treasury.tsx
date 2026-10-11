import { Card, Btn, Chip, art, type ArtName } from '../components/PageArt'
import { ItemThumb } from '../components/ItemThumb'
import { skySrc } from '../components/SkyIcon'
import { useCountdown } from '../components/Rewards'
import type { StoreOut, WardrobeItem, Product } from '../services/api'
import { SWATCH } from './SeasonPassScreen'
import './treasury.css'

// Phase D (admin 4839): English Spell's own real-money store. Decision 1 = D: no payment yet, so every buy button
// says "Coming soon" and no price is shown ("TBD"). The server switch (payments_enabled) turns the real flow on later.
const PACK_ART: Record<string, ArtName> = { gems_100: 'gem_s', gems_300: 'gem_m', gems_1000: 'gem_xl' }

/** a wardrobe thumbnail; recolours show their base garment with the dye dot (the 3D wardrobe's convention) */
function RThumb({ id, items }: { id: string; items: Record<string, WardrobeItem> }) {
  const sw = items[id]?.recolour?.swatch
  return (
    <span className="tsy-th">
      <ItemThumb id={id} />
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
    <div className="ui-h tsy-h">Treasury {!st.payments_enabled && <Chip className="tsy-soon">Coming soon</Chip>}</div>

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

    <div className="sh-grid3">
      {packs.map((p) => (
        <Card key={p.id} name="card_square" className="reveal sh-card tsy-pack">
          {p.tag && <span className="tsy-tag">{p.tag}</span>}
          <img className="sh-card-art" src={art(PACK_ART[p.id] ?? 'gem_m')} alt="" draggable={false} />
          <span className="sh-card-n"><img src={skySrc('ic_gem')} alt="" />{p.gems.toLocaleString('en-US')}</span>
          <Btn className="sm" disabled>{p.available && p.price_label ? p.price_label : 'Soon'}</Btn>
        </Card>
      ))}
    </div>

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
