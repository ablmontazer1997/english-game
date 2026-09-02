import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { MiniGameProps, SrsItem } from './types'
import sceneBg from '../assets/memory_bg.webp'
import backPurple from '../assets/ui/memcards/card_back_purple.webp'
import backTeal from '../assets/ui/memcards/card_back_teal.webp'
import frontPurple from '../assets/ui/memcards/card_front_purple.webp'
import frontTeal from '../assets/ui/memcards/card_front_teal.webp'
import './memorycrystals.css'

// two decorative card themes, alternated by grid position (not by pair)
const THEMES = [
  { back: backPurple, front: frontPurple, ink: '#5a2d82' },
  { back: backTeal, front: frontTeal, ink: '#0e6a6a' },
]

const MAX_PAIRS = 6
const FLIP_BACK_MS = 800

type Face = 'front' | 'back'

// One physical tile in the grid. `pairId` is the SrsItem.id shared by its twin;
// `face` decides whether the revealed side shows the english word or the meaning.
interface Card {
  key: string
  pairId: string
  face: Face
  text: string
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function buildDeck(items: SrsItem[]): Card[] {
  const used = items.slice(0, MAX_PAIRS)
  const cards: Card[] = []
  for (const it of used) {
    cards.push({ key: it.id + ':front', pairId: it.id, face: 'front', text: it.front })
    cards.push({ key: it.id + ':back', pairId: it.id, face: 'back', text: it.back })
  }
  return shuffle(cards)
}

// Memory Crystals — a concentration game. Each SRS item becomes two face-down
// crystal tiles (english word + its Persian meaning); flip two, and a shared
// item.id locks them face-up with a gold glow. A wrong flip breaks the combo.
export function MemoryCrystals({ items, onFinish }: MiniGameProps) {
  const deck = useMemo(() => buildDeck(items), [items])
  const pairCount = Math.min(items.length, MAX_PAIRS)

  const [flipped, setFlipped] = useState<string[]>([]) // keys currently face-up, unmatched (max 2)
  const [matched, setMatched] = useState<Set<string>>(() => new Set()) // matched pairIds
  const [wrong, setWrong] = useState<string[]>([]) // keys flashing wrong
  const [attempts, setAttempts] = useState(0)
  const [combo, setCombo] = useState(0)

  const maxComboRef = useRef(0)
  const doneRef = useRef(false)
  const lockRef = useRef(false) // ignore taps during flip-back delay
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function finish(correct: number) {
    if (doneRef.current) return
    doneRef.current = true
    onFinish({ correct, total: pairCount, maxCombo: maxComboRef.current })
  }

  // Nothing to play — report an empty result once.
  useEffect(() => {
    if (pairCount === 0) finish(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairCount])

  // Clear any pending flip-back timer on unmount.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onTap(card: Card) {
    if (lockRef.current || doneRef.current) return
    if (matched.has(card.pairId)) return
    if (flipped.includes(card.key)) return
    if (flipped.length >= 2) return

    const next = [...flipped, card.key]
    setFlipped(next)
    if (next.length < 2) return

    // Two cards up — evaluate.
    setAttempts((a) => a + 1)
    const [aKey, bKey] = next
    const a = deck.find((c) => c.key === aKey)!
    const b = deck.find((c) => c.key === bKey)!

    if (a.pairId === b.pairId) {
      const nextMatched = new Set(matched)
      nextMatched.add(a.pairId)
      setMatched(nextMatched)
      setFlipped([])
      setCombo((c) => {
        const v = c + 1
        if (v > maxComboRef.current) maxComboRef.current = v
        return v
      })
      if (nextMatched.size === pairCount) finish(nextMatched.size)
    } else {
      // Wrong: break the streak, flash, then flip both back.
      setCombo(0)
      setWrong(next)
      lockRef.current = true
      timer.current = setTimeout(() => {
        setFlipped([])
        setWrong([])
        lockRef.current = false
      }, FLIP_BACK_MS)
    }
  }

  if (pairCount === 0) {
    return <div className="mc-wait">Nothing to play</div>
  }

  const cols = deck.length <= 8 ? 3 : 4

  return (
    <div className="mc-root" style={{ backgroundImage: `url(${sceneBg})` }}>
      <div className="mc-topbar">
        <div className="mc-stat">
          <span className="mc-stat-num">{matched.size}</span>
          <span className="mc-stat-lbl">Pairs</span>
          <span className="mc-stat-sep">/</span>
          <span className="mc-stat-num">{pairCount}</span>
        </div>
        <div className="mc-stat mc-stat-combo" data-hot={combo >= 2}>
          <span className="mc-stat-lbl">Combo</span>
          <span className="mc-stat-num">{combo}</span>
        </div>
        <div className="mc-stat">
          <span className="mc-stat-lbl">Tries</span>
          <span className="mc-stat-num">{attempts}</span>
        </div>
      </div>

      <div
        className="mc-grid"
        style={{ '--mc-cols': String(cols) } as CSSProperties}
        aria-label="Memory crystals"
      >
        {deck.map((card, idx) => {
          const isMatched = matched.has(card.pairId)
          const isUp = isMatched || flipped.includes(card.key)
          const isWrong = wrong.includes(card.key)
          const theme = THEMES[idx % THEMES.length]
          const cls =
            'mc-card' +
            (isUp ? ' is-up' : '') +
            (isMatched ? ' is-matched' : '') +
            (isWrong ? ' is-wrong' : '')
          return (
            <button
              key={card.key}
              type="button"
              className={cls}
              disabled={isMatched}
              aria-pressed={isUp}
              onClick={() => onTap(card)}
            >
              <span className="mc-inner">
                <span className="mc-back" aria-hidden={isUp} style={{ backgroundImage: `url(${theme.back})` }} />
                <span
                  className={'mc-front' + (card.face === 'front' ? ' is-word' : ' is-meaning')}
                  aria-hidden={!isUp}
                  style={{ backgroundImage: `url(${theme.front})`, color: theme.ink }}
                >
                  <span className="mc-label" dir={card.face === 'front' ? 'ltr' : 'auto'}>{card.text}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
