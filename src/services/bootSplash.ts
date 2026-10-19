// admin 6082: no half-built first screen. The static S2 splash from index.html is lifted out of #root and kept on top
// until the first real screen (login, intro letter, map, offline...) has its images decoded and the fonts are ready,
// then it fades out in 200 ms. The Android app keeps its native S2 picture until it hears window.ESNative.ready().
const CAP_MS = 8000          // never hold longer than this after the first real screen appears
const FIRST_MS = 20000       // nor this long in total (slow network: the splash then simply goes)

type Native = { ready?: () => void }
const tellNative = () => { try { (window as unknown as { ESNative?: Native }).ESNative?.ready?.() } catch { /* web */ } }

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

export function holdBootSplash() {
  const root = document.getElementById('root')
  const sp = root?.querySelector(':scope > .es-splash') as HTMLElement | null
  if (!root || !sp) { tellNative(); return }
  document.body.appendChild(sp)                     // React replaces #root's content; the static splash stays on top
  sp.style.zIndex = '2147483000'
  const t0 = performance.now()
  let gone = false
  const hide = () => {
    if (gone) return; gone = true
    tellNative()
    sp.style.transition = 'opacity .2s ease-out'; sp.style.opacity = '0'
    setTimeout(() => sp.remove(), 260)
  }
  setTimeout(hide, FIRST_MS)
  const poll = () => {
    if (gone) return
    const real = root.childElementCount > 0 && !root.querySelector('.es-splash')
    if (!real) { setTimeout(poll, 100); return }
    const cap = setTimeout(hide, CAP_MS)
    // two passes: images can bring in more images (lazy children, late state); then two frames so they are painted
    const pass = () => Promise.all(screenImages(root).map(decode))
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve()
    Promise.all([fonts, pass()]).then(() => new Promise((r) => setTimeout(r, 150))).then(pass)
      .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      .then(() => { clearTimeout(cap); hide() })
  }
  poll()
}
