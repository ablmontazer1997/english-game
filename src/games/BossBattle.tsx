import { useEffect, useMemo, useRef, useState } from 'react'
import type { MiniGameProps } from './types'
import { burst, shake } from './fx'
import { sfx } from '../services/audio'
import { GameTitle } from '../components/GameTitle'
import { useHint } from './boosters'
import plate from '../assets/games/boss2/plate.webp'
import golemNormal from '../assets/games/boss2/golem.webp'
import golemHurt from '../assets/games/boss2/golem_hurt.webp'
import golemHappy from '../assets/games/boss2/golem_happy.webp'
import golemBeaten from '../assets/games/boss2/golem_beaten.webp'
import heroNormal from '../assets/games/boss2/hero.webp'
import heroHurt from '../assets/games/boss2/hero_hurt.webp'
import heroCheer from '../assets/games/boss2/hero_cheer.webp'
import { SPRITES } from './bossSprites'
import './bossbattle.css'

// Boss Battle, redrawn from the approved GPT mockup (sky-island arena, the player's mage
// against the Grammar Golem). The painted 9:16 scene covers the screen; the mage and the
// golem are cut-out layers placed at the mockup's own percentages, each pose a separate
// image that cross-fades. Every right answer is a spell that knocks a chunk off the golem;
// a wrong answer lets the golem strike back and costs one of the mage's 3 hearts.
// The battle ends when the golem falls, the mage runs out of hearts, or the questions end.

type GolemState = 'normal' | 'hurt' | 'happy' | 'beaten'
type HeroState = 'normal' | 'hurt' | 'cheer'
const GOLEM: Record<GolemState, string> = { normal: golemNormal, hurt: golemHurt, happy: golemHappy, beaten: golemBeaten }
const HERO: Record<HeroState, string> = { normal: heroNormal, hurt: heroHurt, cheer: heroCheer }
const LIVES = 3

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[b[i], b[j]] = [b[j], b[i]] }
  return b
}

const place = (k: string) => {
  const s = SPRITES[k] ?? {}
  return { left: `${s.left ?? 0}%`, top: `${s.top ?? 0}%`, width: `${s.width ?? 30}%` }
}
const pose = (k: string) => {
  const s = SPRITES[k] ?? {}
  return { left: `${s.dx ?? 0}%`, top: `${s.dy ?? 0}%`, width: `${s.w ?? 100}%` }
}

