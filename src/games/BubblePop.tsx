import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MiniGameProps } from './types'
import './bubblepop.css'

/* Bubble Pop — faithful port of the approved games.html "#bp" screen.
   Each SRS item is one round: the white question bar shows item.front, and four
   glossy bubbles float (bob) carrying the correct item.back plus distractors.
   Tap the bubble whose word matches the prompt. Every tapped bubble shatters
   into a cloud of water droplets (spawned as DOM nodes + WAAPI, then removed).
   15s ring timer per round; timeout counts as a miss and moves on. */

const ROUND_SECONDS = 15
const RC = 175.9 // 2πr for r=28, the timer ring circumference

const COLS = ['bp-b-blue', 'bp-b-purple', 'bp-b-green', 'bp-b-gold'] as const
const CMAP: Record<string, string> = {
  'bp-b-blue': '#7fc9f5',
  'bp-b-purple': '#b99cf0',
  'bp-b-green': '#87d95f',
  'bp-b-gold': '#ffd24d',
}
// fractional slot centres [fx, fy, sizePx] — from the approved design
const SLOTS: [number, number, number][] = [
  [0.3, 0.22, 120],
  [0.72, 0.34, 128],
  [0.26, 0.6, 116],
  [0.7, 0.72, 122],
]

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

interface Bubble {
  key: string
  text: string
  correct: boolean
  colorClass: (typeof COLS)[number]
  dropColor: string
  fx: number
  fy: number
  sz: number
  jx: number
  jy: number
  dur: number // bob duration (s)
}

