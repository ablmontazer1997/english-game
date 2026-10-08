import { useEffect, useMemo, useState } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { burst, pop } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { TALES } from './banks/bard'
import { fromSrv, hush, levelOf, makeScore, pick, shuffle, speak } from './kit'
import { sfx } from '../services/audio'
import bgPlate from '../assets/games/bard/bt_bg.webp'
import bardIdle from '../assets/games/bard/bt_bard_idle.webp'
import bardHappy from '../assets/games/bard/bt_bard_happy.webp'
import card from '../assets/games/bard/bt_card.webp'
import './scene.css'
import './bardstale.css'

// Bard's Tale — reading for order and linking words. The bard dropped the
// pages of his tale. Tap them in the order the story happens; time words,
// linkers (However, As a result…) and pronouns give the order away.

const ROUNDS = 3

export function BardsTale({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const tales = useMemo(() => fromSrv(srv, () => pick(TALES[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const t = tales[round]
  const cards = useMemo(() => {
    let c = shuffle(t.lines.map((text, id) => ({ id, text })))
    while (c.every((x, i) => x.id === i)) c = shuffle(c)
    return c
  }, [t])
  const [order, setOrder] = useState<number[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const [score] = useState(makeScore)

  useEffect(() => { setOrder([]); setState('play') }, [t])
  useEffect(() => () => hush(), [])

  useHint(() => {
    if (state !== 'play') return false
    let k = 0
    while (k < order.length && order[k] === k) k++
    if (k >= t.lines.length) return false
    setOrder(Array.from({ length: k + 1 }, (_, i) => i)); return true
  })

  const tap = (id: number, el?: Element) => {
    if (state !== 'play') return
    sfx('card', .7)
    const adding = !order.includes(id)
    setOrder(adding ? [...order, id] : order.filter((x) => x !== id))
    if (adding) requestAnimationFrame(() => { const n = el?.querySelector('.bdt-num'); pop(n, 1.35); burst(n, { color: ['#ffe27a', '#ffffff'], n: 6, dist: 26, size: 6 }) })
  }

  function tell() {
    if (state !== 'play' || order.length !== t.lines.length) return
    const ok = order.every((id, i) => id === i)
    if (t._qid) onAnswer?.(t._qid, order.map((id) => t.lines[id]), ok)
    setState(ok ? 'ok' : 'bad')
    if (ok) {
      score.hit(); speak(t.lines.join(' '), { voice: 'm' })
      const bard = document.querySelector('.bdt-bard');[0, 600, 1200, 1800].forEach((d) => setTimeout(() => burst(bard, { glyph: '♪', color: ['#ffd35a', '#c9a3ff', '#8fe56a', '#ff9dcf'], up: true, n: 5, dist: 130, size: 14, ms: 1500 }), d))
      setTimeout(() => { hush(); if (round + 1 >= tales.length) onFinish(score.out(tales.length)); else setRound(round + 1) }, 2600)
    } else {
      score.miss(); fxSfx('wrong', .4)
      setTimeout(() => { setOrder([]); setState('play') }, 1200)
    }
  }

  return (
    <div className={`gs bdt bdt-${state}`}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <div className="gs-at bdt-bard" aria-hidden>
          <img src={bardIdle} alt="" draggable={false} className={state === 'ok' ? '' : 'on'} />
          <img src={bardHappy} alt="" draggable={false} className={state === 'ok' ? 'on' : ''} />
        </div>
      </div>
      <div className="gs-title"><GameTitle title="Bard's Tale" count={`Tale ${round + 1} / ${tales.length}`} /></div>

      <div className="gs-ui gs-panel bdt-panel">
        <Task className="gtask-row" icon="order" text="Put the story in order" sub="Tap the lines from first to last" first={round === 0} />
        <p className="bdt-title">“{t.title}”</p>
        {cards.map((c) => {
          const n = order.indexOf(c.id)
          return (
            <button key={c.id} className={`bdt-row${n >= 0 ? ' placed' : ''}`} style={{ '--k': n } as React.CSSProperties} onClick={(e) => tap(c.id, e.currentTarget)}>
              <span className="bdt-num">{n >= 0 ? n + 1 : ''}</span>
              <span className="bdt-card" style={{ backgroundImage: `url(${card})` }}>
                <span className="bdt-text">{c.text}</span><i className="bdt-grip" />
              </span>
            </button>
          )
        })}
      </div>
      <div className="gs-ui bdt-go"><button className="gs-go" onClick={tell} disabled={order.length !== t.lines.length || state !== 'play'}>Tell the tale</button></div>
    </div>
  )
}
