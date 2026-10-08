// Boss Battle spell effects (admin 4375): one pooled canvas layer, driven by requestAnimationFrame only while something is alive.
// bolt (glowing orb + ribbon + sparkle trail) -> impact (flash, double shockwave ring, stars, runes, sparks), damage numbers,
// rune-stone throw, and rAF-driven screen shake / hit flash / knockback (no CSS animations, so it stays in step on slow phones).
type V2 = [number, number]
type Part = { on: boolean; x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; spr: number; rot: number; vr: number; drag: number; grav: number; grow: number }
type Ring = { x: number; y: number; t: number; life: number; r0: number; r1: number; col: string; w: number }
type Txt = { x: number; y: number; t: number; life: number; text: string; fill: string; stroke: string; size: number }
type Bolt = { a: V2; c: V2; b: V2; t: number; life: number; size: number; crit: boolean; trail: V2[]; done: () => void; rock: boolean }
type Fx = { el: HTMLElement; t: number; life: number; kind: 'shake' | 'hit' | 'hurt' | 'knock'; amp: number }
type Zoom = { el: HTMLElement; from: number; to: number; t: number; life: number; cur: number }

const COLS = ['#b07cff', '#ffd76a', '#86f0ff', '#ffffff', '#ff7a7a', '#d9c7a8']   // violet, gold, cyan, white, red, stone dust
const ease = { o: (t: number) => 1 - Math.pow(1 - t, 3), i: (t: number) => t * t, io: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) }

function glow(col: string, n = 64) {
  const c = document.createElement('canvas'); c.width = c.height = n
  const x = c.getContext('2d')!, g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, col); g.addColorStop(0.55, col + '55'); g.addColorStop(1, col + '00')
  x.fillStyle = g; x.fillRect(0, 0, n, n); return c
}
function star(col: string, n = 48) {
  const c = document.createElement('canvas'); c.width = c.height = n
  const x = c.getContext('2d')!; x.translate(n / 2, n / 2); x.beginPath()
  for (let i = 0; i < 10; i++) { const r = i % 2 ? n * 0.2 : n * 0.46, a = -Math.PI / 2 + (i * Math.PI) / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r) }
  x.closePath(); x.shadowColor = col; x.shadowBlur = n * 0.18; x.fillStyle = col; x.fill(); x.shadowBlur = 0
  x.fillStyle = 'rgba(255,255,255,.85)'; x.scale(0.45, 0.45); x.fill(); return c
}
function rune(col: string, k: number, n = 48) {
  const c = document.createElement('canvas'); c.width = c.height = n
  const x = c.getContext('2d')!; x.strokeStyle = col; x.lineWidth = n * 0.09; x.lineCap = 'round'; x.shadowColor = col; x.shadowBlur = n * 0.25
  const P: V2[][] = [[[.35, .15], [.35, .85], [.35, .4], [.7, .2]], [[.3, .15], [.3, .85], [.3, .2], [.7, .45], [.3, .6]], [[.5, .12], [.5, .88], [.2, .35], [.8, .65]], [[.3, .2], [.7, .5], [.3, .8], [.3, .2]]]
  x.beginPath(); P[k % 4].forEach(([a, b], i) => (i ? x.lineTo(a * n, b * n) : x.moveTo(a * n, b * n))); x.stroke(); return c
}
function stone(n = 64) {
  const c = document.createElement('canvas'); c.width = c.height = n
  const x = c.getContext('2d')!, g = x.createRadialGradient(n * 0.38, n * 0.34, n * 0.05, n / 2, n / 2, n * 0.48)
  g.addColorStop(0, '#d8d2e4'); g.addColorStop(0.6, '#8e86a3'); g.addColorStop(1, '#4e4762')
  x.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = n * (0.4 + 0.06 * Math.sin(i * 2.3)); x.lineTo(n / 2 + Math.cos(a) * r, n / 2 + Math.sin(a) * r) }
  x.closePath(); x.fillStyle = g; x.fill(); x.strokeStyle = '#3c3550'; x.lineWidth = n * 0.04; x.stroke()
  x.strokeStyle = '#ff6a6a'; x.shadowColor = '#ff3a3a'; x.shadowBlur = n * 0.15; x.lineWidth = n * 0.06; x.beginPath(); x.moveTo(n * 0.42, n * 0.3); x.lineTo(n * 0.42, n * 0.7); x.lineTo(n * 0.62, n * 0.55); x.stroke(); return c
}