export function BubblePop({ items, onFinish }: MiniGameProps) {
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [fb, setFb] = useState<{ show: boolean; ok: boolean }>({ show: false, ok: true })
  const [over, setOver] = useState(false)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  const correctRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const lockedRef = useRef(false)
  const finishedRef = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const item = items[idx]

  // measure the playfield so bubble pixel positions can be computed
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // build this round's bubbles (stable per item)
  const bubbles = useMemo<Bubble[]>(() => {
    if (!item) return []
    const wrong: string[] = []
    for (const d of item.distractors) {
      if (d && d !== item.back && !wrong.includes(d)) wrong.push(d)
    }
    const opts = shuffle([
      { text: item.back, correct: true },
      ...shuffle(wrong).slice(0, 3).map((t) => ({ text: t, correct: false })),
    ]).slice(0, 4)
    return opts.map((o, i) => {
      const [fx, fy, sz] = SLOTS[i]
      return {
        key: `${item.id}-${i}`,
        text: o.text,
        correct: o.correct,
        colorClass: COLS[i % 4],
        dropColor: CMAP[COLS[i % 4]],
        fx,
        fy,
        sz,
        jx: Math.round(rnd(-12, 12)),
        jy: Math.round(rnd(-12, 12)),
        dur: 2.6 + i * 0.4,
      }
    })
  }, [item])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }, [])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTimers()
    if (fbTimer.current) clearTimeout(fbTimer.current)
    onFinish({
      correct: correctRef.current,
      total: items.length,
      maxCombo: maxComboRef.current,
    })
  }, [clearTimers, items.length, onFinish])

  const showFb = useCallback((ok: boolean) => {
    setFb({ show: true, ok })
    if (fbTimer.current) clearTimeout(fbTimer.current)
    fbTimer.current = setTimeout(() => setFb((f) => ({ ...f, show: false })), 1200)
  }, [])

  const advance = useCallback(() => {
    if (idx + 1 >= items.length) {
      setOver(true)
      later(finish, 850)
    } else {
      lockedRef.current = false
      setGone(new Set())
      setFb((f) => ({ ...f, show: false }))
      setIdx((i) => i + 1)
    }
  }, [idx, items.length, finish, later])

  // ----- water-droplet burst: spawn nodes, animate with WAAPI, remove ------
  const playPop = useCallback(() => {
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const Ctor = W.AudioContext || W.webkitAudioContext
      if (!Ctor) return
      const ac = new Ctor()
      const t = ac.currentTime
      // body: a very short low "thump" = the pressure release
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(rnd(380, 460), t)
      o.frequency.exponentialRampToValueAtTime(85, t + 0.045)
      g.gain.setValueAtTime(0.34, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
      o.connect(g).connect(ac.destination)
      o.start(t)
      o.stop(t + 0.1)
      // transient: bright ultra-short noise tick = the film actually snapping
      const len = Math.floor(ac.sampleRate * 0.03)
      const buf = ac.createBuffer(1, len, ac.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
      const n = ac.createBufferSource()
      n.buffer = buf
      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1700
      const ng = ac.createGain()
      ng.gain.setValueAtTime(0.5, t)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
      n.connect(hp).connect(ng).connect(ac.destination)
      n.start(t)
      setTimeout(() => ac.close().catch(() => {}), 250)
    } catch {
      /* audio is best-effort */
    }
  }, [])

  const burst = useCallback(
    (x: number, y: number, col: string, r: number) => {
      const field = fieldRef.current
      if (!field) return
      playPop()
      // droplet cloud that fills the whole bubble disk, then explodes outward
      const N = Math.min(52, Math.max(30, Math.round(r * 0.95)))
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2
        const rr = r * Math.sqrt(Math.random()) // uniform point INSIDE the bubble
        const sx = Math.cos(a) * rr
        const sy = Math.sin(a) * rr
        const ja = a + (Math.random() - 0.5) * 0.7
        const out = r * (1.5 + Math.random() * 2.2)
        const gx = Math.cos(ja) * out
        const gy = Math.sin(ja) * out + (45 + Math.random() * 95)
        const sz = 4 + Math.random() * 6 + (1 - rr / r) * 5
        const p = document.createElement('div')
        p.className = 'bp-drop'
        p.style.cssText = `left:${x + sx}px;top:${y + sy}px;width:${sz}px;height:${sz}px;background:radial-gradient(circle at 34% 30%,#ffffff,${col} 60%,rgba(0,40,80,.22) 100%)`
        field.appendChild(p)
        p.animate(
          [
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0 },
            { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.07 },
            { transform: `translate(-50%,-50%) translate(${gx * 0.6}px,${gy * 0.5}px) scale(.85)`, opacity: 1, offset: 0.55 },
            { transform: `translate(-50%,-50%) translate(${gx}px,${gy}px) scale(.3)`, opacity: 0, offset: 1 },
          ],
          { duration: 680 + Math.random() * 560, easing: 'cubic-bezier(.12,.62,.24,1)' }
        ).onfinish = () => p.remove()
      }
      // a quick edge flash so the burst registers the instant it is tapped
      const rim = document.createElement('div')
      rim.className = 'bp-rimsnap'
      rim.style.cssText = `left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px;border-color:${col}`
      field.appendChild(rim)
      rim.animate(
        [
          { transform: 'translate(-50%,-50%) scale(.9)', opacity: 0.85, borderWidth: '5px' },
          { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 0, borderWidth: '1px' },
        ],
        { duration: 200, easing: 'ease-out' }
      ).onfinish = () => rim.remove()
    },
    [playPop]
  )

  // ----- tapping a bubble ---------------------------------------------------
  function pick(b: Bubble) {
    if (lockedRef.current || gone.has(b.key)) return
    const cx = b.fx * size.w + b.jx
    const cy = b.fy * size.h + b.jy
    burst(cx, cy, b.dropColor, b.sz / 2)
    setGone((g) => new Set(g).add(b.key))

    if (b.correct) {
      lockedRef.current = true
      comboRef.current += 1
      if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current
      correctRef.current += 1
      setScore((s) => s + 10 + comboRef.current * 2)
      showFb(true)
      later(advance, 820)
    } else {
      comboRef.current = 0
      showFb(false) // wrong bubble pops, keep trying the rest
    }
  }

  // ----- per-round countdown ----------------------------------------------
  useEffect(() => {
    if (!item || over) return
    lockedRef.current = false
    setTimeLeft(ROUND_SECONDS)
    const id = setInterval(() => {
      setTimeLeft((s) => {
        if (lockedRef.current) return s
        if (s <= 1) {
          clearInterval(id)
          lockedRef.current = true
          comboRef.current = 0
          showFb(false)
          later(advance, 700)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, over])

  // empty item set — nothing to play
  useEffect(() => {
    if (items.length === 0) finish()
  }, [items.length, finish])

  // cleanup on unmount
  useEffect(
    () => () => {
      clearTimers()
      if (fbTimer.current) clearTimeout(fbTimer.current)
    },
    [clearTimers]
  )

  if (items.length === 0) {
    return (
      <div className="bubblepop">
        <div className="bp-stage">
          <div className="bp-sky" />
          <div className="bp-wait">Nothing to play</div>
        </div>
      </div>
    )
  }
  if (!item) {
    return (
      <div className="bubblepop">
        <div className="bp-stage">
          <div className="bp-sky" />
        </div>
      </div>
    )
  }

  const ringOffset = RC * (1 - timeLeft / ROUND_SECONDS)

  return (
    <div className="bubblepop">
      <div className="bp-stage">
        <div className="bp-sky" />
        <div className="bp-cloud" style={{ top: 40, left: -20, width: 120, height: 46 }} />
        <div className="bp-cloud" style={{ top: 70, right: -30, width: 150, height: 56 }} />
        <div className="bp-bushes" />
        {[
          { top: 260, left: 26, s: 20, d: 5 },
          { top: 340, right: 34, s: 14, d: 6.5 },
          { top: 470, left: 48, s: 26, d: 7 },
          { top: 540, right: 60, s: 16, d: 5.8 },
          { top: 620, left: 20, s: 22, d: 8 },
        ].map((m, i) => (
          <div
            key={i}
            className="bp-mini"
            style={{
              top: m.top,
              left: (m as { left?: number }).left,
              right: (m as { right?: number }).right,
              width: m.s,
              height: m.s,
              animationDuration: `${m.d}s`,
            }}
          />
        ))}

        <div className="bp-title">
          <span className="b">Bubble </span>
          <span className="p">Pop</span>
        </div>

        <div className="bp-qbar">
          <div className="q">?</div>
          <div className="qt">
            Pop the right bubble: <b lang="en">{item.front}</b>
          </div>
        </div>

        <div className="bp-stat">
          <span className="st">&#9733;</span>
          <span>{score}</span>
          <span className="dv" />
          <span className="s2">
            {idx + 1}/{items.length}
          </span>
        </div>

        <div className="bp-ring">
          <svg width="66" height="66">
            <circle cx="33" cy="33" r="28" fill="#fff" stroke="#E3E9F5" strokeWidth="6" />
            <circle
              className="arc"
              cx="33"
              cy="33"
              r="28"
              fill="none"
              stroke="#3FA9E6"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RC}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 33 33)"
            />
          </svg>
          <div className="v">
            <b>{timeLeft}</b>
            <s>SEC</s>
          </div>
        </div>

        <div className="bp-field" ref={fieldRef}>
          {size.w > 0 &&
            bubbles.map((b) => {
              const left = b.fx * size.w - b.sz / 2 + b.jx
              const top = b.fy * size.h - b.sz / 2 + b.jy
              const fontSize = b.text.length > 4 ? b.sz * 0.24 : b.sz * 0.3
              return (
                <div
                  key={b.key}
                  className={`bp-bub ${b.colorClass} ${gone.has(b.key) ? 'is-gone' : ''}`}
                  style={
                    {
                      left,
                      top,
                      width: b.sz,
                      height: b.sz,
                      fontSize,
                      animationDuration: `${b.dur}s`,
                    } as CSSProperties
                  }
                  onClick={() => pick(b)}
                >
                  <span className="w">{b.text}</span>
                </div>
              )
            })}
        </div>

        <div className={`bp-fb ${fb.show ? 'show' : ''}`}>
          <div className={`c ${fb.ok ? '' : 'bad'}`}>{fb.ok ? 'Correct!' : 'Try again!'}</div>
          <div className="s">{fb.ok ? 'Way to go!' : 'Give it another shot'}</div>
        </div>

        {over && (
          <div className="bp-over">
            <h2>Round complete!</h2>
            <p>Score {score}</p>
            <button onClick={finish}>Continue</button>
          </div>
        )}
      </div>
    </div>
  )
}
