// Small visual effects shared by the mini-games: particle bursts, a clone that flies
// from one element to another, and a shake. They draw on a fixed overlay above the
// app, so a game only passes the elements involved.
// React Native: replace with Reanimated / Skia equivalents behind the same calls.

type BurstOpts = { color?: string | string[]; n?: number; dist?: number; size?: number; up?: boolean; glyph?: string; ms?: number }

let layer: HTMLDivElement | null = null
function overlay() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
    document.body.appendChild(layer)
  }
  return layer
}
const centre = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r } }

/** particles flying out of an element (sparks, smoke, notes…) */
export function burst(el: Element | null | undefined, o: BurstOpts = {}) {
  if (!el) return
  const { x, y } = centre(el), L = overlay()
  const cols = Array.isArray(o.color) ? o.color : [o.color ?? '#ffd35a']
  const n = o.n ?? 12, dist = o.dist ?? 70, size = o.size ?? 10, ms = o.ms ?? 750
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), c = cols[i % cols.length]
    const a = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : (i / n) * Math.PI * 2 + Math.random() * 0.5
    const d = dist * (0.6 + Math.random() * 0.6), s = size * (0.6 + Math.random() * 0.8)
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50%;` +
      (o.glyph ? `font:900 ${s * 1.6}px/1 system-ui;color:${c};text-shadow:0 0 6px ${c};display:grid;place-items:center` : `background:radial-gradient(circle,#fff,${c} 55%);box-shadow:0 0 ${s}px ${c}`)
    if (o.glyph) p.textContent = o.glyph
    L.appendChild(p)
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d + (o.up ? 0 : 12)
    p.animate([{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px,${dy + (o.up ? -10 : 18)}px) scale(.3)`, opacity: 0 }], { duration: ms * (0.8 + Math.random() * 0.4), easing: 'cubic-bezier(.2,.7,.4,1)' })
      .onfinish = () => p.remove()
  }
}

/** a copy of `from` flies onto `to` (a tile into its slot, a spell onto a word) */
export function flyTo(from: Element | null | undefined, to: Element | null | undefined, o: { ms?: number; arc?: number; spin?: number } = {}): Promise<void> {
  return new Promise((res) => {
    if (!from || !to) { res(); return }
    const a = from.getBoundingClientRect(), b = centre(to)
    const c = from.cloneNode(true) as HTMLElement
    c.style.cssText += `;position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;pointer-events:none;box-sizing:border-box`
    overlay().appendChild(c)
    const dx = b.x - (a.left + a.width / 2), dy = b.y - (a.top + a.height / 2), arc = o.arc ?? -50, sc = Math.min(1.2, b.r.width / a.width || 1)
    c.animate([{ transform: 'translate(0,0) scale(1) rotate(0)' },
      { transform: `translate(${dx / 2}px,${dy / 2 + arc}px) scale(${(1 + sc) / 2 * 1.08}) rotate(${(o.spin ?? 0) / 2}deg)`, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(${o.spin ?? 0}deg)` }],
    { duration: o.ms ?? 320, easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => { c.remove(); res() }
  })
}

/** quick sideways shake */
export function shake(el: Element | null | undefined, px = 8) {
  (el as HTMLElement | null)?.animate?.([{ transform: 'translateX(0)' }, { transform: `translateX(${-px}px)` }, { transform: `translateX(${px}px)` },
    { transform: `translateX(${-px / 2}px)` }, { transform: 'translateX(0)' }], { duration: 380 })
}

/** a bouncy pop on an element (a letter carved, a number badge set) */
export function pop(el: Element | null | undefined, k = 1.25) {
  (el as HTMLElement | null)?.animate?.([{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.4 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' })
}
