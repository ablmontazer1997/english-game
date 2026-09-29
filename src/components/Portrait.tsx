import { useEffect, useState } from 'react'
import mage from '../assets/character/body/mage_m.webp'

// The player's avatar picture is a close-up of THEIR 3D character. The
// wardrobe (same origin, /runecast-wardrobe/) already restores the outfit,
// hair, eyes and skin tone from localStorage; in `?portrait=1` mode it renders
// one head-and-shoulders frame and posts it back (and stores it as rc.portrait).
const KEY = 'rc.portrait'
// bump when the wardrobe's look changes, so saved portraits are retaken once in the new lighting
export const LOOK_VER = 'bake1'
export const portraitStale = () => { try { return !localStorage.getItem(KEY) || localStorage.getItem(KEY + '.look') !== LOOK_VER } catch { return true } }
const read = () => { try { return localStorage.getItem(KEY) } catch { return null } }

export function usePortrait() {
  const [src, setSrc] = useState<string | null>(read)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'rc-portrait' && typeof e.data.data === 'string') setSrc(e.data.data) }
    const onStore = (e: StorageEvent) => { if (e.key === KEY) setSrc(e.newValue) }
    const onLocal = () => setSrc(read())
    addEventListener('message', onMsg); addEventListener('storage', onStore); addEventListener('rc-portrait', onLocal)
    return () => { removeEventListener('message', onMsg); removeEventListener('storage', onStore); removeEventListener('rc-portrait', onLocal) }
  }, [])
  return src ?? mage
}

/**
 * Renders the wardrobe off-screen once to (re)take the portrait. Mount it with a
 * changing `version` (e.g. after the player leaves the wardrobe) to refresh.
 */
export function PortraitCapture({ version }: { version: number }) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    setOn(true)
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'rc-portrait' || typeof e.data.data !== 'string') return
      try { localStorage.setItem(KEY, e.data.data); localStorage.setItem(KEY + '.look', LOOK_VER) } catch { /* full storage: keep it in memory only */ }
      dispatchEvent(new Event('rc-portrait'))
      if (e.data.final) setOn(false)
    }
    addEventListener('message', onMsg)
    const t = setTimeout(() => setOn(false), 45000)                // never keep the 3D view alive for long
    return () => { removeEventListener('message', onMsg); clearTimeout(t) }
  }, [version])
  if (!on) return null
  return <iframe key={version} title="portrait" aria-hidden src={`/runecast-wardrobe/?embed=1&portrait=1&v=${version}`}
    style={{ position: 'fixed', left: 0, bottom: 0, width: 320, height: 320, border: 0, opacity: 0.01, zIndex: -1, pointerEvents: 'none' }} />
}
