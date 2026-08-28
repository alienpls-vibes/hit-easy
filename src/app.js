/**
 * Cola do app: decide qual tela mostrar, mantem a partida gravada e cuida do
 * que e global - tema, orientacao e tela acesa.
 *
 * Gravamos a cada evento. Se o navegador fechar no meio da mesa, ao reabrir a
 * partida esta exatamente onde parou - inclusive de quem era a vez.
 */

import { toast, setHaptics, isSheetOpen, onSheetChange } from './ui.js';
import { renderSetup, seedDraftFrom } from './views/setup.js';
import { renderTable } from './views/table.js';
import { renderStats, renderPaywall } from './views/stats.js';
import { createMatch } from './engine.js';
import { applyTheme, watchTheme } from './theme.js';
import { t, setLang, detectLang } from './i18n.js';
import { preferOrientation, isWide } from './orientation.js';
import { orientOf } from './seating.js';
import * as store from './store.js';
import * as cloud from './cloud.js';
import { podeVerEstatisticas } from './cloud.js';
import * as sync from './sync.js';
import { cloudEnabled } from './config.js';
import { ehTeste } from './canal.js';

const root = document.getElementById('app');
let route = store.getCurrent() ? 'table' : 'setup';
let previous = 'setup';
let live = null; // controlador da tela atual, quando ela precisa de limpeza

function settings() {
  return store.getDB().settings;
}

function go(next) {
  if (next !== route) previous = route;
  route = next;
  render();
}

/**
 * Desenha a rota atual.
 *
 * O corpo real esta em desenhar(); esta camada existe so para que um erro numa
 * tela nao deixe o aplicativo PRETO. Tela preta nao diz nada a quem esta
 * usando e nao diz nada a quem vai consertar - e foi exatamente o que uma
 * partida malformada vinda da nuvem produziu.
 */
function render() {
  try {
    desenhar();
  } catch (err) {
    telaDeErro(err);
  }
}

function telaDeErro(err) {
  root.innerHTML = '';
  const caixa = document.createElement('div');
  caixa.className = 'crash';
  const h = document.createElement('h2');
  h.textContent = t('common.error');
  const p = document.createElement('p');
  p.textContent = String((err && err.message) || err);
  const b = document.createElement('button');
  b.className = 'btn primary';
  b.textContent = t('common.back');
  b.addEventListener('click', () => go('setup'));
  caixa.append(h, p, b);
  root.append(caixa);
}

function desenhar() {
  if (live && live.destroy) live.destroy();
  live = null;
  document.body.dataset.route = route;

  if (route === 'table') {
    const match = store.getCurrent();
    if (!match) { go('setup'); return; }
    live = renderTable(root, {
      match,
      onChange: () => store.setCurrent(match),
      onStats: () => go('stats'),
      onFinish: () => {
        store.archive(match);
        // A partida acabou de existir: sobe agora, enquanto a pessoa ainda
        // esta com o aparelho na mao e provavelmente com rede. Falhar aqui nao
        // perde nada - ela fica sem a marca de enviada e sobe na proxima.
        sync.sincronizar().catch(() => {});
        seedDraftFrom(match);
        go('setup');
        toast(t('victory.saved'), { label: t('victory.seeData'), onClick: () => go('stats') });
      },
      onDiscard: () => {
        store.clearCurrent();
        go('setup');
        toast(t('victory.discarded'));
      },
    });
    hintRotate();
    return;
  }

  if (route === 'stats') {
    // O portao e decisao de ROTA, nao da tela de estatisticas: qual tela
    // mostrar e pergunta do roteador, e assim a view continua sendo so uma
    // leitura dos dados - testavel sem conta nem assinatura.
    //
    // Isto e a tela. O portao de verdade e o RLS do Postgres: sem assinatura
    // ele devolve lista vazia, entao burlar este `if` nao entrega partida
    // nenhuma da nuvem.
    const voltar = () => go(previous === 'stats' ? 'setup' : previous);
    if (podeVerEstatisticas(cloudEnabled(), cloud.state())) {
      renderStats(root, { onBack: voltar });
    } else {
      renderPaywall(root, {
        onBack: voltar,
        onUnlock: () => go('stats'),
        // Enquanto a assinatura nao voltou do servidor, a resposta e "ainda
        // nao sei" - e negar o que nao se sabe e o pior jeito de receber quem
        // paga.
        verificando: !cloud.assinaturaConhecida(),
      });
    }
    return;
  }

  renderSetup(root, {
    onStats: () => go('stats'),
    // Trocar o tema muda a paleta WUBRG, que ja foi escrita no style dos
    // elementos: so um redesenho completo poe todo mundo na cor nova.
    onRefresh: () => render(),
    onStart: (draft) => {
      const match = createMatch(draft.seats, draft.startingLife, {
        firstSeatId: draft.firstSeatId,
        layoutId: draft.layoutId,
      });
      store.setCurrent(match);
      go('table');
    },
  });
}

