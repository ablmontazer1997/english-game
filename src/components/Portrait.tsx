import { useEffect, useState } from 'react'
// default avatar until the player's own portrait exists (fresh player, capture not done or failed):
// the wardrobe's ?portrait=1 frame of the DEFAULT 3D character (look face1), boy and girl body type
import defBoy from '../assets/character/portrait_default_m.webp'
import defGirl from '../assets/character/portrait_default_f.webp'
// admin 6225: the default look's full-body picture (boy / girl), until the player's own one exists
import fbBoy from '../assets/character/fullbody_default_m.webp'
import fbGirl from '../assets/character/fullbody_default_f.webp'

// The player's avatar picture is a close-up of THEIR 3D character. The
// wardrobe (same origin, /runecast-wardrobe/) already restores the outfit,
// hair, eyes and skin tone from localStorage; in `?portrait=1` mode it renders
// one head-and-shoulders frame and posts it back (and stores it as rc.portrait).
const KEY = 'rc.portrait'
// test builds shoot from the test wardrobe (the integrated page that goes live next)
const WARDROBE_BASE = import.meta.env.BASE_URL.includes('-test') ? '/runecast-test-wardrobe-ui/' : '/runecast-wardrobe/'
// bump when the wardrobe's look changes, so saved portraits are retaken once in the new lighting
export const LOOK_VER = 'look3f' // 10-08 admin msg 4294: framed on the face (eye level, eyes at 46%, face ~2/3 of the circle)
export const portraitStale = () => { try { return !localStorage.getItem(KEY) || localStorage.getItem(KEY + '.look') !== LOOK_VER || !readFull() } catch { return true } }
// a picture taken under an older look (other camera / light) is not shown: the new default stands in until the retake lands
const read = () => { try { return localStorage.getItem(KEY + '.look') === LOOK_VER ? localStorage.getItem(KEY) : null } catch { return null } }
// the wardrobe stores the body type as localStorage girl=1
const fallback = () => { try { return localStorage.getItem('girl') === '1' ? defGirl : defBoy } catch { return defBoy } }

// admin 6225: the profile shows a full-body PICTURE of the player's own hero (no 3D there until "Edit look"). The wardrobe shoots it
// (rc.fullbody, transparent WebP cropped to the hero: feet = bottom edge) on Save look, and the hidden capture below after every look change.
const FULL_KEY = 'rc.fullbody'
export const FULL_VER = 'fb1'
function readFull() { try { return localStorage.getItem(FULL_KEY + '.look') === FULL_VER ? localStorage.getItem(FULL_KEY) : null } catch { return null } }
// cx = where the body centre (feet) sits across the picture (the wand makes it lopsided); measured on the default pictures
const FB_CX = { m: 0.3912, f: 0.3912 }
const fullFallback = () => { let g = false; try { g = localStorage.getItem('girl') === '1' } catch { /* */ } return g ? { src: fbGirl, cx: FB_CX.f } : { src: fbBoy, cx: FB_CX.m } }
const readCx = () => { try { const v = parseFloat(localStorage.getItem(FULL_KEY + '.cx') || ''); return v > 0 && v < 1 ? v : 0.5 } catch { return 0.5 } }

export function useFullbody() {
  const [src, setSrc] = useState<string | null>(readFull)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'rc-fullbody' && typeof e.data.data === 'string') setSrc(e.data.data) }
    const onStore = (e: StorageEvent) => { if (e.key === FULL_KEY || e.key === FULL_KEY + '.look') setSrc(readFull()) }
    const onLocal = () => setSrc(readFull())
    addEventListener('message', onMsg); addEventListener('storage', onStore); addEventListener('rc-fullbody', onLocal); addEventListener('focus', onLocal)
    return () => { removeEventListener('message', onMsg); removeEventListener('storage', onStore); removeEventListener('rc-fullbody', onLocal); removeEventListener('focus', onLocal) }
  }, [])
  return src ? { src, cx: readCx() } : fullFallback()
}

