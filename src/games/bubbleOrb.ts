/* Bubble Pop orb renderer + burst FX (canvas).

   The answer "bubbles" are glossy magic orbs sitting inside the admin's gold
   gem frame (bubble_frame.webp). Everything here is pure canvas drawing with no
   React: the game component owns the physics and calls draw and update on its rAF.

   Burst = real soap-film physics, cartoon-scaled:
   1) a hole nucleates at the tap point,
   2) the film retracts away from it and the rim thickens and glows,
   3) the receding rim sheds teardrop droplets that fly radially in every
      direction; the larger blobs split again mid-flight,
   4) the gold frame shatters into tiles (each gem is its own tile) that
      tumble outward under gravity, plus gold star sparkles and a soft ring. */

export type OrbColor = 'purple' | 'blue' | 'green' | 'gold'

interface Pal { hi: string; mid: string; lo: string; rim: string; glow: string }
export const PAL: Record<OrbColor, Pal> = {
  purple: { hi: '#E7D2FF', mid: '#A66CF5', lo: '#6A3BD8', rim: '#F0B6FF', glow: '#E36BFF' },
  blue:   { hi: '#D6ECFF', mid: '#5FA9F2', lo: '#2C63D0', rim: '#A9DCFF', glow: '#5FC4FF' },
  green:  { hi: '#E3FFC9', mid: '#6ECC3E', lo: '#2F8E25', rim: '#C6FF9C', glow: '#8CFF66' },
  gold:   { hi: '#FFF3C2', mid: '#F7C22E', lo: '#D98A0A', rim: '#FFE29A', glow: '#FFD24D' },
}
export const ORB_COLORS: OrbColor[] = ['purple', 'blue', 'green', 'gold']

/* the sphere sits at (0.495, 0.49) of the frame image with radius 0.35 of its width */
const FR = { cx: 0.495, cy: 0.49, r: 0.35 }
/* how far the frame reaches beyond the orb radius (sparkles, orbit ring) */
export const FRAME_REACH = 0.5 / FR.r

const TAU = Math.PI * 2
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

interface Tile { u: number; v: number; w: number; h: number }
let FRAME: HTMLImageElement | null = null
let TILES: Tile[] = []

/* load the frame once; tiles are a 5x5 grid over it, empty tiles dropped.
   The gems sit in column 2 / rows 0 and 4, so each gem is one whole shard. */
export function loadFrame(url: string) {
  if (FRAME) return
  const img = new Image()
  img.onload = () => {
    const G = 5, S = 8
    const oc = document.createElement('canvas')
    oc.width = oc.height = G * S
    const o = oc.getContext('2d')
    if (!o) return
    o.drawImage(img, 0, 0, oc.width, oc.height)
    const d = o.getImageData(0, 0, oc.width, oc.height).data
    const tiles: Tile[] = []
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      let cover = 0
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) cover += d[(((gy * S + y) * oc.width) + gx * S + x) * 4 + 3]
      if (cover / (S * S * 255) > 0.04) tiles.push({ u: gx / G, v: gy / G, w: 1 / G, h: 1 / G })
    }
    TILES = tiles
    FRAME = img
  }
  img.src = url
}

/* ---- static drawing ------------------------------------------------------ */

export function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: OrbColor, alpha = 1, clip?: () => void) {
  const p = PAL[col]
  ctx.save()
  ctx.globalAlpha = alpha
  if (clip) clip()
  const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.25)
  halo.addColorStop(0, p.glow + 'aa'); halo.addColorStop(1, p.glow + '00')
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.fill()
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.05)
  g.addColorStop(0, p.hi); g.addColorStop(0.45, p.mid); g.addColorStop(1, p.lo)
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  const rim = ctx.createRadialGradient(x + r * 0.25, y + r * 0.3, r * 0.55, x + r * 0.25, y + r * 0.3, r * 1.02)
  rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(0.85, p.rim + '55'); rim.addColorStop(1, p.rim + 'ee')
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  const rim2 = ctx.createRadialGradient(x, y, r * 0.9, x, y, r)
  rim2.addColorStop(0, 'rgba(255,255,255,0)'); rim2.addColorStop(1, 'rgba(255,255,255,.55)')
  ctx.fillStyle = rim2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.45, r * 0.3, r * 0.16, -0.45, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.85)'
  ctx.beginPath(); ctx.arc(x - r * 0.58, y - r * 0.2, r * 0.07, 0, TAU); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.05
  ctx.beginPath(); ctx.arc(x, y, r * 0.82, Math.PI * 0.25, Math.PI * 0.6); ctx.stroke()
  ctx.restore()
}

