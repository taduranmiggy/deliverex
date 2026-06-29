const CACHE = 'deliverex-customer-v16'
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/apple-touch-icon.png', '/favicon-192x192.png', '/favicon-512x512.png', '/lottie/deliverex-splash.json', '/customer', '/customer/login', '/customer/track', '/customer/support', '/customer/history', '/customer/about', '/customer/services', '/customer/privacy-policy', '/customer/terms-and-conditions', '/customer/data-privacy-notice']

// ─── Install: pre-cache app shell ────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})),
  )
  self.skipWaiting()
})

// ─── Activate: clean old caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// ─── Fetch: network-first for navigations + hashed assets ─────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Navigation requests: network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          }
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Vite hashed bundles: network-first so deploys never pair new HTML with stale JS
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
          }
          return response
        })
        .catch(() => caches.match(event.request)),
    )
    return
  }

  // Other static assets: cache-first with background update
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && /\.(js|css|svg|png|json|woff2?)$/i.test(url.pathname)) {
            caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

// ─── Background Sync ─────────────────────────────────────────────
// When the browser restores connectivity and a sync tag is registered,
// this event fires. We notify all open clients so they can flush their
// offline queue through the existing syncQueue() logic.
self.addEventListener('sync', (event) => {
  if (event.tag === 'deliverex-offline-queue') {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'BG_SYNC' }))
      }),
    )
  }
})

// ─── Message handler ─────────────────────────────────────────────
// Allows pages to request a cache refresh or trigger explicit sync.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
