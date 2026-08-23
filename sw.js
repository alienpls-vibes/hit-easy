/**
 * Service worker: o app precisa abrir sem internet, porque mesa de Commander
 * acontece em qualquer lugar.
 *
 * Estrategia:
 *  - o proprio app (HTML/CSS/JS) vem do cache primeiro, atualizado em segundo
 *    plano - abertura instantanea, versao nova na proxima vez;
 *  - artes da Scryfall vao para um cache separado, servidas do disco quando ja
 *    conhecidas;
 *  - chamadas a API da Scryfall nunca sao cacheadas aqui (o app ja mantem seu
 *    proprio cache de busca em localStorage).
 */

const VERSION = 'v24';
const SHELL = 'hiteasy-shell-' + VERSION;
const ART = 'hiteasy-art-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles.css',
  './src/app.js',
  './src/ui.js',
  './src/store.js',
  './src/engine.js',
  './src/stats.js',
  './src/colors.js',
  './src/seating.js',
  './src/theme.js',
  './src/install.js',
  './src/vote.js',
  './src/orientation.js',
  './src/i18n.js',
  './src/scryfall.js',
  './src/views/setup.js',
  './src/views/table.js',
  './src/views/stats.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll falha inteiro se um item faltar; item a item e mais tolerante.
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ART).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Busca de cartas: sempre rede. O app trata a falha e cai nos decks salvos.
  if (url.hostname === 'api.scryfall.com') return;

  // Artes das cartas: cache-first, sao imutaveis.
  if (url.hostname.endsWith('scryfall.io')) {
    event.respondWith(
      caches.open(ART).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }).catch(() => Response.error()),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App: responde do cache e revalida por tras.
  event.respondWith(
    caches.open(SHELL).then(async (cache) => {
      const hit = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit || cache.match('./index.html'));
      return hit || fresh;
    }),
  );
});
