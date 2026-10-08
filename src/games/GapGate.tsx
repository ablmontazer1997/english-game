import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Task } from './Task'
import { GameTitle } from '../components/GameTitle'
import type { MiniGameProps } from './types'
import gateImg from '../assets/sky/portal.png'
import sceneBg from '../assets/gapgate_bg.webp'
import { useHint } from './boosters'
import './gapgate.css'

const ADVANCE_OK_MS = 720 // pause after a correct answer (let the gate open)
const ADVANCE_BAD_MS = 1000 // longer pause on a wrong answer (reveal the word)

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

interface Option {
  key: string
  text: string
  correct: boolean
}

export function GapGate({ items, onFinish, onAnswer }: MiniGameProps) {
  const [idx, setIdx] = useState(0)
  const [, setCorrect] = useState(0)
  const [combo, setCombo] = useState(0)
  const [, setMaxCombo] = useState(0)
  const [chosen, setChosen] = useState<Option | null>(null)
  const [reveal, setReveal] = useState(false) // show correct word after a wrong pick
  const [shake, setShake] = useState(false)
  const [opened, setOpened] = useState(false)
  const [locked, setLocked] = useState(false)
  const [gone, setGone] = useState<Set<string>>(() => new Set()) // options removed by a hint

  // Live refs so the advance timer reads the latest tallies (no stale closures).
  const correctRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const finishedRef = useRef(false)
  const timer = useRef<number | null>(null)

  const item = items[idx]

  // Build the 4 options: correct front + 3 distractor WORDS from other items' front.
  const options = useMemo<Option[]>(() => {
    if (!item) return []
    const others = items.filter((it) => it.id !== item.id).map((it) => it.front)
    let pool = shuffle(others).slice(0, 3)
    // Pad if there aren't 3 other items: reuse words but never the correct answer.
    if (pool.length < 3) {
      const reusable = shuffle(others.length ? others : ['?'])
      let k = 0
      while (pool.length < 3) {
        const cand = reusable[k % reusable.length]
        pool.push(cand === item.front ? '?' : cand)
        k++
      }
    }
    const opts = shuffle([
      { text: item.front, correct: true },
      ...pool.map((t) => ({ text: t, correct: false })),
    ])
    return opts.map((o, i) => ({ key: `${item.id}-${i}`, text: o.text, correct: o.correct }))
  }, [item, items])

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearTimer()
    onFinish({
      correct: correctRef.current,
      total: items.length || 1,
      maxCombo: maxComboRef.current,
    })
  }, [clearTimer, items.length, onFinish])

  const advance = useCallback(() => {
    setChosen(null)
    setReveal(false)
    setShake(false)
    setOpened(false)
    setLocked(false)
    setGone(new Set())
    if (idx + 1 < items.length) setIdx((i) => i + 1)
    else finish()
  }, [idx, items.length, finish])

  useHint(() => {
    if (locked || !item) return false
    const wrong = options.filter((o) => !o.correct && !gone.has(o.key))
    if (wrong.length < 2) return false
    setGone(new Set([...gone, ...wrong.slice(0, 2).map((o) => o.key)]))
    return true
  })

  function pick(o: Option) {
    if (locked || !item) return
    setLocked(true)
    setChosen(o)
    onAnswer?.(item.id, o.text, o.correct)
    if (o.correct) {
      correctRef.current += 1
      comboRef.current += 1
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      setCorrect(correctRef.current)
      setCombo(comboRef.current)
      setMaxCombo(maxComboRef.current)
      setOpened(true)
      timer.current = window.setTimeout(advance, ADVANCE_OK_MS)
    } else {
      comboRef.current = 0
      setCombo(0)
      setShake(true)
      setReveal(true)
      timer.current = window.setTimeout(advance, ADVANCE_BAD_MS)
    }
  }

  // If there is nothing to play, report an empty result once.
  useEffect(() => {
    if (items.length === 0) finish()
  }, [items.length, finish])

  // Clear any pending timer on unmount.
  useEffect(() => () => clearTimer(), [clearTimer])

  if (items.length === 0) return <div className="gg-wait">Nothing to play</div>
  if (!item) return <div className="gg-wait">…</div>

  // The word that currently sits in the blank (chosen, or revealed answer).
  const filledWord = chosen?.correct
    ? chosen.text
    : reveal
      ? item.front
      : null
  const blankLen = Math.max(item.front.length, 3)

  return (
    <div className={`gg ${shake ? 'gg-shake' : ''}`} style={{ backgroundImage: `url(${sceneBg})` }}>
      <GameTitle title="Gap Gate" count={`Gate ${idx + 1} / ${items.length}`} />
      <div className="gg-hud">
        {combo >= 2 && (
          <span className="gg-combo pop" key={combo}>
            Combo ×{combo}
          </span>
        )}
      </div>

      <div className={`gg-portal ${opened ? 'is-open' : ''}`} key={item.id}>
        <img className="gg-portal-img" src={gateImg} alt="" draggable={false} />
        <span className="gg-portal-glow" aria-hidden />
      </div>

      <div className="gg-tablet">
        <Task className="gtask-row" icon="tap" text="Pick the missing word" sub="Its meaning is below" first={idx === 0} />
        <p className="gg-clue">
          Spell for <span className="gg-mean">{item.back}</span>
        </p>

        <div className="gg-blank" dir="ltr">
          {filledWord ? (
            <span
              className={`gg-fill ${chosen?.correct ? 'ok' : 'was'}`}
              key={filledWord}
            >
              {filledWord}
            </span>
          ) : (
            <span className="gg-marks" aria-hidden>
              {Array.from({ length: blankLen }).map((_, i) => (
                <i key={i} />
              ))}
            </span>
          )}
        </div>

      </div>

      <div className="gg-options">
        {options.map((o) => {
          const isChosen = chosen?.key === o.key
          const state = isChosen ? (o.correct ? 'ok' : 'bad') : ''
          // After a wrong pick, spotlight the correct option in green.
          const showRight = reveal && o.correct ? 'right' : ''
          return (
            <button
              key={o.key}
              className={`gg-opt ${state} ${showRight}${gone.has(o.key) ? ' gone' : ''}`}
              disabled={locked || gone.has(o.key)}
              onClick={() => pick(o)}
              dir="ltr"
            >
              {o.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
