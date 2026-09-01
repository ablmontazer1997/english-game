import { useEffect, useMemo, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import type { MiniGameProps } from './types'
import arenaUrl from '../assets/games/boss/arena.webp'
import bossNormalUrl from '../assets/games/boss/boss_normal.webp'
import bossHappyUrl from '../assets/games/boss/boss_happy.webp'
import bossSadUrl from '../assets/games/boss/boss_sad.webp'
import bossBeatenUrl from '../assets/games/boss/boss_beaten.webp'
import rustyUrl from '../assets/games/boss/rusty.webp'
import rustySadUrl from '../assets/games/boss/rusty_sad.webp'
import './bossbattle.css'

// Faithful port of the newest approved "Grammar Boss Battle" (live at
// bingual.app/boss). Pixi 7.4.2 draws the arena / boss (crossfading full-image
// expression states) / Rusty (crossfading normal<->sad sprites) / spell bolt /
// particles. The layout is a flex column: the Pixi arena on top, an HTML panel
// (question + answer buttons) below, and a DOM HUD absolutely positioned in the
// arena corners. The boss drains proportionally so it dies precisely when every
// item has been answered correctly.

// Design-space (matches the newest 678x904 arena art) and per-correct-hit damage.
const DW = 678
const DH = 904
const HITDMG = 100

// Boss / Rusty transforms, copied verbatim from the source.
const BS = 0.97 // boss scale
const RS = 0.64 // rusty scale
const BASE = 685
const BOSS_Y = BASE + 98 * BS
const RUSTY_Y = BASE + 2 * RS

// Boss expression sprites keyed the same way as the source `IMG` map.
const IMG: Record<'normal' | 'happy' | 'sad' | 'beaten', string> = {
  normal: bossNormalUrl,
  happy: bossHappyUrl,
  sad: bossSadUrl,
  beaten: bossBeatenUrl,
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// Imperative handle the React quiz layer uses to drive the Pixi world.
interface PixiApi {
  rustyCast(): void
  castBolt(cb: () => void): void
  bossHit(): void
  bossTaunt(): void
  rustySad(): void
  rustyCheer(): void
  bossFlee(): void
  setMuted(m: boolean): void
}

export function BossBattle({ items, onFinish }: MiniGameProps) {
  const total = items.length
  const BMAX = Math.max(HITDMG, total * HITDMG)

  // ---- render state (overlays) ----
  const [idx, setIdx] = useState(0)
  const [locked, setLocked] = useState(false)
  const [pickedIdx, setPickedIdx] = useState<number | null>(null)
  const [pickedCorrect, setPickedCorrect] = useState(false)
  const [hpPct, setHpPct] = useState(100)
  const [hpText, setHpText] = useState(`${BMAX} / ${BMAX}`)
  const [muted, setMuted] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [bannerColor, setBannerColor] = useState('#fff')
  const [bannerShow, setBannerShow] = useState(false)

  // ---- authoritative logic state (survives re-renders / closures) ----
  const idxRef = useRef(0)
  const correctRef = useRef(0)
  const comboRef = useRef(0)
  const maxComboRef = useRef(0)
  const hpRef = useRef(BMAX)
  const answeredRef = useRef(false)
  const finishedRef = useRef(false)

  const apiRef = useRef<PixiApi | null>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<number[]>([])
  const bannerTimerRef = useRef<number | null>(null)

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }

  const showBanner = (text: string, color: string) => {
    setBannerText(text)
    setBannerColor(color)
    setBannerShow(true)
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
    bannerTimerRef.current = window.setTimeout(() => setBannerShow(false), 1400)
  }

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinish({
      correct: correctRef.current,
      total,
      maxCombo: maxComboRef.current,
    })
  }

  const advance = () => {
    if (finishedRef.current) return
    if (idxRef.current + 1 >= total) {
      finish() // ran out of questions with the boss still alive → survived
      return
    }
    idxRef.current += 1
    setIdx(idxRef.current)
    answeredRef.current = false
    setLocked(false)
    setPickedIdx(null)
  }

  // Options + correct index for the current question (stable per question).
  const round = useMemo(() => {
    const item = items[idx]
    if (!item) return null
    const opts = shuffle([item.back, ...item.distractors])
    return { item, opts, correctIndex: opts.indexOf(item.back) }
  }, [idx, items])

  const pick = (i: number, isCorrect: boolean) => {
    if (answeredRef.current || finishedRef.current) return
    answeredRef.current = true
    setLocked(true)
    setPickedIdx(i)
    setPickedCorrect(isCorrect)
    const api = apiRef.current

    if (isCorrect) {
      comboRef.current += 1
      maxComboRef.current = Math.max(maxComboRef.current, comboRef.current)
      api?.rustyCast()
      later(() => {
        api?.castBolt(() => {
          // spell impact — drain the boss
          api?.bossHit()
          correctRef.current += 1
          hpRef.current = Math.max(0, hpRef.current - HITDMG)
          setHpPct((hpRef.current / BMAX) * 100)
          if (hpRef.current <= 0) {
            api?.bossFlee()
            setHpText('FLED!')
            showBanner('VICTORY!', '#8affc0')
            later(finish, 1500)
          } else {
            setHpText(`${hpRef.current} / ${BMAX}`)
            later(() => api?.rustyCheer(), 320)
            showBanner('NICE!', '#ffd94a')
            later(advance, 2100)
          }
        })
      }, 340)
    } else {
      comboRef.current = 0
      api?.rustySad()
      later(() => api?.bossTaunt(), 240)
      showBanner('TRY AGAIN', '#ff6a8a')
      later(advance, 2200)
    }
  }

  // Empty item set → nothing to fight, finish immediately.
  useEffect(() => {
    if (total === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Pixi world: built once, torn down on unmount ----
  useEffect(() => {
    const arena = arenaRef.current
    if (!arena || appRef.current) return // StrictMode / double-init guard

    let disposed = false
    let quirkTimer: number | null = null

    const app = new PIXI.Application({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      resizeTo: arena,
    })
    appRef.current = app
    const view = app.view as HTMLCanvasElement
    view.classList.add('bb-stage')
    arena.appendChild(view)

    const scene = new PIXI.Container()
    app.stage.addChild(scene)

    function layoutScale() {
      const w = app.renderer.width / app.renderer.resolution
      const h = app.renderer.height / app.renderer.resolution
      const s = Math.max(w / DW, h / DH)
      scene.scale.set(s)
      scene.position.set((w - DW * s) / 2, (h - DH * s) / 2)
    }
    app.renderer.on('resize', layoutScale)

    const fx = new PIXI.Container()

    // ---- anim core (tween + easing), ported verbatim ----
    const now = () => performance.now()
    type Anim = { update: () => void }
    let anims: Anim[] = []
    const gp = (o: any, p: string) => p.split('.').reduce((a, k) => a[k], o)
    const sp = (o: any, p: string, v: number) => {
      const ks = p.split('.')
      const l = ks.pop() as string
      ks.reduce((a, k) => a[k], o)[l] = v
    }
    function tween(
      o: any,
      to: Record<string, number>,
      dur: number,
      ease?: (x: number) => number,
      cb?: () => void,
    ) {
      const from: Record<string, number> = {}
      const ks = Object.keys(to)
      const t0 = now()
      const e = ease || ((x: number) => x)
      for (const k of ks) from[k] = gp(o, k)
      const a: Anim = {
        update() {
          const t = Math.min(1, (now() - t0) / dur)
          const p = e(t)
          for (const k of ks) sp(o, k, from[k] + (to[k] - from[k]) * p)
          if (t >= 1) {
            anims = anims.filter((x) => x !== a)
            cb && cb()
          }
        },
      }
      anims.push(a)
      return a
    }
    const eOut = (x: number) => 1 - Math.pow(1 - x, 3)
    const eIn = (x: number) => x * x
    const eOB = (x: number) => {
      const c = 2.2
      return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
    }

    // ---- boss (crossfade full-image expression states) ----
    const bossOuter = new PIXI.Container()
    const bossInner = new PIXI.Container()
    bossOuter.addChild(bossInner)
    const shadow = new PIXI.Graphics()
      .beginFill(0x000000, 0.26)
      .drawEllipse(0, 0, 132, 26)
      .endFill()
    shadow.position.set(0, -96)
    bossInner.addChild(shadow)
    const boss = {
      sp: {} as Record<string, PIXI.Sprite>,
      cur: 'normal',
      dmg: 0,
      fled: false,
    }
    ;(['normal', 'happy', 'beaten', 'sad'] as const).forEach((k) => {
      const s = PIXI.Sprite.from(IMG[k])
      s.anchor.set(0.5, 1.0)
      s.position.set(0, 0)
      s.alpha = k === 'normal' ? 1 : 0
      bossInner.addChild(s)
      boss.sp[k] = s
    })
    bossOuter.position.set(490, BOSS_Y)
    bossOuter.scale.set(BS)
    const beatenAt = Math.max(1, Math.ceil(total * 0.6))
    const baseState = () => (boss.dmg >= beatenAt ? 'beaten' : 'normal')
    function setState(name: string, dur = 260) {
      boss.cur = name
      for (const k in boss.sp) {
        tween(boss.sp[k], { alpha: k === name ? 1 : 0 }, dur, eOut)
      }
    }

    // ---- rusty (fox mascot, crossfading normal<->sad sprites) ----
    const rustyOuter = new PIXI.Container()
    const rustyInner = new PIXI.Container()
    rustyOuter.addChild(rustyInner)
    const rusty = {
      sp: {} as Record<string, PIXI.Sprite>,
      cur: 'normal',
      body: null as PIXI.Sprite | null,
    }
    const shR = new PIXI.Graphics()
      .beginFill(0x000000, 0.24)
      .drawEllipse(0, 0, 120, 26)
      .endFill()
    shR.position.set(0, -4)
    rustyInner.addChild(shR)
    ;(['normal', 'sad'] as const).forEach((k) => {
      const s = PIXI.Sprite.from(k === 'sad' ? rustySadUrl : rustyUrl)
      s.anchor.set(0.5, 1.0)
      s.alpha = k === 'normal' ? 1 : 0
      rustyInner.addChild(s)
      rusty.sp[k] = s
    })
    rusty.body = rusty.sp.normal
    rustyOuter.position.set(192, RUSTY_Y)
    rustyOuter.scale.set(RS)
    function setRusty(name: string, dur = 220) {
      rusty.cur = name
      for (const k in rusty.sp) {
        tween(rusty.sp[k], { alpha: k === name ? 1 : 0 }, dur, eOut)
      }
    }

    scene.addChild(bossOuter)
    scene.addChild(fx)
    scene.addChild(rustyOuter)

    // wand-tip in rustyInner local space (spark origin + castBolt tip)
    const WAND = new PIXI.Point(188, -257)

    // ---- particles ----
    type Part = {
      g: PIXI.Graphics
      vx: number
      vy: number
      life: number
      rot: number
      par: PIXI.Container
      decay?: number
      grav?: number
    }
    let parts: Part[] = []
    function star(g: PIXI.Graphics, c: number) {
      g.beginFill(c)
      const s = 7
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10
        const r = i % 2 ? s * 0.42 : s
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      g.endFill()
    }
    function spark(x: number, y: number, c: number) {
      const g = new PIXI.Graphics()
      star(g, c)
      g.position.set(x, y)
      g.scale.set(0.1 + Math.random() * 0.5)
      rustyInner.addChild(g)
      parts.push({
        g,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -1.6 - Math.random() * 2,
        life: 1,
        rot: (Math.random() - 0.5) * 0.3,
        par: rustyInner,
      })
    }
    function burst(x: number, y: number, c: number, n: number) {
      for (let i = 0; i < n; i++) {
        const g = new PIXI.Graphics()
        star(g, c)
        g.position.set(x, y)
        g.scale.set(0.3 + Math.random() * 0.7)
        bossInner.addChild(g)
        const a = (Math.PI * 2 * i) / n
        parts.push({
          g,
          vx: Math.cos(a) * 3.5,
          vy: Math.sin(a) * 3.5 - 1,
          life: 1,
          rot: 0.2,
          par: bossInner,
        })
      }
    }
    function burst2(x: number, y: number, c: number, n: number) {
      for (let i = 0; i < n; i++) {
        const g = new PIXI.Graphics()
        star(g, c)
        g.position.set(x, y)
        g.scale.set(0.35 + Math.random() * 0.85)
        scene.addChild(g)
        const a = (Math.PI * 2 * i) / n + Math.random()
        const spd = 2 + Math.random() * 3.2
        parts.push({
          g,
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          life: 1,
          rot: 0.25,
          par: scene,
        })
      }
    }
    function trailSpark(x: number, y: number) {
      const g = new PIXI.Graphics()
        .beginFill(0xdcccff)
        .drawCircle(0, 0, 3 + Math.random() * 2.5)
        .endFill()
      g.position.set(x, y)
      scene.addChild(g)
      parts.push({ g, vx: 0, vy: 0, life: 0.7, decay: 0.06, rot: 0, par: scene })
    }
    function tear(x: number, y: number, par?: PIXI.Container) {
      const p = par || bossInner
      const g = new PIXI.Graphics()
        .beginFill(0x8fd0ff)
        .drawEllipse(0, 0, 4, 6)
        .endFill()
      g.position.set(x, y)
      p.addChild(g)
      parts.push({
        g,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 1.2,
        life: 1,
        rot: 0,
        grav: 0.12,
        par: p,
      })
    }
    function tickParts() {
      for (const p of [...parts]) {
        p.g.x += p.vx
        p.g.y += p.vy
        if (p.grav) p.vy += p.grav
        p.g.rotation += p.rot
        p.life -= p.decay || 0.02
        p.g.alpha = Math.max(0, p.life)
        if (p.life <= 0) {
          p.par.removeChild(p.g)
          parts = parts.filter((x) => x !== p)
        }
      }
    }
    // ambient floating sparkles
    let amb: { g: PIXI.Graphics; t: number }[] = []
    function tickAmbient() {
      if (Math.random() < 0.04) {
        const g = new PIXI.Graphics()
        star(g, 0xfff2b0)
        g.position.set(120 + Math.random() * 620, 260 + Math.random() * 260)
        g.scale.set(0.15 + Math.random() * 0.35)
        g.alpha = 0
        scene.addChildAt(g, 1)
        amb.push({ g, t: 0 })
      }
      for (const a of [...amb]) {
        a.t += 0.012
        a.g.alpha = Math.sin(a.t * Math.PI) * 0.7
        a.g.y -= 0.5
        a.g.rotation += 0.02
        if (a.t >= 1) {
          scene.removeChild(a.g)
          amb = amb.filter((x) => x !== a)
        }
      }
    }

    // ---- idle motion ----
    const t0 = now()
    function tickIdle() {
      const t = (now() - t0) / 1000
      if (!boss.fled) {
        const s = Math.sin(t * 1.7)
        bossInner.scale.y = 1 + s * 0.02
        bossInner.scale.x = 1 - s * 0.013
        bossInner.y = Math.sin(t * 1.7) * -3
      }
      if (rusty.body) {
        const s = Math.sin(t * 2.1 + 1)
        rustyInner.scale.y = 1 + s * 0.02
        rustyInner.scale.x = 1 - s * 0.013
      }
    }

    const tick = () => {
      for (const a of [...anims]) a.update()
      tickIdle()
      tickParts()
      tickAmbient()
    }
    app.ticker.add(tick)

    // ---- sound (WebAudio, ported) ----
    let AC: AudioContext | null = null
    let localMuted = false
    const ac = () => {
      if (!AC) {
        const Ctor =
          window.AudioContext ||
          (window as any).webkitAudioContext
        AC = new Ctor()
      }
      return AC
    }
    function tone(
      f: number,
      d: number,
      ty?: OscillatorType,
      g0?: number,
      f1?: number,
    ) {
      if (localMuted) return
      const c = ac()
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = ty || 'sine'
      o.frequency.value = f
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + d)
      g.gain.value = g0 || 0.12
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d)
      o.connect(g).connect(c.destination)
      o.start()
      o.stop(c.currentTime + d)
    }
    function sfx(n: string) {
      if (localMuted) return
      switch (n) {
        case 'boing':
          tone(180, 0.18, 'sine', 0.12, 520)
          break
        case 'laugh':
          ;[0, 90, 180, 270].forEach((t, i) =>
            setTimeout(() => tone(300 + (i % 2 ? 120 : 0), 0.12, 'square', 0.06, 260), t),
          )
          break
        case 'cast':
          tone(500, 0.25, 'triangle', 0.08, 1400)
          break
        case 'impact':
          tone(120, 0.22, 'sawtooth', 0.16, 40)
          setTimeout(() => tone(90, 0.2, 'square', 0.1, 30), 20)
          break
        case 'cheer':
          ;[523, 659, 784, 1047].forEach((f, i) =>
            setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 80),
          )
          break
        case 'sad':
          tone(400, 0.5, 'sine', 0.1, 180)
          break
      }
    }

    // ---- hit / taunt / defeat / rusty reactions ----
    function bossHit() {
      if (boss.fled) return
      boss.dmg++
      const cs = boss.sp[boss.cur]
      cs.tint = 0xffc0c6
      setTimeout(() => {
        cs.tint = 0xffffff
        setState(baseState())
      }, 170)
      // shake
      let n = 0
      const bx = bossOuter.x
      const iv = setInterval(() => {
        bossOuter.x = bx + (n % 2 ? 12 : -12)
        if (++n > 7) {
          clearInterval(iv)
          bossOuter.x = bx
        }
      }, 42)
      burst(0, -260, 0xffe08a, 16)
      const k = boss.dmg / total
      tween(bossOuter, { 'scale.x': BS - 0.05 * k, 'scale.y': BS - 0.05 * k }, 420, eOut)
      tween(bossInner, { rotation: 0.05 * k }, 300, eOut)
      sfx('impact')
    }
    function giggleShake() {
      let n = 0
      const iv = setInterval(() => {
        bossOuter.rotation = (n % 2 ? 1 : -1) * 0.045
        if (++n > 6) {
          clearInterval(iv)
          bossOuter.rotation = 0
        }
      }, 70)
    }
    function bossTaunt() {
      if (boss.fled) return
      setState('happy', 180)
      giggleShake()
      sfx('laugh')
      setTimeout(() => {
        if (!boss.fled) setState(baseState())
      }, 1200)
    }
    function bossFlee() {
      boss.fled = true
      setState('sad', 260)
      tween(bossInner, { rotation: 0.16 }, 300, eOut)
      tween(bossOuter, { 'scale.x': 0.3, 'scale.y': 0.3 }, 900, eIn)
      tween(bossOuter, { y: bossOuter.y + 60 }, 900, eIn)
      setTimeout(() => {
        const bx = bossOuter.x
        const t1 = now()
        const a: Anim = {
          update() {
            const t = (now() - t1) / 1300
            bossOuter.x = bx + t * 520
            if (t >= 1) anims = anims.filter((z) => z !== a)
          },
        }
        anims.push(a)
        tween(bossOuter, { alpha: 0 }, 1300, eIn)
        for (let i = 0; i < 7; i++) setTimeout(() => tear(-30, -360), i * 170)
      }, 500)
      sfx('cheer')
    }
    function rustyCast() {
      setRusty('normal', 120)
      tween(rustyInner, { rotation: -0.08 }, 120, eOut, () =>
        tween(rustyInner, { rotation: 0 }, 280, eOB),
      )
      for (let i = 0; i < 12; i++) setTimeout(() => spark(WAND.x, WAND.y, 0x9d7bff), i * 24)
      sfx('cast')
    }
    function rustyCheer() {
      setRusty('normal', 120)
      tween(rustyOuter, { y: RUSTY_Y - 30 }, 170, eOut, () =>
        tween(rustyOuter, { y: RUSTY_Y }, 360, eOB),
      )
      for (let i = 0; i < 16; i++) setTimeout(() => spark(0, -300, 0xffd94a), i * 30)
      sfx('cheer')
    }
    function rustySad() {
      setRusty('sad', 200)
      tween(rustyInner, { rotation: 0.14 }, 280, eOut)
      tween(rustyOuter, { y: RUSTY_Y + 12 }, 280, eOut, () =>
        setTimeout(() => {
          setRusty('normal', 260)
          tween(rustyInner, { rotation: 0 }, 500, eOut)
          tween(rustyOuter, { y: RUSTY_Y }, 500, eOut)
        }, 1500),
      )
      for (let i = 0; i < 7; i++)
        setTimeout(() => tear(-46, -256, rustyInner), i * 150 + 120)
      sfx('sad')
    }

    // ---- spell bolt from Rusty's wand to the boss ----
    function castBolt(cb: () => void) {
      const tip = scene.toLocal(rustyInner.toGlobal(new PIXI.Point(WAND.x, WAND.y)))
      const tgt = scene.toLocal(bossInner.toGlobal(new PIXI.Point(-10, -360)))
      const orb = new PIXI.Container()
      orb.addChild(
        new PIXI.Graphics().beginFill(0x8f5bff, 0.3).drawCircle(0, 0, 34).endFill(),
        new PIXI.Graphics().beginFill(0xbf9bff, 0.9).drawCircle(0, 0, 18).endFill(),
        new PIXI.Graphics().beginFill(0xffffff, 1).drawCircle(0, 0, 8).endFill(),
      )
      orb.position.copyFrom(tip)
      scene.addChild(orb)
      const t1 = now()
      const dur = 520
      const cx = (tip.x + tgt.x) / 2
      const cy = Math.min(tip.y, tgt.y) - 70
      const a: Anim = {
        update() {
          const t = Math.min(1, (now() - t1) / dur)
          const mt = 1 - t
          const x = mt * mt * tip.x + 2 * mt * t * cx + t * t * tgt.x
          const y = mt * mt * tip.y + 2 * mt * t * cy + t * t * tgt.y
          orb.position.set(x, y)
          orb.scale.set(0.55 + t * 0.75)
          if (Math.random() < 0.85)
            trailSpark(x + (Math.random() - 0.5) * 7, y + (Math.random() - 0.5) * 7)
          if (t >= 1) {
            anims = anims.filter((z) => z !== a)
            scene.removeChild(orb)
            burst2(tgt.x, tgt.y, 0xcbb0ff, 16)
            cb && cb()
          }
        },
      }
      anims.push(a)
      sfx('cast')
    }

    // occasional idle taunt while the fight is ongoing
    function scheduleQuirk() {
      quirkTimer = window.setTimeout(() => {
        if (disposed || boss.fled) return
        if (Math.random() < 0.4) bossTaunt()
        scheduleQuirk()
      }, 3400 + Math.random() * 3000)
    }

    apiRef.current = {
      rustyCast,
      castBolt,
      bossHit,
      bossTaunt,
      rustySad,
      rustyCheer,
      bossFlee,
      setMuted: (m: boolean) => {
        localMuted = m
        if (!m) ac()
      },
    }

    layoutScale()
    scheduleQuirk()

    return () => {
      disposed = true
      if (quirkTimer) window.clearTimeout(quirkTimer)
      app.ticker.remove(tick)
      app.renderer?.off('resize', layoutScale)
      app.destroy(true, { children: true })
      appRef.current = null
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // clear pending quiz timers on unmount
  useEffect(() => {
    return () => {
      for (const id of timersRef.current) window.clearTimeout(id)
      timersRef.current = []
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current)
    }
  }, [])

  const toggleMute = () => {
    setMuted((m) => {
      const nm = !m
      apiRef.current?.setMuted(nm)
      return nm
    })
  }

  // Render the prompt, highlighting a `___` blank if one is present.
  const renderPrompt = (front: string) => {
    if (front.includes('___')) {
      const parts = front.split('___')
      return parts.flatMap((p, i) =>
        i < parts.length - 1
          ? [<span key={`t${i}`}>{p}</span>, <b key={`b${i}`}>___</b>]
          : [<span key={`t${i}`}>{p}</span>],
      )
    }
    return front
  }

  return (
    <div className="bossbattle">
      <div className="bb-arena" ref={arenaRef}>
        <img className="bb-bgimg" src={arenaUrl} alt="" />

        {/* top-left HUD: Rusty plate + static HP / potion bars */}
        <div className="bb-hudL">
          <div className="bb-plate r">RUSTY</div>
          <div className="bb-bar">
            <svg className="bb-ic" viewBox="0 0 24 24">
              <path
                d="M12 21s-7.4-4.7-9.7-9C.9 9.2 2.4 5.6 5.7 5.6c1.9 0 3.3 1.1 3.9 2.2C10.1 6.7 11.5 5.6 13.4 5.6c3.3 0 4.8 3.6 3.4 6.4C14.4 16.3 12 21 12 21z"
                fill="#78e04b"
                stroke="#2a7d1a"
                strokeWidth="1.6"
              />
            </svg>
            <div className="bb-track">
              <div className="bb-fill g" style={{ width: '100%' }} />
            </div>
            <span className="bb-val">120/120</span>
          </div>
          <div className="bb-bar">
            <svg className="bb-ic" viewBox="0 0 24 24">
              <path
                d="M12 2.5C12 2.5 5.5 11 5.5 15.2A6.5 6.5 0 0 0 18.5 15.2C18.5 11 12 2.5 12 2.5z"
                fill="#5bb6ff"
                stroke="#1f5fb0"
                strokeWidth="1.6"
              />
            </svg>
            <div className="bb-track">
              <div className="bb-fill bl" style={{ width: '100%' }} />
            </div>
            <span className="bb-val">50/50</span>
          </div>
        </div>

        {/* top-right HUD: boss plate + animated red HP bar */}
        <div className="bb-hudR">
          <div className="bb-plate b">GRAMMAR BOSS</div>
          <div className="bb-bar">
            <svg className="bb-ic" viewBox="0 0 24 24">
              <path
                d="M12 21s-7.4-4.7-9.7-9C.9 9.2 2.4 5.6 5.7 5.6c1.9 0 3.3 1.1 3.9 2.2C10.1 6.7 11.5 5.6 13.4 5.6c3.3 0 4.8 3.6 3.4 6.4C14.4 16.3 12 21 12 21z"
                fill="#ff5252"
                stroke="#a01414"
                strokeWidth="1.6"
              />
            </svg>
            <div className="bb-track">
              <div className="bb-fill rd bb-bosshpfill" style={{ width: `${hpPct}%` }} />
            </div>
            <span className="bb-val bb-bosshptxt">{hpText}</span>
          </div>
        </div>

        <div className="bb-sound" onClick={toggleMute}>
          {muted ? '🔇' : '🔊'}
        </div>

        <div
          className={'bb-banner' + (bannerShow ? ' show' : '')}
          style={{ color: bannerColor }}
        >
          {bannerText}
        </div>
      </div>

      <div className="bb-panel">
        <div className="bb-q">
          Rusty casts a spell:
          <br />
          {round ? <>&laquo;{renderPrompt(round.item.front)}&raquo;</> : null}
        </div>

        <div className="bb-opts">
          {round?.opts.map((t, i) => {
            let cls = 'bb-opt'
            if (locked) cls += ' lock'
            if (pickedIdx === i) cls += pickedCorrect ? ' correct' : ' wrong'
            return (
              <div
                key={i}
                className={cls}
                onClick={() => pick(i, i === round.correctIndex)}
              >
                {t}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
