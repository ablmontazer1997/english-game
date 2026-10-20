// English Spell's OWN reminders. 🔴 Independent of Bingual: no Bingual FCM, keys or services.
// - Web (Phase D): Web Push with ES's own VAPID keys; the service worker is public/sw.js on /runecast/.
// - Android app (10-20, admin 6138): local notifications (@capacitor/local-notifications), no server keys, work offline.
// WHAT and WHEN come from ONE server planner (backend services/remind.py): the web worker sends today's item, the
// Android app schedules the whole plan (day 1 → 30 ladder + events). The last plan is cached; when the fetch fails
// (offline) the scheduled notifications stay as they are.
// Permission is asked only after a won stage (never on load), through our own soft prompt first.
import { registerPlugin } from '@capacitor/core'
import { api, type PlanItem } from './api'

const ASKED = 'es.push.asked'          // the soft prompt was shown (yes or not now)
const ASKED2 = 'es.push.asked2'        // the one second chance (after a 3-day Hearthfire) was shown
const NATIVE_ON = 'es.remind.on'       // Android: the player turned reminders on ('1') or off ('0')
const PLAN = 'es.remind.plan'          // Android: the last plan from the server
const ID_BASE = 7100, ID_MAX = 7199    // our local notification ids
const CHANNEL = 'es-reminders'
const ls = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

// ---------------------------------------------------------------- Android (Capacitor) local notifications
type Perm = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
interface LocalNote {
  id: number; title: string; body: string; schedule?: { at: Date; allowWhileIdle?: boolean }
  largeIcon?: string; smallIcon?: string; iconColor?: string; channelId?: string; extra?: Record<string, unknown>; group?: string
}
interface LocalNotificationsPlugin {
  checkPermissions(): Promise<{ display: Perm }>
  requestPermissions(): Promise<{ display: Perm }>
  schedule(o: { notifications: LocalNote[] }): Promise<unknown>
  getPending(): Promise<{ notifications: { id: number }[] }>
  cancel(o: { notifications: { id: number }[] }): Promise<void>
  createChannel(c: { id: string; name: string; description?: string; importance?: number; visibility?: number }): Promise<void>
  addListener(ev: 'localNotificationActionPerformed', fn: (a: { notification: { extra?: { route?: string } } }) => void): Promise<unknown>
}
const cap = () => (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean } }).Capacitor
export const isNative = () => !!cap()?.isNativePlatform?.()
const nativeReady = () => isNative() && !!cap()?.isPluginAvailable?.('LocalNotifications')
let LN: LocalNotificationsPlugin | null = null
const ln = () => (LN ??= registerPlugin<LocalNotificationsPlugin>('LocalNotifications'))

async function nativePerm(): Promise<Perm> {
  try { return (await ln().checkPermissions()).display } catch { return 'denied' }
}

/** cancel our pending notifications and schedule these plan items (future ones only) */
async function scheduleItems(items: PlanItem[]) {
  const p = ln()
  try { await p.createChannel({ id: CHANNEL, name: 'Daily reminder', description: 'A short note to keep your Hearthfire burning', importance: 3 }) } catch { /* old Android: no channels */ }
  const pending = (await p.getPending().catch(() => ({ notifications: [] as { id: number }[] }))).notifications
  const ours = pending.filter((n) => n.id >= ID_BASE && n.id <= ID_MAX)
  if (ours.length) await p.cancel({ notifications: ours.map((n) => ({ id: n.id })) }).catch(() => {})
  const now = Date.now() + 30_000
  const notes: LocalNote[] = items.filter((i) => i.at > now).slice(0, ID_MAX - ID_BASE).map((i, k) => ({
    id: ID_BASE + k, title: i.title, body: i.body, schedule: { at: new Date(i.at), allowWhileIdle: true },
    largeIcon: `notif_${i.img}`, smallIcon: 'ic_stat_es', iconColor: '#7B4FD8', channelId: CHANNEL, extra: { route: i.route },
  }))
  if (notes.length) await p.schedule({ notifications: notes })
}

/** Android: fetch the plan and (re)schedule it. Offline or a server error keeps the schedule we already have. */
export async function resync(): Promise<void> {
  if (!nativeReady() || ls.get(NATIVE_ON) !== '1') return
  if ((await nativePerm()) !== 'granted') return
  let plan
  try { plan = await api.pushPlan() } catch { return }
  ls.set(PLAN, JSON.stringify(plan))
  await scheduleItems(plan.on ? plan.items : []).catch(() => { /* keep what is there */ })
}

