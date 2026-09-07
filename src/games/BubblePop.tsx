import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import { BurstFx, FRAME_REACH, ORB_COLORS, drawFrame, drawOrb, drawWord, loadFrame, type OrbColor } from './bubbleOrb'
import frameUrl from '../assets/games/bubble_frame.webp'
import './bubblepop.css'

/* Bubble Pop — a real bubble field, not fixed slots.

   Answer bubbles are buoyant: they drift and rise inside the playfield with a
   soft wobble and bounce gently off the walls, driven by one rAF loop (motion
   is written straight to node transforms, so React never re-renders per frame).
   A continuous stream of small ambient bubbles rises from the bottom and pops
   on its own at the surface, so the water always feels alive.

   The bubbles themselves are glossy magic orbs inside the admin's gold gem
   frame, drawn on one canvas over the field (see bubbleOrb.ts). Tapping one
   bursts the film from the tap point into teardrop droplets flying in every
   direction, and the frame shatters into tumbling gold shards. */

const ROUND_SECONDS = 15
const RC = 175.9 // 2πr for r=28, the timer ring circumference


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
  col: OrbColor
  sz: number // orb diameter (the gold frame reaches well beyond it)
}

// physics state for one floating answer bubble (field-local centre coords)
interface Phys { x: number; y: number; vx: number; vy: number; ph: number; r: number; sx: number; sy: number; dir: 1 | -1; spawn: number }
// an ambient rising bubble
interface Amb { el: HTMLDivElement; x: number; y: number; r: number; vy: number; ph: number; amp: number; sway: number }

