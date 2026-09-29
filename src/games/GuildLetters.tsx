import { useEffect, useMemo, useState } from 'react'
import type { MiniGameProps } from './types'
import { burst } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { LETTERS } from './banks/guild'
import { levelOf, makeScore, pick } from './kit'
import { sfx } from '../services/audio'
import bgPlate from '../assets/games/guild/gl_bg.webp'
import owl from '../assets/games/guild/gl_owl.webp'
import './scene.css'
import './guildletters.css'

// Guild Letters — writing. A guild member sends a letter; write a reply that
// does the task. For now the owl checks three things on the device: length,
// the target language (the key word groups) and tidy sentences. A live AI
// reviewer with real feedback comes with the server.

const ROUNDS = 2

type Check = { label: string; ok: boolean }

function review(text: string, minWords: number, keys: string[][]): Check[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const low = ' ' + text.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ') + ' '
  // whole words or phrases only, so 'so' does not match inside 'also'
  const keysOk = keys.every((g) => g.some((k) => low.includes(' ' + k.toLowerCase().trim() + ' ')))
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim())
  const tidy = sentences.length > 0 && sentences.every((s) => /^[\s"“]*[A-Z0-9]/.test(s)) && /[.!?]["”]?\s*$/.test(text.trim())
  return [
    { label: `At least ${minWords} words`, ok: words.length >= minWords },
    { label: 'Uses the target language', ok: keysOk },
    { label: 'Capitals and full stops', ok: tidy },
  ]
}

export function GuildLetters({ onFinish, level }: MiniGameProps) {
  const lv = levelOf(level)
  const letters = useMemo(() => pick(LETTERS[lv], ROUNDS), [lv])
  const [round, setRound] = useState(0)
  const l = letters[round]
  const [text, setText] = useState('')
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [tip, setTip] = useState(0) // how many key groups are shown as tips
  const [score] = useState(makeScore)
  const [sending, setSending] = useState(false)
  const count = text.trim() ? text.trim().split(/\s+/).length : 0

  useEffect(() => { setText(''); setChecks(null); setTip(0); setSending(false) }, [l])

  // hint: show the next group of words the reply should use
  useHint(() => {
    if (checks || tip >= l.keys.length) return false
    setTip(tip + 1); return true
  })

  function send() {
    if (checks || sending || !count) return
    const c = review(text, l.minWords, l.keys)
    c.forEach((x) => (x.ok ? score.hit() : score.miss()))
    // the reply folds into a letter and the owl carries it off, then the review opens
    setSending(true); fxSfx('whoosh', .6)
    setTimeout(() => {
      setChecks(c); setSending(false)
      c.filter((x) => x.ok).forEach((_, i) => setTimeout(() => { sfx('star'); burst(document.querySelectorAll('.gl-stars span')[i], { color: ['#ffc93a', '#ffffff'], n: 8, dist: 36, size: 7 }) }, 300 + i * 160))
    }, 1100)
  }
  const next = () => { if (round + 1 >= letters.length) onFinish(score.out(letters.length * 3)); else setRound(round + 1) }

  const stars = checks?.filter((c) => c.ok).length ?? 0
  // long letters get a smaller hand so they still fit on the parchment
  const letterSize = l.body.length < 140 ? 1.85 : l.body.length < 260 ? 1.5 : 1.25
  return (
    <div className={`gs gl${checks || sending ? ' gl-sent' : ''}${sending ? ' gl-sending' : ''}`}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <div className="gs-at gl-owl" aria-hidden><img src={owl} alt="" draggable={false} /></div>
        <div className="gs-at gl-letter" style={{ fontSize: `${letterSize}cqh` }}>
          <p>{l.body}</p><p className="gl-from">– {l.from}</p>
        </div>
      </div>
      <div className="gs-title"><GameTitle title="Guild Letters" count={`Letter ${round + 1} / ${letters.length}`} /></div>

      {!checks ? (
        <>
          <div className="gs-ui gs-panel gl-write">
            <b className="gl-task">{l.task}</b>
            {tip > 0 && <p className="gl-tips">Try: {l.keys.slice(0, tip).map((g) => g.join(' / ')).join('  ·  ')}</p>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your reply…" spellCheck={false} />
            <span className={`gl-count${count >= l.minWords ? ' ok' : ''}`}>{count} / {l.minWords} words</span>
          </div>
          <div className="gs-ui gl-go"><button className="gs-go violet" disabled={!count || sending} onClick={send}>Send with the owl</button></div>
        </>
      ) : (
        <>
          <div className="gs-ui gs-panel gl-write gl-review">
            <div className="gl-stars">{[0, 1, 2].map((i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
            <ul>{checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : 'no'}>{c.ok ? '✓' : '✗'} {c.label}</li>)}</ul>
            <details><summary>See a model reply</summary><p>{l.sample}</p></details>
          </div>
          <div className="gs-ui gl-go"><button className="gs-go" onClick={next}>{round + 1 >= letters.length ? 'Finish' : 'Next letter'}</button></div>
        </>
      )}
    </div>
  )
}
