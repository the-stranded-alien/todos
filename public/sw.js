// ── Service Worker ─────────────────────────────────────────
const CACHE_NAME = 'todos-v1'
const SHELL_URLS = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request)
        .then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone))
          return res
        })
        .catch(() => caches.match('/index.html'))
    })
  )
})

// ── Notification scheduling ────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { taskId, title, body, timestamp } = e.data
    const delay = timestamp - Date.now()
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        self.registration.showNotification(title, {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `task-${taskId}`,
          data: { taskId },
        })
      }, delay)
    }
  }
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const taskId = e.notification.data?.taskId
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((wins) => {
      if (wins.length > 0) {
        wins[0].focus()
        wins[0].postMessage({ type: 'OPEN_TASK', taskId })
      } else {
        clients.openWindow(`/?task=${taskId}`)
      }
    })
  )
})
