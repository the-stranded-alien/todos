// ── Service worker (template) ──────────────────────────────
// Built by scripts/vite-pwa.js: the VERSION placeholder becomes a hash of
// the build, so every deploy installs a new worker and drops old caches.
const VERSION = '__SW_VERSION__'
const PRECACHE = `todos-precache-${VERSION}`
const RUNTIME = 'todos-runtime-v1'
const FONTS = 'todos-fonts-v1'
const KEEP = [PRECACHE, RUNTIME, FONTS]

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const res = await fetch(`/precache-manifest.json?v=${VERSION}`, { cache: 'no-store' })
    const { files } = await res.json()
    const cache = await caches.open(PRECACHE)
    await cache.addAll(files.map(f => new Request(f, { cache: 'reload' })))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

const fromNetwork = async (request, timeoutMs) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try { return await fetch(request, { signal: ctrl.signal }) } finally { clearTimeout(t) }
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Pages: network first (so new deploys show up), cached shell offline
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        return await fromNetwork(request, 4000)
      } catch {
        const shell = url.pathname.startsWith('/share-target') ? '/share-target/index.html' : '/index.html'
        return (await caches.match(shell)) || (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }

  if (url.origin === self.location.origin) {
    // Hashed build files never change: cache first
    e.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: url.pathname === '/precache-manifest.json' ? false : true })
      if (cached) return cached
      const res = await fetch(request)
      if (res.ok && res.type === 'basic' && !url.pathname.endsWith('/sw.js')) {
        const copy = res.clone()
        caches.open(RUNTIME).then(c => c.put(request, copy))
      }
      return res
    })())
  }
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
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
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
    self.clients.matchAll({ type: 'window' }).then((wins) => {
      if (wins.length > 0) {
        wins[0].focus()
        wins[0].postMessage({ type: 'OPEN_TASK', taskId })
      } else {
        self.clients.openWindow(`/?task=${encodeURIComponent(taskId)}`)
      }
    }),
  )
})
