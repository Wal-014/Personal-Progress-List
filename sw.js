/**
 * Service worker for installation and offline use, fetching same-origin files from the network first with a cache fallback.
 */
const CACHE = 'prp-1.4.0';
const SHELL = [
  "./",
  "index.html",
  "css/styles.css",
  "data/demo-data.js",
  "manifest.json",
  "icon.svg",
  "favicon.png",
  "vendor/Sortable.min.js",
  "fonts/lilita-one-latin.woff2",
  "fonts/lilita-one-latin-ext.woff2",
  "js/config.js",
  "js/i18n.js",
  "js/utils.js",
  "js/state.js",
  "js/api.js",
  "js/sheet.js",
  "js/gd.js",
  "js/components/faces.js",
  "js/components/levels.js",
  "js/components/wishlists.js",
  "js/components/search.js",
  "js/components/timeline.js",
  "js/components/rankings.js",
  "js/components/compare.js",
  "js/components/stats.js",
  "js/components/home.js",
  "js/components/dialogs.js",
  "js/components/shell.js",
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
      .then(res => {
        // An error page must never replace the good copy that offline mode falls back to
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
