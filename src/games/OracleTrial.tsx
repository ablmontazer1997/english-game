import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import bgPlate from '../assets/games/oracle/bg_plate.webp'
import orbImg from '../assets/games/oracle/orb.webp'
import pedestalImg from '../assets/games/oracle/pedestal.webp'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'
import oracleHappy from '../assets/games/oracle/oracle_happy.webp'
import oracleSurprised from '../assets/games/oracle/oracle_surprised.webp'
import ribbon from '../assets/pages/ribbon_gold.png'
import { ORACLE_BANK, LEVELS, type OracleQ } from './oracleBank'
import './oracletrial.css'

// Oracle Trial — the adaptive placement test. English only. Every right answer
// asks a harder question, every wrong one an easier one; after TOTAL questions
// the level with enough right answers becomes the player's CEFR estimate.
// The scene is layered (plate / oracle / pedestal / orb / sparks) so the orb and
// the oracle can react instead of being a flat picture.

const TOTAL = 12
const START_LEVEL = 1 // A2
const REACT_MS = 1100

type Mood = 'idle' | 'happy' | 'surprised'
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; hue: number }

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// highest level answered right at least half the time (min two asked); A1 otherwise
function estimate(log: { level: number; ok: boolean }[]): number {
  let best = 0
  for (let l = 0; l < LEVELS.length; l++) {
    const at = log.filter((r) => r.level === l)
    if (at.length >= 2 && at.filter((r) => r.ok).length / at.length >= 0.5) best = l
    else if (at.length === 1 && at[0].ok && l > best) best = l
  }
  return best
}

