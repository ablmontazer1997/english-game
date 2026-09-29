import { useEffect, useMemo, useState } from 'react'
import type { MiniGameProps } from './types'
import { burst, flyTo, shake } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { CURSES } from './banks/curse'
import { levelOf, makeScore, pick, shuffle } from './kit'
import { sfx } from '../services/audio'
import bgPlate from '../assets/games/curse/cb_bg.webp'
import mirrorClean from '../assets/games/curse/cb_mirror_clean.webp'
import './scene.css'
import './cursebreaker.css'

// Curse Breaker — error correction. One word of the sentence is cursed (wrong).
// Tap it, then pick the spell that fixes it. Every fixed sentence clears a bit
// of the dark vines around the mirror.

const ROUNDS = 6
const MISS_LIMIT = 2

export function CurseBreaker({ onFinish, level }: MiniGameProps) {
  const lv = levelOf(level)
  const lines = useMemo(() => pick(CURSES[lv], ROUNDS), [lv])
  const [round, setRound] = useState(0)
  const c = lines[round]
  const tokens = useMemo(() => c.text.split(' '), [c])
  const fixes = useMemo(() => shuffle([c.fix, ...c.wrong]), [c])
  const [found, setFound] = useState(false)
  const [misses, setMisses] = useState<number[]>([])
  const [shown, setShown] = useState(false) // hint lit the cursed word
  const [state, setState] = useState<'find' | 'fix' | 'ok' | 'bad'>('find')
  const [picked, setPicked] = useState<string | null>(null)
  const [cleared, setCleared] = useState(0)
  const [score] = useState(makeScore)

  useEffect(() => { setFound(false); setMisses([]); setShown(false); setState('find'); setPicked(null) }, [c])

  const next = () => { if (round + 1 >= lines.length) onFinish(score.out(lines.length)); else setRound(round + 1) }
  const lose = () => { score.miss(); setState('bad'); setTimeout(next, 2600) }

  useHint(() => {
    if (state !== 'find' || shown) return false
    setShown(true); return true
  })

  function tap(i: number) {
    if (state !== 'find') return
    const el = document.querySelector(`.cbk [data-w="${i}"]`)
    if (i === c.bad) { sfx('spell', .5); burst(el, { color: ['#8a4dff', '#3b1466', '#c9a3ff'], n: 16, up: true, dist: 70, size: 13, ms: 1000 }); setFound(true); setState('fix'); return }
    burst(el, { color: '#b9b2cc', n: 6, dist: 30, size: 7 })
    const m = [...misses, i]
    setMisses(m)
    if (m.length >= MISS_LIMIT) { setFound(true); lose() }
  }

  function choose(f: string, btn?: Element) {
    if (state !== 'fix' || picked) return
    setPicked(f)
    const word = document.querySelector(`.cbk [data-w="${c.bad}"]`)
    if (f === c.fix) {
      // the spell flies onto the cursed word and breaks it in a shower of light
      fxSfx('whoosh', .5)
      flyTo(btn, word, { ms: 420, arc: -70 }).then(() => {
        burst(word, { color: ['#ffe27a', '#8fe56a', '#ffffff'], n: 18, dist: 80 }); fxSfx('star', .7)
        if (!misses.length) score.hit(); else score.miss()
        setCleared((n) => n + 1); setState('ok'); setTimeout(next, 1800)
      })
    } else { shake(word, 10); burst(word, { color: ['#3b1466', '#6b5d7a'], n: 12, up: true, dist: 60, size: 14, ms: 1100 }); lose() }
  }

  const tip = state === 'find' ? 'Find the cursed word' : state === 'fix' ? 'Choose the spell that breaks the curse' : state === 'ok' ? 'Curse broken!' : c.why
  return (
    <div className={`gs cbk cbk-s-${state}`} style={{ '--clear': cleared / lines.length } as React.CSSProperties}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <div className="gs-at cbk-mirror" aria-hidden>
          <img className="clean" src={mirrorClean} alt="" draggable={false} />
          <span className="cbk-flash" />
        </div>
      </div>
      <div className="gs-title"><GameTitle title="Curse Breaker" count={`Curse ${round + 1} / ${lines.length}`} /></div>

      <div className="gs-ui gs-panel cbk-card">
        {tokens.map((t, i) => {
          const isBad = i === c.bad
          const cls = ['gs-chip cbk-w',
            misses.includes(i) ? 'miss' : '',
            isBad && (found || shown) ? 'cursed' : '',
            isBad && state === 'ok' ? 'fixed' : ''].join(' ')
          return <button key={i} data-w={i} className={cls} onClick={() => tap(i)} disabled={state !== 'find'}>
            {isBad && state === 'ok' ? (c.fix || <s>{t}</s>) : isBad && state === 'bad' ? <><s>{t}</s> {c.fix}</> : t}
          </button>
        })}
      </div>
      <div className={`gs-ui cbk-fixes${state === 'fix' ? ' on' : ''}`}>
        {fixes.map((f) => (
          <button key={f} className={`gs-gold cbk-fix${picked === f ? (f === c.fix ? ' right' : ' wrong') : ''}`} disabled={state !== 'fix' || !!picked} onClick={(e) => choose(f, e.currentTarget)}>
            {f || '(remove it)'}
          </button>
        ))}
      </div>
      <p className="gs-ui cbk-tip">{tip}</p>
    </div>
  )
}
