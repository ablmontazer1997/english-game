import { useEffect, useRef } from 'react'
import gateImg from '../assets/gate.webp'

// gate.webp natural size + the arch-opening vortex geometry (in natural pixels)
const NAT_W = 493
const RGN = { x: 150, y: 65, w: 194, h: 246 }      // region rect around the opening
const V = { cx: 246, cy: 187, rx: 96, ry: 122 }    // vortex ellipse
const OCX = 236, OCY = 173                          // offset (asymmetric) core center

type Pre = { base: Uint8ClampedArray; r: Float32Array; th: Float32Array; rc: Float32Array; mask: Float32Array }

// The vortex is the approved brightness-flow effect: the ORIGINAL swirl pixels
// (exact colors) modulated by a flowing spiral + inward-streaming sparkles. It
// only animates when `active` (the Final Gate is unlocked / last stage reached).
export function GateVortex({ active, width }: { active: boolean; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pre = useRef<Pre | null>(null)
  const out = useRef<ImageData | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = gateImg
    img.onload = () => {
      const off = document.createElement('canvas')
      off.width = RGN.w; off.height = RGN.h
      const octx = off.getContext('2d', { willReadFrequently: true })!
      octx.drawImage(img, RGN.x, RGN.y, RGN.w, RGN.h, 0, 0, RGN.w, RGN.h)
      const base = new Uint8ClampedArray(octx.getImageData(0, 0, RGN.w, RGN.h).data)
      const n = RGN.w * RGN.h
      const r = new Float32Array(n), th = new Float32Array(n), rc = new Float32Array(n), mask = new Float32Array(n)
      for (let j = 0; j < RGN.h; j++) for (let i = 0; i < RGN.w; i++) {
        const gx = RGN.x + i, gy = RGN.y + j, idx = j * RGN.w + i
        const nx = (gx - V.cx) / V.rx, ny = (gy - V.cy) / V.ry
        r[idx] = Math.hypot(nx, ny); th[idx] = Math.atan2(ny, nx)
        rc[idx] = Math.hypot((gx - OCX) / V.rx, (gy - OCY) / V.ry)
        mask[idx] = r[idx] <= 1.12 ? Math.max(0, Math.min(1, (1.06 - r[idx]) / 0.15)) : 0
      }
      pre.current = { base, r, th, rc, mask }
    }
  }, [])

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 33) return          // ~30fps
      last = now
      const d = pre.current, cv = canvasRef.current
      if (!d || !cv) return
      const ctx = cv.getContext('2d')!
      if (!out.current) out.current = ctx.createImageData(RGN.w, RGN.h)
      const od = out.current.data
      const t = ((now - start) / 4000) % 1, ph = 2 * Math.PI * t
      for (let idx = 0, p = 0; idx < RGN.w * RGN.h; idx++, p += 4) {
        const m = d.mask[idx]
        if (m <= 0) { od[p + 3] = 0; continue }
        const r = d.r[idx]
        const flow = Math.pow(0.5 + 0.5 * Math.sin(2 * d.th[idx] + 5.6 * Math.log(r + 0.12) - 2 * ph), 1.4)
        const core = Math.exp(-((d.rc[idx] / 0.16) ** 2)) * (0.9 + 0.15 * Math.sin(ph * 2))
        const mod = 0.72 + 0.6 * flow * (1 - r * 0.35) + 0.7 * core
        od[p] = d.base[p] * mod
        od[p + 1] = d.base[p + 1] * mod
        od[p + 2] = d.base[p + 2] * mod
        od[p + 3] = 255 * m
      }
      ctx.putImageData(out.current, 0, 0)
      // inward-streaming sparkles
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 16; k++) {
        const th0 = (k * 2.6) % (2 * Math.PI) - Math.PI
        const phase = (t + k / 16) % 1
        const b = Math.sin(Math.PI * phase)
        if (b <= 0.2) continue
        const rr = 1.02 * (1 - phase), ang = th0 + phase * 2.2
        const gx = V.cx + rr * V.rx * Math.cos(ang) - RGN.x
        const gy = V.cy + rr * V.ry * Math.sin(ang) - RGN.y
        ctx.fillStyle = `rgba(255,250,255,${b})`
        ctx.beginPath(); ctx.arc(gx, gy, 1.6, 0, 7); ctx.fill()
      }
      ctx.restore()
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); out.current = null }
  }, [active])

  const s = width / NAT_W
  return (
    <div className="gate-wrap" style={{ width }}>
      <img className="portal-img" src={gateImg} alt="" draggable={false} style={{ width }} />
      {active && (
        <canvas ref={canvasRef} width={RGN.w} height={RGN.h} aria-hidden
          style={{ position: 'absolute', left: RGN.x * s, top: RGN.y * s, width: RGN.w * s, height: RGN.h * s, pointerEvents: 'none' }} />
      )}
    </div>
  )
}