export function BossBattle({ items, onFinish }: MiniGameProps) {
  const total = items.length
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<{ i: number; ok: boolean } | null>(null)
  const [gone, setGone] = useState<Set<number>>(new Set())
  const [golem, setGolem] = useState<GolemState>('normal')
  const [hero, setHero] = useState<HeroState>('normal')
  const [hits, setHits] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [banner, setBanner] = useState<{ text: string; kind: string } | null>(null)
  const [bolt, setBolt] = useState(0)
  const [rock, setRock] = useState(0)

  const r = useRef({ correct: 0, combo: 0, maxCombo: 0, lives: LIVES, done: false, busy: false })
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const golemEl = useRef<HTMLDivElement>(null)
  const heroEl = useRef<HTMLDivElement>(null)
  const rootEl = useRef<HTMLDivElement>(null)
  const bossBar = useRef<HTMLDivElement>(null)
  const heartsEl = useRef<HTMLDivElement>(null)

  const round = useMemo(() => {
    const item = items[idx]
    if (!item) return null
    const opts = shuffle([item.back, ...item.distractors]).slice(0, 4)
    if (!opts.includes(item.back)) opts[0] = item.back
    return { item, opts }
  }, [idx, items])

  const finish = () => {
    if (r.current.done) return
    r.current.done = true
    onFinish({ correct: r.current.correct, total, maxCombo: r.current.maxCombo })
  }
  useEffect(() => { if (total === 0) finish() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const say = (text: string, kind: string, ms = 1300) => { setBanner({ text, kind }); later(() => setBanner(null), ms) }

  const next = () => {
    if (r.current.done) return
    if (idx + 1 >= total) { finish(); return }
    setIdx((i) => i + 1); setPicked(null); setGone(new Set()); r.current.busy = false
  }

  const pick = (i: number, ok: boolean) => {
    if (r.current.busy || r.current.done || !round) return
    r.current.busy = true
    setPicked({ i, ok })
    if (ok) {
      r.current.combo += 1; r.current.maxCombo = Math.max(r.current.maxCombo, r.current.combo)
      sfx('spell'); setHero('cheer'); setBolt((n) => n + 1)
      later(() => {
        // the spell lands
        r.current.correct += 1
        const h = r.current.correct
        setHits(h)
        sfx('correct')
        burst(golemEl.current, { color: ['#c9a3ff', '#ffe27a', '#fff'], n: 18, dist: 110, size: 12 })
        shake(golemEl.current?.firstElementChild, 10)
        const dead = h >= total
        setGolem(dead ? 'beaten' : 'hurt')
        if (dead) {
          say('Victory!', 'win', 1800); sfx('win')
          later(finish, 1900)
        } else {
          say(r.current.combo >= 3 ? `Combo ×${r.current.combo}!` : 'Nice!', 'ok')
          later(() => { setGolem('normal'); setHero('normal') }, 900)
          later(next, 1500)
        }
      }, 560)
    } else {
      r.current.combo = 0
      sfx('wrong'); setGolem('happy'); setRock((n) => n + 1)
      later(() => {
        r.current.lives -= 1
        setLives(r.current.lives)
        setHero('hurt')
        shake(rootEl.current, 7)
        burst(heroEl.current, { color: ['#ffffff', '#d9c7a8'], n: 10, dist: 70, size: 10 })
        if (r.current.lives <= 0) {
          say('The monster wins…', 'bad', 1800); sfx('lose')
          later(finish, 1900)
        } else {
          say('Ouch!', 'bad')
          later(() => { setGolem('normal'); setHero('normal') }, 1000)
          later(next, 1900)
        }
      }, 520)
    }
  }

  // hint: take away two wrong answers
  useHint(() => {
    if (!round || r.current.busy || gone.size) return false
    const wrong = round.opts.map((o, i) => (o === round.item.back ? -1 : i)).filter((i) => i >= 0)
    setGone(new Set(shuffle(wrong).slice(0, 2)))
    return true
  })

  const hpPct = total ? Math.max(0, 100 - (hits / total) * 100) : 0
  const HP = total * 100

  return (
    <div className={`gs bb2${banner ? ' bb2-' + banner.kind : ''}`} ref={rootEl}>
      <div className="bb2-scene">
        <img className="gs-plate" src={plate} alt="" draggable={false} />
        <div className="bb2-sprite bb2-golem" ref={golemEl} style={place('golem')}>
          <div className="bb2-bob">
            {(Object.keys(GOLEM) as GolemState[]).map((k) => (
              <img key={k} src={GOLEM[k]} alt="" draggable={false} className={golem === k ? 'on' : ''}
                style={pose('golem_' + k)} />
            ))}
          </div>
        </div>
        <div className="bb2-sprite bb2-hero" ref={heroEl} style={place('hero')}>
          <div className="bb2-bob">
            {(Object.keys(HERO) as HeroState[]).map((k) => (
              <img key={k} src={HERO[k]} alt="" draggable={false} className={hero === k ? 'on' : ''}
                style={pose('hero_' + k)} />
            ))}
          </div>
        </div>
        {bolt > 0 && <span key={`b${bolt}`} className="bb2-bolt" aria-hidden />}
        {rock > 0 && <span key={`r${rock}`} className="bb2-rock" aria-hidden />}
      </div>

      <div className="gs-title"><GameTitle title="Boss Battle" /></div>

      <div className="gs-ui bb2-hud">
        <div className="gs-panel bb2-hp">
          <b>You</b>
          <div className="bb2-row">
            <div className="bb2-hearts" ref={heartsEl} aria-label={`${lives} of ${LIVES} hearts`}>
              {Array.from({ length: LIVES }).map((_, i) => <i key={i} className={i < lives ? 'on' : ''} />)}
            </div>
          </div>
        </div>
        <div className="gs-panel bb2-hp">
          <b>Grammar Boss</b>
          <div className="bb2-row">
            <i className="bb2-heart" />
            <div className="bb2-track" ref={bossBar}>
              <div className="bb2-fill" style={{ width: `${hpPct}%` }} />
              <span>{Math.round((hpPct / 100) * HP)} / {HP}</span>
            </div>
          </div>
        </div>
      </div>

      {banner && <div key={banner.text + idx} className={`bb2-banner ${banner.kind}`}>{banner.text}</div>}

      {round && (
        <div className="gs-ui bb2-bottom">
          <div className="gs-panel bb2-q">
            <span className="bb2-gem" aria-hidden />
            <p>Choose the meaning of: <b>{round.item.front}</b></p>
            <span className="gt-count">Question {idx + 1} / {total}</span>
          </div>
          <div className="bb2-opts">
            {round.opts.map((t, i) => {
              const ok = t === round.item.back
              const st = picked?.i === i ? (picked.ok ? ' ok' : ' bad') : picked && !picked.ok && ok ? ' right' : ''
              return (
                <button key={t + i} className={`gs-pill bb2-opt${st}${gone.has(i) ? ' gone' : ''}`}
                  disabled={!!picked || gone.has(i)} onClick={() => pick(i, ok)}>{t}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
