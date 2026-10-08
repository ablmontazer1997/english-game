import { useEffect, useRef, type RefObject } from 'react'

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
   - Final Gate: the swirl inside the arch, cut from the painting like the
     waterfalls and animated the approved GateVortex way — the original swirl
     pixels, brightness-modulated by a spiral flowing into the core, a pulsing
     core, and sparkles streaming inward. Always on (it used to be a still).
   - Crystals: at each crystal tip a light glint fires every few seconds — a
     soft tinted glow plus a thin four-point flare, additive, gone in ~0.7s.

   - Set pieces (extras): aurora ribbons, shooting stars, rising sky
     lanterns, schools of fish, drifting jellyfish, candy balloons, shimmering
     sun rays, a breathing moon halo, desert heat haze, flocks of birds.
   - Weather (fx): each world can add a light particle layer of its own —
     snow, embers, falling leaves, blowing sand, bubbles, fireflies, sprinkles,
     steam puffs, petals or stardust — drawn procedurally over the painting.

   Everything is drawn in scene coordinates, so it inherits the world colour
   grade applied to .mw-scene exactly like the painting does. */

type Region = { light?: [number, number, number]; amp?: number; kind: 'tree' | 'fall' | 'cloud' | 'gate' | 'sway' | 'pool'; x: number; y: number; w: number; h: number; pivotY?: number; depth?: number; cx?: number; cy?: number; rx?: number; ry?: number }
type Glint = { x: number; y: number; s?: number; tint: 'pink' | 'cyan' | 'violet' | 'gold' | 'white' }
/** tint: a cold glow (glowing runes, crystal lamps) instead of the warm flame */
type Lamp = { x: number; y: number; r: number; tint?: Glint['tint'] }
export type LifeData = Record<string, Region> & { _map: { w: number; h: number }; _glints?: Glint[]; _lamps?: Lamp[] }
export type Fx = 'snow' | 'embers' | 'leaves' | 'sand' | 'bubbles' | 'fireflies' | 'sprinkles' | 'steam' | 'petals' | 'stars' | 'sparkles' | 'pages' | 'motes'
/** set pieces drawn over a world's sky/scene, on top of its weather */
export type Extra = 'aurora' | 'shooting' | 'lanterns' | 'fish' | 'jelly' | 'balloons' | 'rays' | 'moon' | 'heat' | 'birds' | 'books' | 'butterflies' | 'brooms' | 'runes'
type Particle = { x: number; y: number; vx: number; vy: number; s: number; age: number; life: number; ph: number; c: number }
const TAU = Math.PI * 2
// the painting's lightest water tone (pale sky-blue, not white): flow highlights blend toward it
const LIGHT_R = 214, LIGHT_G = 240, LIGHT_B = 255
const TINT: Record<Glint['tint'], string> = { pink: '255,170,235', cyan: '170,235,255', violet: '215,175,255', gold: '255,220,140', white: '235,245,255' }

type Tree = { key: string; img: HTMLImageElement; r: Region; ph: number; rate: number }
type Cloud = { key: string; img: HTMLImageElement; r: Region; ph: number; depth: number }
type Flare = { g: Glint; next: number; dur: number; rot: number }
type Fall = { key: string; img: HTMLImageElement; r: Region; base: Uint8ClampedArray; out: ImageData; off: HTMLCanvasElement; octx: CanvasRenderingContext2D; ph: number; w?: Float32Array }
type Gate = { r: Region; base: Uint8ClampedArray; out: ImageData; off: HTMLCanvasElement; octx: CanvasRenderingContext2D; rr: Float32Array; th: Float32Array }
type Mist = { u: number; v: number; life: number; age: number; s: number }

const SIN = new Float32Array(2048)
for (let i = 0; i < 2048; i++) SIN[i] = Math.sin((i / 2048) * TAU)
const sinT = (x: number) => SIN[((x % 1 + 1) % 1 * 2048) | 0]   // x in turns

/** anchor: the scroller a viewport-sized weather layer is pinned in (tall worlds): its particles are
 *  shifted by the scroll so they stay put on the scene, and wrap around instead of leaving the screen */
