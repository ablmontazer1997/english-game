import { useEffect, useState } from 'react'

/** admin 6041: the startup splash (key art + gold ribbon title + rune-ring loader + rotating tips). Its CSS and a static
 *  copy of the same markup live in index.html, so the splash shows before the bundle loads and this component simply
 *  carries on with it (same image, same classes) until the game is ready. */
const TIPS: string[] = (window as any).ES_TIPS ?? ['Tip: say new words out loud.']
const BASE = import.meta.env.BASE_URL

export function Splash() {
  const [i, setI] = useState<number>(() => (window as any).ES_TIP_I ?? 0)
  const [on, setOn] = useState(true)
  useEffect(() => {
    const t = setInterval(() => { setOn(false); setTimeout(() => { setI((v) => (v + 1) % TIPS.length); setOn(true) }, 350) }, 3200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="es-splash" role="img" aria-label="English Spell is loading">
      <div className="es-sp-art" style={{ animation: 'none' }} />
      <div className="es-sp-title" style={{ animation: 'none' }}><img src={`${BASE}splash/ribbon.webp`} alt="" draggable={false} /><span>English Spell</span></div>
      <div className="es-sp-load">
        <div className="es-sp-ring" />
        <b>Opening the portal…</b>
        <p className="es-sp-tip" style={{ opacity: on ? 1 : 0 }}>{TIPS[i]}</p>
      </div>
    </div>
  )
}
