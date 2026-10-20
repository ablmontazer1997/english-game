import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { art } from '../components/PageArt'
import { useFullbody } from '../components/Portrait'
import pedestalArt from '../assets/es2/k/wd/pedestal.webp'
import './profilehero.css'
import './profile2.css'
import '../components/es2kit.css'
import spotArt from '../assets/es2/profile/stage.webp'   // the cleaned violet stage (no rays), cut to the arch shape
import tileArt from '../assets/es2/profile/tile.webp'

/*
 * The profile's hero showcase (admin 6225): a full-body PICTURE of the player's own hero standing on the gold pedestal in the
 * arch, in a spotlight. The 3D character loads only in the wardrobe ("Edit look"), which shoots this picture.
 *
 *   variant 'stage': full-width spotlight stage, name ribbon under the podium
 *   variant 'card' : a framed night-sky hero card, stats in a column beside it
 */
/** the ES2 perspective pedestal (GPT art, admin 5334): its top-ellipse centre as a fraction of its height, and its aspect */
const PODIUM_TOP = 0.31
const PODIUM_AR = 1024 / 365
/** heroH: the model's height (feet to hat tip) in px; podiumW: the podium's width in px */
type Ped = { src: string; aspect: number; top: number }
/** admin 6225: no 3D on the profile until "Edit look". The player's own hero as a full-body picture (shot by the wardrobe after every
 *  look change, the default look's picture before that), standing on the same pedestal; a tap bursts a few sparks. */
function HeroPic({ heroH, podiumW, ped }: { heroH: number; podiumW: number; ped?: Ped }) {
  const pic = useFullbody()
  const [burst, setBurst] = useState(0)
  const podiumH = podiumW / (ped?.aspect ?? PODIUM_AR)
  const feetY = podiumH * (1 - (ped?.top ?? PODIUM_TOP))
  return (
    <>
      <img className="ph-podium" src={ped?.src ?? pedestalArt} alt="" draggable={false} style={{ width: podiumW }} />
      <img className="ph-pic" src={pic.src} alt="" draggable={false}
        style={{ height: heroH, bottom: feetY - heroH * 0.012, transform: `translateX(${(-pic.cx * 100).toFixed(1)}%)` }} />
      <span className="ph-shadow" style={{ width: podiumW * 1.08, bottom: `calc(var(--pod-b) - ${Math.round(podiumW * 0.05)}px)` }} />
      {burst > 0 && (
        <span key={burst} className="ph-burst" aria-hidden style={{ bottom: feetY + heroH * 0.55 }}>
          {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ ['--k' as string]: i }} />)}
        </span>
      )}
      <button className="ph-tap" aria-label="Your hero" onClick={() => setBurst((b) => b + 1)}
        style={{ height: heroH, bottom: feetY, width: heroH * 0.55 }} />
    </>
  )
}

/** the stage backdrop: a soft glow and a slowly turning rune ring on the floor (admin 5325: no light rays from the top) */
function Spotlight({ ringY, ringW }: { ringY: number; ringW: number }) {
  return (
    <span className="ph-light" aria-hidden>
      <span className="ph-glow" />
      <span className="ph-ring" style={{ bottom: ringY, width: ringW, height: ringW * 0.34 }} />
      {Array.from({ length: 9 }, (_, i) => <i key={i} className="ph-spark" style={{ ['--i' as string]: i }} />)}
    </span>
  )
}

export function ProfileHeroStage({ name, level, onEdit, children }: {
  name: string; level: number; onEdit: () => void; children?: ReactNode
}) {
  return (
    <section className="ph ph-stage reveal">
      <div className="ph-show">
        <Spotlight ringY={62} ringW={300} />
        <HeroPic heroH={282} podiumW={200} />
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
  // everything in the card scales with the card's width (210 px on a 360 phone, 264 px at 414)
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(240)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth || 240))
    ro.observe(el); setW(el.clientWidth || 240)
    return () => ro.disconnect()
  }, [])
  const heroH = Math.round(Math.min(230, w * 0.9))   // the hat stays inside the arch opening
  const podiumW = Math.round(w * 0.66)
  // ES redesign concept 04 (admin 4935, finished 10-13 admin 5402): the b1 gold arch over the cleaned violet stage (no rays),
  // the live perspective pedestal, the name plate with the level disc, the stat tiles and the cream "Edit look" beside it
  return (
    <section className="ph ph-card ph-es2 reveal">
      <div className="ph-frame" ref={box} style={{ height: Math.round(Math.max(330, Math.min(390, w * 1.52))) }}>
        {/* admin 6108: the violet stage is clipped to the arch opening itself (the arch 9-slice, same slices), never a rectangle */}
        <span className="ph-spotclip" aria-hidden style={{ backgroundImage: `url(${spotArt})` }} />
        <Spotlight ringY={Math.round(podiumW * 0.36)} ringW={Math.round(w * 0.92)} />
        <HeroPic heroH={heroH} podiumW={podiumW} />
        <span className="ph-arch" aria-hidden />
        <div className="ph-foot">
          <span className="ph-lvl"><small>LV</small>{level}</span>
          <b className="ph-foot-t">{name}</b>
        </div>
      </div>
      <div className="ph-side">
        {stats.map((s) => (
          <div key={s.label} className="ph-sstat" style={{ backgroundImage: `url(${tileArt})` }}>
            <img src={s.icon} alt="" draggable={false} />
            <span><b>{s.value}</b><small>{s.label}</small></span>
          </div>
        ))}
        {/* secondary action: kit cream (gold is for claiming only); under the tiles so the name plate never truncates */}
        <button className="k-btn k-cream ph-edit2" onClick={onEdit}>Edit look</button>
      </div>
    </section>
  )
}
