// admin 6056/6062 (mockup B): the full-screen magic letter. One tall parchment scroll (GPT art, shown at its own
// aspect and scaled uniformly, never stretched) over the blurred world key art; the gold title ribbon across the top
// roll with live text; optionally the waving hero leaning on the ribbon. Everything inside is sized in container
// units (cqw = 1% of the scroll width), so the whole sheet scales as one picture. Extra phone height goes to the
// background. Used by the sign-in screen and the first-run intro.
import type { ReactNode } from 'react'
import scroll from '../assets/login/scroll_b.webp'
import heroWave from '../assets/login/hero_wave.webp'
import './scrollsheet.css'

const BASE = import.meta.env.BASE_URL

export function ScrollSheet({ title, hero, top, children, className }: {
  /** live text on the gold ribbon */
  title: string
  /** the waving hero above the ribbon (sign-in and the intro letter) */
  hero?: boolean
  /** small things above the scroll content (the intro step dots) */
  top?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`ssh${hero ? ' has-hero' : ''}${className ? ' ' + className : ''}`}>
      <div className="ssh-bg" style={{ backgroundImage: `url(${BASE}splash/splash.webp)` }} />
      <div className="ssh-stage">
        <div className="ssh-box">
          {hero && <img className="ssh-hero" src={heroWave} alt="" draggable={false} />}
          <img className="ssh-paper" src={scroll} alt="" draggable={false} />
          <div className="ssh-ribbon"><img src={`${BASE}splash/ribbon.webp`} alt="" draggable={false} /><span>{title}</span></div>
          <div className="ssh-body">
            {top}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