/* ---------------------------------------------------------------- */
/* Orientacao                                                        */
/* ---------------------------------------------------------------- */

let lastWide = isWide();
let resizeTimer = null;
let relayoutPendente = false;

/**
 * A mesa tem uma forma para tela em pe e outra para tela deitada, entao virar
 * o aparelho exige redesenhar. A tela de montagem se vira sozinha no CSS - e
 * bom que seja assim, porque redesenhar ali roubaria o foco de quem digita
 * (o teclado do celular encolhe a altura e ja parece uma virada de tela).
 *
 * Com um painel aberto, o redesenho ESPERA. Remontar a mesa chama destroy(),
 * que fecha o painel - e a votacao pede retrato justamente enquanto esta
 * aberta, entao sem isso ela se fecharia sozinha ao girar a tela.
 */
function syncOrientation() {
  const wide = isWide();
  document.body.dataset.orient = wide ? 'wide' : 'tall';
  if (wide === lastWide) return;
  lastWide = wide;
  if (route !== 'table') return;
  if (isSheetOpen()) { relayoutPendente = true; return; }
  render();
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncOrientation, 120);
});

onSheetChange((aberto) => {
  if (aberto || !relayoutPendente) return;
  relayoutPendente = false;
  if (route === 'table') render();
});

let rotateHinted = false;

/** Uma dica por sessao, sem bloquear nada: a mesa funciona em pe tambem. */
function hintRotate() {
  if (rotateHinted || isWide()) return;
  rotateHinted = true;
  setTimeout(() => toast(t('table.rotateHint')), 1400);
}

/* ---------------------------------------------------------------- */
/* Tela acesa                                                        */
/* ---------------------------------------------------------------- */

// Ninguem quer destravar o celular a cada ataque. Liberado ao sair da mesa.
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && settings().keepAwake && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if ((!on || !settings().keepAwake) && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* sem suporte ou negado pelo navegador: segue o jogo */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && route === 'table') keepAwake(true);
});

const observer = new MutationObserver(() => {
  const naMesa = document.body.dataset.route === 'table';
  keepAwake(naMesa);
  // A mesa pede a orientacao que a PESSOA escolheu ao montar o jogo. Antes
  // pedia paisagem sempre, o que contrariava quem tinha escolhido apoiar o
  // aparelho em pe entre dois jogadores.
  preferOrientation(naMesa ? orientacaoDaMesa() : null, naMesa);
});

/** A orientacao declarada pela mesa em andamento; paisagem quando nao ha. */
function orientacaoDaMesa() {
  try {
    const m = store.getCurrent();
    return (m && orientOf(m.seats.length, m.layoutId)) || 'landscape';
  } catch {
    return 'landscape';
  }
}
observer.observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

/* ---------------------------------------------------------------- */
/* Arranque                                                          */
/* ---------------------------------------------------------------- */

// Idioma antes de tudo: cada tela le os textos ao ser desenhada.
setLang(settings().lang || detectLang());
applyTheme(settings().theme);
setHaptics(settings().haptics);
watchTheme(() => render()); // sistema mudou de claro para escuro (ou o contrario)
syncOrientation();

// Uma versao de teste tem de se anunciar. Sem isso da para passar uma mesa
// inteira num beta achando que e o app de verdade - e depois procurar no lugar
// errado a partida que ficou guardada no outro canal.
if (ehTeste()) {
  const marca = document.createElement('div');
  marca.className = 'beta-flag';
  marca.textContent = 'BETA';
  document.body.appendChild(marca);
}

render();

// A conta sobe depois da primeira tela: ninguem deve esperar rede para ver o
// app. Quando o estado chegar, quem depende dele se redesenha.
cloud.iniciar().then((estado) => {
  if (estado !== 'desligado') render();
  // Sincroniza depois de saber quem e a pessoa. Falhar aqui nao atrapalha
  // nada: o que nao subiu continua sem marca e sobe na proxima abertura.
  sync.sincronizar().then((r) => {
    if (r && (r.baixou || r.subiu)) render();
  }).catch(() => {});
});

// A conta pode mudar depois da primeira tela - a assinatura chega da rede, e o
// login acontece dentro das configuracoes. Quem esta olhando as estatisticas
// precisa ver a mudanca sem sair e voltar.
cloud.onAccountChange(() => {
  if (route === 'stats') render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline continua funcionando pelo cache do navegador */
    });
  });
}
