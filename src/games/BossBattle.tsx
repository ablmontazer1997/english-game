import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { use3dFallback } from '../components/use3dFallback'
import { Task } from './Task'
import type { MiniGameProps } from './types'
import { burst, shake } from './fx'
import { BossFx } from './bossFx'
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
import './bossbattle.css'

// Boss Battle: the player's mage against the Grammar Boss on the sky-island arena.
// Every right answer is a spell (cast pose, a bolt flying to the boss, impact, damage number);
// a wrong answer lets the boss strike back and costs one of the mage's 3 hearts.
// The battle ends when the boss falls, the mage runs out of hearts, or the questions end.
//
// Layout (fix 09-30): everything is placed in the painted plate's own pixels (941x1672), so both
// fighters stand ON the arena circle whatever the screen. The plate is scaled to cover the screen
// and, when the question panel would hide the arena, lifted (or on very short screens shrunk) so the
// fight band sits between the HUD and the panel. The rest of the screen shows a blurred copy of the plate.

type GolemState = 'normal' | 'hurt' | 'happy' | 'beaten'
type HeroState = 'normal' | 'hurt' | 'cheer'
const GOLEM: Record<GolemState, string> = { normal: golemNormal, hurt: golemHurt, happy: golemHappy, beaten: golemBeaten }
const HERO: Record<HeroState, string> = { normal: heroNormal, hurt: heroHurt, cheer: heroCheer }
const LIVES = 3

// ---- plate geometry (px of plate.webp, measured: arena star at 468,1000; middle gold ring a=400 b=72;
// floor from the balustrade (y 915) to the front rim (y 1150))
const PW = 941, PH = 1672
const BAND = [560, 1082] // plate rows that must stay visible between the HUD and the question panel
const FIGHT_CX = 490
// fighters: foot point on the floor + figure height; sprite canvases: figure top/bottom and foot centre as fractions
const HERO_AT = { x: 300, y: 1045, h: 365 }
const BOSS_AT = { x: 695, y: 1025, h: 390 }   // admin 4477: boss feet on the hero ground line (was y 1005)
const HERO_IMG = { w: 420, h: 640, top: 0.023, bot: 0.984, foot: 0.56, hand: [0.93, 0.52], cheerHand: [0.88, 0.43] }
const BOSS_IMG = { w: 600, h: 640, top: 0.02, bot: 0.994, foot: 0.55, fist: [0.08, 0.45], chest: [0.5, 0.52] }
// 3D hero (battle page built from the live wardrobe: live face warp; el=10 camera, yaw 0 = the 2D hero's 3/4 view; 5:7 frame):
// measured figure 0.231..0.781, foot x 0.486, right hand at the cast release 0.529,0.629
const H3D = { top: 0.231, bot: 0.781, foot: 0.486, hand: [0.529, 0.629] }
const HERO_SRC = (import.meta.env.BASE_URL.includes('-test') ? '/runecast-test-bosswd/' : '/runecast-hero/') + '?embed=1&battle=1&el=10'

type Box = { x: number; y: number; w: number; h: number }
const boxOf = (at: { x: number; y: number; h: number }, im: { w: number; h: number; top: number; bot: number; foot: number }): Box => {
  const h = at.h / (im.bot - im.top), w = (h * im.w) / im.h
  return { x: at.x - im.foot * w, y: at.y - im.bot * h, w, h }
}
const HERO_BOX = boxOf(HERO_AT, HERO_IMG)
const BOSS_BOX = boxOf(BOSS_AT, BOSS_IMG)
const H3D_BOX = (() => { const h = HERO_AT.h / (H3D.bot - H3D.top), w = (h * 5) / 7; return { x: HERO_AT.x - H3D.foot * w, y: HERO_AT.y - H3D.bot * h, w, h } })()
const pct = (b: Box) => ({ left: `${(b.x / PW) * 100}%`, top: `${(b.y / PH) * 100}%`, width: `${(b.w / PW) * 100}%`, height: `${(b.h / PH) * 100}%` })
const inBox = (b: Box, inner: Box) => ({ left: `${((inner.x - b.x) / b.w) * 100}%`, top: `${((inner.y - b.y) / b.h) * 100}%`,
  width: `${(inner.w / b.w) * 100}%`, height: `${(inner.h / b.h) * 100}%` })
const shadowStyle = (at: { x: number; y: number }, w: number) => ({ left: `${((at.x - w / 2) / PW) * 100}%`, top: `${((at.y - w * 0.09) / PH) * 100}%`,
  width: `${(w / PW) * 100}%`, height: `${((w * 0.18) / PH) * 100}%` })

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[b[i], b[j]] = [b[j], b[i]] }
  return b
}

