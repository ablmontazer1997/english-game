import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import { burst, shake } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { VISIONS } from './banks/crystal'
import { fromSrv, hush, levelOf, makeScore, pick, shuffle, speak } from './kit'
import bgPlate from '../assets/games/crystal/cr_bg.webp'
import './scene.css'
import './crystalball.css'

// Crystal Ball — listening to a conversation. The ball shows a vision: two
// people talk (two voices). Listen to the whole scene, then answer what the
// oracle asks. The vision can be replayed; the text is never shown.

const VISIONS_PER_STAGE = 2
const RATE = [0.85, 0.9, 0.95, 1, 1.05]

export function CrystalBall({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const visions = useMemo(() => fromSrv(srv, () => pick(VISIONS[lv], VISIONS_PER_STAGE)), [lv, srv])
  const chosen = useRef<string[]>([])
  const total = visions.reduce((n, v) => n + v.questions.length, 0)
  const [vi, setVi] = useState(0)
  const v = visions[vi]
  const [qi, setQi] = useState(-1) // -1 = the vision is playing / waiting
  const [line, setLine] = useState(-1)
  const [heard, setHeard] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [gone, setGone] = useState<string[]>([])
  const [score] = useState(makeScore)
  const playId = useRef(0)
  const q = qi >= 0 ? v.questions[qi] : null
  const opts = useMemo(() => (q ? shuffle([q.answer, ...q.wrong]) : []), [q])

  function play() {
    const id = ++playId.current
    const say = (k: number) => {
      if (id !== playId.current) return
      if (k >= v.lines.length) { setLine(-1); setHeard(true); return }
      setLine(k)
      const [who, text] = v.lines[k]
      // if the device has no speech voice, the line still advances after its reading time
      let moved = false
      const go = () => { if (!moved) { moved = true; setTimeout(() => say(k + 1), 350) } }
      setTimeout(go, 1500 + text.split(' ').length * 480 / RATE[lv])
      speak(text, { voice: v[who].voice, rate: RATE[lv], onEnd: go })
    }
    say(0)
  }
  const stop = () => { playId.current++; hush(); setLine(-1) }

  useEffect(() => {
    setQi(-1); setHeard(false); setPicked(null); setGone([]); chosen.current = []
    const t = setTimeout(play, 700)
    return () => { clearTimeout(t); stop() }
  }, [vi]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPicked(null); setGone([]) }, [qi])

  // hint: one wrong answer fades away
  useHint(() => {
    if (!q || picked) return false
    const w = q.wrong.find((x) => !gone.includes(x))
    if (!w || gone.length >= q.wrong.length - 1) return false
    setGone([...gone, w]); return true
  })

  function choose(o: string, el?: Element) {
    if (!q || picked) return
    setPicked(o)
    chosen.current[qi] = o
    if (qi + 1 >= v.questions.length && v._qid) {
      const right = v.questions.filter((x, i) => chosen.current[i] === x.answer).length
      onAnswer?.(v._qid, v.questions.map((_, i) => chosen.current[i] ?? ''), right >= Math.max(1, v.questions.length - 1))
    }
    if (o === q.answer) { score.hit(); burst(el, { color: ['#ffe27a', '#8fe56a', '#ffffff'], n: 14, dist: 70 }) }
    else { score.miss(); shake(el) }
    setTimeout(() => {
      if (qi + 1 < v.questions.length) setQi(qi + 1)
      else if (vi + 1 < visions.length) setVi(vi + 1)
      else onFinish(score.out(total))
    }, o === q.answer ? 1000 : 1700)
  }

  const who = line >= 0 ? v.lines[line][0] : null
  const done = visions.slice(0, vi).reduce((n, x) => n + x.questions.length, 0) + Math.max(qi, 0)
  const prog = heard ? 100 : Math.max(0, line + 1) / v.lines.length * 100
  return (
    <div className={`gs cr${line >= 0 ? ' cr-talking' : ''}`}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <span className="gs-at cr-mist" aria-hidden><i /><i /></span>
        <span className={`gs-at cr-spot a${who === 'a' ? ' on' : ''}`}><b>{v.a.name}</b></span>
        <span className={`gs-at cr-spot b${who === 'b' ? ' on' : ''}`}><b>{v.b.name}</b></span>
      </div>
      <div className="gs-title"><GameTitle title="Crystal Ball" count={`Question ${Math.min(done + 1, total)} / ${total}`} /></div>

      <div className="gs-ui cr-player">
        <button className="gs-orb cr-play" aria-label={line >= 0 ? 'Stop' : 'Play'} onClick={() => (line >= 0 ? stop() : play())}>
          {line >= 0
            ? <svg viewBox="0 0 24 24" width="40%" height="40%"><rect x="5" y="5" width="14" height="14" rx="2" fill="#fff" /></svg>
            : <svg viewBox="0 0 24 24" width="46%" height="46%"><path d="M8 5v14l11-7z" fill="#fff" /></svg>}
        </button>
        <div className="cr-bar"><i style={{ width: `${prog}%` }} /><b style={{ left: `${prog}%` }} /></div>
      </div>

      <div className="gs-ui gs-panel cr-q">
        {!q ? (
          <>
            <p className="cr-ask">{v.title}</p>
            <p className="cr-sub">{heard ? 'Ready? The oracle has questions.' : 'Listen to the vision…'}</p>
            <button className="gs-go" disabled={!heard} onClick={() => { stop(); fxSfx('whoosh', .5); setQi(0) }}>I'm ready</button>
          </>
        ) : (
          <>
            <p className="cr-ask">{q.q}</p>
            {opts.map((o) => (
              <button key={o} className={`gs-pill cr-opt${picked && o === q.answer ? ' right' : ''}${picked === o && o !== q.answer ? ' wrong' : ''}${gone.includes(o) ? ' gone' : ''}`}
                disabled={!!picked || gone.includes(o)} onClick={(e) => choose(o, e.currentTarget)}>{o}</button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
