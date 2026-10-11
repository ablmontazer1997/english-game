// Phase D (admin 4839, decision 7 A): English Spell's OWN daily reminder via Web Push (VAPID).
// 🔴 Independent of Bingual. The service worker is public/sw.js on this app's own path (/runecast/).
// Permission is asked only after a won stage (never on load), through our own soft prompt first.
import { api } from './api'

const ASKED = 'es.push.asked'          // the soft prompt was shown (yes or not now): never nag again from the game
const ls = {
  get(k: string) { try { return localStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

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
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration((import.meta as any).env?.BASE_URL ?? '/runecast/')
  return reg ? reg.pushManager.getSubscription() : null
}

/** asks the browser (must follow a tap), subscribes and tells the server. true = reminders are on */
export async function turnOn(): Promise<boolean> {
  if (!pushSupported()) return false
  const key = await api.pushKey()
  if (!key.enabled || !key.public_key) return false
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return false
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.public_key) as BufferSource })
  await api.pushSubscribe(sub.toJSON())
  return true
}

/** Settings "off": the browser forgets it and the server deletes it */
export async function turnOff(): Promise<void> {
  const sub = await currentSub().catch(() => null)
  const endpoint = sub?.endpoint
  if (sub) await sub.unsubscribe().catch(() => false)
  await api.pushUnsubscribe(endpoint).catch(() => null)
}

/** reminders are on for this browser (permission granted + subscribed) */
export async function isOn(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  return !!(await currentSub().catch(() => null))
}

/** the good moment: after a won stage, once, when the browser can still ask */
export function shouldOffer(): boolean {
  return pushSupported() && Notification.permission === 'default' && ls.get(ASKED) == null
}
export const markOffered = () => ls.set(ASKED, String(Date.now()))
