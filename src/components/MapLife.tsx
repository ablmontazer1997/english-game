import { useEffect, useRef } from 'react'
import LIFE from '../assets/sky/life/life.json'

/* MapLife — ambient life on the home map, without touching the painting.

   The map is one finished painting. pipeline/sky/cut_life.py cuts soft-alpha
   cutouts of the tree canopies and the waterfall sheets out of the painting's
   OWN pixels; this canvas draws them back over their exact spot, animated:

   - Trees: the canopy cutout moves as ONE body — a small lean (rotation about
     the trunk top) plus a matching skew, driven by a slow gusty wind (two sines
     + a gust envelope). Every branch moves together. Because the cutout sits on
     top of the baked tree, the few px it travels reveal the original
     underneath, so no gap ever opens.
   - Waterfalls: the approved GateVortex idea — the original sheet's pixels,
     brightness-modulated by a downward-flowing field (wavy lanes + fine
     ripples + a foam pulse at the foot), plus a little rising mist.

   - Clouds: the big painted clouds, cut out and drawn 7% overscaled over their
     own spot, drifting a few px on slow, depth-scaled periods (parallax feel:
     the nearer/bigger the cloud, the more it moves). The overscale means the
     baked twin underneath never peeks out.
   - Crystals: at each crystal tip a light glint fires every few seconds — a
     soft tinted glow plus a thin four-point flare, additive, gone in ~0.7s.

   Everything is drawn in scene coordinates, so it inherits the world colour
   grade applied to .mw-scene exactly like the painting does. */

