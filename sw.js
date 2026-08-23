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

const VERSION = 'v27';

/**
 * Producao e beta dividem a mesma origem, e Cache Storage e por origem. O canal
 * sai do caminho deste proprio arquivo: /hit-easy/sw.js contra
 * /hit-easy/beta/sw.js. Sem isto os dois canais brigariam pelos mesmos nomes.
 *
 * Producao segue com o prefixo curto de sempre; so o beta ganha marca.
 */
const CANAL = /(^|\/)beta(\/|$)/.test(self.location.pathname) ? 'beta' : 'producao';
const PREFIXO = CANAL === 'beta' ? 'hiteasy-beta-' : 'hiteasy-';
const SHELL = PREFIXO + 'shell-' + VERSION;
const ART = PREFIXO + 'art-' + VERSION;

/**
 * De quem e um cache. Mesma regra de canalDoCache() em src/canal.js - o worker
 * nao importa modulo, entao ela vive nos dois lugares. Se mudar la, mude aqui.
 */
function canalDoCache(nome) {
  const n = String(nome || '');
  if (n.startsWith('hiteasy-beta-')) return 'beta';
  if (n.startsWith('hiteasy-')) return 'producao';
  return null;
}

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
  './src/canal.js',
  './src/config.js',
  './src/cloud.js',
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
        // So o proprio canal, e so o que ficou velho. Antes daqui saia um
        // `k !== SHELL` solto, que apagava TUDO - inclusive o cache offline do
        // outro canal e o de qualquer outra pagina desta origem.
        keys
          .filter((k) => canalDoCache(k) === CANAL && k !== SHELL && k !== ART)
          .map((k) => caches.delete(k)),
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
