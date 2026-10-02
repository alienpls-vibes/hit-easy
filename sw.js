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

// Mesma string de APP_VERSION em src/version.js - worker nao importa modulo.
// Se mudar la, mude aqui; check-syntax.js confere os dois.
const VERSION = '1.8.0';

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

/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
/**
 * O que entra no cache antes de faltar internet.
 *
 * Lista explicita porque o worker precisa saber o que baixar ANTES de ficar
 * offline - nao da para descobrir modulo por modulo na hora. Sao 60+ arquivos,
 * e entrada faltando nao da erro: o app so nao abre sem internet, e isso se
 * descobre na mesa.
 *
 * `npm test` confere que todo .js e .css de src/ esta aqui.
 */
const ASSETS = [
  './',
  './index.html',
  './privacidade.html',
  './manifest.webmanifest',
  './src/app.js',
  './src/canal.js',
  './src/cloud.js',
  './src/cloud/assinatura.js',
  './src/cloud/auth.js',
  './src/cloud/convites.js',
  './src/cloud/estado.js',
  './src/cloud/http.js',
  './src/cloud/iniciar.js',
  './src/cloud/partidas.js',
  './src/cloud/perfil.js',
  './src/cloud/regras.js',
  './src/colors.js',
  './src/config.js',
  './src/engine.js',
  './src/estilos/base.css',
  './src/estilos/configuracoes.css',
  './src/estilos/conta.css',
  './src/estilos/dano.css',
  './src/estilos/erro.css',
  './src/estilos/home.css',
  './src/estilos/mana.css',
  './src/estilos/mesa.css',
  './src/estilos/motivos-de-vitoria.css',
  './src/estilos/nucleo.css',
  './src/estilos/ocultar-rivalidades.css',
  './src/estilos/painel.css',
  './src/estilos/stats-votacoes.css',
  './src/estilos/stats.css',
  './src/estilos/tela.css',
  './src/estilos/telas-largas.css',
  './src/estilos/tokens.css',
  './src/estilos/vitoria-tela-baixa.css',
  './src/estilos/vitoria.css',
  './src/estilos/votacao.css',
  './src/i18n.js',
  './src/i18n/de.js',
  './src/i18n/dicionarios.js',
  './src/i18n/en.js',
  './src/i18n/es.js',
  './src/i18n/ordinal.js',
  './src/i18n/pt.js',
  './src/i18n/traduzir.js',
  './src/install.js',
  './src/novidades.js',
  './src/orientation.js',
  './src/scryfall.js',
  './src/seating.js',
  './src/stats.js',
  './src/stats/agregar.js',
  './src/stats/cores.js',
  './src/stats/formatar.js',
  './src/stats/ordenar.js',
  './src/stats/partida.js',
  './src/stats/rivalidades.js',
  './src/stats/votacoes.js',
  './src/store.js',
  './src/styles.css',
  './src/sync.js',
  './src/theme.js',
  './src/ui.js',
  './src/version.js',
  './src/views/setup.js',
  './src/views/setup/antes-de-comecar.js',
  './src/views/setup/cartao-jogador.js',
  './src/views/setup/configuracoes.js',
  './src/views/setup/conta.js',
  './src/views/setup/convites.js',
  './src/views/setup/escolher-deck.js',
  './src/views/setup/escolher-jogador.js',
  './src/views/setup/handle.js',
  './src/views/setup/home.js',
  './src/views/setup/instalar.js',
  './src/views/setup/notas-de-versao.js',
  './src/views/setup/rascunho.js',
  './src/views/setup/sincronizacao.js',
  './src/views/stats.js',
  './src/views/stats/backup.js',
  './src/views/stats/deck.js',
  './src/views/stats/jogador.js',
  './src/views/stats/marcar-conta.js',
  './src/views/stats/partida.js',
  './src/views/stats/paywall.js',
  './src/views/stats/pecas.js',
  './src/views/stats/rivalidades.js',
  './src/views/stats/tela.js',
  './src/views/stats/vitoria.js',
  './src/views/stats/votacoes.js',
  './src/views/table.js',
  './src/views/table/area.js',
  './src/views/table/constantes.js',
  './src/views/table/contexto.js',
  './src/views/table/dano.js',
  './src/views/table/estado.js',
  './src/views/table/gestos.js',
  './src/views/table/hub.js',
  './src/views/table/jogador.js',
  './src/views/table/mana.js',
  './src/views/table/menu.js',
  './src/views/table/mesa.js',
  './src/views/table/pecas.js',
  './src/views/table/pintar.js',
  './src/views/table/vitoria.js',
  './src/views/table/votacao.js',
  './src/vote.js',
  './icons/icon-gradient-192.png',
  './icons/icon-gradient-512.png',
];

/**
 * Pedido que NAO aceita resposta do cache do navegador.
 *
 * `cache.add(url)` faz um fetch comum, e fetch comum passa pelo cache HTTP. O
 * GitHub Pages manda `max-age=600` em tudo, entao um worker novo instalava e
 * enchia o cache novo com os arquivos VELHOS que o navegador ainda guardava:
 * versao nova do worker, conteudo antigo. O app "atualizava" e continuava
 * exatamente igual - por ate dez minutos, sem explicacao visivel.
 *
 * `cache: 'reload'` obriga a ir na rede.
 */
function daRede(url) {
  return new Request(url, { cache: 'reload' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll falha inteiro se um item faltar; item a item e mais tolerante.
      .then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(daRede(url)))))
      .then(() => self.skipWaiting()),
  );
});

/**
 * Destravar um worker parado em "waiting".
 *
 * O install ja chama skipWaiting, entao normalmente nao ha ninguem esperando.
 * Mas se uma atualizacao anterior ficou presa - a aba ficou aberta durante a
 * troca, por exemplo -, o botao de atualizar manda esta mensagem e o worker
 * novo assume em vez de esperar todas as abas fecharem.
 */
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  // Diagnostico: a tela mostra a versao do MODULO, que vem do cache. Se o
  // worker responder outra, e sinal de cache velho servindo codigo antigo -
  // exatamente o que aconteceu e nao dava para ver de fora.
  if (event.data.type === 'VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage(VERSION);
  }
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
      // Tambem sem o cache do navegador: revalidar contra ele nao revalida
      // nada, so recopia o que ja estava velho.
      const fresh = fetch(new Request(request, { cache: 'reload' }))
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => hit || cache.match('./index.html'));
      return hit || fresh;
    }),
  );
});
