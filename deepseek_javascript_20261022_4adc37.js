const CACHE = 'alberto-astro-v3';
const ASSETS = ['./', './index.html', './app.js', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(err => console.warn('SW asset err', err)))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Bypassa CDN e API esterne
  if (url.hostname.includes('openweathermap') ||
      url.hostname.includes('open-meteo') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('unpkg') ||
      url.hostname.includes('arcgisonline') ||
      url.hostname.includes('basemaps') ||
      url.hostname.includes('cartocdn') ||
      url.hostname.includes('fonts.') ||
      url.hostname.includes('ipapi.co') ||
      url.hostname.includes('ipinfo.io')) {
    return;
  }

  // Network-first per HTML e JS (per avere sempre l'ultima versione)
  if (e.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(()=>{});
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first per tutto il resto (immagini, font, ecc.)
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});