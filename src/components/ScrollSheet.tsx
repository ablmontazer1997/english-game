// admin 6056/6062/6070: the full-screen magic letter = the approved mockup B itself. The base picture is mock B with its
// UI painted out (GPT masked edit, composited back only inside the UI areas): world, waving hero, empty gold ribbon,
// wide scroll with side rolls, compass, castle and seal, scaled uniformly to the phone width (never stretched). Extra
// phone height goes INTO the paper (admin 6103): the picture is cut in the plain middle (y 960) and a seamless paper strip
// repeats there (sides fade to the blurred splash world); the bottom-anchored slots move down with it.
// Live parts sit in FIXED slots measured on the mock (1cqw = 1% of the picture width = 9.41 mock px), identical on
// every screen that uses it (sign-in and every intro step): ribbon title, content box (scrolls inside when long),
// primary button, "or", secondary button(s). Only the content changes between screens.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import letterTop from '../assets/login/letter_top.webp'
import letterTile from '../assets/login/letter_tile.webp'
import letterBot from '../assets/login/letter_bot.webp'
import './scrollsheet.css'

const BASE = import.meta.env.BASE_URL

/** admin 6106: a button label never spills out of its pill: shrink its font step by step (to 14 px at least) */
function fitLabels(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.ssh-pri button, .ssh-sec button').forEach((b) => {
    b.style.fontSize = ''
    let fs = parseFloat(getComputedStyle(b).fontSize)
    for (let i = 0; i < 12 && fs > 14 && b.scrollWidth > b.clientWidth + 1; i++) { fs = Math.max(14, fs * 0.94); b.style.fontSize = fs + 'px' }
  })
}

export function ScrollSheet({ title = 'English Spell', top, children, primary, secondary, or, className }: {
  title?: string
  /** a small line on the paper just under the ribbon (the intro step dots) */
  top?: ReactNode
  /** the content box (heading, fields, cards, text) */
  children: ReactNode
  /** the main button slot */
  primary?: ReactNode
  /** the second button slot (one button, or a row of two) */
  secondary?: ReactNode
  /** the "or" divider between the two slots */
  or?: boolean
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = box.current; if (!el) return
    fitLabels(el)
    const ro = new ResizeObserver(() => fitLabels(el)); ro.observe(el)
    document.fonts?.ready.then(() => fitLabels(el)).catch(() => {})
    return () => ro.disconnect()
  })
  return (
    <div className={`ssh${className ? ' ' + className : ''}`}>
      <div className="ssh-bg" style={{ backgroundImage: `url(${BASE}splash/splash.webp)` }} />
      <div className="ssh-stage">
        <div className="ssh-box" ref={box}>
          {/* admin 6103: the paper grows with the phone: picture top (hero, ribbon, upper paper) + repeated plain paper
              strip + picture bottom (compass, castle, seal, roll); nothing is stretched */}
          <img className="ssh-art ssh-art-top" src={letterTop} alt="" draggable={false} />
          <div className="ssh-band" style={{ backgroundImage: `url(${letterTile})` }} />
          <img className="ssh-art ssh-art-bot" src={letterBot} alt="" draggable={false} />
          <div className="ssh-title"><span>{title}</span></div>
          {top && <div className="ssh-top">{top}</div>}
          <div className="ssh-body">{children}</div>
          {primary && <div className="ssh-pri">{primary}</div>}
          {or && <div className="ssh-or" aria-hidden><i /><span>or</span><i /></div>}
          {secondary && <div className="ssh-sec">{secondary}</div>}
        </div>
      </div>
    </div>
  )
}
