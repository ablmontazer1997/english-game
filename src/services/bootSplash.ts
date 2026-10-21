// admin 6082: no half-built first screen. The static S2 splash from index.html is lifted out of #root and kept on top
// until the first real screen (login, intro letter, map, offline...) has its images decoded and the fonts are ready,
// then it goes in one cut. The Android app keeps its native S2 picture until the web splash is painted
// (window.ESNative.splashUp(), 0.2.6+) or the app is ready (window.ESNative.ready()).
// admin 6264: when the first screen is Home (the map), the splash also waits for the 3D hero to be fully shown
// (the map's .mhero leaves `wait3d`: is-3d after rc-shown, or the painted fallback), so Home appears complete in one go.
// A thin progress bar at the bottom follows real milestones (screen, pictures, 3D engine, body, items, shown).
const CAP_MS = 8000          // never hold longer than this after the first real screen appears (screens without a hero)
const FIRST_MS = 20000       // nor this long in total from app start (slow network / a hero that never comes: the app shows anyway)
const HERO_FADE_MS = 350     // the hero canvas (0.3 s) and the map's .mhero-3d (250 ms) fade in: let them finish under the splash

type Native = { ready?: () => void; splashUp?: () => void }
const native = () => (window as unknown as { ESNative?: Native }).ESNative
const tellNative = () => { try { native()?.ready?.() } catch { /* web */ } }

const urlsOf = (v: string) => [...v.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'))

function screenImages(root: Element): string[] {
  const out = new Set<string>()
  root.querySelectorAll('img').forEach((i) => { if (i.currentSrc || i.src) out.add(i.currentSrc || i.src) })
  root.querySelectorAll('*').forEach((el) => {
    for (const pseudo of [null, '::before', '::after'] as const) {
      const bg = getComputedStyle(el, pseudo).backgroundImage
      if (bg && bg !== 'none') urlsOf(bg).forEach((u) => out.add(u))
    }
  })
  return [...out]
}

const decode = (src: string) => new Promise<void>((res) => {
  const im = new Image(); im.src = src
  const done = () => res()
  if (im.decode) im.decode().then(done, done); else { im.onload = done; im.onerror = done }
})
const frames2 = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

type HeroWin = Window & { THREE?: unknown; ED?: unknown; RCGATE?: { pending?: () => number }; RCGATED?: string; RCSHOWN?: number }

/** the progress bar: `goal` is set by real milestones; the drawn value creeps towards the next one so it never sits still */
function progressBar(sp: HTMLElement) {
  const bar = sp.querySelector('#es-sp-bar') as HTMLElement | null
  if (bar) bar.dataset.own = '1'   // the static creep in index.html stops here
  let shown = Math.max(0.04, +(bar?.dataset.p ?? 0)), goal = shown, next = 0.15, stop = false
  const draw = () => { if (bar) bar.style.transform = `scaleX(${shown.toFixed(4)})` }
  const tick = () => {
    if (stop) return
    if (shown < goal) shown = Math.min(goal, shown + Math.max(0.02, (goal - shown) * 0.25))
    else if (shown < next - 0.01) shown += (next - 0.01 - shown) * 0.025   // slow creep, never reaches the next milestone
    draw(); setTimeout(tick, 100)
  }
  tick()
  return {
    at: (g: number, n: number) => { if (g > goal) goal = g; if (n > next) next = n },
    done: () => { stop = true; shown = 1; draw() },
  }
}

/** true while the boot splash is still on top (the portrait capture waits for it) */
export const splashUp = () => !!document.querySelector('body > .es-splash')

export function holdBootSplash() {
  const root = document.getElementById('root')
  const sp = root?.querySelector(':scope > .es-splash') as HTMLElement | null
  if (!root || !sp) { tellNative(); return }
  document.body.appendChild(sp)                     // React replaces #root's content; the static splash stays on top
  // moving the node restarts its CSS cap animation (index.html .es-sp-boot, 20 s from first paint): keep the original
  // deadline by giving the restarted animation only the time that is left
  const left = Math.max(0, Math.round(FIRST_MS - performance.now()))
  sp.style.animationDelay = `${left}ms, ${left + 250}ms`
  sp.style.zIndex = '2147483000'
  const bar = progressBar(sp)
  // Android 0.2.6+: the native S2 picture hands over to this identical web splash (which has the ring, bar and tips)
  // as soon as it is painted; older apps don't have splashUp and keep the native picture until ready()
  const art = getComputedStyle(sp.querySelector('.es-sp-art') ?? sp).backgroundImage
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve()
  Promise.all([fonts, ...urlsOf(art).map(decode)]).then(frames2).then(() => { try { native()?.splashUp?.() } catch { /* web */ } })

  let gone = false
  const hide = () => {
    if (gone) return; gone = true
    bar.done()
    tellNative()
    // one clean cut: a CSS fade froze half-way for seconds on a busy phone (emulator, slow network) and left the map ghosted
    sp.remove()
    dispatchEvent(new Event('es-splash-gone'))
  }
  setTimeout(hide, Math.max(0, FIRST_MS - performance.now()))
  const poll = () => {
    if (gone) return
    const real = root.childElementCount > 0 && !root.querySelector('.es-splash')
    if (!real) { setTimeout(poll, 100); return }
    bar.at(0.15, 0.3)
    const cap = setTimeout(hide, CAP_MS)
    // two passes: images can bring in more images (lazy children, late state); then two frames so they are painted
    const pass = () => Promise.all(screenImages(root).map(decode))
    Promise.all([fonts, pass()]).then(() => { bar.at(0.3, 0.42); return new Promise((r) => setTimeout(r, 150)) }).then(pass)
      .then(frames2)
      .then(() => {
        // Home first: wait for the 3D hero (the overall FIRST_MS cap still applies)
        const hero = root.querySelector('.mhero') as HTMLElement | null
        clearTimeout(cap)
        if (!hero || !hero.classList.contains('wait3d')) { hide(); return }
        bar.at(0.32, 0.45)
        let maxPending = 0
        const watch = () => {
          if (gone) return
          const h = root.querySelector('.mhero') as HTMLElement | null
          if (!h || !h.classList.contains('wait3d')) {  // is-3d (rc-shown) or the painted fallback (15 s); or the map left
            bar.at(1, 1)
            setTimeout(() => frames2().then(hide), h?.classList.contains('is-3d') ? HERO_FADE_MS : 0)
            return
          }
          try {   // same-origin hero page: read its loading state for the bar
            const w = (h.querySelector('iframe.mhero-3d') as HTMLIFrameElement | null)?.contentWindow as HeroWin | null
            if (w?.RCSHOWN || w?.RCGATED) bar.at(0.95, 0.99)
            else if (w?.ED) {
              const n = w.RCGATE?.pending?.() ?? 0
              maxPending = Math.max(maxPending, n)
              bar.at(0.62 + 0.3 * (maxPending ? 1 - n / maxPending : 0), 0.94)
            } else if (w?.THREE) bar.at(0.45, 0.6)
          } catch { /* not readable: the creep carries the bar */ }
          setTimeout(watch, 100)
        }
        watch()
      })
  }
  poll()
}
