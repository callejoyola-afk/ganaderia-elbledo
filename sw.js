// El Bledo · Service Worker
// El caché va ligado a APP_VER: al publicar una versión nueva se guarda en un caché
// nuevo y el anterior se borra al activar. app.html va a la red primero para que
// ningún celular quede atrapado en una versión vieja.

const APP_VER = '1.1.0';
const CACHE = 'elbledo-' + APP_VER;
const PRECARGA = [
  './',
  './index.html',
  './manifest.json',
  './supabase.js',
  './atkinson-400.woff2',
  './atkinson-700.woff2'
];

self.addEventListener('install', evento => {
  // Si algún archivo del precache falla, la instalación falla y el celular
  // conserva la versión anterior. Preferible a un SW que no puede arrancar sin señal.
  evento.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECARGA))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(llaves => Promise.all(
        llaves.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca cachear Supabase (siempre red directa)
  if (url.hostname.endsWith('.supabase.co')) return;

  const esAppShell = url.pathname.endsWith('/index.html')
    || url.pathname === '/'
    || url.pathname.endsWith('/');

  if (esAppShell) {
    // Red primero, caché de respaldo
    evento.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clon = res.clone();
          caches.open(CACHE).then(c => c.put(req, clon));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Otros recursos: caché primero, red de respaldo
  evento.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clon = res.clone();
          caches.open(CACHE).then(c => c.put(req, clon));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

self.addEventListener('message', evento => {
  if (evento.data === 'skipWaiting') self.skipWaiting();
});
