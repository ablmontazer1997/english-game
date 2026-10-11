/* English Spell service worker (Phase D): ONLY the daily reminder (Web Push). No caching, no fetch handler,
   so it never changes how the app loads. Scope: this app's own path (/runecast/). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (_) { d = { body: e.data ? e.data.text() : '' } }
  const base = self.registration.scope
  e.waitUntil(self.registration.showNotification(d.title || 'English Spell', {
    body: d.body || 'One quick spell keeps your Hearthfire burning.',
    icon: base + 'push-icon.png', badge: base + 'push-badge.png',
    tag: d.tag || 'es-daily', renotify: false, data: { url: d.url || base },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus()
    return self.clients.openWindow(url)
  })())
})