type Region = { kind: 'tree' | 'fall' | 'cloud'; x: number; y: number; w: number; h: number; pivotY?: number; depth?: number }
type Glint = { x: number; y: number; tint: 'pink' | 'cyan' | 'violet' }
const R = LIFE as unknown as Record<string, Region> & { _map: { w: number; h: number }; _glints: Glint[] }
// every cutout png next to life.json, keyed by basename
const SRC: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/sky/life/*.png', { eager: true, import: 'default' }) as Record<string, string>)
    .map(([path, url]) => [path.split('/').pop()!.replace('.png', ''), url]),
)
const TAU = Math.PI * 2
// the painting's lightest water tone (pale sky-blue, not white): flow highlights blend toward it
const LIGHT_R = 214, LIGHT_G = 240, LIGHT_B = 255
const TINT: Record<Glint['tint'], string> = { pink: '255,170,235', cyan: '170,235,255', violet: '215,175,255' }

type Tree = { key: string; img: HTMLImageElement; r: Region; ph: number; rate: number }
type Cloud = { key: string; img: HTMLImageElement; r: Region; ph: number; depth: number }
type Flare = { g: Glint; next: number; dur: number; rot: number }
type Fall = { key: string; img: HTMLImageElement; r: Region; base: Uint8ClampedArray; out: ImageData; off: HTMLCanvasElement; octx: CanvasRenderingContext2D; ph: number }
type Mist = { u: number; v: number; life: number; age: number; s: number }

const SIN = new Float32Array(2048)
for (let i = 0; i < 2048; i++) SIN[i] = Math.sin((i / 2048) * TAU)
const sinT = (x: number) => SIN[((x % 1 + 1) % 1 * 2048) | 0]   // x in turns

export function MapLife({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trees = useRef<Tree[]>([])
  const falls = useRef<Fall[]>([])
  const clouds = useRef<Cloud[]>([])
  const mist = useRef<Mist[]>([])
  const flares = useRef<Flare[]>((R._glints || []).map((g) => ({ g, next: 1 + Math.random() * 5, dur: 0.55 + Math.random() * 0.35, rot: Math.random() * TAU })))

  // load the cutouts once; waterfalls also get an offscreen buffer at native res
  useEffect(() => {
    let alive = true
    const ts: Tree[] = [], fs: Fall[] = [], cs: Cloud[] = []
    for (const key of Object.keys(SRC)) {
      const r = R[key]
      if (!r) continue
      const img = new Image()
      img.src = SRC[key]
      img.onload = () => {
        if (!alive) return
        if (r.kind === 'tree') {
          ts.push({ key, img, r, ph: Math.random() * TAU, rate: 0.85 + Math.random() * 0.3 })
        } else if (r.kind === 'cloud') {
          cs.push({ key, img, r, ph: Math.random() * TAU, depth: r.depth ?? 0.7 })
        } else {
          const off = document.createElement('canvas')
          off.width = r.w; off.height = r.h
          const octx = off.getContext('2d', { willReadFrequently: true })!
          octx.drawImage(img, 0, 0)
          const base = new Uint8ClampedArray(octx.getImageData(0, 0, r.w, r.h).data)
          fs.push({ key, img, r, base, out: octx.createImageData(r.w, r.h), off, octx, ph: Math.random() })
        }
        trees.current = ts; falls.current = fs; clouds.current = cs
      }
    }
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !width || !height) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr)
    const ctx = cv.getContext('2d')!
    const scale = width / R._map.w
    const start = performance.now()
    let raf = 0, lastFall = 0

    const drawTree = (tr: Tree, t: number) => {
      const { r } = tr
      const dx = r.x * scale, dy = r.y * scale, dw = r.w * scale, dh = r.h * scale
      const pivotY = dy + ((r.pivotY ?? r.y + r.h) - r.y) * scale   // trunk top: the canopy hinges here
      const px = dx + dw / 2
      // one wind signal for the whole canopy: a slow gust envelope × two sines
      const g = 0.6 + 0.4 * Math.sin(t * 0.23 * tr.rate + tr.ph)
      const wind = g * (0.7 * Math.sin(t * 1.0 * tr.rate + tr.ph) + 0.3 * Math.sin(t * 2.2 * tr.rate + tr.ph * 1.7))
      // the canopy moves as ONE body: a small lean (rotation about the trunk)
      // plus a matching sideways skew, so the crown travels a few px and the
      // trunk stays put — every branch together, no row-by-row wobble
      const lean = wind * 0.12                                      // radians (~7° max)
      const skew = wind * 0.2
      ctx.save()
      ctx.translate(px, pivotY)
      ctx.rotate(lean)
      ctx.transform(1, 0, skew, 1, 0, 0)
      ctx.drawImage(tr.img, dx - px, dy - pivotY, dw, dh)
      ctx.restore()
    }

    const drawFall = (fa: Fall, t: number, step: boolean) => {
      const { r, base, out } = fa
      if (step) {
        const od = out.data
        const tt = t * 0.16 + fa.ph                                   // turns
        for (let y = 0, p = 0; y < r.h; y++) {
          const v = y / r.h
          const foot = Math.exp(-(((1 - v) / 0.14) ** 2))              // foam at the foot
          for (let x = 0; x < r.w; x++, p += 4) {
            const a = base[p + 3]
            if (a === 0) { od[p + 3] = 0; continue }
            const u = x / r.w
            // fronts sliding straight down (only a gentle wobble across the width,
            // so they stay vertical like falling water, not diagonal bands)
            const lane = 0.5 + 0.5 * sinT(v * 8 - tt * 1.4 + 0.18 * sinT(u * 2.0 + tt * 0.3))
            const fine = 0.5 + 0.5 * sinT(v * 21 - tt * 3.1 + 0.12 * sinT(u * 5.0))
            const foam = foot * 0.35 * (0.5 + 0.5 * sinT(tt * 2.2 + u * 5 + v * 3))
            // never multiply (that pushed dark pixels darker and clipped bright ones
            // to white): blend each pixel a little toward the painting's own light
            // water tone, so every streak stays inside the blue range
            const k = 0.30 * lane * lane + 0.10 * fine + foam
            od[p] = base[p] + (LIGHT_R - base[p]) * k
            od[p + 1] = base[p + 1] + (LIGHT_G - base[p + 1]) * k
            od[p + 2] = base[p + 2] + (LIGHT_B - base[p + 2]) * k
            od[p + 3] = a
          }
        }
        fa.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(fa.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    }

    const drawCloud = (c: Cloud, t: number) => {
      const { r } = c
      const cx = (r.x + r.w / 2) * scale, cy = (r.y + r.h / 2) * scale
      const w = r.w * scale * 1.07, h = r.h * scale * 1.07       // overscale: always covers the baked twin
      const period = 38 + 26 * (1 - c.depth)                       // far clouds drift slower and less
      const dx = width * 0.012 * c.depth * Math.sin((t / period) * TAU + c.ph)
      const dy = width * 0.003 * c.depth * Math.sin((t / (period * 0.63)) * TAU + c.ph * 1.3)
      ctx.drawImage(c.img, cx - w / 2 + dx, cy - h / 2 + dy, w, h)
    }

    const drawGlints = (t: number) => {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const f of flares.current) {
        const k = (t - f.next) / f.dur
        if (k < 0) continue
        if (k > 1) { f.next = t + 2.5 + Math.random() * 5; f.rot = Math.random() * TAU; continue }
        const s = Math.sin(Math.PI * k)                            // 0 → 1 → 0
        const x = f.g.x * scale, y = f.g.y * scale, c = TINT[f.g.tint]
        // soft tinted glow on the crystal tip
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 16 * scale)
        gr.addColorStop(0, `rgba(${c},${0.55 * s})`); gr.addColorStop(0.4, `rgba(${c},${0.18 * s})`); gr.addColorStop(1, `rgba(${c},0)`)
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 16 * scale, 0, TAU); ctx.fill()
        // thin four-point flare, slightly rotated per firing
        const L = (10 + 16 * s) * scale, wdt = 1.1 * scale
        ctx.translate(x, y); ctx.rotate(f.rot + k * 0.35)
        ctx.fillStyle = `rgba(255,255,255,${0.85 * s})`
        for (const [lx, ly] of [[L, wdt], [L * 0.6, wdt * 0.8]]) {
          ctx.beginPath(); ctx.moveTo(-lx, 0); ctx.lineTo(0, -ly); ctx.lineTo(lx, 0); ctx.lineTo(0, ly); ctx.closePath(); ctx.fill()
          ctx.rotate(Math.PI / 2)
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      ctx.restore()
    }

    const drawMist = (fa: Fall, dt: number) => {
      const { r } = fa
      const m = mist.current
      if (m.length < 14 && Math.random() < dt * 6) m.push({ u: 0.15 + Math.random() * 0.7, v: 0.98, life: 1.4 + Math.random() * 1.2, age: 0, s: 2 + Math.random() * 3 })
      ctx.save()
      for (let i = m.length - 1; i >= 0; i--) {
        const p = m[i]
        p.age += dt
        if (p.age > p.life) { m.splice(i, 1); continue }
        const k = p.age / p.life
        const x = (r.x + r.w * (p.u + Math.sin(k * 4 + p.s) * 0.06)) * scale
        const y = (r.y + r.h * (p.v - k * 0.16)) * scale
        const a = 0.28 * Math.sin(Math.PI * k)
        const rad = p.s * (1 + k * 1.4) * scale * 1.6
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rad)
        gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gr
        ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill()
      }
      ctx.restore()
    }

    let lastT = start
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden) return
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now
      const stepFall = now - lastFall >= 33                          // waterfall pixels at ~30fps
      if (stepFall) lastFall = now
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      for (const c of clouds.current) drawCloud(c, t)
      for (const fa of falls.current) drawFall(fa, t, stepFall)
      for (const tr of trees.current) drawTree(tr, t)
      const big = falls.current.find((f) => f.key === 'fall_l')
      if (big) drawMist(big, dt)
      drawGlints(t)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [width, height])

  return <canvas className="mw-life" ref={canvasRef} aria-hidden="true" />
}