export function MapLife({ width, height, life: R, src: SRC, fx, extras, anchor }: {
  width: number; height: number; life: LifeData; src: Record<string, string>; fx?: Fx; extras?: Extra[]
  anchor?: RefObject<HTMLElement | null>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // a tall world stacks several of these: only the ones on screen are drawn
  const onScreen = useRef(true)
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { onScreen.current = e.isIntersecting }, { rootMargin: '120px 0px' })
    io.observe(cv)
    return () => io.disconnect()
  }, [])
  const trees = useRef<Tree[]>([])
  const falls = useRef<Fall[]>([])
  const clouds = useRef<Cloud[]>([])
  const mist = useRef<Mist[]>([])
  const gate = useRef<Gate | null>(null)
  const flares = useRef<Flare[]>([])
  const parts = useRef<Particle[]>([])

  // load the cutouts once; waterfalls also get an offscreen buffer at native res
  useEffect(() => {
    let alive = true
    const ts: Tree[] = [], fs: Fall[] = [], cs: Cloud[] = []
    trees.current = []; falls.current = []; clouds.current = []; gate.current = null; mist.current = []; parts.current = []
    flares.current = (R._glints || []).map((g) => ({ g, next: 1 + Math.random() * 5, dur: 0.55 + Math.random() * 0.35, rot: Math.random() * TAU }))
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
        } else if (r.kind === 'gate') {
          const off = document.createElement('canvas')
          off.width = r.w; off.height = r.h
          const octx = off.getContext('2d', { willReadFrequently: true })!
          octx.drawImage(img, 0, 0)
          const base = new Uint8ClampedArray(octx.getImageData(0, 0, r.w, r.h).data)
          // polar coords about the swirl core, normalised to the arch
          const rr = new Float32Array(r.w * r.h), th = new Float32Array(r.w * r.h)
          for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) {
            const nx = (r.x + i - r.cx!) / r.rx!, ny = (r.y + j - r.cy!) / r.ry!
            rr[j * r.w + i] = Math.hypot(nx, ny); th[j * r.w + i] = Math.atan2(ny, nx)
          }
          gate.current = { r, base, out: octx.createImageData(r.w, r.h), off, octx, rr, th }
        } else {
          const off = document.createElement('canvas')
          off.width = r.w; off.height = r.h
          const octx = off.getContext('2d', { willReadFrequently: true })!
          octx.drawImage(img, 0, 0)
          const base = new Uint8ClampedArray(octx.getImageData(0, 0, r.w, r.h).data)
          const fa: Fall = { key, img, r, base, out: octx.createImageData(r.w, r.h), off, octx, ph: Math.random() }
          fs.push(fa)
          // <key>_w.png: a grey weight map of the tree crown — only the crown moves, trunk and grass stay put
          if (r.kind === 'sway' && SRC[key + '_w']) {
            const wi = new Image()
            wi.src = SRC[key + '_w']
            wi.onload = () => {
              if (!alive) return
              const c = document.createElement('canvas'); c.width = r.w; c.height = r.h
              const cx = c.getContext('2d', { willReadFrequently: true })!
              cx.drawImage(wi, 0, 0, r.w, r.h)
              const d = cx.getImageData(0, 0, r.w, r.h).data, w = new Float32Array(r.w * r.h)
              for (let i = 0; i < w.length; i++) w[i] = d[i * 4] / 255
              fa.w = w
            }
          }
        }
        trees.current = ts; falls.current = fs; clouds.current = cs
      }
    }
    return () => { alive = false }
  }, [R, SRC])

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
      ctx.scale(1.03, 1.03)                                         // hide the baked twin under the sway
      ctx.drawImage(tr.img, dx - px, dy - pivotY, dw, dh)
      ctx.restore()
    }

    const drawFall = (fa: Fall, t: number, step: boolean) => {
      const { r, base, out } = fa
      if (step) {
        const od = out.data
        const tt = t * 0.16 + fa.ph                                   // turns
        const [LR, LG, LB] = r.light ?? [LIGHT_R, LIGHT_G, LIGHT_B]    // lava / chocolate / sand falls carry their own light tone
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
            od[p] = base[p] + (LR - base[p]) * k
            od[p + 1] = base[p + 1] + (LG - base[p + 1]) * k
            od[p + 2] = base[p + 2] + (LB - base[p + 2]) * k
            od[p + 3] = a
          }
        }
        fa.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(fa.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    }

    // foliage / banners in the wind: the painted rectangle is resampled with a sideways
    // offset that is zero at the pivot row (trunk / banner rod) and fades to zero on the
    // other borders, so the edit never shows a seam; a gust envelope drives the whole piece
    // a tree crown in the wind (weight-mapped sway): the whole crown leans from the trunk,
    // more the higher it is, with a slow gust envelope; on top of that the puffs roll a
    // little on their own (2D, not row by row). Sky around the crown is resampled too, so
    // the crown really travels over it; the weight map fades to zero at the rect border
    const drawCrown = (fa: Fall, t: number, step: boolean) => {
      const { r, base, out } = fa, w = fa.w!
      if (step) {
        const od = out.data, W = r.w, H = r.h, piv = (r.pivotY ?? r.y + r.h) - r.y, ph = fa.ph * 6
        const g = 0.6 + 0.4 * Math.sin(t * 0.21 + ph)
        const lean = g * (0.72 * Math.sin(t * 0.85 + ph) + 0.28 * Math.sin(t * 1.9 + ph * 1.3))
        const A = r.amp ?? 10, fl = A * 0.16
        const k = 0.11, sx0 = Math.sin(t * 2.3 + ph), cx0 = Math.cos(t * 2.3 + ph)
        const sy0 = Math.sin(t * 1.7 + ph * 0.7), cy0 = Math.cos(t * 1.7 + ph * 0.7)
        for (let y = 0, p = 0; y < H; y++) {
          const hn = Math.max(0, Math.min(1, (piv - y) / piv)), bend = A * lean * hn ** 1.3
          const sy = Math.sin(y * k * 0.8), cy = Math.cos(y * k * 0.8)
          for (let x = 0; x < W; x++, p += 4) {
            const wv = w[p >> 2]
            if (wv <= 0.004) { od[p] = base[p]; od[p + 1] = base[p + 1]; od[p + 2] = base[p + 2]; od[p + 3] = 255; continue }
            let sx = x, sy2 = y
            {
              const ax = Math.sin(x * k), bx = Math.cos(x * k)
              const px = (sx0 * bx + cx0 * ax) * cy + (cx0 * bx - sx0 * ax) * sy   // sin(t·2.3 + x·k + y·k·.8)
              const py = (sy0 * bx - cy0 * ax) * cy - (cy0 * bx + sy0 * ax) * sy   // ~ an independent roll for y
              sx = x - wv * (bend + fl * px)
              sy2 = y - wv * (fl * 0.7 * py + Math.abs(bend) * 0.08)
              if (sx < 0) sx = 0; else if (sx > W - 1.001) sx = W - 1.001
              if (sy2 < 0) sy2 = 0; else if (sy2 > H - 1.001) sy2 = H - 1.001
            }
            const x0 = sx | 0, y0 = sy2 | 0, fx = sx - x0, fy = sy2 - y0, q = (y0 * W + x0) * 4, q2 = q + W * 4
            for (let c = 0; c < 3; c++) {
              const a = base[q + c] + (base[q + 4 + c] - base[q + c]) * fx
              const b = base[q2 + c] + (base[q2 + 4 + c] - base[q2 + c]) * fx
              od[p + c] = a + (b - a) * fy
            }
            od[p + 3] = 255
          }
        }
        fa.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(fa.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    }

    const drawSway = (fa: Fall, t: number, step: boolean) => {
      if (fa.w) return drawCrown(fa, t, step)
      const { r, base, out } = fa
      if (step) {
        const od = out.data, W = r.w, H = r.h, piv = (r.pivotY ?? r.y + r.h) - r.y, span = Math.max(piv, H - piv) || 1
        const g = 0.55 + 0.45 * Math.sin(t * 0.3 + fa.ph * 6)
        const amp = (r.amp ?? 4) * g
        for (let y = 0, p = 0; y < H; y++) {
          const f = Math.min(1, Math.abs(y - piv) / span) ** 1.3, v = y / H
          const wy = Math.min(1, Math.min(v, 1 - v) * 8 + (Math.abs(y - piv) < 2 ? 0 : 0))
          const rowWave = Math.sin(t * 1.3 + fa.ph * 6 + y * 0.012) * 0.75 + Math.sin(t * 2.9 + y * 0.05 + fa.ph) * 0.25
          for (let x = 0; x < W; x++, p += 4) {
            const u = x / W, wx = Math.min(1, Math.min(u, 1 - u) * 7)
            const dx = amp * f * wx * wy * (rowWave + 0.18 * Math.sin(t * 4.1 + x * 0.09 + y * 0.07))
            let sx = x - dx; if (sx < 0) sx = 0; else if (sx > W - 1.001) sx = W - 1.001
            const x0 = sx | 0, fr = sx - x0, q = (y * W + x0) * 4
            od[p] = base[q] + (base[q + 4] - base[q]) * fr
            od[p + 1] = base[q + 1] + (base[q + 5] - base[q + 1]) * fr
            od[p + 2] = base[q + 2] + (base[q + 6] - base[q + 2]) * fr
            od[p + 3] = 255
          }
        }
        fa.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(fa.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    }

    // still water: gentle cross ripples resample the painted pool, and soft glints slide over it
    const drawPool = (fa: Fall, t: number, step: boolean) => {
      const { r, base, out } = fa
      if (step) {
        const od = out.data, W = r.w, H = r.h
        for (let y = 0, p = 0; y < H; y++) {
          for (let x = 0; x < W; x++, p += 4) {
            const a = base[p + 3]
            if (a === 0) { od[p + 3] = 0; continue }
            const dx = 1.1 * Math.sin(y * 0.55 + t * 2.1) + 0.5 * Math.sin((x + y) * 0.21 - t * 1.4)
            const dy = 0.6 * Math.sin(x * 0.17 + t * 1.7)
            let sx = Math.round(x + dx), sy = Math.round(y + dy)
            sx = sx < 0 ? 0 : sx >= W ? W - 1 : sx; sy = sy < 0 ? 0 : sy >= H ? H - 1 : sy
            const q = (sy * W + sx) * 4
            const gl = (0.5 + 0.5 * Math.sin(x * 0.09 + y * 0.32 - t * 2.4)) ** 6 * 0.35 + (0.5 + 0.5 * Math.sin(x * 0.23 - y * 0.15 + t * 1.3)) ** 8 * 0.2
            od[p] = base[q] + (255 - base[q]) * gl
            od[p + 1] = base[q + 1] + (255 - base[q + 1]) * gl
            od[p + 2] = base[q + 2] + (255 - base[q + 2]) * gl
            od[p + 3] = a
          }
        }
        fa.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(fa.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
    }

    // lanterns, windows and braziers breathe and flicker like real flames
    const lampPh = (R._lamps || []).map(() => Math.random() * TAU)
    const drawLamps = (t: number) => {
      const L = R._lamps
      if (!L || !L.length) return
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      L.forEach((l, i) => {
        const ph = lampPh[i]
        const fl = 0.62 + 0.2 * Math.sin(t * 2.3 + ph) + 0.12 * Math.sin(t * 7.9 + ph * 3) + 0.06 * Math.sin(t * 17 + ph * 5)
        const x = l.x * scale, y = l.y * scale, rad = Math.max(6, l.r * 3.2) * scale
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
        if (l.tint) {
          const c = TINT[l.tint]
          g.addColorStop(0, `rgba(${c},${0.5 * fl})`); g.addColorStop(0.3, `rgba(${c},${0.2 * fl})`); g.addColorStop(1, `rgba(${c},0)`)
        } else { g.addColorStop(0, `rgba(255,214,140,${0.55 * fl})`); g.addColorStop(0.3, `rgba(255,170,80,${0.22 * fl})`); g.addColorStop(1, 'rgba(255,150,60,0)') }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill()
      })
      ctx.restore()
    }

    const drawGate = (g: Gate, t: number, step: boolean) => {
      const { r, base, out, rr, th } = g
      const tt = t / 4.5                                           // one full turn of the flow every 4.5 s
      if (step) {
        const od = out.data, ph = TAU * tt
        for (let idx = 0, p = 0; idx < rr.length; idx++, p += 4) {
          const a = base[p + 3]
          if (a === 0) { od[p + 3] = 0; continue }
          const rad = rr[idx]
          // spiral arms sliding inward, a breathing core, never darker than 0.75x
          const flow = (0.5 + 0.5 * Math.sin(2 * th[idx] + 5.6 * Math.log(rad + 0.12) - 2 * ph)) ** 1.4
          const core = Math.exp(-((rad / 0.22) ** 2)) * (0.8 + 0.25 * Math.sin(ph * 2))
          const mod = 0.78 + 0.5 * flow * Math.max(0, 1 - rad * 0.4) + 0.55 * core
          od[p] = Math.min(255, base[p] * mod)
          od[p + 1] = Math.min(255, base[p + 1] * mod)
          od[p + 2] = Math.min(255, base[p + 2] * mod)
          od[p + 3] = a
        }
        g.octx.putImageData(out, 0, 0)
      }
      ctx.drawImage(g.off, r.x * scale, r.y * scale, r.w * scale, r.h * scale)
      // sparkles streaming into the core along the spiral
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 14; k++) {
        const phase = (tt * 1.1 + k / 14) % 1
        const b = Math.sin(Math.PI * phase)
        if (b <= 0.15) continue
        const q = 0.95 * (1 - phase), ang = (k * 2.6) % TAU + phase * 2.4
        const x = (r.cx! + q * r.rx! * Math.cos(ang)) * scale, y = (r.cy! + q * r.ry! * 0.9 * Math.sin(ang)) * scale
        ctx.fillStyle = `rgba(255,250,255,${0.9 * b})`
        ctx.beginPath(); ctx.arc(x, y, 1.5 * scale * (0.6 + b), 0, TAU); ctx.fill()
      }
      ctx.restore()
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
        const x = f.g.x * scale, y = f.g.y * scale, c = TINT[f.g.tint], gs = f.g.s ?? 1   // s: per-crystal size (big soft crystals need a bigger flare)
        // soft tinted glow on the crystal tip
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 16 * gs * scale)
        gr.addColorStop(0, `rgba(${c},${0.55 * s})`); gr.addColorStop(0.4, `rgba(${c},${0.18 * s})`); gr.addColorStop(1, `rgba(${c},0)`)
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 16 * gs * scale, 0, TAU); ctx.fill()
        // thin four-point flare, slightly rotated per firing
        const L = (10 + 16 * s) * gs * scale, wdt = 1.1 * Math.sqrt(gs) * scale
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

    // ---- weather: one light particle layer per world (scene px units via `scale`)
    const FX: Record<Fx, { n: number; spawn: () => Particle; draw: (p: Particle, k: number, t: number) => void; add?: boolean }> = {
      snow: { n: 70, spawn: () => ({ x: Math.random() * width, y: -10, vx: 0, vy: 18 + Math.random() * 22, s: 1.2 + Math.random() * 2.2, age: 0, life: 99, ph: Math.random() * TAU, c: 0 }),
        draw: (p, _k, t) => { p.x += Math.sin(t * 0.9 + p.ph) * 0.35; dot(p.x, p.y, p.s, 'rgba(255,255,255,0.9)') } },
      embers: { n: 45, add: true, spawn: () => ({ x: Math.random() * width, y: height + 10, vx: 0, vy: -(20 + Math.random() * 30), s: 1 + Math.random() * 1.8, age: 0, life: 4 + Math.random() * 5, ph: Math.random() * TAU, c: 0 }),
        draw: (p, k, t) => { p.x += Math.sin(t * 1.7 + p.ph) * 0.5; glow(p.x, p.y, p.s * 3, `255,${150 + (p.ph * 20 | 0) % 60},60`, Math.sin(Math.PI * k)) } },
      leaves: { n: 26, spawn: () => ({ x: Math.random() * width * 1.2 - width * 0.1, y: -12, vx: 8 + Math.random() * 14, vy: 16 + Math.random() * 16, s: 3 + Math.random() * 3, age: 0, life: 99, ph: Math.random() * TAU, c: Math.random() }),
        draw: (p, _k, t) => { p.x += Math.sin(t * 1.3 + p.ph) * 0.8; leaf(p.x, p.y, p.s, t * 2 + p.ph, p.c < 0.5 ? '#e8742a' : p.c < 0.8 ? '#d9442b' : '#f2b233') } },
      sand: { n: 60, spawn: () => ({ x: -10, y: Math.random() * height, vx: 30 + Math.random() * 40, vy: -3 + Math.random() * 6, s: 0.8 + Math.random() * 1.3, age: 0, life: 99, ph: Math.random() * TAU, c: 0 }),
        draw: (p) => dot(p.x, p.y, p.s, 'rgba(255,226,170,0.75)') },
      bubbles: { n: 40, spawn: () => ({ x: Math.random() * width, y: height + 10, vx: 0, vy: -(14 + Math.random() * 22), s: 1.5 + Math.random() * 3.5, age: 0, life: 99, ph: Math.random() * TAU, c: 0 }),
        draw: (p, _k, t) => { p.x += Math.sin(t * 2 + p.ph) * 0.4; bubble(p.x, p.y, p.s) } },
      fireflies: { n: 34, add: true, spawn: () => ({ x: Math.random() * width, y: height * (0.25 + Math.random() * 0.75), vx: 0, vy: 0, s: 1.4 + Math.random() * 1.4, age: 0, life: 3 + Math.random() * 4, ph: Math.random() * TAU, c: 0 }),
        draw: (p, k, t) => { p.x += Math.sin(t * 0.8 + p.ph) * 0.4; p.y += Math.cos(t * 0.6 + p.ph) * 0.3; glow(p.x, p.y, p.s * 4, '200,255,140', Math.sin(Math.PI * k) * (0.6 + 0.4 * Math.sin(t * 5 + p.ph))) } },
      sprinkles: { n: 40, spawn: () => ({ x: Math.random() * width, y: -10, vx: 0, vy: 20 + Math.random() * 20, s: 2 + Math.random() * 2, age: 0, life: 99, ph: Math.random() * TAU, c: Math.random() }),
        draw: (p, _k, t) => { const cols = ['#ff7eb6', '#7ee0ff', '#ffe066', '#a78bfa', '#7dffb0']; stick(p.x, p.y, p.s, t * 3 + p.ph, cols[(p.c * 5) | 0]) } },
      steam: { n: 16, spawn: () => ({ x: Math.random() * width, y: height * (0.3 + Math.random() * 0.7), vx: 3, vy: -8 - Math.random() * 8, s: 8 + Math.random() * 10, age: 0, life: 4 + Math.random() * 3, ph: 0, c: 0 }),
        draw: (p, k) => puff(p.x, p.y, p.s * (1 + k * 1.5), 0.22 * Math.sin(Math.PI * k)) },
      petals: { n: 34, spawn: () => ({ x: Math.random() * width * 1.2 - width * 0.1, y: -10, vx: 6 + Math.random() * 12, vy: 14 + Math.random() * 14, s: 2.2 + Math.random() * 2, age: 0, life: 99, ph: Math.random() * TAU, c: 0 }),
        draw: (p, _k, t) => { p.x += Math.sin(t * 1.5 + p.ph) * 0.6; leaf(p.x, p.y, p.s, t * 2.5 + p.ph, '#ffc1d9') } },
      stars: { n: 50, add: true, spawn: () => ({ x: Math.random() * width, y: Math.random() * height, vx: 0, vy: 0, s: 1 + Math.random() * 1.6, age: 0, life: 1.5 + Math.random() * 3, ph: Math.random() * TAU, c: 0 }),
        draw: (p, k) => { glow(p.x, p.y, p.s * 3.5, '220,230,255', Math.sin(Math.PI * k)) } },
      // magic sparkles: little four-point stars in crystal colours that rise and twinkle
      sparkles: { n: 40, add: true, spawn: () => ({ x: Math.random() * width, y: height * (0.1 + Math.random() * 0.95), vx: 0, vy: -(4 + Math.random() * 8), s: 1.6 + Math.random() * 2, age: 0, life: 2 + Math.random() * 3, ph: Math.random() * TAU, c: Math.random() }),
        draw: (p, k, t) => { const c = p.c < 0.4 ? '215,175,255' : p.c < 0.75 ? '170,235,255' : '255,225,150'; const a = Math.sin(Math.PI * k) * (0.7 + 0.3 * Math.sin(t * 7 + p.ph)); glow(p.x, p.y, p.s * 2.4, c, a * 0.6); star4(p.x, p.y, p.s * (0.8 + 0.4 * Math.sin(t * 5 + p.ph)), t * 0.8 + p.ph, `rgba(255,255,255,${a})`) } },
      // loose spell-book pages drifting across the library
      pages: { n: 14, spawn: () => ({ x: -20, y: height * (0.05 + Math.random() * 0.8), vx: 14 + Math.random() * 14, vy: -2 + Math.random() * 6, s: 4 + Math.random() * 3, age: 0, life: 99, ph: Math.random() * TAU, c: 0 }),
        draw: (p, _k, t) => { p.y += Math.sin(t * 1.4 + p.ph) * 0.5; page(p.x, p.y, p.s, Math.sin(t * 1.8 + p.ph) * 0.9, Math.cos(t * 2.3 + p.ph)) } },
      // glowing potion motes rising like bubbles from the cauldrons
      motes: { n: 30, add: true, spawn: () => ({ x: Math.random() * width, y: height + 10, vx: 0, vy: -(10 + Math.random() * 16), s: 1.4 + Math.random() * 2.4, age: 0, life: 99, ph: Math.random() * TAU, c: Math.random() }),
        draw: (p, _k, t) => { p.x += Math.sin(t * 1.6 + p.ph) * 0.5; const c = p.c < 0.45 ? '140,255,150' : p.c < 0.8 ? '215,150,255' : '120,220,255'; glow(p.x, p.y, p.s * 3, c, 0.55); bubble(p.x, p.y, p.s * 0.8) } },
    }
    const star4 = (x: number, y: number, r: number, rot: number, c: string) => {
      const R2 = r * scale * 1.6; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c; ctx.beginPath()
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? R2 * 0.28 : R2 * 1.4; ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q) }
      ctx.closePath(); ctx.fill(); ctx.restore()
    }
    const page = (x: number, y: number, r: number, rot: number, flip: number) => {
      const w = r * scale * 1.6, h = w * 1.3; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(0.25 + 0.75 * Math.abs(flip), 1)
      ctx.fillStyle = 'rgba(255,246,222,0.95)'; ctx.fillRect(-w / 2, -h / 2, w, h)
      ctx.strokeStyle = 'rgba(150,110,70,0.55)'; ctx.lineWidth = Math.max(0.5, w * 0.06)
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-w * 0.35, -h / 2 + i * h / 5.5); ctx.lineTo(w * 0.35, -h / 2 + i * h / 5.5); ctx.stroke() }
      ctx.restore()
    }
    const dot = (x: number, y: number, r: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * scale * 1.6, 0, TAU); ctx.fill() }
    const glow = (x: number, y: number, r: number, c: string, a: number) => {
      const R2 = r * scale * 1.6, g = ctx.createRadialGradient(x, y, 0, x, y, R2)
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(0.35, `rgba(${c},${a * 0.45})`); g.addColorStop(1, `rgba(${c},0)`)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R2, 0, TAU); ctx.fill()
    }
    const leaf = (x: number, y: number, r: number, rot: number, c: string) => {
      const R2 = r * scale * 1.6; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(rot)))
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, R2, R2 * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore()
    }
    const stick = (x: number, y: number, r: number, rot: number, c: string) => {
      const R2 = r * scale * 1.6; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = c
      ctx.beginPath(); ctx.roundRect(-R2, -R2 * 0.28, R2 * 2, R2 * 0.56, R2 * 0.28); ctx.fill(); ctx.restore()
    }
    const bubble = (x: number, y: number, r: number) => {
      const R2 = r * scale * 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(0.8, R2 * 0.18)
      ctx.beginPath(); ctx.arc(x, y, R2, 0, TAU); ctx.stroke(); dot(x - R2 * 0.3, y - R2 * 0.3, r * 0.18, 'rgba(255,255,255,0.9)')
    }
    const puff = (x: number, y: number, r: number, a: number) => {
      const R2 = r * scale * 1.6, g = ctx.createRadialGradient(x, y, 0, x, y, R2)
      g.addColorStop(0, `rgba(255,250,240,${a})`); g.addColorStop(1, 'rgba(255,250,240,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R2, 0, TAU); ctx.fill()
    }
    const drawFx = (dt: number, t: number) => {
      if (!fx) return
      const F = FX[fx], ps = parts.current
      const sc = anchor?.current
      if (sc) {
        const st = sc.scrollTop, d = st - lastScroll
        lastScroll = st
        if (d) { const span = height + 45; for (const p of ps) p.y = (((p.y - d + 30) % span) + span) % span - 30 }
      }
      // seed the whole screen at start so it doesn't look empty for the first seconds
      if (!ps.length) for (let i = 0; i < F.n; i++) { const p = F.spawn(); p.y = Math.random() * height; if (p.vx > 20) p.x = Math.random() * width; p.age = Math.random() * Math.min(p.life, 3); ps.push(p) }
      while (ps.length < F.n) ps.push(F.spawn())
      ctx.save(); if (F.add) ctx.globalCompositeOperation = 'lighter'
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.age += dt; p.x += p.vx * dt * scale * 1.6; p.y += p.vy * dt * scale * 1.6
        const k = p.age / p.life
        if (k >= 1 || p.y > height + 20 || p.y < -30 || p.x > width + 30 || p.x < -40) { ps.splice(i, 1); continue }
        F.draw(p, k, t)
      }
      ctx.restore()
    }

    // ---- set pieces
    type Mover = { x: number; y: number; v: number; s: number; ph: number; k: number }
    const movers: Record<string, Mover[]> = {}
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const S = scale * 1.6                                         // ~1 phone px per unit at the reference size
    const EX: Record<Extra, (t: number, dt: number) => void> = {
      aurora: (t) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 3; i++) {
          const y0 = height * (0.05 + i * 0.045), amp = height * 0.025
          const g = ctx.createLinearGradient(0, y0 - amp * 2, 0, y0 + amp * 3)
          const col = i === 1 ? '150,120,255' : '110,255,200'
          const a = 0.10 + 0.07 * Math.sin(t * 0.5 + i * 2)
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.5, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`)
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y0)
          for (let x = 0; x <= width; x += width / 24) ctx.lineTo(x, y0 + amp * Math.sin(x / width * 5 + t * 0.35 + i * 1.7) * Math.sin(t * 0.21 + i))
          for (let x = width; x >= 0; x -= width / 24) ctx.lineTo(x, y0 + amp * 3 + amp * Math.sin(x / width * 4 + t * 0.3 + i))
          ctx.closePath(); ctx.fill()
        }
        ctx.restore()
      },
      shooting: (t, dt) => {
        const m = (movers.shoot ??= [])
        if (m.length < 2 && Math.random() < dt * 0.35) m.push({ x: rnd(0.1, 0.9) * width, y: rnd(0.02, 0.3) * height, v: rnd(220, 340), s: rnd(40, 80), ph: t, k: rnd(0.3, 0.55) })
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
        for (let i = m.length - 1; i >= 0; i--) {
          const p = m[i], age = t - p.ph, life = 1.1
          if (age > life) { m.splice(i, 1); continue }
          const d = age * p.v * S, dx = Math.cos(p.k) * d, dy = Math.sin(p.k) * d, L = p.s * S
          const x = p.x - dx, y = p.y + dy, a = Math.sin(Math.PI * age / life)
          const g = ctx.createLinearGradient(x, y, x + Math.cos(p.k) * L, y - Math.sin(p.k) * L)
          g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.strokeStyle = g; ctx.lineWidth = 1.6 * S; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(p.k) * L, y - Math.sin(p.k) * L); ctx.stroke()
          glow(x, y, 4, '255,255,255', a)
        }
        ctx.restore()
      },
      lanterns: (t, dt) => {
        const m = (movers.lant ??= [])
        if (!m.length) for (let i = 0; i < 14; i++) m.push({ x: rnd(0, 1) * width, y: rnd(0, 1) * height, v: rnd(8, 16), s: rnd(3, 6), ph: rnd(0, TAU), k: 0 })
        ctx.save()
        for (const p of m) {
          p.y -= p.v * dt * S; p.x += Math.sin(t * 0.4 + p.ph) * 0.15 * S
          if (p.y < -20) { p.y = height + 20; p.x = rnd(0, 1) * width }
          const w = p.s * S, h = w * 1.3, fl = 0.85 + 0.15 * Math.sin(t * 6 + p.ph)
          ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, p.s * 3.2, '255,170,70', 0.35 * fl)
          ctx.globalCompositeOperation = 'source-over'
          const g = ctx.createLinearGradient(0, p.y - h / 2, 0, p.y + h / 2)
          g.addColorStop(0, '#ffcf6a'); g.addColorStop(1, '#e8542c')
          ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, w * 0.35); ctx.fill()
        }
        ctx.restore()
      },
      fish: (t, dt) => {
        const m = (movers.fish ??= [])
        if (!m.length) for (let i = 0; i < 3; i++) { const y = rnd(0.2, 0.8) * height, dir = Math.random() < 0.5 ? 1 : -1; for (let j = 0; j < 6; j++) m.push({ x: rnd(0, 1) * width + j * 9 * S * dir, y: y + rnd(-14, 14) * S, v: 26 * dir, s: rnd(3, 4.5), ph: rnd(0, TAU), k: i }) }
        const cols = ['#ffb03a', '#4fd8ff', '#ff6fa8']
        for (const p of m) {
          p.x += p.v * dt * S
          if (p.v > 0 && p.x > width + 30) p.x = -30; if (p.v < 0 && p.x < -30) p.x = width + 30
          const y = p.y + Math.sin(t * 1.4 + p.ph) * 4 * S, w = p.s * S, dir = Math.sign(p.v)
          ctx.save(); ctx.translate(p.x, y); ctx.scale(dir, 1); ctx.fillStyle = cols[p.k % 3]
          ctx.beginPath(); ctx.ellipse(0, 0, w * 1.4, w * 0.7, 0, 0, TAU); ctx.fill()
          const wag = Math.sin(t * 9 + p.ph) * w * 0.35
          ctx.beginPath(); ctx.moveTo(-w * 1.2, 0); ctx.lineTo(-w * 2.2, -w * 0.7 + wag); ctx.lineTo(-w * 2.2, w * 0.7 + wag); ctx.closePath(); ctx.fill()
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(w * 0.7, -w * 0.15, w * 0.22, 0, TAU); ctx.fill()
          ctx.restore()
        }
      },
      jelly: (t, dt) => {
        const m = (movers.jelly ??= [])
        if (!m.length) for (let i = 0; i < 4; i++) m.push({ x: rnd(0.05, 0.95) * width, y: rnd(0.1, 1) * height, v: rnd(6, 11), s: rnd(6, 10), ph: rnd(0, TAU), k: i })
        for (const p of m) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + p.ph)
          p.y -= p.v * (0.4 + pulse) * dt * S
          if (p.y < -40) { p.y = height + 40; p.x = rnd(0.05, 0.95) * width }
          const w = p.s * S * (1 + 0.12 * pulse), h = p.s * S * (0.8 - 0.1 * pulse), c = p.k % 2 ? '255,150,220' : '170,160,255'
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(p.x, p.y, p.s * 2.4, c, 0.25); ctx.restore()
          ctx.fillStyle = `rgba(${c},0.55)`; ctx.beginPath(); ctx.ellipse(p.x, p.y, w, h, 0, Math.PI, TAU); ctx.fill()
          ctx.strokeStyle = `rgba(${c},0.5)`; ctx.lineWidth = 1.1 * S
          for (let j = -2; j <= 2; j++) {
            ctx.beginPath(); ctx.moveTo(p.x + j * w * 0.35, p.y)
            for (let q = 1; q <= 5; q++) ctx.lineTo(p.x + j * w * 0.35 + Math.sin(t * 3 + q + j + p.ph) * 1.6 * S, p.y + q * h * 0.45)
            ctx.stroke()
          }
        }
      },
      balloons: (t, dt) => {
        const m = (movers.ball ??= [])
        if (!m.length) for (let i = 0; i < 6; i++) m.push({ x: rnd(0.05, 0.95) * width, y: rnd(0, 1) * height, v: rnd(7, 12), s: rnd(5, 8), ph: rnd(0, TAU), k: i })
        const cols = ['#ff7eb6', '#7ee0ff', '#ffe066', '#b69cff', '#7dffb0', '#ff9f6b']
        for (const p of m) {
          p.y -= p.v * dt * S; if (p.y < -40) { p.y = height + 40; p.x = rnd(0.05, 0.95) * width }
          const x = p.x + Math.sin(t * 0.7 + p.ph) * 5 * S, r = p.s * S
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8 * S; ctx.beginPath(); ctx.moveTo(x, p.y + r * 1.1)
          ctx.quadraticCurveTo(x + Math.sin(t * 2 + p.ph) * 4 * S, p.y + r * 2.2, x, p.y + r * 3.2); ctx.stroke()
          const g = ctx.createRadialGradient(x - r * 0.35, p.y - r * 0.4, r * 0.1, x, p.y, r * 1.2)
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, cols[p.k % 6]); g.addColorStop(1, cols[p.k % 6])
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, p.y, r * 0.85, r * 1.05, 0, 0, TAU); ctx.fill()
        }
      },
      rays: (t) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 5; i++) {
          const x0 = width * (0.15 + i * 0.18) + Math.sin(t * 0.2 + i) * width * 0.03, a = 0.05 + 0.04 * Math.sin(t * 0.6 + i * 1.9)
          const g = ctx.createLinearGradient(0, 0, 0, height * 0.8)
          g.addColorStop(0, `rgba(230,255,255,${a})`); g.addColorStop(1, 'rgba(230,255,255,0)')
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - width * 0.02, 0); ctx.lineTo(x0 + width * 0.02, 0)
          ctx.lineTo(x0 + width * 0.1 + width * 0.06, height * 0.8); ctx.lineTo(x0 + width * 0.02, height * 0.8); ctx.closePath(); ctx.fill()
        }
        ctx.restore()
      },
      moon: (t) => {
        const mn = R._moon as unknown as { x: number; y: number; r: number } | undefined
        if (!mn) return
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        glow(mn.x * scale, mn.y * scale, mn.r * (1.5 + 0.15 * Math.sin(t * 0.8)) / 1.6, '200,220,255', 0.28 + 0.08 * Math.sin(t * 0.8))
        ctx.restore()
      },
      heat: (t) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < 6; i++) {
          const y = height * (0.35 + i * 0.1) + Math.sin(t * 0.9 + i) * 6 * S
          const g = ctx.createLinearGradient(0, y - 8 * S, 0, y + 8 * S)
          const a = 0.035 + 0.025 * Math.sin(t * 1.7 + i * 2.1)
          g.addColorStop(0, 'rgba(255,230,180,0)'); g.addColorStop(0.5, `rgba(255,230,180,${a})`); g.addColorStop(1, 'rgba(255,230,180,0)')
          ctx.fillStyle = g; ctx.fillRect(0, y - 8 * S, width, 16 * S)
        }
        ctx.restore()
      },
      // enchanted books flapping their covers like wings, drifting between the shelves
      books: (t, dt) => {
        const m = (movers.books ??= [])
        if (!m.length) for (let i = 0; i < 5; i++) m.push({ x: rnd(0, 1) * width, y: rnd(0.08, 0.75) * height, v: rnd(10, 18) * (Math.random() < 0.5 ? 1 : -1), s: rnd(6, 9), ph: rnd(0, TAU), k: i })
        const cols = ['#8e3b46', '#2f5d8a', '#4f7a3a', '#6b3f8f', '#9a6a2c']
        for (const p of m) {
          p.x += p.v * dt * S; if (p.v > 0 && p.x > width + 40) p.x = -40; if (p.v < 0 && p.x < -40) p.x = width + 40
          const y = p.y + Math.sin(t * 1.2 + p.ph) * 8 * S, w = p.s * S, flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 4 + p.ph))
          ctx.save(); ctx.translate(p.x, y); ctx.scale(Math.sign(p.v), 1)
          ctx.globalCompositeOperation = 'lighter'; glow(0, 0, p.s * 1.6, '255,220,150', 0.18); ctx.globalCompositeOperation = 'source-over'
          for (const side of [-1, 1]) {           // two covers hinged at the spine, pages showing inside
            ctx.save(); ctx.scale(side, 1); ctx.transform(1, -flap * 0.55, 0, 1, 0, 0)
            ctx.fillStyle = cols[p.k % 5]; ctx.fillRect(0, -w * 0.45, w, w * 0.9)
            ctx.fillStyle = '#fff4dc'; ctx.fillRect(w * 0.08, -w * 0.38, w * 0.84, w * 0.76)
            ctx.restore()
          }
          ctx.restore()
        }
      },
      // pastel butterflies fluttering over the glade
      butterflies: (t, dt) => {
        const m = (movers.bfly ??= [])
        if (!m.length) for (let i = 0; i < 7; i++) m.push({ x: rnd(0, 1) * width, y: rnd(0.3, 0.95) * height, v: rnd(-8, 8), s: rnd(3, 4.5), ph: rnd(0, TAU), k: i })
        const cols = ['255,170,220', '170,220,255', '255,230,140', '200,170,255']
        for (const p of m) {
          p.x += (p.v + Math.sin(t * 0.7 + p.ph) * 10) * dt * S; p.y += Math.cos(t * 0.9 + p.ph) * 6 * dt * S
          if (p.x > width + 20) p.x = -20; if (p.x < -20) p.x = width + 20
          const w = p.s * S, f = 0.25 + 0.75 * Math.abs(Math.sin(t * 11 + p.ph)), c = cols[p.k % 4]
          ctx.save(); ctx.translate(p.x, p.y)
          ctx.globalCompositeOperation = 'lighter'; glow(0, 0, p.s * 1.8, c, 0.2); ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = `rgba(${c},0.95)`
          for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(side * w * 0.55 * f, -w * 0.2, w * 0.6 * f, w * 0.75, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(side * w * 0.4 * f, w * 0.45, w * 0.4 * f, w * 0.45, 0, 0, TAU); ctx.fill() }
          ctx.fillStyle = 'rgba(70,50,80,0.9)'; ctx.fillRect(-w * 0.08, -w * 0.6, w * 0.16, w * 1.2)
          ctx.restore()
        }
      },
      // students on broomsticks crossing the sky, with a sparkle trail
      brooms: (t, dt) => {
        const m = (movers.brooms ??= [])
        if (m.length < 2 && Math.random() < dt * 0.12) { const dir = Math.random() < 0.5 ? 1 : -1; m.push({ x: dir > 0 ? -40 : width + 40, y: rnd(0.06, 0.4) * height, v: rnd(40, 60) * dir, s: rnd(7, 10), ph: rnd(0, TAU), k: 0 }) }
        for (let i = m.length - 1; i >= 0; i--) {
          const p = m[i]; p.x += p.v * dt * S
          if (p.x < -60 || p.x > width + 60) { m.splice(i, 1); continue }
          const y = p.y + Math.sin(t * 2 + p.ph) * 5 * S, w = p.s * S, dir = Math.sign(p.v)
          ctx.save(); ctx.globalCompositeOperation = 'lighter'
          for (let j = 1; j <= 6; j++) glow(p.x - dir * j * w * 0.55, y + w * 0.1 + Math.sin(t * 6 + j) * 1.5 * S, 1.6, '255,230,160', 0.5 - j * 0.07)
          ctx.restore()
          ctx.save(); ctx.translate(p.x, y); ctx.scale(dir, 1); ctx.rotate(-0.12)
          ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = w * 0.12; ctx.beginPath(); ctx.moveTo(-w * 1.2, 0); ctx.lineTo(w * 1.1, 0); ctx.stroke()
          ctx.fillStyle = '#d9a44a'; ctx.beginPath(); ctx.moveTo(-w * 1.1, 0); ctx.lineTo(-w * 1.9, -w * 0.35); ctx.lineTo(-w * 1.9, w * 0.35); ctx.closePath(); ctx.fill()
          ctx.fillStyle = '#3b2f6b'; ctx.beginPath(); ctx.moveTo(-w * 0.2, 0); ctx.lineTo(w * 0.35, 0); ctx.lineTo(w * 0.1, -w * 0.9); ctx.closePath(); ctx.fill()   // robe
          ctx.fillStyle = '#ffd9b8'; ctx.beginPath(); ctx.arc(w * 0.12, -w * 1.0, w * 0.2, 0, TAU); ctx.fill()                                          // head
          ctx.fillStyle = '#3b2f6b'; ctx.beginPath(); ctx.moveTo(-w * 0.15, -w * 1.1); ctx.lineTo(w * 0.4, -w * 1.1); ctx.lineTo(w * 0.05, -w * 1.65); ctx.closePath(); ctx.fill()  // hat
          ctx.restore()
        }
      },
      // glowing rune glyphs that surface in the air, shimmer and fade
      runes: (t, dt) => {
        const m = (movers.runes ??= [])
        if (m.length < 7 && Math.random() < dt * 1.2) m.push({ x: rnd(0.05, 0.95) * width, y: rnd(0.15, 0.95) * height, v: rnd(3, 6), s: rnd(5, 8), ph: t, k: (Math.random() * 6) | 0 })
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        for (let i = m.length - 1; i >= 0; i--) {
          const p = m[i], age = t - p.ph, life = 3.2
          if (age > life) { m.splice(i, 1); continue }
          const a = Math.sin(Math.PI * age / life), w = p.s * S, y = p.y - age * p.v * S
          glow(p.x, y, p.s * 2, '120,235,255', a * 0.35)
          ctx.strokeStyle = `rgba(170,245,255,${a})`; ctx.lineWidth = 1.3 * S; ctx.beginPath()
          const G = [[[0, -1], [0, 1], [0.6, 0.3]], [[-0.5, -1], [0.5, 0], [-0.5, 1]], [[0, 1], [0, -1], [0.6, -0.4], [0, 0.1]], [[-0.5, 1], [0, -1], [0.5, 1]], [[0, -1], [0, 1], [-0.5, -0.4], [0.5, -0.4]], [[-0.5, -1], [0.5, -1], [0, 0], [0, 1]]][p.k]
          G.forEach(([gx, gy], j) => (j ? ctx.lineTo : ctx.moveTo).call(ctx, p.x + gx * w, y + gy * w))
          ctx.stroke()
        }
        ctx.restore()
      },
      birds: (t, dt) => {
        const m = (movers.birds ??= [])
        if (!m.length) { const y = rnd(0.08, 0.3) * height; for (let j = 0; j < 5; j++) m.push({ x: -20 - j * 14 * S, y: y + (j % 2) * 8 * S + j * 3 * S, v: 22, s: rnd(3, 4), ph: rnd(0, TAU), k: 0 }) }
        ctx.strokeStyle = 'rgba(60,50,80,0.75)'; ctx.lineWidth = 1.2 * S; ctx.lineCap = 'round'
        for (const p of m) {
          p.x += p.v * dt * S; if (p.x > width + 40) { p.x = -40 - Math.random() * width * 0.5 }
          const f = Math.sin(t * 8 + p.ph) * p.s * S * 0.6, w = p.s * S
          ctx.beginPath(); ctx.moveTo(p.x - w, p.y - f); ctx.quadraticCurveTo(p.x - w * 0.4, p.y - w * 0.2, p.x, p.y); ctx.quadraticCurveTo(p.x + w * 0.4, p.y - w * 0.2, p.x + w, p.y - f); ctx.stroke()
        }
      },
    }

    let lastT = start
    let lastScroll = anchor?.current?.scrollTop ?? 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || !onScreen.current) { lastT = now; return }
      const t = (now - start) / 1000
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now
      const stepFall = now - lastFall >= 33                          // waterfall pixels at ~30fps
      if (stepFall) lastFall = now
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      for (const c of clouds.current) drawCloud(c, t)
      for (const fa of falls.current) (fa.r.kind === 'sway' ? drawSway : fa.r.kind === 'pool' ? drawPool : drawFall)(fa, t, stepFall)
      if (gate.current) drawGate(gate.current, t, stepFall)
      for (const tr of trees.current) drawTree(tr, t)
      const big = falls.current.find((f) => f.key === 'fall_l')
      if (big) drawMist(big, dt)
      drawGlints(t)
      drawLamps(t)
      for (const e of extras ?? []) EX[e](t, dt)
      drawFx(dt, t)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [width, height, R, fx, extras, anchor])

  return <canvas className="mw-life" ref={canvasRef} aria-hidden="true" />
}