export function usePortrait() {
  const [src, setSrc] = useState<string | null>(read)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'rc-portrait' && typeof e.data.data === 'string') setSrc(e.data.data) }
    const onStore = (e: StorageEvent) => { if (e.key === KEY) setSrc(e.newValue) }
    const onLocal = () => setSrc(read())
    addEventListener('message', onMsg); addEventListener('storage', onStore); addEventListener('rc-portrait', onLocal)
    return () => { removeEventListener('message', onMsg); removeEventListener('storage', onStore); removeEventListener('rc-portrait', onLocal) }
  }, [])
  return src ?? fallback()
}

/**
 * Renders the wardrobe off-screen once to (re)take the portrait. Mount it with a
 * changing `version` (e.g. after the player leaves the wardrobe) to refresh.
 */
export function PortraitCapture({ version }: { version: number }) {
  const [on, setOn] = useState(true)
  // admin 5999 (slow start): the hidden wardrobe used to load at the same time as the visible hero and doubled the
  // time until the map hero appeared (17 s -> 34 s on a throttled CPU). Wait for a shown hero (rc-shown), or 20 s.
  const [go, setGo] = useState(false)
  useEffect(() => {
    setGo(false)
    let t = 0
    const start = () => { clearTimeout(t); t = window.setTimeout(() => setGo(true), 1500) }
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'rc-shown') start() }
    addEventListener('message', onMsg)
    const t0 = setTimeout(() => setGo(true), 20000)
    return () => { removeEventListener('message', onMsg); clearTimeout(t); clearTimeout(t0) }
  }, [version])
  const [phase, setPhase] = useState<'head' | 'full'>('head')
  useEffect(() => { setPhase('head') }, [version])
  useEffect(() => {
    if (!go || phase !== 'full') return
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'rc-fullbody' || typeof e.data.data !== 'string') return
      try { localStorage.setItem(FULL_KEY, e.data.data); if (typeof e.data.cx === 'number') localStorage.setItem(FULL_KEY + '.cx', e.data.cx.toFixed(4)); localStorage.setItem(FULL_KEY + '.look', FULL_VER) } catch { /* full storage */ }
      dispatchEvent(new Event('rc-fullbody'))
      setOn(false)
    }
    addEventListener('message', onMsg)
    const t = setTimeout(() => setOn(false), 90000)
    return () => { removeEventListener('message', onMsg); clearTimeout(t) }
  }, [version, go, phase])
  useEffect(() => {
    if (!go || phase !== 'head') return
    setOn(true)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'rc-portrait' || typeof e.data.data !== 'string') return
      try { localStorage.setItem(KEY, e.data.data); localStorage.setItem(KEY + '.look', LOOK_VER) } catch { /* full storage: keep it in memory only */ }
      dispatchEvent(new Event('rc-portrait'))
      if (e.data.final) setPhase('full')
    }
    addEventListener('message', onMsg)
    const t = setTimeout(() => setPhase('full'), 90000)                // never keep the 3D view alive for long (slow phones need > 45 s for the first load)
    return () => { removeEventListener('message', onMsg); clearTimeout(t) }
  }, [version, go, phase])
  if (!go || !on) return null
  if (phase === 'full') return <iframe key={'f' + version} title='hero picture' aria-hidden src={`${WARDROBE_BASE}?embed=1&fullsnap=1&v=${version}`}
    style={{ position: 'fixed', left: 0, bottom: 0, width: 300, height: 540, border: 0, opacity: 0.01, zIndex: -1, pointerEvents: 'none' }} />
  return <iframe key={version} title="portrait" aria-hidden src={`${WARDROBE_BASE}?embed=1&portrait=1&v=${version}`}
    style={{ position: 'fixed', left: 0, bottom: 0, width: 320, height: 320, border: 0, opacity: 0.01, zIndex: -1, pointerEvents: 'none' }} />
}
