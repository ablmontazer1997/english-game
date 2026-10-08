import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { POTIONS } from './banks/potion'
import { fromSrv, levelOf, makeScore, pick, shuffle, speak } from './kit'
import { sfx } from '../services/audio'
import bgPlate from '../assets/games/potion/pm_bg.webp'
import b1 from '../assets/games/potion/pm_bottle1.webp'
import b2 from '../assets/games/potion/pm_bottle2.webp'
import b3 from '../assets/games/potion/pm_bottle3.webp'
import b4 from '../assets/games/potion/pm_bottle4.webp'
import b5 from '../assets/games/potion/pm_bottle5.webp'
import './scene.css'
import './potionmix.css'

// Potion Mix — word building. Every bottle holds a piece of a word (a prefix, a
// root, a suffix). Pour the right pieces in the right order and brew: the word
// rises out of the cauldron. The wrong mix puffs into smoke.
// Pouring is animated: the bottle flies over the cauldron, tips, a stream of its
// own colour runs into the brew, it splashes, and the brew takes on the colour.

const ROUNDS = 6
const BOTTLES = [b1, b2, b3, b4, b5]
const LIQUID = ['#8224d6', '#0772f3', '#da1f75', '#e8a504', '#05a296'] // matches each bottle's liquid
const POUR_MS = 1700, LAND_MS = 700

type Fly = { id: number; key: number; src: string; color: string; x0: number; y0: number; w: number; h: number; cx: number; sy: number }

function mix(colors: string[]) {
  if (!colors.length) return '#b27cff'
  const c = colors.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const avg = [0, 1, 2].map((k) => Math.round(c.reduce((s, x) => s + x[k], 0) / c.length))
  return '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join('')
}

// the flying bottle, its stream and the splash; coordinates are in the game root's box
function PourFx({ f }: { f: Fly }) {
  const bottle = useRef<HTMLImageElement>(null), stream = useRef<HTMLDivElement>(null), splash = useRef<HTMLDivElement>(null)
  // pour pose: bottle tipped 115deg to the right, its mouth just left of the brew centre
  const tilt = 115, rad = tilt * Math.PI / 180
  const bx = f.cx - Math.sin(rad) * f.h * 0.5 - f.w * 0.1, by = f.sy - f.h * 1.2
  const mouthX = bx + f.w / 2 + Math.sin(rad) * f.h * 0.5, mouthY = by + f.h / 2 - Math.cos(rad) * f.h * 0.5
  useLayoutEffect(() => {
    const dx = bx - f.x0, dy = by - f.y0
    bottle.current?.animate([
      { transform: 'translate(0,0) rotate(0deg)', offset: 0 },
      { transform: `translate(${dx * 0.55}px,${dy - 40}px) rotate(20deg)`, offset: 0.14 },
      { transform: `translate(${dx}px,${dy}px) rotate(${tilt}deg)`, offset: 0.26 },
      { transform: `translate(${dx}px,${dy + 4}px) rotate(${tilt + 6}deg)`, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) rotate(${tilt}deg)`, offset: 0.7 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 30}px) rotate(10deg)`, offset: 0.86 },
      { transform: 'translate(0,0) rotate(0deg)', offset: 1 },
    ], { duration: POUR_MS, easing: 'ease-in-out', fill: 'both' })
    stream.current?.animate([
      { transform: 'scaleY(0)', opacity: 0, offset: 0 },
      { transform: 'scaleY(0)', opacity: 1, offset: 0.25 },
      { transform: 'scaleY(1)', opacity: 1, offset: 0.36 },
      { transform: 'scaleY(1) scaleX(1)', opacity: 1, offset: 0.62 },
      { transform: 'scaleY(1) scaleX(.35)', opacity: 0.9, offset: 0.7 },
      { transform: 'scaleY(0) scaleX(.2)', opacity: 0, offset: 0.76, transformOrigin: 'bottom' },
      { transform: 'scaleY(0)', opacity: 0, offset: 1 },
    ], { duration: POUR_MS, fill: 'both' })
    splash.current?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.36 }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.72 }, { opacity: 0 }],
      { duration: POUR_MS, fill: 'both' })
  }, [])
  const style = { '--liq': f.color } as React.CSSProperties
  return (
    <div className="pm-fx" style={style} aria-hidden>
      <img ref={bottle} className="pm-fly" src={f.src} alt="" style={{ left: f.x0, top: f.y0, width: f.w, height: f.h }} />
      <div ref={stream} className="pm-stream" style={{ left: mouthX - 5, top: mouthY, height: Math.max(10, f.sy - mouthY) }} />
      <div ref={splash} className="pm-splash" style={{ left: mouthX, top: f.sy }}>
        <i /><i /><i /><i /><i /><i /><b />
      </div>
    </div>
  )
}

