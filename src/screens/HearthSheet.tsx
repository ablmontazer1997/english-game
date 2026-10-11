// The Hearthfire (daily streak) with its Frost Wards: what keeps it burning, and the ward shop row.
import { useGame } from '../services/ServiceProvider'
import { Sheet } from '../components/Sheet'
import { useState } from 'react'
import { art, Row, Slot, Btn } from '../components/PageArt'
import { skySrc } from '../components/SkyIcon'
import { OfferRow } from './ShopScreen'
import type { Offer } from '../services/shopCatalog'
import './screens.css'
import './pages.css'
import './serverstage.css'
import '../components/progression.css'

const WARD: Offer = { id: 'freeze', title: 'Frost Ward', note: 'Covers one missed day', icon: 'flame', price: { coins: 300 } }

export function HearthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { streak, currencies, repairStreak } = useGame()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sure, setSure] = useState(false)
  if (!open || !streak) return null
  const rep = streak.repair
  const short = !!rep && (currencies?.gems ?? 0) < rep.cost_gems
  const repair = async () => {
    if (!rep) return
    if (short) { setMsg(`You need ${rep.cost_gems - (currencies?.gems ?? 0)} more gems`); return }
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 6000); return }
    setBusy(true); setSure(false)
    const r = await repairStreak()
    setBusy(false)
    setMsg(r.ok ? 'It burns again!' : r.reason ?? 'Not possible')
  }
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
        {rep && (
          <Row className="reveal of-row hf-repair">
            <Slot src={art('qi_flame')} />
            <span className="ui-main">
              <b className="ui-t">Relight {rep.restores} days</b>
              <small className={`ui-s${msg ? ' of-msg' : ''}`}>{msg ?? 'Your fire went out'}</small>
            </span>
            <span className="ui-trail">
              <Btn name={sure ? 'btn_gold' : 'btn_green'} className={short ? 'short' : ''} disabled={busy} onClick={repair}>
                {sure ? 'Sure?' : <><img src={skySrc('ic_gem')} alt="" />{rep.cost_gems}</>}
              </Btn>
            </span>
          </Row>
        )}
        <p className="ss-note">{streak.rule}</p>
        <div className="hf-wards" aria-label={`${streak.freezes} of ${streak.freezes_max} Frost Wards`}>
          {Array.from({ length: streak.freezes_max }, (_, i) => <span key={i} className={i < streak.freezes ? 'on' : ''}>❄</span>)}
          <small>Frost Wards cover a missed day by themselves.</small>
        </div>
        <OfferRow o={WARD} disabled={streak.freezes >= streak.freezes_max || streak.current === 0}
          status={streak.freezes >= streak.freezes_max ? 'You hold 2 / 2' : streak.current === 0 ? 'Needs a lit Hearthfire' : `You hold ${streak.freezes} / ${streak.freezes_max}`} />
      </div>
    </Sheet>
  )
}