let tapsHooked = false
/** Android: a tap on our notification opens its route (see App: window event 'es-go'). Call once at start. */
export function hookTaps() {
  if (tapsHooked || !nativeReady()) return
  tapsHooked = true
  ln().addListener('localNotificationActionPerformed', (a) => {
    const route = a?.notification?.extra?.route
    if (typeof route === 'string') dispatchEvent(new CustomEvent('es-go', { detail: route }))
  }).catch(() => {})
}

// ---------------------------------------------------------------- web push
export const webPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** reminders can work here: the Android app (plugin present) or a browser with Web Push */
export const pushSupported = () => nativeReady() || (!isNative() && webPushSupported())

const swUrl = () => `${(import.meta as any).env?.BASE_URL ?? '/runecast/'}sw.js`

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const scope = (import.meta as any).env?.BASE_URL ?? '/runecast/'
  return (await navigator.serviceWorker.getRegistration(scope)) ?? navigator.serviceWorker.register(swUrl(), { scope })
}

/** this browser's subscription, if any */
export async function currentSub(): Promise<PushSubscription | null> {
  if (!webPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration((import.meta as any).env?.BASE_URL ?? '/runecast/')
  return reg ? reg.pushManager.getSubscription() : null
}

// ---------------------------------------------------------------- one API for both
/** asks the system (must follow a tap) and turns reminders on. true = on */
export async function turnOn(): Promise<boolean> {
  if (nativeReady()) {
    let perm = await nativePerm()
    if (perm !== 'granted') perm = (await ln().requestPermissions().catch(() => ({ display: 'denied' as Perm }))).display
    if (perm !== 'granted') return false
    ls.set(NATIVE_ON, '1')
    await api.pushPrefs({ on: true }).catch(() => null)
    await resync()
    return true
  }
  if (!webPushSupported()) return false
  const key = await api.pushKey()
  if (!key.enabled || !key.public_key) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.public_key) as BufferSource })
  await api.pushSubscribe(sub.toJSON())
  await api.pushPrefs({ on: true }).catch(() => null)
  return true
}

/** Settings "off": nothing more is sent here (web: the subscription is deleted; Android: the schedule is cleared) */
export async function turnOff(): Promise<void> {
  if (nativeReady()) {
    ls.set(NATIVE_ON, '0')
    await scheduleItems([]).catch(() => {})
    await api.pushPrefs({ on: false }).catch(() => null)
    return
  }
  const sub = await currentSub().catch(() => null)
  const endpoint = sub?.endpoint
  if (sub) await sub.unsubscribe().catch(() => false)
  await api.pushUnsubscribe(endpoint).catch(() => null)
}

/** reminders are on here (permission granted + subscribed / scheduled) */
export async function isOn(): Promise<boolean> {
  if (nativeReady()) return ls.get(NATIVE_ON) === '1' && (await nativePerm()) === 'granted'
  if (!webPushSupported() || Notification.permission !== 'granted') return false
  return !!(await currentSub().catch(() => null))
}

/** the system said no for good: the player must allow it in the phone/browser settings */
export async function isBlocked(): Promise<boolean> {
  if (nativeReady()) return (await nativePerm()) === 'denied'
  return webPushSupported() && Notification.permission === 'denied'
}

/** the good moment: after a won stage, once; one more chance after a 3-day Hearthfire if they said "Not now" */
export async function shouldOffer(streak = 0): Promise<boolean> {
  if (!pushSupported()) return false
  if (nativeReady()) {
    if (ls.get(NATIVE_ON) != null) return false
    const p = await nativePerm()
    if (p === 'granted' || p === 'denied') return false
  } else if (Notification.permission !== 'default') return false
  if (ls.get(ASKED) == null) return true
  return streak >= 3 && ls.get(ASKED2) == null
}
export const markOffered = () => ls.set(ls.get(ASKED) == null ? ASKED : ASKED2, String(Date.now()))

/** Settings: the reminder time / Event news (server-side; Android reschedules right away) */
export async function savePrefs(b: { minute?: number; auto?: boolean; events?: boolean }) {
  const st = await api.pushPrefs(b)
  resync().catch(() => {})
  return st
}
