/* Service worker de OurTable: cachea la "carcasa" de la app para que abra al instante
   y funcione sin red en lo que no depende de Supabase. */
const VERSION = 'v1.4.0';
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/theme-init.js',
  './js/app.js',
  './js/config.js',
  './js/dom.js',
  './js/theme.js',
  './js/supabase.js',
  './js/auth.js',
  './js/db.js',
  './js/image.js',
  './js/map.js',
  './js/ui/login.js',
  './js/ui/list.js',
  './js/ui/detail.js',
  './js/ui/form.js',
  './js/ui/restaurant-fields.js',
  './js/ui/wish.js',
  './js/ui/place-search.js',
  './js/ui/add-tabs.js',
  './js/ui/restaurant-form.js',
  './js/ui/map-view.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
];

const CDN_HOSTS = new Set(['cdn.jsdelivr.net']);

self.addEventListener('install', (event) => {
  // cache: 'reload' evita que la precaché se rellene con copias antiguas de la caché HTTP del navegador.
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    // Todo desde la caché de la versión instalada (también la página), para no
    // mezclar un index.html nuevo con módulos antiguos. La versión nueva se
    // instala en segundo plano y la app se recarga cuando toma el control.
    event.respondWith(
      request.mode === 'navigate'
        ? staleWhileRevalidate(new Request('./index.html'), SHELL).then((res) => (res && res.ok ? res : fetch(request)))
        : staleWhileRevalidate(request, SHELL)
    );
    return;
  }
  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
  // Supabase y Google Maps: siempre red, sin cachear.
});