export function OracleTrial({ onFinish }: MiniGameProps) {
  const [level, setLevel] = useState(START_LEVEL)
  const [n, setN] = useState(0)
  const [q, setQ] = useState<OracleQ | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<'ok' | 'bad' | null>(null)
  const [mood, setMood] = useState<Mood>('idle')
  const [done, setDone] = useState<number | null>(null)
  const used = useRef(new Set<string>())
  const log = useRef<{ level: number; ok: boolean }[]>([])
  const combo = useRef({ now: 0, max: 0 })

  // sparks live on a canvas over the orb: a slow ambient drift, a gold burst on success
  const cvs = useRef<HTMLCanvasElement>(null)
  const sparks = useRef<Spark[]>([])
  const burst = (hue: number, count: number, speed: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8)
      sparks.current.push({ x: 0, y: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, life: 0, max: 50 + Math.random() * 40, r: 1.5 + Math.random() * 2.5, hue })
    }
  }
  useEffect(() => {
    const c = cvs.current
    if (!c) return
    const ctx = c.getContext('2d')!
    let raf = 0, t = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1)
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      t++
      if (t % 7 === 0) { // ambient motes rising from the orb
        const a = Math.random() * Math.PI * 2
        sparks.current.push({ x: Math.cos(a) * w * 0.16, y: Math.sin(a) * w * 0.12, vx: (Math.random() - 0.5) * 0.25, vy: -0.35 - Math.random() * 0.4, life: 0, max: 90, r: 1 + Math.random() * 1.6, hue: 275 })
      }
      ctx.globalCompositeOperation = 'lighter'
      sparks.current = sparks.current.filter((s) => {
        s.life++; s.x += s.vx; s.y += s.vy; s.vy += 0.012; s.vx *= 0.99
        const k = 1 - s.life / s.max
        if (k <= 0) return false
        const x = w / 2 + s.x, y = h / 2 + s.y
        const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4)
        g.addColorStop(0, `hsla(${s.hue},100%,85%,${0.9 * k})`)
        g.addColorStop(1, `hsla(${s.hue},100%,60%,0)`)
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(x, y, s.r * 4, 0, Math.PI * 2); ctx.fill()
        return true
      })
      ctx.globalCompositeOperation = 'source-over'
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const nextQ = (lv: number) => {
    const pool = ORACLE_BANK.filter((x) => x.level === lv && !used.current.has(x.id))
    const src = pool.length ? pool : ORACLE_BANK.filter((x) => !used.current.has(x.id))
    const next = src[(Math.random() * src.length) | 0]
    used.current.add(next.id)
    setQ(next); setPick(null); setVerdict(null)
  }
  useEffect(() => { nextQ(START_LEVEL) }, [])

  const options = useMemo(() => (q ? shuffle([q.answer, ...q.wrong]) : []), [q])

  function check() {
    if (!q || !pick || verdict) return
    const ok = pick === q.answer
    log.current.push({ level: q.level, ok })
    setVerdict(ok ? 'ok' : 'bad')
    setMood(ok ? 'happy' : 'surprised')
    if (ok) {
      combo.current.now++; combo.current.max = Math.max(combo.current.max, combo.current.now)
      burst(45, 46, 3.2)
    } else {
      combo.current.now = 0
      burst(265, 14, 1.2)
    }
    const nl = Math.max(0, Math.min(LEVELS.length - 1, level + (ok ? 1 : -1)))
    setTimeout(() => {
      setMood('idle')
      const nn = n + 1
      if (nn >= TOTAL) {
        const est = estimate(log.current)
        setDone(est); burst(45, 90, 4.5)
        return
      }
      setN(nn); setLevel(nl); nextQ(nl)
    }, REACT_MS)
  }

  function skip() {
    if (!q || verdict) return
    log.current.push({ level: q.level, ok: false })
    const nl = Math.max(0, level - 1)
    const nn = n + 1
    if (nn >= TOTAL) { setDone(estimate(log.current)); return }
    setN(nn); setLevel(nl); nextQ(nl)
  }

  const finish = () => {
    const right = log.current.filter((r) => r.ok).length
    onFinish({ correct: right, total: TOTAL, maxCombo: combo.current.max })
  }

  const shownLevel = done ?? level
  const oracleSrc = mood === 'happy' ? oracleHappy : mood === 'surprised' ? oracleSurprised : oracleIdle

  return (
    <div className={`ot ot-lv${shownLevel}${verdict ? ' ot-' + verdict : ''}${done != null ? ' ot-done' : ''}`}>
      <img className="ot-plate" src={bgPlate} alt="" draggable={false} />

      <div className="ot-head">
        <div className="ot-ribbon"><img src={ribbon} alt="" draggable={false} /><span>Oracle Trial</span></div>
        <div className="ot-count">{done != null ? 'Complete' : `Question ${n + 1} / ${TOTAL}`}</div>
        <div className="ot-gauge" aria-label={`Level ${LEVELS[shownLevel]}`}>
          <div className="ot-rail">
            <div className="ot-track"><i style={{ width: `${(shownLevel / (LEVELS.length - 1)) * 100}%` }} /></div>
            {LEVELS.map((l, i) => (
              <span key={l} className={`ot-node${i <= shownLevel ? ' on' : ''}${i === shownLevel ? ' cur' : ''}`}
                style={{ left: `${(i / (LEVELS.length - 1)) * 100}%` }}><b>{l}</b></span>
            ))}
          </div>
        </div>
      </div>

      <div className="ot-stage" aria-hidden>
        <div className="ot-oracle">
          {/* one shared float for every pose, so a pose swap never shifts the figure */}
          <div className="ot-oracle-float">
            {[oracleIdle, oracleHappy, oracleSurprised].map((src) => (
              <img key={src} src={src} alt="" draggable={false} className={src === oracleSrc ? 'on' : ''} />
            ))}
          </div>
        </div>
        <img className="ot-pedestal" src={pedestalImg} alt="" draggable={false} />
        <div className="ot-orb">
          <span className="ot-glow" />
          <img className="ot-orb-base" src={orbImg} alt="" draggable={false} />
          <img className="ot-orb-swirl" src={orbImg} alt="" draggable={false} />
          <span className="ot-ring" />
        </div>
        <canvas className="ot-sparks" ref={cvs} />
      </div>

      {done == null && q && (
        <div className="ot-ui">
          <div className="ot-q">
            <span className="ot-skill">{q.skill}</span>
            <p>{q.prompt}</p>
          </div>
          <div className="ot-opts">
            {options.map((o) => {
              const cls = 'ot-opt'
                + (pick === o ? ' sel' : '')
                + (verdict && o === q.answer ? ' right' : '')
                + (verdict === 'bad' && pick === o ? ' wrong' : '')
              return <button key={o} className={cls} disabled={!!verdict} onClick={() => setPick(o)}>{o}</button>
            })}
          </div>
          <div className="ot-actions">
            <button className="ot-skip" onClick={skip} disabled={!!verdict}>Skip</button>
            <button className="ot-check" onClick={check} disabled={!pick || !!verdict}>Check</button>
          </div>
        </div>
      )}

      {done != null && (
        <div className="ot-ui ot-result">
          <div className="ot-q">
            <span className="ot-skill">The Oracle has spoken</span>
            <p className="ot-level">{LEVELS[done]}</p>
            <p className="ot-level-sub">Your adventure begins at level {LEVELS[done]}.</p>
          </div>
          <div className="ot-actions"><button className="ot-check" onClick={finish}>Begin</button></div>
        </div>
      )}
    </div>
  )
}
