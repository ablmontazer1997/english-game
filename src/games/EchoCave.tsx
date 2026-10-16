import { useEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { burst, pop } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { useStageCtl } from './coach'
import { ECHO } from './banks/echo'
import { fromSrv, canListen, hush, levelOf, listen, makeScore, norm, pick, speak } from './kit'
import bgPlate from '../assets/games/echo/ec_bg.webp'
import wisp from '../assets/games/echo/ec_wisp.webp'
import wispHappy from '../assets/games/echo/ec_wisp_happy.webp'
import wispSad from '../assets/games/echo/ec_wisp_sad.webp'
import snail from '../assets/es2/k/p16/icon_snail.webp'
import ringLO from '../assets/es2/k/p17/echo_ring_left_outer.webp'
import ringLI from '../assets/es2/k/p17/echo_ring_left_inner.webp'
import ringRI from '../assets/es2/k/p17/echo_ring_right_inner.webp'
import ringRO from '../assets/es2/k/p17/echo_ring_right_outer.webp'
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
  const ctl = useStageCtl()

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
      // Phase C: the shared card with the sentence (admin 5838: no automatic speech after the answer)
      score.miss(); setState('bad'); setNote('')
      setTimeout(() => { ctl.wrong({ answer: line.text, label: 'Say it like this', yours: said[0] }, 2000).then(next) }, 600)
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
    const imgs = document.querySelectorAll('.ec-line > span')
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
      {/* ES2 concept 17: the task plate (with the scroll) under the HUD; in the card every word hides under a painted rune
          block until it is said (the old crystal row is now these blocks); painted speaker + snail */}
      <div className="gs-ui ec-taskp"><Task icon="speak" text={mic ? "Listen, then say it" : "Listen, then type it"} sub="Tap the speaker to hear it" first={round === 0} className="k-scroll" /></div>
      <div className="gs-ui gs-panel ec-card k9 k-panel" data-coach="q" aria-label={`${on} of ${words.length} words`}>
        <p className="ec-line">
          {line.text.split(' ').map((w, i) => <span key={i} className={lit[i] ? 'on' : 'ec-hid'}><i>{w}</i> </span>)}
        </p>
        <div className="ec-btns">
          <button className="ec-say" aria-label="Listen" onClick={() => speak(line.text, { onState: setTalking })} />
          <button className="ec-slow" aria-label="Slow" onClick={() => speak(line.text, { rate: 0.6, onState: setTalking })}><img src={snail} alt="" /></button>
        </div>
      </div>

      <div className="gs-ui ec-act" data-coach="a" data-coach-parts=".ec-mic, .ec-tip, .ec-type">
        {mic ? (
          <>
            <button className="ec-mic" data-demo={ctl.practice ? 0 : undefined} aria-label="Say it" onClick={say} disabled={state !== 'play'}>
              <img className="ec-ring lo" src={ringLO} alt="" /><img className="ec-ring li" src={ringLI} alt="" />
              <img className="ec-ring ri" src={ringRI} alt="" /><img className="ec-ring ro" src={ringRO} alt="" />
            </button>
            <p className="ec-tip">{hearing ? 'Listening…' : 'Tap and say it'}</p>
          </>
        ) : (
          <form className="ec-type" onSubmit={(e) => { e.preventDefault(); if (typed.trim() && state === 'play') judge([typed]) }}>
            <input className="gs-panel k9 k-panel" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type what you hear" autoCapitalize="off" autoCorrect="off" />
            <button className="gs-go k-btn k-green" disabled={!typed.trim() || state !== 'play'}>Echo</button>
          </form>
        )}
      </div>
    </div>
  )
}
