// Shared shrink-to-fit for one-line labels (admin 6106-6108, 10-20: text kept sticking out of chips, ribbons and buttons
// on phones that render text larger). A label inside a painted frame gets its font made smaller, down to MIN of its own
// size, until it fits the frame's inner box (padding, or the painted rim of a border-image frame, whichever is wider);
// if even MIN is too big, the label may wrap (balanced) instead. Nothing is hidden or cut.
// Opt in: the selectors below, or any element with data-fit.
const SEL = [
  '[data-fit]', '.k-ribbon', '.k-btn', '.ui-btn', '.ss-gchip b', '.ph-edit2', '.ph-sstat small', '.ph-sstat b',
  '.pf2-more', '.pf2-t', '.sl-mis-t', '.ui-chip', '.shp-tabs [role=tab]',
].join(',')
// the login / intro letter (ScrollSheet .ssh) runs its own label shrink (x0.94 steps, min 14 px): never touch it
const SKIP = '.ssh'
const MIN = 0.72        // never below 72% of the designed size
const MIN_PX = 10
const RIM = 0.6         // share of a border-image width that is painted rim (text keeps clear of it)

const last = new WeakMap<Element, string>()
// a label whose box follows its own text could ping-pong between two widths: a repeat of the key from two fits ago stops it
const prev = new WeakMap<Element, string>()
let epoch = 0   // bumped when fonts finish loading or the window / text size changes: every label is measured again
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
  if (!el.isConnected || !el.textContent?.trim() || el.closest(SKIP)) return
  const key = `${el.textContent}|${el.parentElement?.clientWidth ?? 0}|${innerWidth}|${epoch}`
  if (last.get(el) === key || prev.get(el) === key) return
  prev.set(el, last.get(el) ?? '')
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
  last.set(el, `${el.textContent}|${el.parentElement?.clientWidth ?? 0}|${innerWidth}|${epoch}`)
}

function scan(root: ParentNode) {
  const els = root instanceof HTMLElement && root.matches(SEL) ? [root] : []
  root.querySelectorAll?.<HTMLElement>(SEL).forEach((e) => els.push(e))
  for (const e of els) { fit(e); if (e.parentElement) ro?.observe(e.parentElement) }
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
  const again = () => { epoch++; later() }
  // fonts.ready can resolve before the web font even starts loading (nothing pending at boot): also refit on loadingdone
  document.fonts?.ready.then(again)
  document.fonts?.addEventListener?.('loadingdone', again)
  addEventListener('resize', again)
  later()
}
