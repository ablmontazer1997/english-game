// ?perf=1 only (10-21): a small overlay with the start-up numbers + a beacon to the ES backend (POST /v1/perf, logged only).
// Loaded with a dynamic import from main.tsx, so without ?perf=1 none of this code runs.
import { API_BASE } from './api'

type Gate = string | null
const r = (n: number) => Math.round(n)

export function installPerf() {
  const sid = Math.random().toString(36).slice(2, 8)
  const lt = { n: 0, total: 0, max: 0, top: [] as [number, number][] }   // long tasks: count, ms total, max, [start, dur] > 1 s
  let late = 0                                                         // worst setTimeout lateness (ms)
  const ev: Record<string, number | string> = {}
  const once = (k: string, v: number | string = r(performance.now())) => { if (!(k in ev)) ev[k] = v }

  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        lt.n++; lt.total += e.duration; lt.max = Math.max(lt.max, e.duration)
        if (e.duration > 1000 && lt.top.length < 8) lt.top.push([r(e.startTime), r(e.duration)])
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch { ev.longtask = 'n/a' }

  let last = performance.now()
  setInterval(() => { const n = performance.now(); late = Math.max(late, n - last - 250); last = n }, 250)

  addEventListener('es-splash-gone', () => once('splashGone'))
  addEventListener('message', (e: MessageEvent) => {
    const t = e.data?.type
    if (typeof t !== 'string' || !t.startsWith('rc-')) return
    once(t)
    if (t === 'rc-capfail') once('capfailWhy', String(e.data.why || ''))
    if ((t === 'rc-portrait' || t === 'rc-fullbody') && e.data.gate) once(t + 'Gate', String(e.data.gate))
  })

  const gateOf = (sel: string): Gate => {
    try { const f = document.querySelector(sel) as HTMLIFrameElement | null; const w = f?.contentWindow as (Window & { RCGATED?: string }) | null; return w?.RCGATED ?? (f ? 'loading' : null) } catch { return 'n/a' }
  }
  const gl = (() => {
    try {
      const c = document.createElement('canvas').getContext('webgl')
      const x = c?.getExtension('WEBGL_debug_renderer_info')
      const s = x && c ? String(c.getParameter(x.UNMASKED_RENDERER_WEBGL)) : 'n/a'
      c?.getExtension('WEBGL_lose_context')?.loseContext()
      return s.slice(0, 60)
    } catch { return 'n/a' }
  })()
  const nav = navigator as Navigator & { deviceMemory?: number }
  const dev = `${nav.hardwareConcurrency || '?'} cores, ${nav.deviceMemory ?? '?'} GB, ${gl}`

  const box = document.createElement('div')
  box.setAttribute('aria-hidden', 'true')
  box.style.cssText = 'position:fixed;left:4px;top:calc(env(safe-area-inset-top,0px) + 120px);z-index:2147483647;max-width:70vw;padding:4px 6px;' +
    'background:rgba(0,0,0,.72);color:#7CFC00;font:10px/1.3 monospace;white-space:pre-wrap;pointer-events:none;border-radius:4px'
  document.body.appendChild(box)

  const snap = () => {
    const h = document.querySelector('.mhero')
    if (h?.classList.contains('is-3d')) once('hero3d')
    else if (h && !h.classList.contains('wait3d')) once('heroPainted')
    if (h) once('heroMount')
    return {
      sid, t: r(performance.now()), dev, ua: navigator.userAgent.slice(0, 120),
      longtasks: { n: lt.n, totalMs: r(lt.total), maxMs: r(lt.max), over1s: lt.top }, worstTimerLateMs: r(late), ev,
      gate: { hero: gateOf('iframe.mhero-3d'), portrait: gateOf('iframe[title="portrait"]'), fullbody: gateOf('iframe[title="hero picture"]') },
    }
  }
  const draw = () => {
    const s = snap()
    box.textContent = `perf ${s.sid}  t=${(s.t / 1000).toFixed(1)}s\n${s.dev}\n` +
      `long tasks ${s.longtasks.n}, total ${(s.longtasks.totalMs / 1000).toFixed(1)}s, max ${(s.longtasks.maxMs / 1000).toFixed(1)}s\n` +
      `worst timer late ${(s.worstTimerLateMs / 1000).toFixed(1)}s\n` +
      Object.entries(s.ev).map(([k, v]) => `${k} ${typeof v === 'number' ? (v / 1000).toFixed(1) + 's' : v}`).join('\n') +
      `\ngate hero: ${s.gate.hero ?? '-'}\ngate portrait: ${s.gate.portrait ?? '-'}\ngate full: ${s.gate.fullbody ?? '-'}`
  }
  setInterval(draw, 1000); draw()

  const send = (why: string) => {
    try {
      const body = JSON.stringify({ why, ...snap() })
      if (!navigator.sendBeacon?.(API_BASE + '/v1/perf', body)) fetch(API_BASE + '/v1/perf', { method: 'POST', body, keepalive: true }).catch(() => {})
    } catch { /* */ }
  }
  for (const s of [20, 45, 90, 150, 240]) setTimeout(() => send(s + 's'), s * 1000)
  addEventListener('pagehide', () => send('hide'))
}