export class BossFx {
  private cv: HTMLCanvasElement
  private x: CanvasRenderingContext2D
  private parts: Part[] = []
  private rings: Ring[] = []
  private txts: Txt[] = []
  private bolts: Bolt[] = []
  private fxs: Fx[] = []
  private flashes: { x: number; y: number; t: number; life: number; r: number; col: number }[] = []
  private spr: HTMLCanvasElement[]
  private raf = 0
  private zoom: Zoom | null = null
  private freezeT = 0
  private last = 0
  private dpr = 1
  private scale: () => number
  constructor(host: HTMLElement, scale: () => number) {
    this.scale = scale
    this.cv = document.createElement('canvas'); this.cv.className = 'bb2-fxc'
    host.appendChild(this.cv); this.x = this.cv.getContext('2d')!
    // sprites: 0-5 glows, 6-8 stars (gold, white, cyan), 9-12 runes, 13 stone
    this.spr = [...COLS.map((c) => glow(c)), star('#ffd76a'), star('#ffffff'), star('#86f0ff'), ...[0, 1, 2, 3].map((k) => rune(k % 2 ? '#86f0ff' : '#ffd76a', k)), stone()]
    for (let i = 0; i < 420; i++) this.parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 1, spr: 0, rot: 0, vr: 0, drag: 0, grav: 0, grow: 0 })
    this.fit()
  }
  fit() {
    const r = this.cv.parentElement!.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.cv.width = Math.max(1, Math.round(r.width * this.dpr)); this.cv.height = Math.max(1, Math.round(r.height * this.dpr))
  }
  destroy() { cancelAnimationFrame(this.raf); this.cv.remove(); if (this.zoom) this.zoom.el.style.scale = ''; this.fxs.forEach((f) => { f.el.style.transform = ''; f.el.style.filter = '' }) }
  private kick() { if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick) } }
  private emit(x: number, y: number, vx: number, vy: number, life: number, size: number, spr: number, o: Partial<Part> = {}) {
    const p = this.parts.find((q) => !q.on); if (!p) return
    Object.assign(p, { on: true, x, y, vx, vy, t: 0, life, size, spr, rot: Math.random() * 6.28, vr: 0, drag: 2.5, grav: 0, grow: 0 }, o)
  }

  /** the spell: an orb from the wand tip to the target along an arc; resolves on arrival */
  bolt(a: V2, b: V2, crit = false) {
    return new Promise<void>((done) => {
      const s = this.scale(), dx = b[0] - a[0]
      const c: V2 = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - Math.abs(dx) * 0.07 - 10 * s]
      this.bolts.push({ a, b, c, t: 0, life: crit ? 0.27 : 0.22, size: (crit ? 150 : 115) * s, crit, trail: [], done, rock: false })
      // muzzle flash at the tip
      this.flashes.push({ x: a[0], y: a[1], t: 0, life: 0.18, r: (crit ? 130 : 95) * s, col: 0 })
      for (let i = 0; i < (crit ? 14 : 9); i++) { const an = Math.random() * 6.28, v = (90 + Math.random() * 160) * s; this.emit(a[0], a[1], Math.cos(an) * v, Math.sin(an) * v, 0.3, (14 + Math.random() * 12) * s, [0, 1, 2][i % 3]) }
      this.kick()
    })
  }
  /** the boss's rune stone, spinning on a high arc */
  rock(a: V2, b: V2) {
    return new Promise<void>((done) => {
      const s = this.scale()
      this.bolts.push({ a, b, c: [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 90 * s], t: 0, life: 0.44, size: 70 * s, crit: false, trail: [], done, rock: true }); this.kick()
    })
  }
  impact(p: V2, crit = false) {
    const s = this.scale(), k = crit ? 1.35 : 1
    this.flashes.push({ x: p[0], y: p[1], t: 0, life: 0.14, r: 130 * s * k, col: 3 }, { x: p[0], y: p[1], t: 0, life: 0.3, r: 230 * s * k, col: 0 })
    this.rings.push({ x: p[0], y: p[1], t: 0, life: 0.42, r0: 20 * s, r1: 210 * s * k, col: '#ffe9a8', w: 14 * s * k },
      { x: p[0], y: p[1], t: -0.07, life: 0.5, r0: 10 * s, r1: 290 * s * k, col: '#9ff3ff', w: 8 * s * k })
    if (crit) this.rings.push({ x: p[0], y: p[1], t: -0.14, life: 0.55, r0: 10 * s, r1: 360 * s, col: '#c9a3ff', w: 6 * s })
    for (let i = 0; i < (crit ? 16 : 10); i++) {
      const an = (i / (crit ? 16 : 10)) * 6.28 + Math.random() * 0.4, v = (380 + Math.random() * 320) * s * k
      this.emit(p[0], p[1], Math.cos(an) * v, Math.sin(an) * v - 120 * s, 0.75 + Math.random() * 0.3, (30 + Math.random() * 20) * s * k, 6 + (i % 3), { vr: (Math.random() - 0.5) * 12, drag: 3.2, grav: 520 * s })
    }
    for (let i = 0; i < (crit ? 6 : 4); i++) {
      const an = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = (120 + Math.random() * 90) * s
      this.emit(p[0] + (Math.random() - 0.5) * 60 * s, p[1], Math.cos(an) * v, Math.sin(an) * v, 0.95, (34 + Math.random() * 10) * s, 9 + (i % 4), { vr: (Math.random() - 0.5) * 3, drag: 1.4, grav: -30 * s })
    }
    for (let i = 0; i < (crit ? 34 : 22); i++) {
      const an = Math.random() * 6.28, v = (200 + Math.random() * 520) * s * k
      this.emit(p[0], p[1], Math.cos(an) * v, Math.sin(an) * v, 0.45 + Math.random() * 0.35, (10 + Math.random() * 14) * s, [0, 1, 2, 3][i % 4], { drag: 4.5 })
    }
    this.kick()
  }
  /** the stone hits the hero: dust + red pop */
  smack(p: V2) {
    const s = this.scale()
    this.flashes.push({ x: p[0], y: p[1], t: 0, life: 0.24, r: 170 * s, col: 4 })
    this.rings.push({ x: p[0], y: p[1], t: 0, life: 0.34, r0: 10 * s, r1: 130 * s, col: '#ffb0a0', w: 8 * s })
    for (let i = 0; i < 16; i++) { const an = Math.random() * 6.28, v = (150 + Math.random() * 260) * s; this.emit(p[0], p[1], Math.cos(an) * v, Math.sin(an) * v, 0.5, (12 + Math.random() * 14) * s, i % 2 ? 5 : 4, { drag: 4, grav: 300 * s }) }
    this.kick()
  }
  number(text: string, p: V2, kind: 'boss' | 'crit' | 'hero') {
    const s = this.scale()
    const st = kind === 'hero' ? ['#ffffff', '#c0242e'] : kind === 'crit' ? ['#fff4c2', '#b8741a'] : ['#ffffff', '#6b2fd6']
    this.txts.push({ x: p[0], y: p[1], t: 0, life: 1.15, text, fill: st[0], stroke: st[1], size: (kind === 'crit' ? 96 : 76) * s }); this.kick()
  }
  /** camera punch-in towards a point (scene px), held until release() */
  punch(el: HTMLElement | null, at: V2, amount = 1.06, life = 0.35) {
    if (!el) return; el.style.transformOrigin = `${at[0]}px ${at[1]}px`
    const cur = this.zoom?.el === el ? this.zoom.cur : 1; this.zoom = { el, from: cur, to: amount, t: 0, life, cur }; this.kick()
  }
  release(life = 0.25) { const z = this.zoom; if (z) { this.zoom = { el: z.el, from: z.cur, to: 1, t: 0, life, cur: z.cur }; this.kick() } }
  /** hit-stop: everything on this layer holds still for a moment */
  freeze(sec = 0.08) { this.freezeT = Math.max(this.freezeT, sec); this.kick() }
  shake(el: HTMLElement | null, amp: number, life = 0.38) { if (el) { this.fxs.push({ el, t: 0, life, kind: 'shake', amp }); this.kick() } }
  hit(el: HTMLElement | null, life = 0.42) { if (el) { this.fxs.push({ el, t: 0, life, kind: 'hit', amp: 1 }); this.kick() } }
  hurt(el: HTMLElement | null, life = 0.5) { if (el) { this.fxs.push({ el, t: 0, life, kind: 'hurt', amp: 1 }); this.kick() } }
  knock(el: HTMLElement | null, px: number, life = 0.45) { if (el) { this.fxs.push({ el, t: 0, life, kind: 'knock', amp: px }); this.kick() } }

  private tick = (now: number) => {
    const rdt = Math.min(0.05, (now - this.last) / 1000); this.last = now
    let dt = rdt; if (this.freezeT > 0) { this.freezeT -= rdt; dt = 0 }
    const x = this.x, d = this.dpr, s = this.scale()
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.cv.width, this.cv.height); x.setTransform(d, 0, 0, d, 0, 0)
    let alive = false
    // bolts (head + ribbon + trail emission)
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const B = this.bolts[i]; B.t += dt; const u = Math.min(1, B.t / B.life), e = B.rock ? u : Math.pow(u, 1.35)
      const px = (1 - e) * (1 - e) * B.a[0] + 2 * e * (1 - e) * B.c[0] + e * e * B.b[0], py = (1 - e) * (1 - e) * B.a[1] + 2 * e * (1 - e) * B.c[1] + e * e * B.b[1]
      B.trail.unshift([px, py]); if (B.trail.length > 12) B.trail.pop()
      if (B.rock) {
        x.globalCompositeOperation = 'source-over'; x.save(); x.translate(px, py); x.rotate(-u * 9); x.drawImage(this.spr[13], -B.size / 2, -B.size / 2, B.size, B.size); x.restore()
        if (Math.random() < 0.6) this.emit(px, py, (Math.random() - 0.5) * 40 * s, (Math.random() - 0.5) * 40 * s, 0.35, 12 * s, 5)
      } else {
        x.globalCompositeOperation = 'lighter'
        // ribbon: a tapered glowing stroke through the last positions
        for (let k = B.trail.length - 1; k > 0; k--) {
          const f = 1 - k / B.trail.length
          x.strokeStyle = k % 2 ? 'rgba(134,240,255,' + (0.35 * f) + ')' : 'rgba(176,124,255,' + (0.55 * f) + ')'; x.lineWidth = B.size * 0.5 * f; x.lineCap = 'round'
          x.beginPath(); x.moveTo(B.trail[k][0], B.trail[k][1]); x.lineTo(B.trail[k - 1][0], B.trail[k - 1][1]); x.stroke()
        }
        const pul = 1 + 0.12 * Math.sin(B.t * 60), pv = B.trail[Math.min(2, B.trail.length - 1)], ang = Math.atan2(py - pv[1], px - pv[0])
        x.save(); x.translate(px, py); x.rotate(ang); x.scale(2.3, 0.85); x.drawImage(this.spr[0], -B.size * pul / 2, -B.size * pul / 2, B.size * pul, B.size * pul); x.restore()
        x.drawImage(this.spr[B.crit ? 1 : 2], px - B.size * 0.32, py - B.size * 0.32, B.size * 0.64, B.size * 0.64)
        x.drawImage(this.spr[3], px - B.size * 0.16, py - B.size * 0.16, B.size * 0.32, B.size * 0.32)
        for (let k = 0; k < (B.crit ? 4 : 3); k++) { const an = Math.random() * 6.28, v = (40 + Math.random() * 90) * s; this.emit(px, py, Math.cos(an) * v, Math.sin(an) * v, 0.32 + Math.random() * 0.2, (10 + Math.random() * 16) * s * (B.crit ? 1.3 : 1), [0, 2, 1][k % 3], { drag: 3 }) }
        if (Math.random() < 0.35) this.emit(px, py, 0, 0, 0.5, 18 * s, 6 + (Math.random() < 0.5 ? 0 : 2), { vr: 6, drag: 1 })
      }
      if (u >= 1) { this.bolts.splice(i, 1); B.done() } else alive = true
    }
    // flashes
    x.globalCompositeOperation = 'lighter'
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const F = this.flashes[i]; F.t += dt; const u = F.t / F.life; if (u >= 1) { this.flashes.splice(i, 1); continue }
      alive = true; const r = F.r * (0.55 + 0.45 * ease.o(u)); x.globalAlpha = (1 - u) * 0.75; x.drawImage(this.spr[F.col], F.x - r, F.y - r, r * 2, r * 2); x.globalAlpha = 1
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const R = this.rings[i]; R.t += dt; if (R.t < 0) { alive = true; continue }
      const u = R.t / R.life; if (u >= 1) { this.rings.splice(i, 1); continue }
      alive = true; const e = ease.o(u)
      x.strokeStyle = R.col; x.globalAlpha = (1 - u) * 0.95; x.lineWidth = Math.max(0.5, R.w * (1 - u)); x.beginPath(); x.arc(R.x, R.y, R.r0 + (R.r1 - R.r0) * e, 0, 6.283); x.stroke(); x.globalAlpha = 1
    }
    // particles
    for (const p of this.parts) {
      if (!p.on) continue
      p.t += dt; const u = p.t / p.life; if (u >= 1) { p.on = false; continue }
      alive = true; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vy = p.vy * dr + p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt
      const sz = p.size * (u < 0.15 ? 0.4 + 4 * u : 1 - 0.6 * (u - 0.15)) * (1 + p.grow * u)
      x.globalCompositeOperation = p.spr === 5 || p.spr === 13 ? 'source-over' : 'lighter'
      x.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1
      if (p.spr >= 6) { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.drawImage(this.spr[p.spr], -sz / 2, -sz / 2, sz, sz); x.restore() } else x.drawImage(this.spr[p.spr], p.x - sz / 2, p.y - sz / 2, sz, sz)
      x.globalAlpha = 1
    }
    // damage numbers: pop, rise, fade
    x.globalCompositeOperation = 'source-over'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'
    for (let i = this.txts.length - 1; i >= 0; i--) {
      const T = this.txts[i]; T.t += dt; const u = T.t / T.life; if (u >= 1) { this.txts.splice(i, 1); continue }
      alive = true; const k = u < 0.12 ? 0.6 + 0.9 * ease.o(u / 0.12) : u < 0.25 ? 1.5 - 0.5 * ease.io((u - 0.12) / 0.13) : 1
      x.font = `900 ${T.size * k}px Fredoka, system-ui, sans-serif`; x.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1
      const y = T.y - 120 * s * ease.o(u)
      x.lineWidth = T.size * 0.16 * k; x.strokeStyle = T.stroke; x.strokeText(T.text, T.x, y); x.fillStyle = T.fill; x.fillText(T.text, T.x, y); x.globalAlpha = 1
    }
    // element effects (rAF-driven: shake, hit flash, hurt flash, knockback)
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const F = this.fxs[i]; F.t += dt; const u = Math.min(1, F.t / F.life)
      if (F.kind === 'shake') { const a = F.amp * (1 - u) * (1 - u); F.el.style.transform = u >= 1 ? '' : `translate(${(Math.sin(F.t * 46) * a).toFixed(1)}px,${(Math.cos(F.t * 36) * a * 0.6).toFixed(1)}px)` }
      if (F.kind === 'hit') F.el.style.filter = u >= 1 ? '' : `brightness(${(1 + 1.4 * (1 - u) * (1 - u)).toFixed(2)}) saturate(${(1 - 0.4 * (1 - u)).toFixed(2)})`
      if (F.kind === 'hurt') F.el.style.filter = u >= 1 ? '' : `sepia(${(0.35 * (1 - u)).toFixed(2)}) saturate(${(1 + 1.2 * (1 - u)).toFixed(2)}) hue-rotate(${(-25 * (1 - u)).toFixed(0)}deg) brightness(${(1 + 0.12 * (1 - u)).toFixed(2)})`
      if (F.kind === 'knock') { const e = u < 0.2 ? ease.o(u / 0.2) : 1 - ease.io((u - 0.2) / 0.8); F.el.style.translate = u >= 1 ? '' : `${(F.amp * e).toFixed(1)}px 0` }
      if (u >= 1) this.fxs.splice(i, 1); else alive = true
    }
    const Z = this.zoom
    if (Z) {
      Z.t += dt; const u = Math.min(1, Z.t / Z.life); Z.cur = Z.from + (Z.to - Z.from) * (Z.to > Z.from ? ease.o(u) : ease.io(u))
      Z.el.style.scale = Math.abs(Z.cur - 1) < 1e-3 ? '' : Z.cur.toFixed(4)
      if (u >= 1 && Z.to === 1) this.zoom = null; else if (u < 1) alive = true
    }
    if (this.freezeT > 0) alive = true
    x.globalCompositeOperation = 'source-over'
    this.raf = alive ? requestAnimationFrame(this.tick) : 0
    if (!alive) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.cv.width, this.cv.height) }
  }
}
