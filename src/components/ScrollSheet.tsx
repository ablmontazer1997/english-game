// admin 6056/6062/6070: the full-screen magic letter = the approved mockup B itself. The base picture is mock B with its
// UI painted out (GPT masked edit, composited back only inside the UI areas): world, waving hero, empty gold ribbon,
// wide scroll with side rolls, compass, castle and seal. It is shown whole at its own aspect (941 x 1672, scaled
// uniformly, never stretched); extra phone height shows the splash world blurred behind it.
// Live parts sit in FIXED slots measured on the mock (1cqw = 1% of the picture width = 9.41 mock px), identical on
// every screen that uses it (sign-in and every intro step): ribbon title, content box (scrolls inside when long),
// primary button, "or", secondary button(s). Only the content changes between screens.
import type { ReactNode } from 'react'
import letter from '../assets/login/letter_b.webp'
import './scrollsheet.css'

const BASE = import.meta.env.BASE_URL

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
  return (
    <div className={`ssh${className ? ' ' + className : ''}`}>
      <div className="ssh-bg" style={{ backgroundImage: `url(${BASE}splash/splash.webp)` }} />
      <div className="ssh-stage">
        <div className="ssh-box">
          <img className="ssh-art" src={letter} alt="" draggable={false} />
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
