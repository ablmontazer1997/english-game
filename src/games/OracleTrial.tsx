import { useEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import bgPlate from '../assets/games/oracle/bg_plate.webp'
import orbImg from '../assets/games/oracle/orb.webp'
import pedestalImg from '../assets/games/oracle/pedestal.webp'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'
import oracleHappy from '../assets/games/oracle/oracle_happy.webp'
import oracleSurprised from '../assets/games/oracle/oracle_surprised.webp'
import ribbon from '../assets/pages/ribbon_gold.png'
import { TitleIntro, GameProgress } from '../components/GameTitle'
import { ORACLE_BANK, LEVELS, type OracleQ } from './oracleBank'
import './oracletrial.css'
import { useStageCtl, explain } from './coach'

// Oracle Trial — the adaptive placement test. English only. Every right answer
// asks a harder question, every wrong one an easier one; after TOTAL questions
// the level with enough right answers becomes the player's CEFR estimate.
// The scene is layered (plate / oracle / pedestal / orb / sparks) so the orb and
// the oracle can react instead of being a flat picture.

const TOTAL_PLACEMENT = 12
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

// ES2: the sentence split around its gap (2+ underscores) so the gap shows as the painted slot; null marks the gap
function blankParts(p: string): (string | null)[] {
  const m = p.match(/_{2,}/)
  return m ? [p.slice(0, m.index), null, p.slice(m.index! + m[0].length)] : [p]
}

/** the intro's placement test (10-11): the adaptive run below on a bigger bank (server items + the local ones);
 *  `onPlaced` gets the estimated level (0..4 = A1..C1) when the player taps Begin, `onExit` leaves the test */
export interface Placement { bank: OracleQ[]; onPlaced: (lv: number) => void; onExit?: () => void }

export function OracleTrial({ onFinish, srv, onAnswer, level: lvProp, placement }: MiniGameProps & { placement?: Placement }) {
  const BANK = placement?.bank.length ? placement.bank : ORACLE_BANK
  // server mode: the stage's own questions in order, no adaptive placement
  const ctl = useStageCtl()
  const srvQs = useMemo<(OracleQ & { rule?: string; why?: string })[] | null>(() => srv ? srv.map((x) => ({
    id: x.qid, level: Math.max(0, LEVELS.indexOf(x.level as typeof LEVELS[number])), skill: x.payload.skill ?? 'Grammar',
    prompt: x.payload.prompt, answer: x.payload.answer, wrong: x.payload.wrong ?? [], ...explain(x.payload),
  })) : null, [srv])
  const TOTAL = srvQs ? srvQs.length : TOTAL_PLACEMENT
  const [level, setLevel] = useState(srvQs ? Math.max(0, Math.min(4, lvProp ?? 0)) : START_LEVEL)
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

  const nextQ = (lv: number, idx = 0) => {
    if (srvQs) { setQ(srvQs[idx] ?? null); setPick(null); setVerdict(null); return }
    const pool = BANK.filter((x) => x.level === lv && !used.current.has(x.id))
    const src = pool.length ? pool : BANK.filter((x) => !used.current.has(x.id))
    const next = src[(Math.random() * src.length) | 0]
    used.current.add(next.id)
    setQ(next); setPick(null); setVerdict(null)
  }
  useEffect(() => { nextQ(START_LEVEL) }, [])

  const options = useMemo(() => (q ? shuffle([q.answer, ...q.wrong]) : []), [q])

  function check() {
    if (!q || !pick || verdict) return
    const ok = pick === q.answer
    onAnswer?.(q.id, pick, ok)
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
    const nl = srvQs ? level : Math.max(0, Math.min(LEVELS.length - 1, level + (ok ? 1 : -1)))
    // Phase C: in a stage (never in the placement test) a wrong answer shows the shared card first
    const pause = !ok && srvQs && !placement
      ? new Promise<void>((res) => setTimeout(() => ctl.wrong({ ...(/_{2,}/.test(q.prompt) ? { answer: q.prompt.replace(/_{2,}/, q.answer), label: 'The right sentence' } : { answer: q.answer }), yours: pick, rule: (q as { rule?: string }).rule, why: (q as { why?: string }).why }, REACT_MS - 500).then(res), 500))
      : new Promise<void>((res) => setTimeout(res, REACT_MS))
    pause.then(() => {
      setMood('idle')
      const nn = n + 1
      if (nn >= TOTAL && srvQs) { finish(); return }
      if (nn >= TOTAL) {
        const est = estimate(log.current)
        setDone(est); burst(45, 90, 4.5)
        return
      }
      setN(nn); setLevel(nl); nextQ(nl, nn)
    })
  }

  function skip() {
    if (!q || verdict) return
    log.current.push({ level: q.level, ok: false })
    onAnswer?.(q.id, '', false)
    const nl = srvQs ? level : Math.max(0, level - 1)
    const nn = n + 1
    if (nn >= TOTAL && srvQs) { finish(); return }
    if (nn >= TOTAL) { setDone(estimate(log.current)); return }
    setN(nn); setLevel(nl); nextQ(nl, nn)
  }

  const finish = () => {
    if (placement) { placement.onPlaced(done ?? estimate(log.current)); return }
    const right = log.current.filter((r) => r.ok).length
    onFinish({ correct: right, total: TOTAL, maxCombo: combo.current.max })
  }

  const shownLevel = done ?? level
  const oracleSrc = mood === 'happy' ? oracleHappy : mood === 'surprised' ? oracleSurprised : oracleIdle

  return (
    <div className={`ot ot-lv${shownLevel}${verdict ? ' ot-' + verdict : ''}${done != null ? ' ot-done' : ''}`}>
      <img className="ot-plate" src={bgPlate} alt="" draggable={false} />

      {placement?.onExit && <button className="stage-close ot-exit" onClick={placement.onExit} aria-label="Leave the test">✕</button>}
      <div className="ot-head">
        <TitleIntro title={srvQs ? 'Oracle' : 'Oracle Trial'} src={ribbon} className="ot-ribbon" />
        <div className="ot-count gt gt-slim">{done != null ? <GameProgress count="Complete" /> : <GameProgress count={`Question ${n + 1} / ${TOTAL}`} />}</div>
        {/* ES2 concept 08: the painted level ladder (gold rail, a gem per level: passed / current / locked) */}
        <div className="ot-gauge" aria-label={`Level ${LEVELS[shownLevel]}`}>
          {LEVELS.map((l, i) => (
            <span key={l} className={`ot-node${i < shownLevel ? ' on' : i === shownLevel ? ' cur' : ''}`}><i /><b>{l}</b></span>
          ))}
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
          <div className="ot-q" data-coach="q">
            <Task className="gtask-row" icon="tap" text="Choose the right answer" sub="Then tap Check" first={n === 0} />
            <span className="ot-skill k9 k-chip-v">{q.skill}</span>
            <p>{blankParts(q.prompt).map((t, i) => t === null
              ? <span key={i} className={`ot-blank${pick ? ' filled' : ''}`}>{pick ?? '\u00a0'}</span>
              : <span key={i}>{t}</span>)}</p>
          </div>
          <div className={`ot-opts${options.some((o) => o.length > 16) ? ' long' : ''}`} data-coach="a" data-coach-parts=".ot-opt">
            {options.map((o) => {
              const cls = 'ot-opt k9 k-tile'
                + (pick === o ? ' sel' : '')
                + (verdict && o === q.answer ? ' right' : '')
                + (verdict === 'bad' && pick === o ? ' wrong' : '')
              return <button key={o} className={cls} disabled={!!verdict} onClick={() => setPick(o)} data-demo={ctl.practice && o === q.answer ? 0 : undefined}>{o}</button>
            })}
          </div>
          <div className="ot-actions" data-focus-keep="">
            <button className="ot-skip k-btn k-cream" onClick={skip} disabled={!!verdict}>Skip</button>
            <button className="ot-check k-btn k-green" onClick={check} disabled={!pick || !!verdict} data-demo={ctl.practice ? 1 : undefined}>Check</button>
          </div>
        </div>
      )}

      {done != null && (
        <div className="ot-ui ot-result">
          <div className="ot-q">
            <span className="ot-skill k9 k-chip-v">The Oracle has spoken</span>
            <p className="ot-level">{LEVELS[done]}</p>
            <p className="ot-level-sub">{placement ? 'The Oracle will tell you more.' : `Your adventure begins at level ${LEVELS[done]}.`}</p>
          </div>
          <div className="ot-actions" data-focus-keep=""><button className="ot-check k-btn k-green" onClick={finish}>{placement ? 'Continue' : 'Begin'}</button></div>
        </div>
      )}
    </div>
  )
}
