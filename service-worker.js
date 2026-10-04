const STATIC_VERSION = '2026-10-04-1';
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
    const cached = await cache.match(target);
    if (!cached) return fetch(request);
    const range = request.headers?.get('range');
    if (!range || !/\.(?:wav|mp3|m4a)$/.test(url.pathname)) return cached;
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) return cached;
    const bytes = await cached.arrayBuffer();
    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
    if (start >= bytes.byteLength || start > end) {
      return new Response(null, {status:416, headers:{'Content-Range':`bytes */${bytes.byteLength}`}});
    }
    return new Response(bytes.slice(start, end + 1), {
      status:206,
      headers:{
        'Content-Type':cached.headers.get('Content-Type') || 'audio/wav',
        'Content-Range':`bytes ${start}-${end}/${bytes.byteLength}`,
        'Accept-Ranges':'bytes',
        'Content-Length':String(end - start + 1)
      }
    });
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'OFFLINE_STATUS') {
    event.waitUntil(cacheStatus().then(status => event.ports?.[0]?.postMessage(status)));
  }
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    event.waitUntil((async () => {
      const status = await cacheStatus();
      const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
      let reason = '';
      if (!status.ready) reason = 'incomplete-cache';
      else if (clients.length !== 1) reason = 'other-windows';
      else {
        const idle = await new Promise(resolve => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(false), 1500);
          channel.port1.onmessage = reply => {
            clearTimeout(timer);
            resolve(reply.data?.active === false);
          };
          clients[0].postMessage({type:'TRAINING_STATE_QUERY'}, [channel.port2]);
        });
        if (!idle) reason = 'training-or-unresponsive';
      }
      if (reason) {
        event.ports?.[0]?.postMessage({type:'ACTIVATE_UPDATE_RESULT', accepted:false, reason});
        return;
      }
      event.ports?.[0]?.postMessage({type:'ACTIVATE_UPDATE_RESULT', accepted:true, reason:''});
      await self.skipWaiting();
    })());
  }
});