export function drawWord(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, word: string, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  let size = Math.max(12, r * 0.38)
  ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif`
  const maxW = r * 1.72
  const w = ctx.measureText(word).width
  if (w > maxW) { size = Math.max(10, size * maxW / w); ctx.font = `700 ${size}px Fredoka, system-ui, sans-serif` }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2
  ctx.fillStyle = '#fff'
  ctx.fillText(word, x, y + 1)
  ctx.restore()
}

export function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 1) {
  if (!FRAME) return
  const w = r / FR.r
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(FRAME, x - w * FR.cx, y - w * FR.cy, w, w)
  ctx.restore()
}

/* ---- burst FX ------------------------------------------------------------ */

interface Burst { x: number; y: number; r: number; col: OrbColor; word: string; hx: number; hy: number; hole: number; far: number; speed: number; lastHole: number; t: number }
interface Drop { x: number; y: number; vx: number; vy: number; r: number; big?: boolean; split?: number; mist?: boolean; life: number; age: number; hi: string; mid: string; lo: string; wob: number }
interface Shard { tile: Tile; x: number; y: number; w: number; h: number; vx: number; vy: number; rot: number; spin: number; life: number; age: number }
interface Spark { x: number; y: number; vx: number; vy: number; s: number; life: number; age: number; rot: number; spin: number; col: string }
interface Ring { x: number; y: number; r: number; max: number; a: number; w: number }

const G = 420, DRAG = 1.6

export class BurstFx {
  bursts: Burst[] = []
  drops: Drop[] = []
  shards: Shard[] = []
  sparks: Spark[] = []
  rings: Ring[] = []

  get active() { return this.bursts.length + this.drops.length + this.shards.length + this.sparks.length + this.rings.length > 0 }

  clear() { this.bursts = []; this.drops = []; this.shards = []; this.sparks = []; this.rings = [] }

  /* burst an orb at (x,y,r); (px,py) is the tap point */
  burst(x: number, y: number, r: number, col: OrbColor, word: string, px: number, py: number) {
    let dx = px - x, dy = py - y
    const d = Math.hypot(dx, dy)
    if (d > r * 0.92) { dx *= r * 0.92 / d; dy *= r * 0.92 / d }
    const far = r + Math.hypot(dx, dy)
    this.bursts.push({ x, y, r, col, word, hx: x + dx, hy: y + dy, hole: 0, far, speed: far / 0.16, lastHole: 0, t: 0 })
    this.rings.push({ x: x + dx, y: y + dy, r: r * 0.3, max: r * 1.5, a: 0.45, w: r * 0.12 })
    for (let k = 0; k < 6; k++) this.sparks.push(mkSpark(x + dx, y + dy, rnd(1.5, 3.2)))
    this.shatter(x, y, r)
  }

  private shatter(x: number, y: number, r: number) {
    const w = r / FR.r
    const fx = x - w * FR.cx, fy = y - w * FR.cy
    for (const t of TILES) {
      const cx = fx + (t.u + t.w / 2) * w, cy = fy + (t.v + t.h / 2) * w
      let dx = cx - x, dy = cy - y
      const d = Math.hypot(dx, dy) || 1
      dx /= d; dy /= d
      const v = rnd(260, 520)
      this.shards.push({ tile: t, x: cx, y: cy, w: t.w * w, h: t.h * w,
        vx: dx * v + rnd(-60, 60), vy: dy * v - 120 + rnd(-60, 60),
        rot: 0, spin: rnd(-9, 9) * (Math.random() < 0.5 ? 1 : 1.6), life: rnd(0.7, 1.1), age: 0 })
    }
  }

  private shed(bu: Burst, count: number, holeR: number) {
    const p = PAL[bu.col]
    for (let k = 0; k < count; k++) {
      const a = rnd(0, TAU)
      const x = bu.hx + Math.cos(a) * holeR, y = bu.hy + Math.sin(a) * holeR
      const dxc = x - bu.x, dyc = y - bu.y, dc = Math.hypot(dxc, dyc)
      if (dc > bu.r) continue
      const base = dc > 4 ? Math.atan2(dyc, dxc) : rnd(0, TAU)
      const dir = base + rnd(-0.6, 0.6)
      const speed = rnd(160, 520)
      const big = Math.random() < 0.18
      this.drops.push({ x, y, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed - 40,
        r: big ? rnd(4, 6.5) : rnd(1.8, 3.6), big, split: big ? rnd(0.08, 0.2) : 0,
        life: rnd(0.7, 1.3), age: 0, hi: p.hi, mid: p.mid, lo: p.lo, wob: rnd(0, TAU) })
    }
    for (let k = 0; k < count * 0.35; k++) {
      const a = rnd(0, TAU)
      const x = bu.hx + Math.cos(a) * holeR, y = bu.hy + Math.sin(a) * holeR
      if (Math.hypot(x - bu.x, y - bu.y) > bu.r) continue
      this.drops.push({ x, y, vx: Math.cos(a) * rnd(40, 160), vy: Math.sin(a) * rnd(40, 160), r: rnd(0.5, 1.1), mist: true,
        life: rnd(0.25, 0.5), age: 0, hi: '#fff', mid: '#fff', lo: '#fff', wob: 0 })
    }
  }

  update(dt: number) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const bu = this.bursts[i]
      bu.t += dt
      bu.lastHole = bu.hole
      bu.hole = Math.min(bu.far, bu.hole + bu.speed * dt)
      const arc = (bu.hole - bu.lastHole) * 2.2 + 2
      this.shed(bu, Math.ceil(arc * 1.1), (bu.hole + bu.lastHole) / 2)
      if (bu.hole >= bu.far) {
        for (let k = 0; k < 10; k++) this.sparks.push(mkSpark(bu.x + rnd(-bu.r, bu.r) * 0.6, bu.y + rnd(-bu.r, bu.r) * 0.6, rnd(1, 2.2)))
        this.bursts.splice(i, 1)
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]
      d.age += dt
      if (d.age > d.life) { this.drops.splice(i, 1); continue }
      const k = Math.exp(-DRAG * dt)
      d.vx *= k; d.vy = d.vy * k + G * dt * (d.mist ? 0.25 : 1)
      d.x += d.vx * dt; d.y += d.vy * dt
      if (d.big && d.split && d.age > d.split) {
        const n = 3 + ((Math.random() * 3) | 0)
        for (let j = 0; j < n; j++) {
          const a = rnd(0, TAU), v = rnd(30, 110)
          this.drops.push({ x: d.x, y: d.y, vx: d.vx + Math.cos(a) * v, vy: d.vy + Math.sin(a) * v,
            r: d.r * rnd(0.32, 0.5), life: rnd(0.45, 0.9), age: 0, hi: d.hi, mid: d.mid, lo: d.lo, wob: rnd(0, TAU) })
        }
        this.drops.splice(i, 1)
      }
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i]
      s.age += dt
      if (s.age > s.life) { this.shards.splice(i, 1); continue }
      const k = Math.exp(-1.4 * dt)
      s.vx *= k; s.vy = s.vy * k + 700 * dt
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.age += dt
      if (s.age > s.life) { this.sparks.splice(i, 1); continue }
      const k = Math.exp(-1.8 * dt)
      s.vx *= k; s.vy = s.vy * k + 120 * dt
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      r.r += (r.max - r.r) * 7 * dt; r.a -= dt * 2.2
      if (r.a <= 0) this.rings.splice(i, 1)
    }
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    for (const bu of this.bursts) {
      const remaining = 1 - bu.hole / bu.far
      drawOrb(ctx, bu.x, bu.y, bu.r, bu.col, 0.95, () => {
        ctx.beginPath()
        ctx.arc(bu.x, bu.y, bu.r, 0, TAU)
        ctx.arc(bu.hx, bu.hy, bu.hole, 0, TAU, true)
        ctx.clip('evenodd')
      })
      ctx.save()
      ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r + 1, 0, TAU); ctx.clip()
      ctx.lineWidth = 3.5 + (1 - remaining) * 2.5
      ctx.strokeStyle = 'rgba(255,255,255,.95)'
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 12
      ctx.beginPath(); ctx.arc(bu.hx, bu.hy, bu.hole, 0, TAU); ctx.stroke()
      ctx.restore()
      drawWord(ctx, bu.x, bu.y + bu.t * 120, bu.r, bu.word, Math.max(0, 1 - bu.t * 6))
    }
    // frame shards
    if (FRAME) {
      const W0 = FRAME.naturalWidth, H0 = FRAME.naturalHeight
      for (const s of this.shards) {
        const f = 1 - s.age / s.life
        ctx.save()
        ctx.globalAlpha = Math.min(1, f * 2)
        ctx.translate(s.x, s.y); ctx.rotate(s.rot)
        const sc = 0.6 + 0.4 * f
        ctx.drawImage(FRAME, s.tile.u * W0, s.tile.v * H0, s.tile.w * W0, s.tile.h * H0, -s.w / 2 * sc, -s.h / 2 * sc, s.w * sc, s.h * sc)
        ctx.restore()
      }
    }
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.a)
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r.w * (r.a + 0.2)
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke()
    }
    for (const s of this.sparks) {
      const f = 1 - s.age / s.life
      ctx.globalAlpha = f
      ctx.shadowColor = s.col; ctx.shadowBlur = 8
      star(ctx, s.x, s.y, s.s * (0.6 + 0.4 * Math.sin(s.age * 20)), s.rot, s.col)
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1
    // droplets on top
    for (const d of this.drops) {
      const f = 1 - d.age / d.life
      const r = d.r * (0.5 + 0.5 * f)
      if (d.mist) {
        ctx.globalAlpha = f * 0.5
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, TAU); ctx.fill()
        continue
      }
      ctx.globalAlpha = Math.min(1, f * 1.8)
      const sp = Math.hypot(d.vx, d.vy)
      const tail = Math.min(1.6, sp / 260)
      const ang = Math.atan2(d.vy, d.vx)
      const wob = d.big ? 1 + Math.sin(t * 0.05 + d.wob) * 0.18 : 1
      ctx.save()
      ctx.translate(d.x, d.y); ctx.rotate(ang); ctx.scale(wob, 1 / wob)
      const g = ctx.createRadialGradient(r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.4)
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, d.hi); g.addColorStop(0.75, d.mid); g.addColorStop(1, d.lo)
      ctx.fillStyle = g
      teardrop(ctx, r, tail); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(0.6, r * 0.18); ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      ctx.beginPath(); ctx.ellipse(r * 0.2, -r * 0.38, r * 0.34, r * 0.2, -0.5, 0, TAU); ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}

function mkSpark(x: number, y: number, s: number): Spark {
  const a = rnd(0, TAU), v = rnd(60, 220)
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, s, life: rnd(0.5, 0.9), age: 0, rot: rnd(0, TAU), spin: rnd(-6, 6),
    col: Math.random() < 0.6 ? '#FFC01E' : '#ffffff' }
}

/* round head in front, tail tapering to a point behind (true tangent construction) */
function teardrop(ctx: CanvasRenderingContext2D, r: number, tail: number) {
  const L = r * (1.6 + tail * 1.1)
  const th = Math.acos(r / L)
  ctx.beginPath()
  ctx.arc(0, 0, r, -(Math.PI - th), Math.PI - th, false)
  ctx.lineTo(-L, 0)
  ctx.closePath()
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, col: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.fillStyle = col
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? s * 0.35 : s * 1.6, a = i * Math.PI / 4
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath(); ctx.fill(); ctx.restore()
}
