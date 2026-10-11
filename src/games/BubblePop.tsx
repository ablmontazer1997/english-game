import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sfx } from '../services/audio'
import type { MiniGameProps } from './types'
import { BurstFx, ORB_COLORS, SPRITE_REACH, drawBubble, drawTapRing, drawWordPlate, loadSprites, type OrbColor } from './bubbleOrb'
import bubViolet from '../assets/es2/games/bub_violet.webp'
import bubBlue from '../assets/es2/games/bub_blue.webp'
import bubGreen from '../assets/es2/games/bub_green.webp'
import bubGold from '../assets/es2/games/bub_gold.webp'
import plateViolet from '../assets/es2/games/plate_violet.webp'
import sparkRing from '../assets/es2/games/spark_ring.webp'
import timerRing from '../assets/es2/games/timer_ring.webp'
import comboChip from '../assets/es2/games/combo_chip.webp'
import '../components/eskit.css'
import { GameTitle } from '../components/GameTitle'
import './scene.css'
import './bubblepop.css'
import { useStageCtl, usePausedRef, explain, payloadOf, bubbleMode } from './coach'

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
const RC2 = 490.1 // 2πr for r=78 on the painted timer ring (viewBox 220 x 197)


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

export function BubblePop({ items, onFinish, onAnswer, srv }: MiniGameProps) {
  const ctl = useStageCtl()
  const pausedRef = usePausedRef()
  // Phase C: no clock in Focus mode and in the tutorial's practice bubble; it stands still while a card is open
  const timerOff = ctl.focus || ctl.practice
  const marks = useRef<Record<string, HTMLDivElement | null>>({})   // practice: one marker per bubble (the ghost hand taps the right one)
  const revealRef = useRef<string | null>(null)          // the right bubble glows after a wrong pick / time out
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
  const [combo, setCombo] = useState(0)   // ES redesign: client-side streak chip (visual only, scoring unchanged)
  const squash = useRef<Record<string, { t: number; ok: boolean }>>({})
  const taps = useRef<{ x: number; y: number; r: number; t: number }[]>([])
  const maxComboRef = useRef(0)
  const lockedRef = useRef(false)
  const finishedRef = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const item = items[idx]
  const pay = payloadOf(srv, item?.id)
  const mode = bubbleMode(pay)   // 'syn': 1-2 word synonyms; 'def': definitions (older items, syn_ok = false)

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
      // ES redesign 10-11: big bubbles as in the concept; long options (definitions) shrink them and wrap on the plate
      sz: o.text.length > 24 ? 92 : o.text.length > 14 ? 100 : o.text.length > 8 ? 108 : 116,
    }))
  }, [item])
  bubblesRef.current = bubbles
  goneRef.current = gone
  // mock previews only (?mock=1): the screenshot checks read the live bubbles to tap a right or a wrong one
  useEffect(() => {
    if (typeof location === 'undefined' || !new URLSearchParams(location.search).has('mock')) return
    const w = window as unknown as { __bp?: () => unknown }
    w.__bp = () => bubblesRef.current.filter((b) => !goneRef.current.has(b.key)).map((b) => ({ ...phys.current[b.key], ok: b.correct }))
    return () => { delete w.__bp }
  }, [])
  useEffect(() => { loadSprites({ purple: bubViolet, blue: bubBlue, green: bubGreen, gold: bubGold, plate: plateViolet, ring: sparkRing }) }, [])

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
      const m = r * SPRITE_REACH // keep the whole bubble with its gem caps inside the field
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
      revealRef.current = null
      setGone(new Set())
      setFb((f) => ({ ...f, show: false }))
      setIdx((i) => i + 1)
    }
  }, [idx, items.length, finish, later])

  // ---- pop sound: the admin's Pixabay bubble pop (#419513, msg 4333), replaces the synthesized thump
  const playPop = useCallback(() => { sfx('bubble', 0.9) }, [])

  // ---- burst an orb at a field-local point (tap point drives the film tear)
  const burst = useCallback((b: Bubble, p: Phys, px: number, py: number) => {
    playPop()
    fx.current.burst(p.x, p.y, p.r, b.col, b.text, px, py)
  }, [playPop])

  // ---- tapping a bubble ---------------------------------------------------
  const pick = useCallback((b: Bubble, px: number, py: number) => {
    if (lockedRef.current || gone.has(b.key)) return
    const pp = phys.current[b.key]
    // concept 07: the tapped bubble squashes (90 ms) inside a ring of gold sparkles, then pops; a wrong one flashes red
    lockedRef.current = true
    squash.current[b.key] = { t: performance.now(), ok: !!b.correct }
    if (pp) taps.current.push({ x: pp.x, y: pp.y, r: pp.r, t: performance.now() })
    later(() => {
      const p2 = phys.current[b.key]
      if (p2) burst(b, p2, px, py)
      delete squash.current[b.key]
      setGone((g) => new Set(g).add(b.key))
    }, 90)
    if (item) onAnswer?.(item.id, b.text, !!b.correct)

    if (b.correct) {
      lockedRef.current = true
      comboRef.current += 1
      if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current
      setCombo(comboRef.current)
      correctRef.current += 1
      setScore((s) => s + 10 + comboRef.current * 2)
      showFb(true)
      later(advance, 780)
    } else {
      comboRef.current = 0
      setCombo(0)
      lockedRef.current = true
      teach(b.text)
    }
  }, [gone, burst, later, advance, item, onAnswer, showFb])   // eslint-disable-line react-hooks/exhaustive-deps

  /** Phase C: the right bubble glows, then the shared card (the synonym + the definition, rule, "Why?"), then the next word */
  function teach(yours?: string) {
    if (!item) return
    const right = bubblesRef.current.find((x) => x.correct)
    revealRef.current = right?.key ?? null
    const def = typeof pay.definition === 'string' ? pay.definition : undefined
    later(() => {
      ctl.wrong({
        answer: item.back, label: mode === 'syn' ? `A synonym of "${item.front}"` : `"${item.front}" means`, yours,
        meaning: mode === 'syn' && def && def !== item.back ? def : undefined, ...explain(pay),
      }, 900).then(advance)
    }, 450)
  }

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
      const lo = (r: number) => r * SPRITE_REACH + 4   // wall margin = the gem caps' reach beyond the orb
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
            const min = (pa.r + pb.r) * 1.34 + 8   // keep the gem caps (top and bottom) from touching
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
            if (revealRef.current === b.key) {   // the right answer, lit in place behind the card
              ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y + bob, r * 1.32, 0, Math.PI * 2)
              ctx.fillStyle = 'rgba(143, 229, 106, .55)'; ctx.shadowColor = '#8fe56a'; ctx.shadowBlur = 24; ctx.fill(); ctx.restore()
            }
            const mk = marks.current[b.key]   // practice only: markers follow the bubbles (ghost hand, checks)
            if (mk) {
              mk.style.transform = `translate(${p.x - r}px, ${p.y + bob - r}px)`
              mk.style.width = mk.style.height = `${r * 2}px`
            }
            const sq = squash.current[b.key], k = sq ? Math.min(1, (t - sq.t) / 90) : 0
            const sx = sq ? 1 + 0.08 * k : 1, sy = sq ? 1 - 0.08 * k : 1
            drawBubble(ctx, p.x, p.y + bob, r, b.col, ease, sx, sy, sq && !sq.ok ? 1 : 0)
            drawWordPlate(ctx, p.x, p.y + bob, r * sx, b.text, ease)
          }
          taps.current = taps.current.filter((q) => t - q.t < 460)
          for (const q of taps.current) drawTapRing(ctx, q.x, q.y, q.r, (t - q.t) / 460)
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
    if (timerOff) return
    const id = setInterval(() => {
      setTimeLeft((s) => {
        if (lockedRef.current || pausedRef.current) return s
        if (s <= 1) {
          clearInterval(id)
          lockedRef.current = true
          comboRef.current = 0
          if (item) onAnswer?.(item.id, '', false)
          teach()
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

  const ring = (
    <div className="bp-ring bp2-ring">
      <img src={timerRing} alt="" draggable={false} />
      <svg viewBox="0 0 220 197" aria-hidden>
        <circle cx="106" cy="104.5" r="78" fill="none" stroke="#dfe9f6" strokeWidth="17" />
        <circle className="arc" cx="106" cy="104.5" r="78" fill="none" stroke="#2fa2ec" strokeWidth="13"
          strokeLinecap="round" strokeDasharray={RC2} strokeDashoffset={RC2 * (1 - timeLeft / ROUND_SECONDS)} transform="rotate(-90 106 104.5)" />
      </svg>
      <div className="v"><b>{timeLeft}</b></div>
    </div>
  )

  return (
    <div className="bubblepop">
      <div className="bp-stage">
        <div className="bp-sky" />
        <div className="bp-cloud" style={{ top: 40, left: -20, width: 120, height: 46 }} />
        <div className="bp-cloud" style={{ top: 70, right: -30, width: 150, height: 56 }} />
        <div className="bp-bushes" />

        {/* admin 3697: same crest + cream prompt panel as every other mini-game */}
        <div className="bp-crest"><GameTitle title="Bubble Pop" count={`Bubble ${idx + 1} / ${items.length}`} /></div>
        {combo >= 2 && (
          <div className="bp2-combo" key={combo} aria-label={`Streak ${combo}`}><img src={comboChip} alt="" draggable={false} /><b>x{combo}</b></div>
        )}
        {/* concept 07: the gold-rimmed violet task card with its gem crest; the word big in gold; the timer ring inside */}
        <div className="bp-prompt bp2-card gs-panel" data-coach="q">
          <div className="bp2-q">
            <span className="bp2-ask">{mode === 'syn' ? 'Pop the synonym of:' : 'Pop the meaning of:'}</span>
            <b lang="en">{item.front}</b>
            {timerOff && <small>Take your time</small>}
          </div>
          {!timerOff && ring}
        </div>

        <div className="bp-field" ref={fieldRef} data-coach="a" data-coach-parts=".bp-okmark">
          {ready && <canvas className="bp-canvas" ref={canvasRef} onPointerDown={onCanvasDown} />}
          {ctl.practice && bubbles.filter((b) => !gone.has(b.key)).map((b) => (
            <div key={b.key} className="bp-okmark" ref={(el) => { marks.current[b.key] = el }} data-demo={b.correct ? 0 : undefined} data-bad={b.correct ? undefined : 1} aria-hidden />
          ))}
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
