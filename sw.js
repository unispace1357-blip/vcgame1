const CACHE_VERSION = 'abyss-raid-v10-chest-popup';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './asset/dungeon_background.webp',
  './asset/knight.png',
  './asset/sword_wave.png',
  './asset/player_weapon_base.png',
  './asset/player_weapon_blue.png',
  './asset/player_weapon_red.png',
  './asset/meteor.png',
  './asset/explosion.png',
  './asset/floor_blast.png',
  './asset/floor_rune.png',
  './asset/hit_effect.png',
  './asset/ui_hp.png',
  './asset/ui_level.png',
  './asset/ui_score.png',
  './asset/ui_sword.png',
  './asset/pets/ember_wyvern_portrait.png',
  './asset/pets/rift_guardian_portrait.png',
  './asset/pets/gold_mimic_portrait.png',
  './asset/pets/ar_dungeon_rear.png',
  './asset/pets/lume_dungeon_rear.png',
  './asset/pets/mora_dungeon_rear.png',
  './screenshots/screenshot-mobile.png',
  './screenshots/screenshot-wide.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('abyss-raid-') && ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || caches.match('./index.html');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(request);
  const update = fetch(request).then(async (response) => {
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || update;
}

async function serveAudioRange(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  let response = await cache.match(request.url);

  if (!response) {
    const fullRequest = new Request(request.url, { cache: 'no-cache' });
    const networkResponse = await fetch(fullRequest);
    if (!networkResponse.ok) return networkResponse;
    await cache.put(request.url, networkResponse.clone());
    response = networkResponse;
  }

  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = request.headers.get('range')?.match(/bytes=(\d+)-(\d*)/);
  if (!match) return response;

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  if (start >= size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has('range')) {
    const isAudio = url.pathname.includes('/asset/audio/');
    event.respondWith(isAudio ? serveAudioRange(request) : fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  const isRuntimeMedia =
    url.pathname.includes('/asset/bosses/optimized/') ||
    url.pathname.includes('/asset/audio/');

  event.respondWith(isRuntimeMedia ? cacheFirst(request) : staleWhileRevalidate(request));
});
