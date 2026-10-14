// Service worker for the installed admin app: shows booking notifications
// and opens the booking when one is tapped.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let message = { title: 'Νέα ειδοποίηση', body: '', url: '/admin' }
  try {
    message = { ...message, ...event.data.json() }
  } catch {
    if (event.data) message.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: message.tag,
      renotify: Boolean(message.tag),
      data: { url: message.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/admin', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(`${self.location.origin}/admin`))
      if (open) {
        return open.navigate(url).then((client) => (client ?? open).focus())
      }
      return self.clients.openWindow(url)
    }),
  )
})
