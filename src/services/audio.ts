// Game audio: the looping theme and short reaction sounds. Both respect the
// Settings toggles (rc.set.music / rc.set.sound). Browsers only allow audio
// after a user gesture, so the theme starts on the first tap.
// React Native: swap this file for an expo-av implementation with the same API.

import theme from '../assets/audio/theme.mp3'
import tap from '../assets/audio/tap.mp3'
import correct from '../assets/audio/correct.mp3'
import wrong from '../assets/audio/wrong.mp3'
import combo from '../assets/audio/combo.mp3'
import win from '../assets/audio/win.mp3'
import lose from '../assets/audio/lose.mp3'
import coin from '../assets/audio/coin.mp3'
import pop from '../assets/audio/pop.mp3'
import whoosh from '../assets/audio/whoosh.mp3'
import spell from '../assets/audio/spell.mp3'
import brew from '../assets/audio/brew.mp3'
import card from '../assets/audio/card.mp3'
import star from '../assets/audio/star.mp3'
import pour from '../assets/audio/pour.mp3'
import bubble from '../assets/audio/bubble.mp3'
import confirm from '../assets/audio/confirm.mp3'
// admin 4530: item reveal (shop purchase, chest open, new item / reward) + the Boss Battle spell (Pixabay fire magic, trimmed 2.3 s)
import reveal from '../assets/audio/reveal.mp3'
import spellFire2 from '../assets/audio/spell_fire2.mp3'
import spellFire4 from '../assets/audio/spell_fire4.mp3'
import bossLaugh from '../assets/audio/boss_laugh.mp3'   // admin 4539, used as is (1.7 s)

const SFX = { tap, correct, wrong, combo, win, lose, coin, pop, whoosh, spell, brew, card, star, pour, bubble, confirm, reveal, spellFire2, spellFire4, bossLaugh }
export type Sfx = keyof typeof SFX

const MUSIC_VOL = 0.35
const DUCK_VOL = 0.08

const setting = (k: string) => { try { return localStorage.getItem('rc.set.' + k) !== '0' } catch { return true } }

let music: HTMLAudioElement | null = null
let unlocked = false
const pool = new Map<Sfx, HTMLAudioElement[]>()

function themeEl() {
  if (!music) {
    music = new Audio(theme); music.loop = true; music.preload = 'auto'; music.volume = MUSIC_VOL
  }
  return music
}

// Each mini-game has its own soundtrack (and sometimes an ambience bed) instead of
// the app theme. Files are fetched only when that game is opened.
const SCENE_FILES = import.meta.glob('../assets/audio/scenes/*.mp3', { eager: true, import: 'default' }) as Record<string, string>
const sceneUrl = (kind: 'mus' | 'amb', id: string) => SCENE_FILES[`../assets/audio/scenes/${kind}_${id}.mp3`]
const SCENE_VOL = 0.32, AMB_VOL = 0.55
let scene: { id: string; mus: HTMLAudioElement | null; amb: HTMLAudioElement | null } | null = null
let ducked = false

/** games where a character speaks (speech synthesis) or the player speaks (mic): their stages are silent, no music and
 *  no ambience for the whole stage, not just ducked (admin msg 4310). Sound effects still play. */
export const VOICE_GAMES = new Set(['echo', 'whisper-scroll', 'tavern-talk', 'crystal-ball', 'bards-tale', 'rune-type', 'potion-mix', 'spell-weaver'])
let quiet = false
/** a stage with any voice game in it: silence the music from its lobby to its result */
export function quietStage(on: boolean) {
  if (quiet === on) return
  quiet = on
  if (on) { themeEl().pause(); sceneEls().forEach((a) => a.pause()) } else playNow()
}

function loopEl(url: string | undefined, vol: number) {
  if (!url) return null
  const a = new Audio(url); a.loop = true; a.preload = 'auto'; a.volume = vol; return a
}
const sceneEls = () => (scene ? [scene.mus, scene.amb].filter(Boolean) as HTMLAudioElement[] : [])
function playNow() {
  if (!unlocked || !setting('music') || quiet) return
  if (scene) { themeEl().pause(); sceneEls().forEach((a) => a.play().catch(() => {})) }
  else themeEl().play().catch(() => { /* blocked until a gesture */ })
}
function applyVolumes() {
  if (music) music.volume = ducked ? DUCK_VOL : MUSIC_VOL
  if (scene?.mus) scene.mus.volume = ducked ? DUCK_VOL : SCENE_VOL
  if (scene?.amb) scene.amb.volume = ducked ? AMB_VOL * 0.4 : AMB_VOL
}

/** entering a mini-game: its own music replaces the theme; leaving restores the theme */
export function enterScene(id: string) {
  if (scene?.id === id) return
  leaveScene(false)
  const silent = VOICE_GAMES.has(id)
  scene = silent ? { id, mus: null, amb: null } : { id, mus: loopEl(sceneUrl('mus', id) ?? sceneUrl('mus', 'quiz'), SCENE_VOL), amb: loopEl(sceneUrl('amb', id), AMB_VOL) }
  applyVolumes(); themeEl().pause(); playNow()
}
export function leaveScene(resume = true) {
  sceneEls().forEach((a) => { a.pause(); a.src = '' })
  scene = null
  if (resume) playNow()
}

export function setMusic(on: boolean) {
  if (on) playNow()
  else { themeEl().pause(); sceneEls().forEach((a) => a.pause()) }
}

/** quieter music while a voice (speech synthesis) is talking */
export function duck(on: boolean) {
  ducked = on; applyVolumes()
}

export function sfx(name: Sfx, vol = 0.8) {
  if (!setting('sound')) return
  try {
    const list = pool.get(name) ?? []
    let a = list.find((x) => x.paused || x.ended)
    if (!a) { a = new Audio(SFX[name]); list.push(a); pool.set(name, list) }
    a.volume = vol; a.currentTime = 0
    a.play().catch(() => { /* not allowed yet */ })
  } catch { /* no audio */ }
}

const CONFIRM_BTNS = '.gs-go, .cb-green, .ot-check, .result-continue, .lobby-start, [data-confirm]'

/** call once at startup: unlock audio on the first gesture, tap sound on buttons */
export function initAudio() {
  const first = () => {
    unlocked = true
    if (setting('music')) playNow()
    window.removeEventListener('pointerdown', first)
  }
  window.addEventListener('pointerdown', first)
  window.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.('button')
    // admin 4343: the main action buttons in a game (Weave, Cast, Check, Continue, Start...) get a confirm sound instead of the tap
    if (b && !b.disabled) { if (b.matches(CONFIRM_BTNS)) sfx('confirm', 0.7); else sfx('tap', 0.5) }
  })
  // pause the theme while the app is in the background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { music?.pause(); sceneEls().forEach((a) => a.pause()) } else playNow()
  })
}
