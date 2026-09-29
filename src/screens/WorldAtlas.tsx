import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { World } from '../types/game'
import { usePortrait } from '../components/Portrait'
import './worldatlas.css'

/* The World Atlas: an old parchment map. Every world is a small floating island,
   joined by a dotted route from the first world (top) to the last (bottom). The
   walked part of the route turns into golden dots that run in when the map opens,
   locked worlds are faded sepia. Tapping an open island travels there. */

const ISLANDS = Object.values(import.meta.glob('../assets/atlas/isl_*.webp', { eager: true, import: 'default' }) as Record<string, string>)
  .sort()

// island centres on the atlas (x: 0..1 of width, y: 0..1 of height, top = first world, reading down like a scroll)
function layout(n: number) {
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const side = i % 2 === 0 ? -1 : 1
    const wob = [0.0, 0.05, -0.04, 0.03, -0.02][i % 5]
    pts.push({ x: 0.5 + side * 0.19 + wob * 0.4, y: 0.05 + t * 0.9 })
  }
  return pts
}

export function WorldAtlas({ worlds, current, onPick, onClose }: {
  worlds: World[]; current: number; onPick: (i: number) => void; onClose: () => void
}) {
  const face = usePortrait()
  const scroller = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const n = worlds.length
  const pts = useMemo(() => layout(n), [n])
  const boardH = w * 0.34 * Math.max(1, n) + w * 0.3   // ~a third of a screen width of map per world

  useLayoutEffect(() => {
    const el = board.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // open on the player's current world, centred on screen
  useEffect(() => {
    const sc = scroller.current
    if (!sc || !w) return
    const y = pts[current]?.y ?? 1
    sc.scrollTop = Math.max(0, y * boardH - sc.clientHeight * 0.55)
  }, [w, boardH, current, pts])

  const unlocked = (i: number) => worlds[i]?.stages.some((s) => s.status !== 'locked') ?? false
  const stars = (i: number) => worlds[i]?.stages.reduce((a, s) => a + (s.stars || 0), 0) ?? 0
  const maxStars = (i: number) => (worlds[i]?.stages.length ?? 0) * 3
  const reached = worlds.reduce((m, _, i) => (unlocked(i) ? i : m), 0)

  const close = (then?: () => void) => { setLeaving(true); setTimeout(() => { then?.(); onClose() }, 320) }
  const pick = (i: number) => { if (unlocked(i)) close(() => onPick(i)) }

  // Catmull-Rom trail through the island centres
  const P = pts.map((p) => [p.x * w, p.y * boardH])
  const d = P.length < 2 ? '' : P.slice(0, -1).map((p1, i) => {
    const p0 = P[Math.max(0, i - 1)], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    return `${i ? '' : `M${p1[0]},${p1[1]} `}C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }).join(' ')
  const walked = n > 1 ? reached / (n - 1) : 0

  return (
    <div className={`atlas${leaving ? ' is-leaving' : ''}`} role="dialog" aria-label="World map">
      <div className="atlas-scroll" ref={scroller}>
        <div className="atlas-board" ref={board} style={{ height: boardH || '100vh' }}>
          <div className="atlas-paper" aria-hidden />
          <svg className="atlas-compass" viewBox="-50 -50 100 100" aria-hidden>
            <circle r="44" /><circle r="36" /><path d="M0-46L6-6L46 0L6 6L0 46L-6 6L-46 0L-6-6Z" /><path className="k" d="M0-46L6-6L0 0ZM46 0L6 6L0 0ZM0 46L-6 6L0 0ZM-46 0L-6-6L0 0Z" />
            <text y="-38">N</text>
          </svg>
          <svg className="atlas-compass c2" viewBox="-50 -50 100 100" aria-hidden>
            <circle r="44" /><path d="M0-46L6-6L46 0L6 6L0 46L-6 6L-46 0L-6-6Z" /><path className="k" d="M0-46L6-6L0 0ZM46 0L6 6L0 0ZM0 46L-6 6L0 0ZM-46 0L-6-6L0 0Z" />
          </svg>
          <div className="atlas-motes" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, animationDelay: `${(i % 9) * 0.7}s` }} />)}</div>

          {w > 0 && d && (
            <svg className="atlas-trail" viewBox={`0 0 ${w} ${boardH}`} width={w} height={boardH} aria-hidden>
              <defs>
                <mask id="atlas-wm" maskUnits="userSpaceOnUse" x="0" y="0" width={w} height={boardH}>
                  <path d={d} className="atlas-trail-reveal" stroke="#fff" fill="none" strokeWidth={w * 0.06} pathLength={1}
                    style={{ ['--walk' as string]: walked }} />
                </mask>
                <linearGradient id="atlas-walk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#e0a22c" /><stop offset="1" stopColor="#c8561f" />
                </linearGradient>
              </defs>
              {/* the whole route: small ink dots; the walked part: bigger golden dots revealed along the route */}
              <path d={d} className="atlas-trail-base" strokeWidth={w * 0.014} pathLength={1} />
              <path d={d} className="atlas-trail-walk" strokeWidth={w * 0.022} pathLength={1} mask="url(#atlas-wm)" />
            </svg>
          )}

          {worlds.map((wd, i) => {
            const p = pts[i]; const open = unlocked(i); const cur = i === current; const here = i === reached
            const done = open && wd.stages.every((s) => s.status === 'done')
            return (
              <button key={wd.id} className={`atlas-isle${open ? '' : ' is-locked'}${cur ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, animationDelay: `${0.25 + i * 0.07}s`, ['--bob' as string]: `${(i % 4) * 0.6}s` }}
                onClick={() => pick(i)} disabled={!open}
                aria-label={open ? `${wd.name}, ${wd.cefr}, ${stars(i)} of ${maxStars(i)} stars` : `${wd.name} locked`}>
                {cur && <span className="atlas-halo" aria-hidden />}
                <span className="atlas-isle-art">
                  {ISLANDS[i] && <img src={ISLANDS[i]} alt="" draggable={false} />}
                  {!open && <span className="atlas-veil" aria-hidden />}
                </span>
                {here && face && (
                  <span className="atlas-me" aria-hidden><img src={face} alt="" draggable={false} /></span>
                )}
                <span className="atlas-tag">
                  <b className="atlas-cefr">{wd.cefr}</b>
                  <span className="atlas-name">{wd.name}</span>
                  {open
                    ? <span className="atlas-stars">★ {stars(i)}/{maxStars(i)}</span>
                    : <span className="atlas-lock">🔒</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <header className="atlas-head">
        <span className="atlas-title">World Map</span>
        <button className="atlas-close" onClick={() => close()} aria-label="Close map">✕</button>
      </header>
    </div>
  )
}
