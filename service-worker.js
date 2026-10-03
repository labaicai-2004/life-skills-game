const STATIC_VERSION = '2026-10-03-1';
const CACHE_NAME = `life-skills-static-${STATIC_VERSION}`;
const STATIC_FILES = [
  './', './index.html', './manifest.webmanifest', './service-worker.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/folding/folding-table.png',
  './assets/folding/sweatshirt-flat.png',
  './assets/folding/sweatshirt-folded.png',
  './assets/home/home-skills-island.png',
  './assets/laundry/detergent.png',
  './assets/laundry/laundry-room.png',
  './assets/laundry/shirt-clean.png',
  './assets/laundry/shirt-dirty.png',
  './assets/laundry/wash-basin.png',
  './assets/umbrella/umbrella-closed.png',
  './assets/umbrella/umbrella-folded.png',
  './assets/umbrella/umbrella-open.png',
  './assets/umbrella/umbrella-room.png',
  './music/xylophone.wav',
  ...Array.from({length:36}, (_, i) => `./voice/v${String(i).padStart(2, '0')}.wav`)
];
const REQUIRED_URLS = STATIC_FILES.map(file => new URL(file, self.registration.scope).href);
const REQUIRED_SET = new Set(REQUIRED_URLS);

async function cacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const missing = [];
  for (let i = 0; i < STATIC_FILES.length; i++) {
    if (!await cache.match(REQUIRED_URLS[i])) missing.push(STATIC_FILES[i]);
  }
  return {type:'OFFLINE_STATUS_RESULT', version:STATIC_VERSION, ready:missing.length === 0, missing};
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      for (const url of REQUIRED_URLS) {
        const response = await fetch(url, {cache:'reload'});
        if (!response.ok) throw new Error(`Cannot cache ${url}`);
        await cache.put(url, response);
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const status = await cacheStatus();
    if (!status.ready) return;
    for (const key of await caches.keys()) {
      if (key.startsWith('life-skills-static-') && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode !== 'navigate' && !REQUIRED_SET.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const target = request.mode === 'navigate' ? new URL('./index.html', self.registration.scope).href : url.href;
    return await cache.match(target) || fetch(request);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') {
    event.waitUntil(cacheStatus().then(status => event.ports?.[0]?.postMessage(status)));
  }
});
