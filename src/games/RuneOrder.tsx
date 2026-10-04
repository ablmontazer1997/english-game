import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import bgPlate from '../assets/games/runeorder/ro_bg.webp'
import gateClosed from '../assets/games/runeorder/ro_gate_closed.webp'
import gateOpen from '../assets/games/runeorder/ro_gate_open.webp'
import tileImg from '../assets/games/runeorder/ro_tile.webp'
import './runeorder.css'

// Rune Order — grammar by building the sentence. The rune tiles hold the words
// out of order; tap them into the slots, then Cast. The right order opens the
// gate; a wrong one makes the runes flare red and the tiles jump back.

const SENTENCES = [
  'The dragon is sleeping under the old bridge',
  'She has never seen a flying ship',
  'We will meet at the tower after sunset',
  'Where did you hide the golden key',
  'The wizard was reading when the storm began',
]
const OK_MS = 1500
const BAD_MS = 900

type Tile = { id: number; word: string }

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]] }
  return b
}

export function RuneOrder({ onFinish, srv, onAnswer }: MiniGameProps) {
  const sents = useMemo(() => srv ? srv.map((q) => String(q.payload.text ?? '').trim()) : SENTENCES, [srv])
  const [round, setRound] = useState(0)
  const words = useMemo(() => sents[round].split(' '), [round])
  const tiles = useMemo<Tile[]>(() => {
    let t = shuffle(words.map((word, id) => ({ id, word })))
    while (t.every((x, i) => x.id === i)) t = shuffle(t) // never hand over the answer
    return t
  }, [words])
  const [placed, setPlaced] = useState<number[]>([])
  const [state, setState] = useState<'play' | 'ok' | 'bad'>('play')
  const right = useRef(0)
  const combo = useRef({ now: 0, max: 0 })

  useEffect(() => { setPlaced([]); setState('play') }, [round])

  // hint: keep the right beginning of the sentence and set the next rune in place
  useHint(() => {
    if (state !== 'play') return false
    let k = 0
    while (k < placed.length && placed[k] === k) k++
    if (k >= words.length) return false
    setPlaced(Array.from({ length: k + 1 }, (_, i) => i))
    return true
  })

  const place = (id: number) => { if (state === 'play' && !placed.includes(id)) setPlaced([...placed, id]) }
  const unplace = (id: number) => { if (state === 'play') setPlaced(placed.filter((x) => x !== id)) }

  function cast() {
    if (placed.length !== words.length || state !== 'play') return
    const sentence = placed.map((id) => tiles.find((t) => t.id === id)!.word).join(' ')
    const ok = sentence === sents[round]
    if (srv?.[round]) onAnswer?.(srv[round].qid, sentence, ok)
    setState(ok ? 'ok' : 'bad')
    if (ok) {
      right.current++; combo.current.now++; combo.current.max = Math.max(combo.current.max, combo.current.now)
      setTimeout(() => {
        if (round + 1 >= sents.length) onFinish({ correct: right.current, total: sents.length, maxCombo: combo.current.max })
        else setRound(round + 1)
      }, OK_MS)
    } else {
      combo.current.now = 0
      setTimeout(() => { setPlaced([]); setState('play') }, BAD_MS)
    }
  }

  const wordOf = (id: number) => tiles.find((t) => t.id === id)!.word
  const tileStyle = { backgroundImage: `url(${tileImg})` }

  return (
    <div className={`ro ro-${state}`}>
      <img className="ro-plate" src={bgPlate} alt="" draggable={false} />
      <GameTitle title="Rune Order" count={`Spell ${round + 1} / ${sents.length}`} />

      <div className="ro-gate" aria-hidden>
        <span className="ro-gate-glow" />
        <img className="ro-gate-closed" src={gateClosed} alt="" draggable={false} />
        <img className="ro-gate-open" src={gateOpen} alt="" draggable={false} />
      </div>

      <div className="ro-ui">
        <div className="ro-slots lp" aria-label="Your sentence">
          {words.map((_, i) => {
            const id = placed[i]
            return id === undefined
              ? <span key={i} className="ro-slot" />
              : <button key={i} className="ro-tile ro-placed" style={tileStyle} onClick={() => unplace(id)}>{wordOf(id)}</button>
          })}
        </div>
        <div className="ro-pool">
          {tiles.map((t, i) => (
            <button key={t.id} className={`ro-tile${placed.includes(t.id) ? ' used' : ''}`} style={{ ...tileStyle, '--tilt': `${((i * 37) % 9) - 4}deg` } as React.CSSProperties}
              disabled={placed.includes(t.id)} onClick={() => place(t.id)}>{t.word}</button>
          ))}
        </div>
        <button className="cb cb-green ro-cast" onClick={cast} disabled={placed.length !== words.length || state !== 'play'}>Cast</button>
      </div>
    </div>
  )
}
