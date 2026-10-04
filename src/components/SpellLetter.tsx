import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import book from '../data/spellbook.json'
import pTop from '../assets/spellbook/p_top.webp'
import pMid from '../assets/spellbook/p_mid.webp'
import pBot from '../assets/spellbook/p_bot.webp'
import seal from '../assets/spellbook/seal.webp'
import quill from '../assets/spellbook/quill.webp'
import lavender from '../assets/spellbook/lavender.webp'
import divider from '../assets/spellbook/divider.webp'
import { Panel, Btn } from './PageArt'
import './spellletter.css'

const ICONS = import.meta.glob('../assets/spellbook/icons/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const icon = (id: string) => ICONS[`../assets/spellbook/icons/${id}.webp`]

type Page = { t: string; s: string; ex: string[]; ic: string[]; mw: string; mr: string }
const PAGES = book as Record<string, Page>

export const hasLetter = (topicId?: string | null) => !!topicId && topicId in PAGES

// paper art: 853 px wide; caps 210 px tall (the bottom cap is the top one mirrored), the middle strip 240 px.
// The strip's ends match each other and both caps, so the paper is only ever whole strips: never stretched or cut.
const ART_W = 853, CAP = 210, STRIP = 240
const TEXT_TOP = 0.62, TEXT_BOT = 0   // how far into the top / bottom cap the text may reach (of the cap height)

/** **word** → the grammar word in red ink */
function Ink({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return <>{parts.map((p, i) => (i % 2 ? <em key={i}>{p}</em> : p))}</>
}

/** Spellbook page as an old letter that grows by whole paper strips with its content. A topic too long for the
 *  screen becomes two letters (admin 3669): title + intro + 2 examples, then the rest + the common mistake. */
export function SpellLetter({ topicId, level, children, onStart, startLabel = 'Start' }:
  { topicId: string; level: string; children?: ReactNode; onStart?: () => void; startLabel?: string }) {
  const pg = PAGES[topicId]
  const m = pg.t.match(/^(.*?)\s*\((.+)\)\s*$/)
  const main = m ? m[1] : pg.t
  const sub = m ? m[2] : ''
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ strips: 2, top: 0 })
  const [mode, setMode] = useState<'measure' | 'one' | 'two'>('measure')
  const [page, setPage] = useState(0)
  useLayoutEffect(() => { setMode('measure'); setPage(0) }, [topicId])
  // web fonts can add lines after the first layout: decide again once they are in
  useEffect(() => { document.fonts?.ready.then(() => setMode('measure')) }, [topicId])

  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !body.current) return
      const k = box.current.clientWidth / ART_W
      const cap = CAP * k, strip = STRIP * k
      const need = body.current.offsetHeight - cap * (TEXT_TOP + TEXT_BOT)
      const strips = Math.max(1, Math.ceil(need / strip))
      const top = Math.round(cap * TEXT_TOP + (strips * strip - need) * 0.3)
      setFit((f) => (f.strips === strips && f.top === top ? f : { strips, top }))
      // one letter must fit with the seal above it and the Start button below it, without scrolling
      const host = box.current.parentElement
      if (host) setMode((md) => {
        if (md !== 'measure') return md
        const cs = getComputedStyle(host)
        const room = host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 18 - 14 - 62
        return cap * 2 + strips * strip <= room ? 'one' : 'two'
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    if (body.current) ro.observe(body.current)
    return () => ro.disconnect()
  }, [topicId, mode, page])

  const two = mode === 'two'
  const ex = pg.ex.map((x, i) => [x, pg.ic[i]] as const)
  const shown = !two ? ex : page === 0 ? ex.slice(0, 2) : ex.slice(2)
  const head = !two || page === 0
  const tail = !two || page === 1
  return (
    <>
      <div className="sl" ref={box} style={mode === 'measure' ? { visibility: 'hidden' } : undefined}>
        <div className="sl-paper">
          <img src={pTop} alt="" draggable={false} />
          {Array.from({ length: fit.strips }, (_, i) => <img key={i} src={pMid} alt="" draggable={false} />)}
          <img src={pBot} alt="" draggable={false} />
        </div>
        <img className="sl-seal" src={seal} alt="" draggable={false} />
        <img className="sl-quill" src={quill} alt="" draggable={false} />
        <img className="sl-lav" src={lavender} alt="" draggable={false} />
        <div className="sl-body" ref={body} style={{ top: fit.top }}>
          <Panel name="ribbon_gold" className="sl-tag" inner="lobby-tag-in">Spellbook · {level}{two ? ` · ${page + 1}/2` : ''}</Panel>
          <h2 className={`sl-title${head ? '' : ' sm'}`}>{main}</h2>
          {head && sub && <p className="sl-subt">{sub}</p>}
          {head && <p className="sl-sum"><Ink text={pg.s} /></p>}
          <img className="sl-div" src={divider} alt="" draggable={false} />
          {shown.map(([x, ic], i) => (
            <div key={i} className="sl-row">
              <img src={icon(ic)} alt="" draggable={false} />
              <span><Ink text={x} /></span>
            </div>
          ))}
          {tail && (
            <div className={`sl-row sl-mis${(pg.mw + pg.mr).length > 30 ? ' col' : ''}`}>
              <s>{pg.mw}</s><i aria-hidden>➜</i><span><Ink text={pg.mr} /></span>
            </div>
          )}
          {tail && children}
        </div>
      </div>
      {two && page === 0 ? (
        <Btn className="lg sl-start" onClick={() => setPage(1)}>Next</Btn>
      ) : (
        <div className="sl-btns">
          {two && <Btn name="btn_gold" className="sl-back" onClick={() => setPage(0)}>Back</Btn>}
          <Btn className="lg sl-start" onClick={onStart}>{startLabel}</Btn>
        </div>
      )}
    </>
  )
}
