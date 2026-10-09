/**
 * Service worker: permite instalar la página como app y abrirla sin conexión.
 * Estrategia: red primero (siempre la versión más reciente) y caché como respaldo.
 * Solo gestiona archivos propios; las peticiones a APIs externas no se interceptan.
 */
const CACHE = 'prp-1.0.0';
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "data/demo-data.js",
  "manifest.json",
  "icon.svg",
  "js/config.js",
  "js/i18n.js",
  "js/utils.js",
  "js/state.js",
  "js/api.js",
  "js/components/levels.js",
  "js/components/wishlists.js",
  "js/components/stats.js",
  "js/components/home.js",
  "js/components/dialogs.js",
  "js/render.js",
  "js/events.js",
  "js/main.js"
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const sameOrigin = new URL(e.request.url).origin === location.origin;
  if (e.request.method !== 'GET' || !sameOrigin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request))
  );
});
