import { useMemo, useState } from 'react'
import type { MiniGameProps } from './types'

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[b[i], b[j]] = [b[j], b[i]] }
  return b
}

// The classic 4-option meaning quiz. Also the fallback for any mini-game not yet
// given its own implementation.
export function QuizGame({ items, onFinish }: MiniGameProps) {
  const [idx, setIdx] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  const item = items[idx]
  const options = useMemo(() => item ? shuffle([item.back, ...item.distractors]).slice(0, 4) : [], [item])

  function choose(opt: string) {
    if (picked || !item) return
    setPicked(opt)
    const ok = opt === item.back
    const nextCorrect = ok ? correct + 1 : correct
    if (ok) { setCorrect(nextCorrect); setCombo((c) => { const n = c + 1; setMaxCombo((m) => Math.max(m, n)); return n }) }
    else setCombo(0)
    setTimeout(() => {
      if (idx + 1 < items.length) { setIdx(idx + 1); setPicked(null) }
      else onFinish({ correct: nextCorrect, total: items.length || 1, maxCombo: Math.max(maxCombo, ok ? combo + 1 : 0) })
    }, 620)
  }

  if (!item) return <div className="game-wait">…</div>

  return (
    <div className="quiz">
      {combo >= 2 && <div className="combo-flag pop" key={combo}>Combo ×{combo}</div>}
      <div className="quiz-prompt reveal" key={item.id}>
        <span className="prompt-sub">What does this word mean?</span>
        <b className="prompt-word">{item.front}</b>
      </div>
      <div className="quiz-options">
        {options.map((opt) => {
          const state = picked ? (opt === item.back ? 'ok' : opt === picked ? 'bad' : 'dim') : ''
          return <button key={opt} className={`opt ${state}`} disabled={!!picked} onClick={() => choose(opt)}>{opt}</button>
        })}
      </div>
    </div>
  )
}
