import { useEffect, useRef, useState, type ReactNode } from 'react'
import hero2d from '../assets/games/boss2/hero.webp'
import { art } from '../components/PageArt'
import { hero3dPage } from './MapHero'
import './profilehero.css'

/*
 * The profile's hero showcase: the player's own 3D character (the same small
 * hero page the map uses, lite models, transparent) standing on the gold
 * podium, big, in a spotlight. The page reports where the feet and the hat tip
 * land in its frame (rc-ready), so the frame is sized and placed to put the
 * feet exactly on the podium's top face. The painted hero stands in until the
 * 3D has drawn. Tapping the hero plays a short gesture.
 *
 *   variant 'stage': full-width spotlight stage, name ribbon under the podium
 *   variant 'card' : a framed night-sky hero card, stats in a column beside it
 */
const SRC = hero3dPage('&el=6&fps=40')
/** podium.png: where its top face centre is, as a fraction of its height */
const PODIUM_TOP = 0.33
const GESTURES = ['clap', 'fold_arms', 'cast_a_spell'] as const

type Frame = { gnd: number; top: number }

function useShowcase3d() {
  const ref = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [frame, setFrame] = useState<Frame>({ gnd: 0.7578, top: 0.2231 })
  const post = (m: Record<string, unknown>) => ref.current?.contentWindow?.postMessage(m, '*')
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return
      const d = e.data || {}
      if (d.type === 'rc-ready' && Array.isArray(d.gnd)) setFrame({ gnd: d.gnd[1], top: d.top[1] })
      if (d.type === 'rc-shown') {
        // face the viewer, turned a little to the light; a bow to greet
        post({ type: 'rc-map', yaw: 'cam', off: 0.32, snap: 1, fps: 40 })
        post({ type: 'rc-anim', name: 'bow', once: 1, speed: 1, fade: 0.25 })
        setReady(true)
      }
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])
  const g = useRef(0)
  const gesture = () => { post({ type: 'rc-anim', name: GESTURES[g.current++ % GESTURES.length], once: 1, fade: 0.2 }) }
  return { ref, ready, frame, gesture }
}

/** heroH: the model's height (feet to hat tip) in px; podiumW: the podium's width in px */
function Hero3d({ heroH, podiumW, h3 }: { heroH: number; podiumW: number; h3: ReturnType<typeof useShowcase3d> }) {
  const { frame } = h3
  const fh = Math.round(heroH / Math.max(0.2, frame.gnd - frame.top))
  const fw = Math.round(fh * 0.8)
  const podiumH = podiumW / 1.315
  const feetY = podiumH * (1 - PODIUM_TOP) // feet above the bottom of the podium box
  return (
    <>
      <img className="ph-podium" src={art('podium')} alt="" draggable={false} style={{ width: podiumW }} />
      <img className={`ph-2d${h3.ready ? ' off' : ''}`} src={hero2d} alt="" draggable={false}
        style={{ height: heroH * 1.02, bottom: feetY - heroH * 0.035 }} />
      <iframe ref={h3.ref} className={`ph-3d${h3.ready ? ' on' : ''}`} src={SRC} title="your hero" scrolling="no" tabIndex={-1}
        style={{ width: fw, height: fh, bottom: feetY - fh * (1 - frame.gnd) }} />
      <button className="ph-tap" aria-label="Your hero: tap for a gesture" onClick={h3.gesture}
        style={{ height: heroH, bottom: feetY, width: heroH * 0.55 }} />
    </>
  )
}

/** the stage backdrop: light rays, a soft glow and a slowly turning rune ring on the floor */
function Spotlight({ ringY, ringW }: { ringY: number; ringW: number }) {
  return (
    <span className="ph-light" aria-hidden>
      <span className="ph-rays" />
      <span className="ph-glow" />
      <span className="ph-ring" style={{ bottom: ringY, width: ringW, height: ringW * 0.34 }} />
      {Array.from({ length: 9 }, (_, i) => <i key={i} className="ph-spark" style={{ ['--i' as string]: i }} />)}
    </span>
  )
}

export function ProfileHeroStage({ name, level, onEdit, children }: {
  name: string; level: number; onEdit: () => void; children?: ReactNode
}) {
  const h3 = useShowcase3d()
  return (
    <section className="ph ph-stage reveal">
      <div className="ph-show">
        <Spotlight ringY={62} ringW={300} />
        <Hero3d heroH={282} podiumW={200} h3={h3} />
        <button className="sk sk-edit ui-btn ph-edit" onClick={onEdit}>Edit look</button>
      </div>
      <div className="ph-plate">
        <img className="ph-ribbon" src={art('ribbon_gold')} alt="" draggable={false} />
        <span className="ph-plate-t"><b>{name}</b></span>
        <span className="ph-lvl" title={`Level ${level}`}><small>LV</small>{level}</span>
      </div>
      {children}
    </section>
  )
}

export function ProfileHeroCard({ name, level, onEdit, stats }: {
  name: string; level: number; onEdit: () => void
  stats: { icon: string; value: ReactNode; label: string }[]
}) {
  const h3 = useShowcase3d()
  return (
    <section className="ph ph-card reveal">
      <div className="ph-frame">
        <span className="ph-sky" aria-hidden />
        <Spotlight ringY={50} ringW={220} />
        <Hero3d heroH={236} podiumW={150} h3={h3} />
        <div className="ph-foot">
          <span className="ph-lvl"><small>LV</small>{level}</span>
          <b className="ph-foot-t">{name}</b>
        </div>
      </div>
      <div className="ph-side">
        {stats.map((s) => (
          <div key={s.label} className="sk sk-stat ui-card ph-sstat">
            <img src={s.icon} alt="" draggable={false} />
            <span><b>{s.value}</b><small>{s.label}</small></span>
          </div>
        ))}
        <button className="sk sk-edit ui-btn ph-edit2" onClick={onEdit}>Edit look</button>
      </div>
    </section>
  )
}
