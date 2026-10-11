import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { burst } from './fx'
import { sfx as fxSfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import { useStageCtl } from './coach'
import { LETTERS } from './banks/guild'
import { fromSrv, levelOf, makeScore, pick } from './kit'
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

export function GuildLetters({ onFinish, level, srv, onAnswer }: MiniGameProps) {
  const lv = levelOf(level)
  const letters = useMemo(() => fromSrv(srv, () => pick(LETTERS[lv], ROUNDS)), [lv, srv])
  const [round, setRound] = useState(0)
  const l = letters[round]
  const [text, setText] = useState('')
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [tip, setTip] = useState(0) // how many key groups are shown as tips
  const [score] = useState(makeScore)
  const [sending, setSending] = useState(false)
  const ctl = useStageCtl()
  const count = text.trim() ? text.trim().split(/\s+/).length : 0
  // admin 4857: keyboard-aware. When the visible height is short (the phone keyboard is open, or a small screen),
  // the painted scene steps back: a compact letter card with the owl sits on top, then the paper, then Send.
  const rootRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLTextAreaElement>(null)
  const [vis, setVis] = useState(0)
  const [letterOpen, setLetterOpen] = useState(true)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const vv = window.visualViewport
    const m = () => {
      const r = el.getBoundingClientRect()
      const bottom = vv ? Math.min(r.bottom, vv.offsetTop + vv.height) : r.bottom
      setVis(Math.round(Math.max(0, bottom - r.top)))
    }
    m()
    const ro = new ResizeObserver(m); ro.observe(el)
    vv?.addEventListener('resize', m); vv?.addEventListener('scroll', m)
    return () => { ro.disconnect(); vv?.removeEventListener('resize', m); vv?.removeEventListener('scroll', m) }
  }, [])
  const kb = vis > 0 && vis < 620
  // the paper stays in view while typing (iOS scrolls the page instead of resizing it)
  useEffect(() => { if (kb && document.activeElement === paperRef.current) paperRef.current?.scrollIntoView({ block: 'nearest' }) }, [kb, vis])

  useEffect(() => { setText(''); setChecks(null); setTip(0); setSending(false); setLetterOpen(true) }, [l])

  // hint: show the next group of words the reply should use
  useHint(() => {
    if (checks || tip >= l.keys.length) return false
    setTip(tip + 1); return true
  })

  function send() {
    if (checks || sending || !count) return
    const c = review(text, l.minWords, l.keys)
    if (l._qid) onAnswer?.(l._qid, text, c[0].ok && c[1].ok)
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
  const letterBody = <><p>{l.body}</p><p className="gl-from">– {l.from}</p></>
  return (
    <div ref={rootRef} className={`gs gl${kb ? ' gl-kb' : ''}${checks || sending ? ' gl-sent' : ''}${sending ? ' gl-sending' : ''}`}
      style={kb ? ({ '--gl-vis': `${vis}px` } as CSSProperties) : undefined}>
      <div className="gs-scene">
        <img className="gs-plate" src={bgPlate} alt="" draggable={false} />
        <div className="gs-at gl-owl" aria-hidden data-focus-keep=""><img src={owl} alt="" draggable={false} /></div>
        <div data-coach="q" className="gs-at gl-letter" style={{ fontSize: `${letterSize}cqh` }}>{letterBody}</div>
      </div>
      <div className="gs-title"><GameTitle title="Guild Letters" count={`Letter ${round + 1} / ${letters.length}`} /></div>

      <div className="gs-ui gl-dock">
        {kb && (
          <div className={`gl-card${letterOpen ? '' : ' shut'}`} data-coach="q">
            <img className="gl-card-owl" src={owl} alt="" draggable={false} />
            <div className="gl-card-body">{letterOpen ? letterBody : <p className="gl-card-peek">{l.body}</p>}</div>
            <button type="button" className="gl-card-tg" onClick={() => setLetterOpen(!letterOpen)} aria-expanded={letterOpen}>
              {letterOpen ? 'Hide' : 'Letter'}</button>
          </div>
        )}
        {!checks ? (
          <>
            <div className="gs-panel gl-write" data-coach="a" data-coach-tut=".gl-paper">
              <Task className="gtask-row" icon="type" text="Write a reply" sub="Answer the letter above" first={round === 0} />
              <p className="gl-task">{l.task}</p>
              {tip > 0 && <p className="gl-tips">Try: {l.keys.slice(0, tip).map((g) => g.join(' / ')).join('  ·  ')}</p>}
              <label className="gl-paper">
                <textarea ref={paperRef} data-demo={ctl.practice ? 0 : undefined} value={text} onChange={(e) => setText(e.target.value)}
                  onFocus={() => setTimeout(() => paperRef.current?.scrollIntoView({ block: 'nearest' }), 300)}
                  placeholder="Write your reply here…" spellCheck={false} aria-label="Your reply" />
              </label>
              <span className={`gl-count${count >= l.minWords ? ' ok' : ''}`}>{count} / {l.minWords} words</span>
            </div>
            <div className="gl-go" data-focus-keep=""><button className="gs-go violet" data-demo={ctl.practice ? 1 : undefined} disabled={!count || sending} onClick={send}>Send with the owl</button></div>
          </>
        ) : (
          <>
            <div className="gs-panel gl-write gl-review">
              <div className="gl-stars">{[0, 1, 2].map((i) => <span key={i} className={i < stars ? 'on' : ''}>★</span>)}</div>
              <ul>{checks.map((c) => <li key={c.label} className={c.ok ? 'ok' : 'no'}>{c.ok ? '✓' : '✗'} {c.label}</li>)}</ul>
              {/* Phase C: when the reply missed something, the model reply opens by itself */}
              <details open={!(checks[0].ok && checks[1].ok)}><summary>See a model reply</summary><p>{l.sample}</p></details>
            </div>
            <div className="gl-go" data-focus-keep=""><button className="gs-go" onClick={next}>{round + 1 >= letters.length ? 'Finish' : 'Next letter'}</button></div>
          </>
        )}
      </div>
    </div>
  )
}
