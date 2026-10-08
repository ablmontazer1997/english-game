import { useEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { burst, pop } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { ECHO } from './banks/echo'
import { fromSrv, canListen, hush, levelOf, listen, makeScore, norm, pick, speak } from './kit'
import bgPlate from '../assets/games/echo/ec_bg.webp'
import wisp from '../assets/games/echo/ec_wisp.webp'
import wispHappy from '../assets/games/echo/ec_wisp_happy.webp'
import wispSad from '../assets/games/echo/ec_wisp_sad.webp'
import crystal from '../assets/games/echo/ec_crystal.webp'
import './scene.css'
import './echocave.css'

// Echo Cave — speaking. The cave spirit says a sentence; the player says it
// back. Every word heard lights one crystal; light most of them to pass.
// Without a microphone API the player types what they heard instead.

const ROUNDS = 5
const PASS = 0.8
const TRIES = 2

/** which target words were heard, in order, allowing small slips */
function heardWords(target: string[], said: string): boolean[] {
  const s = norm(said).split(' ')
  let j = 0
  return target.map((w) => {
    for (let k = j; k < Math.min(s.length, j + 3); k++) {
      if (s[k] === w) { j = k + 1; return true }
    }
    return false
  })
}

export function EchoCave({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const lines = useMemo(() => fromSrv(srv, () => pick(ECHO[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const line = lines[round]
  const words = useMemo(() => norm(line.text).split(' '), [line])
  const [lit, setLit] = useState<boolean[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const [tries, setTries] = useState(0)
  const [talking, setTalking] = useState(false)
  const [hearing, setHearing] = useState(false)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const [score] = useState(makeScore)
  const mic = canListen()

  useEffect(() => {
    setLit(words.map(() => false)); setState('play'); setTries(0); setTyped(''); setNote('')
    const t = setTimeout(() => speak(line.text, { onState: setTalking }), 500)
    return () => { clearTimeout(t); hush() }
  }, [line, words])

  // hint: light the next dark crystal as if it had been said
  useHint(() => {
    if (state !== 'play') return false
    const i = lit.indexOf(false)
    if (i < 0) return false
    setLit(lit.map((x, k) => x || k === i)); return true
  })

  function next() {
    if (round + 1 >= lines.length) onFinish(score.out(lines.length))
    else setRound(round + 1)
  }

  function judge(said: string[]) {
    // best of the recognizer's alternatives, merged with crystals already lit
    let best = lit
    for (const s of said) {
      const h = heardWords(words, s).map((x, i) => x || lit[i])
      if (h.filter(Boolean).length > best.filter(Boolean).length) best = h
    }
    setLit(best)
    const ratio = best.filter(Boolean).length / words.length
    if (ratio >= PASS) {
      if (line._qid) onAnswer?.(line._qid, said[0] ?? '', true)
      score.hit(); setState('ok'); setTimeout(next, 1400)
    } else if (tries + 1 >= TRIES) {
      if (line._qid) onAnswer?.(line._qid, said[0] ?? '', false)
      score.miss(); setState('bad'); setNote(`It was: "${line.text}"`)
      setTimeout(next, 2400)
    } else {
      setTries(tries + 1); setState('bad')
      setNote(said.length ? `I heard: "${said[0]}". Listen and try again.` : 'I could not hear you. Try again.')
      setTimeout(() => { setState('play'); speak(line.text, { rate: 0.8, onState: setTalking }) }, 1200)
    }
  }

  async function say() {
    if (state !== 'play' || hearing) return
    hush(); setNote('')
    judge(await listen(setHearing))
  }

  // every crystal that lights up pops with a spark
  const prevLit = useRef<boolean[]>([])
  useEffect(() => {
    const imgs = document.querySelectorAll('.ec-crystals img')
    let k = 0
    lit.forEach((x, i) => { if (x && !prevLit.current[i]) { const el = imgs[i]; setTimeout(() => { pop(el, 1.3); burst(el, { color: ['#c9a3ff', '#ffffff', '#8ad8ff'], n: 7, dist: 32, size: 7 }); fxSfx('star', .35) }, 90 * k++) } })
    prevLit.current = lit
  }, [lit])
  useEffect(() => { if (state === 'ok') burst(document.querySelector('.ec-wisp'), { color: ['#ffe27a', '#8ad8ff', '#ffffff'], n: 18, dist: 90 }) }, [state])
  const on = lit.filter(Boolean).length
  return (
    <div className={`gs ec ec-${state}${talking ? ' ec-talking' : ''}${hearing ? ' ec-hearing' : ''}`}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <div className="gs-at ec-wisp" aria-hidden><img src={state === 'ok' ? wispHappy : state === 'bad' ? wispSad : wisp} alt="" draggable={false} /></div>
      </div>
      <div className="gs-title"><GameTitle title="Echo Cave" count={`Echo ${round + 1} / ${lines.length}`} /></div>

      {note && <div className="gs-ui ec-note">{note}</div>}
      <div className="gs-ui gs-panel ec-card">
        <Task className="gtask-row" icon="speak" text={mic ? "Listen, then say it" : "Listen, then type it"} sub="Tap the speaker to hear it" first={round === 0} />
        <p className="ec-line">
          {line.text.split(' ').map((w, i) => <span key={i} className={lit[i] ? 'on' : ''}>{w} </span>)}
        </p>
        <div className="ec-btns">
          <button className="gs-orb ec-say" aria-label="Listen" onClick={() => speak(line.text, { onState: setTalking })}>
            <svg viewBox="0 0 24 24" width="26" height="26"><path fill="#fff" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
          </button>
          <button className="ec-slow" aria-label="Slow" onClick={() => speak(line.text, { rate: 0.6, onState: setTalking })}>🐢</button>
        </div>
      </div>

      <div className="gs-ui ec-crystals" aria-label={`${on} of ${words.length} words`}>
        {words.map((_, i) => <img key={i} src={crystal} alt="" draggable={false} className={lit[i] ? 'on' : ''} />)}
      </div>

      <div className="gs-ui ec-act">
        {mic ? (
          <>
            <button className="gs-orb ec-mic" aria-label="Say it" onClick={say} disabled={state !== 'play'}>
              <span className="ec-arc l" /><span className="ec-arc r" />
              <svg viewBox="0 0 24 24" width="46%" height="46%"><path fill="#fff" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z" /></svg>
            </button>
            <p className="ec-tip">{hearing ? 'Listening…' : 'Tap and say it'}</p>
          </>
        ) : (
          <form className="ec-type" onSubmit={(e) => { e.preventDefault(); if (typed.trim() && state === 'play') judge([typed]) }}>
            <input className="gs-panel" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type what you hear" autoCapitalize="off" autoCorrect="off" />
            <button className="gs-go" disabled={!typed.trim() || state !== 'play'}>Echo</button>
          </form>
        )}
      </div>
    </div>
  )
}
