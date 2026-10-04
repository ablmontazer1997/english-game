import { useEffect, useMemo, useState } from 'react'
import type { MiniGameProps } from './types'
import { burst, pop } from './fx'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { RUNE_WORDS } from './banks/runetype'
import { fromSrv, hush, levelOf, makeScore, pick, speak } from './kit'
import bgPlate from '../assets/games/runetype/rt_bg.webp'
import './scene.css'
import './runetype.css'

// Rune Type — spelling. Read the clue (and hear the word), then carve it letter
// by letter on the rune keyboard. A full word is checked at once: wrong runes
// crack and fall away, the right beginning stays.

const ROUNDS = 6
const TRIES = 3
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export function RuneType({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const words = useMemo(() => fromSrv(srv, () => pick(RUNE_WORDS[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const w = words[round]
  const [typed, setTyped] = useState('')
  const [bad, setBad] = useState<number[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad' | 'reveal'>('play')
  const [tries, setTries] = useState(0)
  const [score] = useState(makeScore)

  useEffect(() => {
    setTyped(''); setBad([]); setState('play'); setTries(0)
    const t = setTimeout(() => speak(w.word), 450)
    return () => { clearTimeout(t); hush() }
  }, [w])

  const next = () => { if (round + 1 >= words.length) onFinish(score.out(words.length)); else setRound(round + 1) }

  function check(s: string) {
    if (w._qid) onAnswer?.(w._qid, s, s === w.word)
    if (s === w.word) { score.hit(); setState('ok'); speak(w.word); document.querySelectorAll('.rt-slot').forEach((el, i) => setTimeout(() => burst(el, { color: ['#8fe56a', '#ffe27a', '#ffffff'], n: 7, dist: 38, size: 7 }), 60 * i)); setTimeout(next, 1300); return }
    const wrong = [...s].map((c, i) => (c !== w.word[i] ? i : -1)).filter((i) => i >= 0)
    setBad(wrong); setState('bad')
    if (tries + 1 >= TRIES) {
      score.miss()
      setTimeout(() => { setTyped(w.word); setBad([]); setState('reveal'); speak(w.word) }, 800)
      setTimeout(next, 2600)
    } else {
      setTries(tries + 1)
      setTimeout(() => { setTyped(s.slice(0, wrong[0])); setBad([]); setState('play') }, 850)
    }
  }

  function press(c: string) {
    if (state !== 'play' || typed.length >= w.word.length) return
    const s = typed + c
    setTyped(s)
    requestAnimationFrame(() => { const el = document.querySelectorAll('.rt-slot')[s.length - 1]; pop(el, 1.3); burst(el, { color: ['#ffd45a', '#fff3b0'], n: 5, dist: 24, size: 6, ms: 500 }) })
    if (s.length === w.word.length) setTimeout(() => check(s), 180)
  }
  const back = () => { if (state === 'play') setTyped(typed.slice(0, -1)) }

  // a hardware keyboard works too
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase())
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // hint: keep the right beginning and carve the next rune
  useHint(() => {
    if (state !== 'play') return false
    let k = 0
    while (k < typed.length && typed[k] === w.word[k]) k++
    if (k >= w.word.length - 1) return false
    setTyped(w.word.slice(0, k + 1)); return true
  })

  return (
    <div className={`gs rt rt-${state}`}>
      <div className="gs-scene"><img className="gs-plate" src={bgPlate} alt="" draggable={false} /></div>
      <div className="gs-title"><GameTitle title="Rune Type" count={`Rune ${round + 1} / ${words.length}`} /></div>

      <div className="gs-ui gs-panel rt-clue">
        <p>{w.clue}</p>
        <button className="gs-orb rt-say" aria-label="Hear the word" onClick={() => speak(w.word)}>
          <svg viewBox="0 0 24 24" width="30" height="30"><path fill="#fff" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
        </button>
      </div>

      <div className="gs-ui rt-slots" style={{ '--n': w.word.length } as React.CSSProperties}>
        {[...w.word].map((_, i) => (
          <span key={i} className={`rt-slot${typed[i] ? ' full' : ''}${bad.includes(i) ? ' bad' : ''}`}>{typed[i] ?? ''}</span>
        ))}
      </div>

      <div className="gs-ui rt-kb">
        {ROWS.map((row, r) => (
          <div className="rt-row" key={r}>
            {[...row].map((c) => <button key={c} className="rt-key" onClick={() => press(c)}>{c}</button>)}
            {r === 2 && <button className="rt-key rt-back" aria-label="Delete" onClick={back}>←</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
