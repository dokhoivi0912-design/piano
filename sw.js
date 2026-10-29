// Network first so online users always get the latest push; the cache is only the offline fallback.
const CACHE = 'piano';
const CORE = ['./', 'style.css', 'data.js', 'app.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'apple-touch-icon.png'];

// Files are stored without their ?v=N query so each file keeps a single, newest copy.
const key = req => { const u = new URL(req.url); u.search = ''; return u.href; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(key(req), copy));
      }
      return res;
    }).catch(() => caches.match(key(req)).then(hit => hit || (req.mode === 'navigate' ? caches.match(new URL('./', self.registration.scope).href) : Response.error())))
  );
});
