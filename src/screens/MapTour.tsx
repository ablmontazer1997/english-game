// The short map tour after the intro (audit 10-11 §3 step 9): a few coach marks that light up one part of the home
// screen each, with one wizard line. Shown once (account flags.tour = 'pending' -> 'done'); "Skip tour" ends it.
import { useEffect, useLayoutEffect, useState } from 'react'
import { Btn } from '../components/PageArt'
import oracleIdle from '../assets/games/oracle/oracle_idle.webp'
import './maptour.css'
import { Dim } from '../games/coach'

interface Mark { find: () => Element | null; title: string; text: string }
const MARKS: Mark[] = [
  { find: () => document.querySelector('.rtoken.is-current .rtoken-btn, .rtoken.is-current'), title: 'Your path',
    text: 'The glowing stone is your next stage. Tap it to play.' },
  { find: () => document.querySelector('.mla-streak'), title: 'Hearthfire',
    text: 'Finish one stage a day to keep your fire burning.' },
  { find: () => document.querySelector('.mlc-seg[aria-label="Daily quests"], .mlb-daily'), title: 'Daily quests',
    text: 'Three small quests every day. Finish them all for a chest.' },
  { find: () => document.querySelector('.mlx-atlas'), title: 'World map',
    text: 'Travel between worlds and grimoires here.' },
  { find: () => document.querySelector('.hud-avatar'), title: 'Your profile',
    text: 'Your look, your treasures and your achievements.' },
  { find: () => document.querySelectorAll('.bnav-item')[3] ?? null, title: 'The league',
    text: 'Every week your name meets other players. Climb to the top!' },
]

type Box = { x: number; y: number; w: number; h: number }

export function MapTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [vh, setVh] = useState(() => innerHeight)
  const [vw, setVw] = useState(() => innerWidth)

  // skip marks whose element is not on screen (e.g. a layout without that chip)
  useEffect(() => {
    if (i >= MARKS.length) { onDone(); return }
    let tries = 0
    const t = setInterval(() => {
      const el = MARKS[i].find()
      const r = el?.getBoundingClientRect()
      if (r && r.width > 0 && r.bottom > 0 && r.top < innerHeight) { clearInterval(t); return }
      if (++tries > 12) { clearInterval(t); setI((n) => n + 1) }
    }, 150)
    return () => clearInterval(t)
  }, [i, onDone])

  useLayoutEffect(() => {
    if (i >= MARKS.length) return
    const read = () => {
      const el = MARKS[i].find(), host = document.querySelector('.app-frame')
      const r = el?.getBoundingClientRect(), h = host?.getBoundingClientRect()
      setVh(h?.height ?? innerHeight)
      setVw(h?.width ?? innerWidth)
      if (!r || !h || !r.width) { setBox(null); return }
      // tight to the element, never past the screen edges (the League tab hole used to stick out above the tab bar)
      const pad = 5
      const x = Math.max(2, r.left - h.left - pad), y = Math.max(2, r.top - h.top - pad)
      setBox({ x, y, w: Math.min(h.width - 2, r.right - h.left + pad) - x, h: Math.min(h.height - 2, r.bottom - h.top + pad) - y })
    }
    read()
    const t = setInterval(read, 400)
    addEventListener('resize', read)
    return () => { clearInterval(t); removeEventListener('resize', read) }
  }, [i])

  if (i >= MARKS.length) return null
  const m = MARKS[i]
  const below = !box || box.y + box.h / 2 < vh * 0.5
  const last = i === MARKS.length - 1
  return (
    <div className="mt" role="dialog" aria-label={`Tour: ${m.title}`}>
      {/* Phase E (admin 4847): plain HTML rectangles (coach Dim), like the game tutorials. The old 9999px box-shadow hole rendered as a pale
          wash on some phones, so the lit element barely stood out from the map. */}
      <Dim w={vw} h={vh} boxes={box ? [box] : []} color="rgba(8, 5, 26, .8)" r={18} />
      <svg className="mt-dim" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden>
        {box && <rect className="mt-glow" x={box.x} y={box.y} width={box.w} height={box.h} rx="18" />}
        {box && <rect className="mt-ring" x={box.x} y={box.y} width={box.w} height={box.h} rx="18" />}
      </svg>
      <div className={`mt-card pop ${below ? 'below' : 'above'}`} key={i}
        style={box ? (below ? { top: Math.min(vh - 210, box.y + box.h + 14) } : { bottom: Math.max(12, vh - box.y + 14) }) : { top: '40%' }}>
        <img className="mt-face" src={oracleIdle} alt="" draggable={false} />
        <div className="mt-tx">
          <b>{m.title}</b>
          <p>{m.text}</p>
        </div>
        <div className="mt-btns">
          <span className="mt-count">{i + 1} / {MARKS.length}</span>
          <button className="mt-skip" onClick={onDone}>Skip tour</button>
          <Btn className="mt-next" onClick={() => setI(i + 1)}>{last ? 'Got it' : 'Next'}</Btn>
        </div>
      </div>
    </div>
  )
}
