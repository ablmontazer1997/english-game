import { useEffect, useRef, useState } from 'react'
import { TitleMark } from './TitleMark'
import './gametitle.css'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** The game's gold ribbon title as a short intro (admin 4602): centred over the board for ~1.5 s with a gentle
 *  scale-in, then a 400 ms fade, then gone for the rest of the game. It is out of the layout flow from the start
 *  (fixed overlay), so nothing moves when it leaves. Reduced motion: no intro at all. */
export function TitleIntro({ title, className = '' }: { title: string; className?: string }) {
  const [on, setOn] = useState(() => !reducedMotion())
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!on) return
    // one rAF timeline (not CSS keyframes): scale-in .42 s, hold to 1.5 s, fade .4 s, then unmount
    let raf = 0; const t0 = performance.now()
    const step = (now: number) => {
      const t = (now - t0) / 1000, r = el.current?.firstElementChild as HTMLElement | null
      if (t >= 1.9) { setOn(false); return }
      if (el.current && r) {
        const u = Math.min(1, t / 0.42), back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2)   // ease-out with a small overshoot
        r.style.transform = `scale(${0.8 + 0.2 * back})`
        el.current.style.opacity = String(Math.min(1, u * 1.6) * (t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.4) : 1))
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return null
  return (
    <div className="gt-intro" ref={el} style={{ opacity: 0 }} aria-hidden>
      <div className={`gt-mark ${className}`}><TitleMark tone="light" size="xl">{title}</TitleMark></div>
    </div>
  )
}

/** The shared crest every mini-game shows under the stage bar: the round counter pill stays in place; the gold
 *  ribbon with the game's name only plays as the intro above (it no longer takes a slot in the layout). */
export function GameTitle({ title, count }: { title: string; count?: string }) {
  return (
    <div className="gt gt-slim">
      <TitleIntro title={title} />
      {count && <GameProgress count={count} />}
    </div>
  )
}

/** ES redesign 10-11 (concepts 05 / 07): the round counter as a violet pill with a gold rim and one pip per round
 *  (done pips gold, the current one glowing). Shared by every mini-game through GameTitle's `count` ("Spell 2 / 5"). */
export function GameProgress({ count }: { count: string }) {
  const m = count.match(/(\d+)\s*\/\s*(\d+)/)
  const cur = m ? +m[1] : 0, total = m ? Math.min(+m[2], 12) : 0
  return (
    <div className={`gt-count${total ? ' gt-pp' : ''}`} aria-label={count}>
      <span className="gt-pp-t">{count}</span>
      {total > 0 && <span className="gt-pips" aria-hidden>{Array.from({ length: total }, (_, i) => <i key={i} className={i + 1 < cur ? 'done' : i + 1 === cur ? 'on' : ''} />)}</span>}
    </div>
  )
}
