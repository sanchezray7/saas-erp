self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  let data = { title: 'CRM', body: '', icon: '/icons/icon-192.svg' }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {}

  const options = {
    body: data.body,
    icon: data.icon,
    badge: '/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const client = clientList.find((c) => c.url.includes(self.location.origin))
        if (client) {
          client.focus()
          client.postMessage({ type: 'NAVIGATE', url })
        } else {
          clients.openWindow(url)
        }
      })
  )
})
