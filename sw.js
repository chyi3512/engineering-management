/* Bump VERSION whenever a deployed app-shell file changes. */
const VERSION = '20260910-cloud1';
const PREFIX = 'engineering-management-pwa:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './css/style.css?v=20260910checklist2', './css/pwa.css?v=20260910pwa1',
  './js/data.js?v=20260910cloud1', './js/app.js?v=20260910cloud1',
  './js/equipment-quotes.js?v=20260910equipment1', './js/photos.js?v=20260910libraryui2',
  './js/trades.js?v=20260910libraryui2', './js/schedule.js?v=202609092035',
  './js/workflow.js?v=20260910inlineui2', './js/project-data.js?v=20260910deleteui2',
  './js/projects.js?v=20260910checklist2', './js/methods.js?v=202609092035',
  './js/daily-report-photos.js?v=20260909site1', './js/daily-reports.js?v=202609092035',
  './js/daily-report-export.js?v=202609092035', './js/project-site.js?v=20260910projectv1',
  './js/project-site-report.js?v=20260909site1', './js/checklists.js?v=20260910checklist2',
  './js/cloud-sync.js?v=20260910cloud1', './js/init.js?v=20260910cloud1', './js/pwa.js?v=20260910pwa1',
  './js/vendor/exceljs-4.4.0.min.js'
].map(path => new URL(path, self.registration.scope).href);
const PATHS = new Set(SHELL.map(path => new URL(path).pathname));
const ENTRY = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })))));
  // No skipWaiting: never replace a worker in the middle of an open editing session.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  const entryNavigation = request.mode === 'navigate' &&
    (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(ENTRY).pathname);
  // Leave data JSON, uploads, APIs, external photos and every non-GET request alone.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      (!entryNavigation && !PATHS.has(url.pathname))) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        // A full storage quota must not prevent an online page from opening.
        try {
          const cache = await caches.open(CACHE);
          await cache.put(entryNavigation ? ENTRY : request, response.clone());
        } catch (_) {}
      }
      return response;
    } catch (error) {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(entryNavigation ? ENTRY : request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});
