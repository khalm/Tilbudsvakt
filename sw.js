// Tilbudsvakt service worker: appen virker uten nett, data hentes ferskt når mulig.
const CACHE = 'tilbudsvakt-v2.6.0';
const SKALL = ['./', 'index.html', 'style.css', 'app.js', 'lib/matcher.js', 'lib/synonymer.js', 'lib/forslag.js', 'lib/tilbud.js', 'lib/historikk.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = hent rett fra nettet, aldri fra nettleserens mellomlager.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SKALL.map((u) => new Request(u, { cache: 'reload' }))))
    .catch(() => {})
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')
    || url.pathname.endsWith('config.json') || url.pathname.endsWith('versjon.json')) return;
  // Nett først, forbi nettleserens mellomlager (så nye versjoner kommer med en gang), cache som reserve uten nett.
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r; })
    .then((r) => { const kopi = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, kopi)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// Push-varsler fra den daglige sjekken.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { tittel: 'Tilbudsvakt', tekst: e.data?.text() ?? '' }; }
  e.waitUntil(self.registration.showNotification(d.tittel || 'Tilbudsvakt', {
    body: d.tekst || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    image: d.bilde || undefined,
    tag: d.tag || undefined,
    renotify: Boolean(d.tag),
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((vinduer) => {
    const apen = vinduer.find((v) => v.url.startsWith(self.registration.scope));
    return apen ? apen.focus() : self.clients.openWindow(url);
  }));
});
