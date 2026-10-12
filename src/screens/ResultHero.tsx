import { useEffect, useRef, useState } from 'react'
import { use3dFallback } from '../components/use3dFallback'
import { hero3dPage } from './MapHero'
import hero2d from '../assets/games/boss2/hero.webp'
import pedestal from '../assets/es2/k/p13/rune_pedestal.webp'

/*
 * ES2 concept 13 (admin 5202): the player's own 3D hero (the same small hero page the map uses) standing on the
 * painted rune pedestal of the result screen. The page reports where the feet and the hat tip land in its frame
 * (rc-ready), so the frame is placed to put the feet on the pedestal's top face. The painted hero only stands in
 * when the 3D has not drawn after a few seconds. `win` plays a short cheer once the hero is shown.
 */
const SRC = hero3dPage('&el=6&fps=40')
/** rune_pedestal.webp (322 x 95): the top face centre, as a fraction of its height from the top */
const TOP_FACE = 0.34

export function ResultHero({ heroH: h0, pedW: w0, win = false }: { heroH?: number; pedW?: number; win?: boolean }) {
  // short phones keep the whole result (cards, drop, Continue) on one screen: a smaller hero
  const short = typeof innerHeight === 'number' && innerHeight < 800
  const heroH = h0 ?? (short ? 118 : 158), pedW = w0 ?? (short ? 150 : 180)
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [frame, setFrame] = useState({ gnd: 0.7578, top: 0.2231 })
  const fb = use3dFallback(ready, false, 4000)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return
      const d = e.data || {}
      if (d.type === 'rc-ready' && Array.isArray(d.gnd)) setFrame({ gnd: d.gnd[1], top: d.top[1] })
      if (d.type === 'rc-shown') {
        const w = ref.current.contentWindow
        w?.postMessage({ type: 'rc-map', yaw: 'cam', off: 0.32, snap: 1, fps: 40 }, '*')
        if (win) w?.postMessage({ type: 'rc-anim', name: 'clap', once: 1, fade: 0.2 }, '*')
        setReady(true)
      }
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [win])
  const pedH = pedW * 95 / 322
  const feetY = pedH * (1 - TOP_FACE)
  const fh = Math.round(heroH / Math.max(0.2, frame.gnd - frame.top))
  const fw = Math.round(fh * 0.8)
  return (
    <div className="rh" style={{ width: Math.max(pedW, fw), height: heroH + feetY + 6 }} aria-hidden>
      <img className="rh-ped" src={pedestal} alt="" draggable={false} style={{ width: pedW }} />
      <img className={`rh-2d${ready || !fb ? ' off' : ''}`} src={hero2d} alt="" draggable={false}
        style={{ height: heroH * 1.02, bottom: feetY - heroH * 0.035 }} />
      <iframe ref={ref} className={`rh-3d${ready ? ' on' : ''}`} src={SRC} title="your hero" scrolling="no" tabIndex={-1}
        style={{ width: fw, height: fh, bottom: feetY - fh * (1 - frame.gnd) }} />
    </div>
  )
}
