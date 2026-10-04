import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import book from '../data/spellbook.json'
import pTop from '../assets/spellbook/p_top.webp'
import pMid from '../assets/spellbook/p_mid.webp'
import pBot from '../assets/spellbook/p_bot.webp'
import seal from '../assets/spellbook/seal.webp'
import quill from '../assets/spellbook/quill.webp'
import lavender from '../assets/spellbook/lavender.webp'
import divider from '../assets/spellbook/divider.webp'
import { Panel } from './PageArt'
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

/** Spellbook page as an old letter that grows by whole paper strips with its content. */
export function SpellLetter({ topicId, level, children }: { topicId: string; level: string; children?: ReactNode }) {
  const pg = PAGES[topicId]
  const m = pg.t.match(/^(.*?)\s*\((.+)\)\s*$/)
  const main = m ? m[1] : pg.t
  const sub = m ? m[2] : ''
  const box = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ strips: 2, top: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !body.current) return
      const k = box.current.clientWidth / ART_W
      const cap = CAP * k, strip = STRIP * k
      const need = body.current.offsetHeight - cap * (TEXT_TOP + TEXT_BOT)
      const strips = Math.max(1, Math.ceil(need / strip))
      const top = Math.round(cap * TEXT_TOP + (strips * strip - need) * 0.3)
      setFit((f) => (f.strips === strips && f.top === top ? f : { strips, top }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    if (body.current) ro.observe(body.current)
    return () => ro.disconnect()
  }, [topicId])

  return (
    <div className="sl" ref={box}>
      <div className="sl-paper">
        <img src={pTop} alt="" draggable={false} />
        {Array.from({ length: fit.strips }, (_, i) => <img key={i} src={pMid} alt="" draggable={false} />)}
        <img src={pBot} alt="" draggable={false} />
      </div>
      <img className="sl-seal" src={seal} alt="" draggable={false} />
      <img className="sl-quill" src={quill} alt="" draggable={false} />
      <img className="sl-lav" src={lavender} alt="" draggable={false} />
      <div className="sl-body" ref={body} style={{ top: fit.top }}>
        <Panel name="ribbon_gold" className="sl-tag" inner="lobby-tag-in">Spellbook · {level}</Panel>
        <h2 className="sl-title">{main}</h2>
        {sub && <p className="sl-subt">{sub}</p>}
        <p className="sl-sum"><Ink text={pg.s} /></p>
        <img className="sl-div" src={divider} alt="" draggable={false} />
        {pg.ex.map((x, i) => (
          <div key={i} className="sl-row">
            <img src={icon(pg.ic[i])} alt="" draggable={false} />
            <span><Ink text={x} /></span>
          </div>
        ))}
        <div className={`sl-row sl-mis${(pg.mw + pg.mr).length > 30 ? ' col' : ''}`}>
          <s>{pg.mw}</s><i aria-hidden>➜</i><span><Ink text={pg.mr} /></span>
        </div>
        {children}
      </div>
    </div>
  )
}
