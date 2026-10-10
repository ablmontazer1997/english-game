import { useEffect, useMemo, useState } from 'react'
import { Task, ASK } from './Task'
const cap = (t: string) => { const l = t.trim().toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1) }
import type { MiniGameProps } from './types'
import { burst, flyTo, pop } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { SPELLS } from './banks/weave'
import { fromSrv, levelOf, makeScore, pick, shuffle, speak } from './kit'
import { sfx } from '../services/audio'
import bgPlate from '../assets/games/weave/sw_bg.webp'
import tileRope from '../assets/games/weave/sw_tile_rope.webp'
import tileViolet from '../assets/games/weave/sw_tile_violet.webp'
import './scene.css'
import './spellweaver.css'

// Spell Weaver — sentence transformation. The source spell must be rewoven as
// the badge commands (make it passive, report it, start with Never…). Weave the
// thread tiles into the loom in order; decoy threads hold the typical mistakes.

const ROUNDS = 5

export function SpellWeaver({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const spells = useMemo(() => fromSrv(srv, () => pick(SPELLS[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const s = spells[round]
  const tiles = useMemo(() => shuffle([...s.answer, ...s.extra].map((t, id) => ({ id, t }))), [s])
  const [woven, setWoven] = useState<number[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const [score] = useState(makeScore)
  const [pend, setPend] = useState<number | null>(null) // tile in flight to its slot

  useEffect(() => { setWoven([]); setState('play') }, [s])
  const text = (id: number) => tiles.find((x) => x.id === id)!.t

  useHint(() => {
    if (state !== 'play') return false
    let k = 0
    while (k < woven.length && text(woven[k]) === s.answer[k]) k++
    if (k >= s.answer.length) return false
    const id = tiles.find((x) => x.t === s.answer[k] && !woven.slice(0, k).includes(x.id))!.id
    setWoven([...woven.slice(0, k), id]); return true
  })

  const add = (id: number, el?: Element) => {
    if (state !== 'play' || pend !== null || woven.includes(id) || woven.length >= s.answer.length) return
    const slot = document.querySelector(`.swv [data-slot="${woven.length}"]`)
    setPend(id)
    flyTo(el, slot, { ms: 300, arc: -40 }).then(() => { setWoven((w) => [...w, id]); setPend(null); fxSfx('pop', .45); pop(slot, 1.15) })
  }
  const drop = (id: number) => { if (state === 'play') setWoven(woven.filter((x) => x !== id)) }

  function weave() {
    if (state !== 'play' || woven.length !== s.answer.length) return
    const ok = woven.every((id, i) => text(id) === s.answer[i])
    if (s._qid) onAnswer?.(s._qid, woven.map(text), ok)
    setState(ok ? 'ok' : 'bad')
    if (ok) {
      score.hit(); sfx('spell'); speak(s.answer.join(' '))
      document.querySelectorAll('.swv .swv-tile.in').forEach((t, i) => setTimeout(() => burst(t, { color: ['#ffe27a', '#ffffff', '#c9a3ff'], n: 9, dist: 45, size: 8 }), 120 * i))
      setTimeout(() => { if (round + 1 >= spells.length) onFinish(score.out(spells.length)); else setRound(round + 1) }, 2000)
    } else {
      score.miss(); fxSfx('whoosh', .5)
      setTimeout(() => { setWoven([]); setState('play') }, 1000)
    }
  }

  return (
    <div className={`gs swv swv-${state}`}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <img className="swv-mirror" src={bgPlate} alt="" draggable={false} />
        <span className="gs-at swv-glow" aria-hidden />
        <div className="gs-at swv-line" aria-label="Your spell">
          {s.answer.map((_, i) => {
            const id = woven[i]
            return id === undefined
              ? <span key={i} data-slot={i} className="swv-slot" style={{ backgroundImage: `url(${tileViolet})` }} />
              : <button key={i} data-slot={i} className="swv-tile in" style={{ backgroundImage: `url(${tileViolet})` }} onClick={() => drop(id)}>{text(id)}</button>
          })}
        </div>
      </div>
      <div className="gs-title"><GameTitle title="Spell Weaver" count={`Spell ${round + 1} / ${spells.length}`} /></div>

      {/* admin 4793: the loom rides up under the HUD; task card, chips and Weave sit together at the bottom */}
      <div className="gs-ui swv-dock">
        <div className={`gs-panel swv-source${ASK ? ' has-task' : ''}`}>
          {ASK && <Task icon="build" text={cap(s.cmd)} sub="Tap the words in the right order" first={round === 0} />}
          <p>{s.source}</p>
          {!ASK && <span className="swv-cmd">{s.cmd}</span>}
        </div>
        <div className="swv-pool">
          {tiles.map((x) => (
            <button key={x.id} className={`swv-tile rope${woven.includes(x.id) || pend === x.id ? ' used' : ''}`} style={{ backgroundImage: `url(${tileRope})` }}
              disabled={woven.includes(x.id) || pend !== null || state !== 'play'} onClick={(e) => add(x.id, e.currentTarget)}>{x.t}</button>
          ))}
        </div>
        <div className="swv-go"><button className="gs-go" onClick={weave} disabled={woven.length !== s.answer.length || state !== 'play'}>Weave</button></div>
      </div>
    </div>
  )
}