export function PotionMix({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const recipes = useMemo(() => fromSrv(srv, () => pick(POTIONS[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const r = recipes[round]
  const shelf = useMemo(() => shuffle([...r.parts, ...r.extra].map((t, id) => ({ id, t }))), [r])
  const [poured, setPoured] = useState<number[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const [fly, setFly] = useState<Fly | null>(null)
  const [score] = useState(makeScore)
  const root = useRef<HTMLDivElement>(null), surface = useRef<HTMLSpanElement>(null)
  const flyKey = useRef(0)

  useEffect(() => { setPoured([]); setState('play'); setFly(null) }, [r])

  const text = (id: number) => shelf.find((b) => b.id === id)!.t
  const colorOf = (id: number) => LIQUID[id % LIQUID.length]
  const brewColor = mix(poured.map(colorOf))

  const pour = (id: number, el: HTMLElement) => {
    if (state !== 'play' || fly || poured.includes(id) || poured.length >= 4) return
    const R = root.current!.getBoundingClientRect(), img = el.querySelector('img')!.getBoundingClientRect(), S = surface.current!.getBoundingClientRect()
    const f: Fly = { id, key: ++flyKey.current, src: BOTTLES[id % BOTTLES.length], color: colorOf(id),
      x0: img.left - R.left, y0: img.top - R.top, w: img.width, h: img.height, cx: S.left + S.width / 2 - R.left, sy: S.top + S.height * 0.55 - R.top }
    setFly(f); sfx('pour', 0.9)
    setTimeout(() => { setPoured((p) => [...p, id]); sfx('pop', 0.45) }, LAND_MS)
    setTimeout(() => setFly((x) => (x?.key === f.key ? null : x)), POUR_MS)
  }
  const unpour = (id: number) => { if (state === 'play' && !fly) setPoured(poured.filter((x) => x !== id)) }

  // hint: keep the right start of the mix and pour the next right bottle
  useHint(() => {
    if (state !== 'play' || fly) return false
    let k = 0
    while (k < poured.length && text(poured[k]) === r.parts[k]) k++
    if (k >= r.parts.length) return false
    const id = shelf.find((b) => b.t === r.parts[k] && !poured.slice(0, k).includes(b.id))!.id
    setPoured([...poured.slice(0, k), id]); return true
  })

  function brew() {
    if (state !== 'play' || fly || !poured.length) return
    const ok = poured.length === r.parts.length && poured.every((id, i) => text(id) === r.parts[i])
    if (r._qid) onAnswer?.(r._qid, ok ? r.answer : poured.map(text).join(''), ok)
    setState(ok ? 'ok' : 'bad')
    if (ok) {
      score.hit(); sfx('brew'); speak(r.answer)
      setTimeout(() => { if (round + 1 >= recipes.length) onFinish(score.out(recipes.length)); else setRound(round + 1) }, 1900)
    } else {
      score.miss(); sfx('whoosh', 0.5)
      setTimeout(() => { setPoured([]); setState('play') }, 1200)
    }
  }

  return (
    <div ref={root} className={`gs pm pm-${state}${poured.length ? ' pm-filled' : ''}`} style={{ '--brew': brewColor } as React.CSSProperties}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <span ref={surface} className="gs-at pm-surface" aria-hidden />
        <span className="gs-at pm-bubbles" aria-hidden><i /><i /><i /><i /><i /><i /><i /></span>
        <span className="gs-at pm-burst" aria-hidden><i /><i /><i /><i /><i /><i /><i /><i /></span>
        <span className="gs-at pm-smoke" aria-hidden><i /><i /><i /></span>
      </div>
      <div className="gs-title"><GameTitle title="Potion Mix" count={`Potion ${round + 1} / ${recipes.length}`} /></div>

      <div className="gs-ui gs-panel pm-goal"><Task className="gtask-row" icon="build" text="Brew a word that means:" sub="Pour the right bottles in" first={round === 0} /><p>{r.clue}</p></div>

      <div className="gs-ui pm-mix">
        {state === 'ok'
          ? <span className="pm-word">{r.answer}</span>
          : poured.map((id, i) => (
            <span key={id} className="pm-part">{i > 0 && <i className="pm-plus">+</i>}<button className="pm-tag" style={{ '--liq': colorOf(id) } as React.CSSProperties} onClick={() => unpour(id)}>{text(id)}</button></span>
          ))}
      </div>

      <div className="gs-ui pm-shelf" style={{ '--n': shelf.length } as React.CSSProperties}>
        {shelf.map((b) => (
          <button key={b.id} className={`pm-bottle${poured.includes(b.id) ? ' used' : ''}${fly?.id === b.id ? ' flying' : ''}`}
            disabled={poured.includes(b.id) || state !== 'play'} onClick={(e) => pour(b.id, e.currentTarget)}>
            <img src={BOTTLES[b.id % BOTTLES.length]} alt="" draggable={false} />
            <span>{b.t}</span>
          </button>
        ))}
      </div>
      <div className="gs-ui pm-go"><button className="gs-go" onClick={brew} disabled={!poured.length || state !== 'play' || !!fly}>Brew</button></div>
      {fly && <PourFx key={fly.key} f={fly} />}
    </div>
  )
}
