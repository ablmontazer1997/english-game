/* English Spell service worker (Phase D, 10-20): ONLY the reminders (Web Push). No caching, no fetch handler,
   so it never changes how the app loads. Scope: this app's own path (/runecast/).
   The server planner (backend services/remind.py) sends title, body, a picture and the place a tap opens (?go=). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (_) { d = { body: e.data ? e.data.text() : '' } }
  const base = self.registration.scope
  const opts = {
    body: d.body || 'One quick spell keeps your Hearthfire burning.',
    icon: d.icon || base + 'push-icon.png', badge: base + 'push-badge.png',
    tag: d.tag || 'es-daily', renotify: false, data: { url: d.url || base },
  }
  if (d.image) opts.image = d.image
  e.waitUntil(self.registration.showNotification(d.title || 'English Spell', opts))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope
  let route = 'map'
  try { route = new URL(url).searchParams.get('go') || 'map' } catch (_) { /* map */ }
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
        c.postMessage({ type: 'es-go', route })
        return c.focus()
      }
    }
    return self.clients.openWindow(url)
  })())
})