export function BossBattle({ items, onFinish, onAnswer }: MiniGameProps) {
  const total = items.length
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<{ i: number; ok: boolean } | null>(null)
  const [gone, setGone] = useState<Set<number>>(new Set())
  const [golem, setGolem] = useState<GolemState>('normal')
  const [hero, setHero] = useState<HeroState>('normal')
  const [hits, setHits] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [banner, setBanner] = useState<{ text: string; kind: string } | null>(null)

  const r = useRef({ correct: 0, combo: 0, maxCombo: 0, lives: LIVES, done: false, busy: false })
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const rootEl = useRef<HTMLDivElement>(null)
  const sceneEl = useRef<HTMLDivElement>(null)
  const fxEl = useRef<HTMLDivElement>(null)
  const golemEl = useRef<HTMLDivElement>(null)
  const heroEl = useRef<HTMLDivElement>(null)
  const hudEl = useRef<HTMLDivElement>(null)
  const bottomEl = useRef<HTMLDivElement>(null)
  const scale = useRef(1)
  // natural breathing idle (admin 4412): slow sine cycles, gentle scale + bob + sway; no high-frequency motion
  useEffect(() => {
    let raf = 0
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = (now: number) => {
      const t = now / 1000
      const g = golemEl.current?.querySelector('.bb2-bob') as HTMLElement | null
      if (g && !reduce) {
        const b = 0.5 - 0.5 * Math.cos((t * Math.PI * 2) / 3.6)   // 3.6 s breath, ease-in-out by construction
        g.style.transform = `translateY(${(-0.6 * b).toFixed(3)}%) rotate(${(0.5 * Math.sin((t * Math.PI * 2) / 7.2)).toFixed(3)}deg) scale(${(1 + 0.012 * b).toFixed(4)}, ${(1 + 0.018 * b).toFixed(4)})`
      }
      const h = heroEl.current?.querySelector('.bb2-bob') as HTMLElement | null
      if (h && !reduce) { const b = 0.5 - 0.5 * Math.cos((t * Math.PI * 2) / 3); h.style.transform = `scale(${(1 + 0.01 * b).toFixed(4)}, ${(1 + 0.016 * b).toFixed(4)})` }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // pooled canvas effects (bolt, impact, shockwave, numbers, shake): one rAF loop, only while something is alive
  const bfx = useRef<BossFx | null>(null)
  useEffect(() => {
    if (!fxEl.current) return
    const f = new BossFx(fxEl.current, () => scale.current); bfx.current = f
    return () => { f.destroy(); bfx.current = null }
  }, [])

  // ---- anchor the plate: cover the screen, keep the fight band between the HUD and the question panel
  useLayoutEffect(() => {
    const root = rootEl.current, scene = sceneEl.current
    if (!root || !scene) return
    const fit = () => {
      const rr = root.getBoundingClientRect(), vw = rr.width, vh = rr.height
      if (!vw || !vh) return
      const hud = hudEl.current?.getBoundingClientRect(), bot = bottomEl.current?.getBoundingClientRect()
      const top = (hud ? hud.bottom - rr.top : vh * 0.2) + 6
      const low = (bot && bot.height ? bot.top - rr.top : vh * 0.66) - 8
      let S = Math.max(vw / PW, vh / PH), oy = 0
      if (BAND[1] * S > low) oy = low - BAND[1] * S
      if (BAND[0] * S + oy < top) { S = Math.max(0.05, (low - top) / (BAND[1] - BAND[0])); oy = top - BAND[0] * S }
      const w = PW * S
      let ox = vw / 2 - FIGHT_CX * S
      if (w >= vw) ox = Math.min(0, Math.max(vw - w, ox))
      scale.current = S
      Object.assign(scene.style, { left: `${ox}px`, top: `${oy}px`, width: `${w}px`, height: `${PH * S}px` })
      scene.style.setProperty('--s', String(S))
      bfx.current?.fit()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(root); if (bottomEl.current) ro.observe(bottomEl.current); if (hudEl.current) ro.observe(hudEl.current)
    return () => ro.disconnect()
  }, [idx])

  // ---- the player's own 3D character (wardrobe page in battle mode) replaces the painted mage once loaded
  const heroFrame = useRef<HTMLIFrameElement>(null)
  const [hero3d, setHero3d] = useState(false)
  const use3d = useMemo(() => !/[?&]bbsprite=1/.test(location.search), [])
  const heroFallback = use3dFallback(hero3d, !use3d)
  const onMark = useRef<((d: any) => void) | null>(null)
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== heroFrame.current?.contentWindow) return
      if (e.data?.type === 'rc-ready') setHero3d(true)
      if (e.data?.type === 'rc-mark' && onMark.current) { const f = onMark.current; onMark.current = null; f(e.data) }
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, [])
  const anim3d = (msg: Record<string, unknown>) => heroFrame.current?.contentWindow?.postMessage({ type: 'rc-anim', ...msg }, '*')

  // ---- effects, in plate px (converted with the current scale)
  const P = (x: number, y: number) => [x * scale.current, y * scale.current]
  const fx = (cls: string, x: number, y: number, size: number) => {
    const L = fxEl.current; if (!L) return null
    const e = document.createElement('i'); e.className = cls
    const [px, py] = P(x, y), s = size * scale.current
    e.style.cssText = `left:${px - s / 2}px;top:${py - s / 2}px;width:${s}px;height:${s}px`
    L.appendChild(e); return e
  }
  // an arcing flight a -> b; trail = fading copies a few ms behind
  const fly = (cls: string, a: number[], b: number[], size: number, ms: number, arc: number, spin = 0) => new Promise<void>((res) => {
    const N = 14, S = scale.current, kf: Keyframe[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = (b[0] - a[0]) * t, y = (b[1] - a[1]) * t - arc * 4 * t * (1 - t)
      kf.push({ transform: `translate(${x * S}px,${y * S}px) rotate(${spin * t}deg) scale(${0.75 + 0.35 * t})`, opacity: i === 0 ? 0.4 : 1 })
    }
    const head = fx(cls, a[0], a[1], size)
    if (!head) { res(); return }
    for (const [d, k] of [[35, 0.75], [70, 0.55], [105, 0.38]]) {
      const tr = fx(cls + ' trail', a[0], a[1], size * k)
      if (tr) tr.animate(kf, { duration: ms, delay: d, easing: 'cubic-bezier(.35,.1,.65,1)', fill: 'both' }).onfinish = () => tr.remove()
    }
    head.animate(kf, { duration: ms, easing: 'cubic-bezier(.35,.1,.65,1)', fill: 'forwards' }).onfinish = () => { head.remove(); res() }
  })
  const pop = (cls: string, x: number, y: number, size: number, ms: number) => {
    const e = fx(cls, x, y, size); if (e) window.setTimeout(() => e.remove(), ms)
  }
  const number = (text: string, cls: string, x: number, y: number) => {
    const L = fxEl.current; if (!L) return
    const e = document.createElement('b'); e.className = 'bb2-dmg ' + cls; e.textContent = text
    const [px, py] = P(x, y); e.style.left = `${px}px`; e.style.top = `${py}px`
    L.appendChild(e); window.setTimeout(() => e.remove(), 1300)
  }
  const react = (el: HTMLElement | null, kind: 'hit' | 'hurt', dx: number) => {
    if (!el) return
    el.classList.remove('bb2-flash', 'bb2-flash-red'); void el.offsetWidth
    el.classList.add(kind === 'hit' ? 'bb2-flash' : 'bb2-flash-red')
    window.setTimeout(() => el.classList.remove('bb2-flash', 'bb2-flash-red'), 560)
    el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}%) rotate(${dx / 3}deg)`, offset: 0.25 },
      { transform: `translateX(${-dx / 3}%)`, offset: 0.55 }, { transform: 'translateX(0)' }], { duration: 480, easing: 'ease-out' })
  }

  const heroTip = (d?: any): number[] =>
    hero3d && d?.tip ? [H3D_BOX.x + d.tip[0] * H3D_BOX.w, H3D_BOX.y + d.tip[1] * H3D_BOX.h] : heroHand(d)
  const PP = (p: number[]) => P(p[0], p[1]) as [number, number]
  const heroHand = (d?: any): number[] => {
    if (hero3d && d?.R_Hand) return [H3D_BOX.x + d.R_Hand[0] * H3D_BOX.w, H3D_BOX.y + d.R_Hand[1] * H3D_BOX.h]
    if (hero3d) return [H3D_BOX.x + H3D.hand[0] * H3D_BOX.w, H3D_BOX.y + H3D.hand[1] * H3D_BOX.h]
    return [HERO_BOX.x + HERO_IMG.cheerHand[0] * HERO_BOX.w, HERO_BOX.y + HERO_IMG.cheerHand[1] * HERO_BOX.h]
  }
  const bossChest = [BOSS_BOX.x + BOSS_IMG.chest[0] * BOSS_BOX.w, BOSS_BOX.y + BOSS_IMG.chest[1] * BOSS_BOX.h]
  const bossFist = [BOSS_BOX.x + BOSS_IMG.fist[0] * BOSS_BOX.w, BOSS_BOX.y + BOSS_IMG.fist[1] * BOSS_BOX.h]
  const heroChest = [HERO_AT.x + 10, HERO_AT.y - HERO_AT.h * 0.45]

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

  // right answer: cast -> bolt -> impact on the boss
  const cast = () => {
    sfx('spell')
    const crit = r.current.combo >= 3
    let launched = false
    const launch = (d?: any) => {
      if (launched) return; launched = true
      const from = heroTip(d), F = bfx.current
      if (F) F.bolt(PP(from), PP(bossChest), crit).then(() => impact(crit))
      else { pop('bb2-charge', from[0], from[1], 110, 420); fly('bb2-orb', from, bossChest, 96, 460, 60).then(() => impact(crit)) }
    }
    if (hero3d) {
      // procedural wand cast in the hero page (anticipation -> flick -> follow-through); it posts rc-mark at the release
      onMark.current = launch
      heroFrame.current?.contentWindow?.postMessage({ type: 'rc-cast', crit }, '*')
      bfx.current?.punch(sceneEl.current, PP(heroChest), crit ? 1.08 : 1.06, 1.0)
      later(() => { onMark.current = null; launch() }, 2200) // slow device / old hero page: don't wait for the arm forever
    } else {
      setHero('cheer')
      later(launch, 220)
    }
  }
  const impact = (crit = false) => {
    r.current.correct += 1
    const h = r.current.correct
    setHits(h)
    sfx('correct')
    const F = bfx.current
    if (F) {
      // hit-stop: a few frozen frames on the hit (this layer + the hero), then the camera eases back out
      F.freeze(0.08); F.release(0.3)
      heroFrame.current?.contentWindow?.postMessage({ type: 'rc-hitstop', ms: 80 }, '*')
      F.impact(PP(bossChest), crit)
      F.hit(golemEl.current, crit ? 0.55 : 0.42)
      F.knock(golemEl.current, (crit ? 34 : 22) * scale.current)
      F.shake(sceneEl.current, crit ? 9 : 5, crit ? 0.45 : 0.32)
      F.number('-100', PP([BOSS_AT.x - 20, BOSS_BOX.y + 40]), crit ? 'crit' : 'boss')
    } else {
      pop('bb2-boom', bossChest[0], bossChest[1], 230, 520)
      burst(golemEl.current?.querySelector('.bb2-core'), { color: ['#c9a3ff', '#ffe27a', '#fff'], n: 18, dist: 110 * scale.current * 2, size: 12 })
      react(golemEl.current, 'hit', 5)
      number('-100', 'boss', BOSS_AT.x - 20, BOSS_BOX.y + 30)
    }
    const dead = h >= total
    setGolem(dead ? 'beaten' : 'hurt')
    if (dead) {
      say('Victory!', 'win', 1800); sfx('win')
      setHero('cheer'); if (hero3d) anim3d({ name: 'clap' })
      later(finish, 1900)
    } else {
      say(r.current.combo >= 3 ? `Combo ×${r.current.combo}!` : 'Nice!', 'ok')
      later(() => { setGolem('normal'); setHero('normal') }, 900)
      later(next, 1400)
    }
  }

  // wrong answer: the boss winds up, lunges and throws a rune stone at the mage
  const strike = () => {
    sfx('wrong'); setGolem('happy')
    golemEl.current?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(3%) rotate(2deg)', offset: 0.35 },
      { transform: 'translateX(-7%) rotate(-3deg)', offset: 0.7 }, { transform: 'translateX(0)' }], { duration: 620, easing: 'ease-in-out' })
    later(() => {
      const F = bfx.current
      ;(F ? F.rock(PP(bossFist), PP(heroChest)) : fly('bb2-rock', bossFist, heroChest, 62, 440, 90, -300)).then(() => {
        r.current.lives -= 1
        setLives(r.current.lives)
        setHero('hurt')
        if (hero3d) heroFrame.current?.contentWindow?.postMessage({ type: 'rc-hurt' }, '*')
        if (F) {
          F.smack(PP(heroChest)); F.hurt(heroEl.current); F.shake(sceneEl.current, 7, 0.4)
          if (!hero3d) F.knock(heroEl.current, -26 * scale.current)
          F.number('-1 ♥', PP([HERO_AT.x, HERO_AT.y - HERO_AT.h - 10]), 'hero')
        } else {
          pop('bb2-boom red', heroChest[0], heroChest[1], 170, 480)
          react(heroEl.current, 'hurt', -6)
          shake(rootEl.current, 7)
          burst(heroEl.current?.querySelector('.bb2-core'), { color: ['#ffffff', '#ffb3b3', '#d9c7a8'], n: 10, dist: 70, size: 10 })
          number('-1 ♥', 'hero', HERO_AT.x, HERO_AT.y - HERO_AT.h - 10)
        }
        if (r.current.lives <= 0) {
          say('The monster wins…', 'bad', 1800); sfx('lose')
          if (hero3d) later(() => heroFrame.current?.contentWindow?.postMessage({ type: 'rc-cry' }, '*'), 700)
          later(finish, 1900)
        } else {
          say('Ouch!', 'bad')
          later(() => { setGolem('normal'); setHero('normal') }, 1000)
          later(next, 1700)
        }
      })
    }, 230)
  }

  const pick = (i: number, ok: boolean) => {
    if (r.current.busy || r.current.done || !round) return
    r.current.busy = true
    onAnswer?.(round.item.id, round.opts[i], ok)
    setPicked({ i, ok })
    if (ok) {
      r.current.combo += 1; r.current.maxCombo = Math.max(r.current.maxCombo, r.current.combo)
      cast()
    } else {
      r.current.combo = 0
      strike()
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
      <div className="bb2-backdrop" style={{ backgroundImage: `url(${plate})` }} aria-hidden />
      <div className="bb2-scene" ref={sceneEl}>
        <img className="gs-plate" src={plate} alt="" draggable={false} />
        <i className="bb2-shadow" style={shadowStyle(BOSS_AT, BOSS_BOX.w * 0.78)} />
        <i className="bb2-shadow" style={shadowStyle(HERO_AT, HERO_BOX.w * 0.9)} />
        <div className="bb2-sprite bb2-golem" ref={golemEl} style={pct(BOSS_BOX)}>
          <div className="bb2-bob">
            {(Object.keys(GOLEM) as GolemState[]).map((k) => (
              <img key={k} src={GOLEM[k]} alt="" draggable={false} className={golem === k ? 'on' : ''} />
            ))}
          </div>
          <i className="bb2-core" style={{ left: `${BOSS_IMG.chest[0] * 100}%`, top: `${BOSS_IMG.chest[1] * 100}%` }} />
        </div>
        <div className={`bb2-sprite bb2-hero${hero3d ? ' bb2-3d' : ''}${!hero3d && !heroFallback ? ' bb2-wait3d' : ''}`} ref={heroEl} style={pct(HERO_BOX)}>
          {use3d && <iframe ref={heroFrame} className="bb2-hero3d" src={HERO_SRC} title="hero" scrolling="no" aria-hidden tabIndex={-1}
            style={inBox(HERO_BOX, H3D_BOX)} />}
          <div className="bb2-bob">
            {(Object.keys(HERO) as HeroState[]).map((k) => (
              <img key={k} src={HERO[k]} alt="" draggable={false} className={hero === k ? 'on' : ''} />
            ))}
          </div>
          <i className="bb2-core" style={{ left: '55%', top: '55%' }} />
        </div>
        <div className="bb2-fx" ref={fxEl} />
      </div>

      <div className="gs-title"><GameTitle title="Boss Battle" /></div>

      <div className="gs-ui bb2-hud" ref={hudEl}>
        <div className="gs-panel bb2-hp">
          <b>You</b>
          <div className="bb2-row">
            <div className="bb2-hearts" aria-label={`${lives} of ${LIVES} hearts`}>
              {Array.from({ length: LIVES }).map((_, i) => <i key={i} className={i < lives ? 'on' : ''} />)}
            </div>
          </div>
        </div>
        <div className="gs-panel bb2-hp">
          <b>Grammar Boss</b>
          <div className="bb2-row">
            <i className="bb2-heart" />
            <div className="bb2-track">
              <div className="bb2-fill" style={{ width: `${hpPct}%` }} />
              <span>{Math.round((hpPct / 100) * HP)} / {HP}</span>
            </div>
          </div>
        </div>
      </div>

      {banner && <div key={banner.text + idx} className={`bb2-banner ${banner.kind}`}>{banner.text}</div>}

      {round && (
        <div className="gs-ui bb2-bottom" ref={bottomEl}>
          <div className="gs-panel bb2-q">
            <Task className="gtask-row" icon="tap" text="Pick the right answer" sub="Each right answer hits the boss" first={idx === 0} />
            <span className="bb2-gem" aria-hidden />
            <p>{round.item.ask ? <>{round.item.ask} <b>{round.item.front}</b></> : <>Choose the meaning of: <b>{round.item.front}</b></>}</p>
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