export function BubblePop({ items, onFinish }: MiniGameProps) {
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [fb, setFb] = useState<{ show: boolean; ok: boolean }>({ show: false, ok: true })
  const [over, setOver] = useState(false)

  const fieldRef = useRef<HTMLDivElement | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)

  const phys = useRef<Record<string, Phys>>({})
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fx = useRef(new BurstFx())
  const bubblesRef = useRef<Bubble[]>([])
  const goneRef = useRef<Set<string>>(new Set())
  const amb = useRef<Amb[]>([])
  const ambTimer = useRef(0)
  const rafRef = useRef(0)
  const lastT = useRef(0)

  const correctRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const lockedRef = useRef(false)
  const finishedRef = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const item = items[idx]

  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    const measure = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight }
      setReady(el.clientWidth > 0)
    }
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
    return opts.map((o, i) => ({
      key: `${item.id}-${i}`,
      text: o.text,
      correct: o.correct,
      col: ORB_COLORS[i % 4],
      sz: o.text.length > 8 ? 96 : o.text.length > 5 ? 90 : 84,
    }))
  }, [item])
  bubblesRef.current = bubbles
  goneRef.current = gone
  useEffect(() => { loadFrame(frameUrl) }, [])

  // seed physics for the new round: spread the bubbles low and let them rise
  useEffect(() => {
    const { w, h } = sizeRef.current
    if (!w || bubbles.length === 0) return
    // a jittered 2x2 grid so the four bubbles start spread over the whole field
    const gx = [0.28, 0.72, 0.3, 0.7]
    const gy = [0.28, 0.4, 0.72, 0.62]
    const p: Record<string, Phys> = {}
    bubbles.forEach((b, i) => {
      const r = b.sz / 2
      const m = r * FRAME_REACH // keep the whole gold frame inside the field
      p[b.key] = {
        x: Math.min(w - m, Math.max(m, gx[i] * w + rnd(-14, 14))),
        y: Math.min(h - m, Math.max(m, gy[i] * h + rnd(-14, 14))),
        vx: 0,
        vy: 0,
        ph: rnd(0, Math.PI * 2),
        r,
        sx: rnd(0, 6.28),
        sy: rnd(0, 6.28),
        dir: 1,
        spawn: performance.now(),
      }
    })
    phys.current = p
  }, [bubbles, ready])

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
    onFinish({ correct: correctRef.current, total: items.length, maxCombo: maxComboRef.current })
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

  // ---- pop sound: a wet body-thump plus a bright film snap ----------------
  const playPop = useCallback(() => {
    try {
      const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const Ctor = W.AudioContext || W.webkitAudioContext
      if (!Ctor) return
      const ac = new Ctor()
      const t = ac.currentTime
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(rnd(360, 470), t)
      o.frequency.exponentialRampToValueAtTime(80, t + 0.05)
      g.gain.setValueAtTime(0.3, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
      o.connect(g).connect(ac.destination)
      o.start(t)
      o.stop(t + 0.11)
      const len = Math.floor(ac.sampleRate * 0.03)
      const buf = ac.createBuffer(1, len, ac.sampleRate)
      const dd = buf.getChannelData(0)
      for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
      const n = ac.createBufferSource()
      n.buffer = buf
      const hp = ac.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1800
      const ng = ac.createGain()
      ng.gain.setValueAtTime(0.45, t)
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.045)
      n.connect(hp).connect(ng).connect(ac.destination)
      n.start(t)
      setTimeout(() => ac.close().catch(() => {}), 260)
    } catch { /* best-effort */ }
  }, [])

  // ---- burst an orb at a field-local point (tap point drives the film tear)
  const burst = useCallback((b: Bubble, p: Phys, px: number, py: number) => {
    playPop()
    fx.current.burst(p.x, p.y, p.r, b.col, b.text, px, py)
  }, [playPop])

  // ---- tapping a bubble ---------------------------------------------------
  const pick = useCallback((b: Bubble, px: number, py: number) => {
    if (lockedRef.current || gone.has(b.key)) return
    const pp = phys.current[b.key]
    if (pp) burst(b, pp, px, py)
    setGone((g) => new Set(g).add(b.key))

    if (b.correct) {
      lockedRef.current = true
      comboRef.current += 1
      if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current
      correctRef.current += 1
      setScore((s) => s + 10 + comboRef.current * 2)
      showFb(true)
      later(advance, 780)
    } else {
      comboRef.current = 0
      showFb(false)
    }
  }, [gone, burst, showFb, later, advance])

  // hit-test the canvas against the live orbs (topmost first)
  const onCanvasDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    const list = bubblesRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      if (goneRef.current.has(b.key)) continue
      const p = phys.current[b.key]
      if (p && Math.hypot(px - p.x, py - p.y) <= p.r + 6) { pick(b, px, py); return }
    }
  }, [pick])

  // ---- the one animation loop: bubbles, ambient stream, burst FX ----------
  useEffect(() => {
    const step = (t: number) => {
      rafRef.current = requestAnimationFrame(step)
      const field = fieldRef.current
      const { w, h } = sizeRef.current
      if (!field || !w) { lastT.current = t; return }
      const dt = Math.min(2.4, lastT.current ? (t - lastT.current) / 16.667 : 1)
      const dts = dt / 60 // seconds, for the burst FX
      lastT.current = t

      // answer orbs: a slow, steady buoyant rise with a gentle sideways sway —
      // like a real bubble drifting up through water, not a jittery wander.
      // They bob gently between the field's top and bottom (bouncing softly at
      // each wall) so a bubble always stays reachable for the whole round.
      const RISE = 0.14     // px per frame-tick of upward drift (~8px/s at 60fps) — slow and steady
      const SWAY = 0.12     // px per frame-tick of side-to-side drift
      const EASE = 0.03     // how quickly velocity eases toward its target (smooths out the motion)
      const live: string[] = []
      for (const key in phys.current) { if (!gone.has(key)) live.push(key) }
      const lo = (r: number) => r * FRAME_REACH + 6   // wall margin = the frame reach beyond the orb
      for (const key of live) {
        const p = phys.current[key]
        p.ph += 0.006 * dt
        const targetVx = Math.sin(p.ph * 0.7 + p.sx) * SWAY
        const targetVy = -RISE * p.dir
        p.vx += (targetVx - p.vx) * EASE * dt
        p.vy += (targetVy - p.vy) * EASE * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const loR = lo(p.r), hiX = w - lo(p.r), top = lo(p.r), hiY = h - lo(p.r)
        if (p.x < loR) { p.x = loR; p.vx = Math.abs(p.vx) }
        if (p.x > hiX) { p.x = hiX; p.vx = -Math.abs(p.vx) }
        if (p.y < top) { p.y = top; p.dir = -1 }    // reached the surface: drift back down
        if (p.y > hiY) { p.y = hiY; p.dir = 1 }     // sank to the floor: rise again
      }
      // separation: push overlapping pairs apart by half their overlap each
      // (position-only — no velocity kick — so it stays smooth, not jittery)
      for (let iter = 0; iter < 3; iter++) {
        for (let a = 0; a < live.length; a++) {
          const pa = phys.current[live[a]]
          for (let b2 = a + 1; b2 < live.length; b2++) {
            const pb = phys.current[live[b2]]
            let dx = pb.x - pa.x, dy = pb.y - pa.y
            let d = Math.hypot(dx, dy)
            const min = (pa.r + pb.r) * 1.35 + 8   // keep the gold frames from stacking
            if (d < min) {
              if (d < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d = Math.hypot(dx, dy) }
              const push = (min - d) / 2, ux = dx / d, uy = dy / d
              pa.x -= ux * push; pa.y -= uy * push
              pb.x += ux * push; pb.y += uy * push
            }
          }
        }
      }
      for (const key of live) {
        const p = phys.current[key]
        p.x = Math.min(w - lo(p.r), Math.max(lo(p.r), p.x))
        p.y = Math.min(h - lo(p.r), Math.max(lo(p.r), p.y))
      }

      // ambient stream: keep ~10 rising, respawn at the bottom
      ambTimer.current -= dt
      if (amb.current.length < 10 && ambTimer.current <= 0) {
        ambTimer.current = rnd(6, 16)
        const r = rnd(4, 12)
        const el = document.createElement('div')
        el.className = 'bp-amb'
        el.style.width = el.style.height = r * 2 + 'px'
        field.appendChild(el)
        amb.current.push({ el, x: rnd(r, w - r), y: h + r, r, vy: rnd(0.7, 1.8), ph: rnd(0, 6.28), amp: rnd(6, 20), sway: rnd(0.02, 0.05) })
      }
      for (let i = amb.current.length - 1; i >= 0; i--) {
        const a = amb.current[i]
        a.ph += a.sway * dt
        a.y -= a.vy * dt
        const dx = Math.sin(a.ph) * a.amp
        a.el.style.transform = `translate(${a.x + dx - a.r}px,${a.y - a.r}px)`
        if (a.y < h * 0.06 + a.r) {                       // pops at the surface
          a.el.remove(); amb.current.splice(i, 1)
        }
      }

      // draw: orbs + frames, then burst FX, on the field canvas
      const cv = canvasRef.current
      if (cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr) }
        const ctx = cv.getContext('2d')
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, w, h)
          for (const b of bubblesRef.current) {
            if (gone.has(b.key)) continue
            const p = phys.current[b.key]
            if (!p) continue
            const bob = Math.sin(p.ph * 2 + p.sx) * 1.5
            // new round's orbs fade + scale in together instead of popping in at once
            const fadeIn = Math.min(1, (t - p.spawn) / 420)
            const ease = 1 - (1 - fadeIn) * (1 - fadeIn)   // ease-out
            const scale = 0.6 + 0.4 * ease
            const r = p.r * scale
            drawOrb(ctx, p.x, p.y + bob, r, b.col, ease)
            drawWord(ctx, p.x, p.y + bob, r, b.text, ease)
            drawFrame(ctx, p.x, p.y + bob, r, ease)
          }
          fx.current.update(dts)
          fx.current.draw(ctx, t)
        }
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [gone])

  // ---- per-round countdown ------------------------------------------------
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

  useEffect(() => { if (items.length === 0) finish() }, [items.length, finish])

  useEffect(() => () => {
    clearTimers()
    if (fbTimer.current) clearTimeout(fbTimer.current)
    cancelAnimationFrame(rafRef.current)
    amb.current.forEach((a) => a.el.remove()); amb.current = []
    fx.current.clear()
  }, [clearTimers])

  if (items.length === 0) {
    return (
      <div className="bubblepop"><div className="bp-stage"><div className="bp-sky" /><div className="bp-wait">Nothing to play</div></div></div>
    )
  }
  if (!item) {
    return <div className="bubblepop"><div className="bp-stage"><div className="bp-sky" /></div></div>
  }

  const ringOffset = RC * (1 - timeLeft / ROUND_SECONDS)

  return (
    <div className="bubblepop">
      <div className="bp-stage">
        <div className="bp-sky" />
        <div className="bp-cloud" style={{ top: 40, left: -20, width: 120, height: 46 }} />
        <div className="bp-cloud" style={{ top: 70, right: -30, width: 150, height: 56 }} />
        <div className="bp-bushes" />

        <div className="bp-title"><span className="b">Bubble </span><span className="p">Pop</span></div>

        <div className="bp-qbar">
          <div className="q">?</div>
          <div className="qt">Pop the right bubble: <b lang="en">{item.front}</b></div>
        </div>

        <div className="bp-stat">
          <span className="st">&#9733;</span><span>{score}</span>
          <span className="dv" /><span className="s2">{idx + 1}/{items.length}</span>
        </div>

        <div className="bp-ring">
          <svg width="66" height="66">
            <circle cx="33" cy="33" r="28" fill="#fff" stroke="#E3E9F5" strokeWidth="6" />
            <circle className="arc" cx="33" cy="33" r="28" fill="none" stroke="#3FA9E6" strokeWidth="6"
              strokeLinecap="round" strokeDasharray={RC} strokeDashoffset={ringOffset} transform="rotate(-90 33 33)" />
          </svg>
          <div className="v"><b>{timeLeft}</b><s>SEC</s></div>
        </div>

        <div className="bp-field" ref={fieldRef}>
          {ready && <canvas className="bp-canvas" ref={canvasRef} onPointerDown={onCanvasDown} />}
        </div>

        <div className={`bp-fb ${fb.show ? 'show' : ''}`}>
          <div className={`c ${fb.ok ? '' : 'bad'}`}>{fb.ok ? 'Correct!' : 'Try again!'}</div>
          <div className="s">{fb.ok ? 'Way to go!' : 'Give it another shot'}</div>
        </div>

        {over && (
          <div className="bp-over"><h2>Round complete!</h2><p>Score {score}</p><button onClick={finish}>Continue</button></div>
        )}
      </div>
    </div>
  )
}
