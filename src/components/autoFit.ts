// Shared shrink-to-fit for one-line labels (admin 6106-6108, 10-20: text kept sticking out of chips, ribbons and buttons
// on phones that render text larger). A label inside a painted frame gets its font made smaller, down to MIN of its own
// size, until it fits the frame's inner box (padding, or the painted rim of a border-image frame, whichever is wider);
// if even MIN is too big, the label may wrap (balanced) instead. Nothing is hidden or cut.
// Opt in: the selectors below, or any element with data-fit.
const SEL = [
  '[data-fit]', '.k-ribbon', '.k-btn', '.ui-btn', '.ss-gchip b', '.ph-edit2', '.ph-sstat small', '.ph-sstat b',
  '.pf2-more', '.pf2-t', '.sl-mis-t', '.ui-chip', '.shp-tabs [role=tab]',
].join(',')
const MIN = 0.72        // never below 72% of the designed size
const MIN_PX = 10
const RIM = 0.6         // share of a border-image width that is painted rim (text keeps clear of it)

const last = new WeakMap<Element, string>()
const runs = new WeakMap<Element, number>()   // a label whose box follows its own text could ping-pong: 4 fits, then it stays
let ro: ResizeObserver | null = null

function inner(el: HTMLElement, cs: CSSStyleDeclaration) {
  let l = parseFloat(cs.paddingLeft) || 0, r = parseFloat(cs.paddingRight) || 0
  if (cs.borderImageSource && cs.borderImageSource !== 'none') {
    // border-image-width as px (a bare number = multiples of the border width, which is 0 here: ignore)
    const w = cs.borderImageWidth.split(/\s+/).map((v) => (v.endsWith('px') ? parseFloat(v) : 0))
    const wr = w[1] ?? w[0] ?? 0, wl = w[3] ?? w[1] ?? w[0] ?? 0
    l = Math.max(l, wl * RIM + 2); r = Math.max(r, wr * RIM + 2)
  }
  return el.clientWidth - l - r
}

function textWidth(el: HTMLElement) {
  const rg = document.createRange(); rg.selectNodeContents(el)
  let L = Infinity, R = -Infinity
  for (const q of rg.getClientRects()) { if (q.width < 0.5) continue; L = Math.min(L, q.left); R = Math.max(R, q.right) }
  return R > L ? R - L : 0
}

export function fit(el: HTMLElement) {
  if (!el.isConnected || !el.textContent?.trim()) return
  const key = `${el.textContent}|${el.parentElement?.clientWidth ?? 0}|${innerWidth}`
  if (last.get(el) === key) return
  const n = runs.get(el) ?? 0
  if (n >= 4) return
  runs.set(el, n + 1)
  el.style.removeProperty('font-size'); el.classList.remove('fit-wrap'); el.classList.add('fit-1')
  const cs = getComputedStyle(el)
  const base = parseFloat(cs.fontSize)
  const have = inner(el, cs)
  let need = textWidth(el)
  if (have > 0 && need > have + 0.5) {
    const min = Math.max(MIN_PX, base * MIN)
    let f = Math.max(min, Math.floor(base * (have / need) * 4) / 4)
    el.style.setProperty('font-size', `${f}px`)
    for (let i = 0; i < 8 && f > min && (need = textWidth(el)) > have + 0.5; i++) {
      f = Math.max(min, f - 0.5); el.style.setProperty('font-size', `${f}px`)
    }
    if (textWidth(el) > have + 0.5) el.classList.add('fit-wrap')   // still too long at MIN: wrap, balanced
  }
  el.classList.remove('fit-1')
  last.set(el, `${el.textContent}|${el.parentElement?.clientWidth ?? 0}|${innerWidth}`)
}

function scan(root: ParentNode) {
  const els = root instanceof HTMLElement && root.matches(SEL) ? [root] : []
  root.querySelectorAll?.<HTMLElement>(SEL).forEach((e) => els.push(e))
  for (const e of els) { fit(e); ro?.observe(e); if (e.parentElement) ro?.observe(e.parentElement) }
}

export function installAutoFit() {
  if (typeof window === 'undefined' || !('ResizeObserver' in window)) return
  const st = document.createElement('style')
  st.textContent = '.fit-1{white-space:nowrap!important}.fit-wrap{white-space:normal!important;text-wrap:balance}'
  document.head.appendChild(st)
  let queued = false
  const all = () => { queued = false; scan(document.body) }
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(all) } }
  ro = new ResizeObserver(later)
  new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true })
  document.fonts?.ready.then(() => { for (const e of document.querySelectorAll<HTMLElement>(SEL)) { last.delete(e); runs.delete(e) } later() })
  addEventListener('resize', () => { for (const e of document.querySelectorAll<HTMLElement>(SEL)) runs.delete(e); later() })
  later()
}
