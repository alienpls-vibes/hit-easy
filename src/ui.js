/** Utilitarios de DOM. Pequenos de proposito - a app nao precisa de framework. */

import { t } from './i18n.js';
import { colorHex } from './colors.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') aplicarEstilo(node, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Aplica estilos inline.
 *
 * Custom properties (--algo) EXIGEM setProperty: atribuir por indice
 * (`style['--x'] = v`) nao registra nada no navegador, so cria uma propriedade
 * solta no objeto. O app inteiro passa a identidade de cor do deck assim, e
 * por muito tempo isso caiu em silencio no --accent da raiz - o branco
 * translucido -, apagando a cor de todo painel, cartao e bolinha de mana.
 */
function aplicarEstilo(node, estilos) {
  for (const [prop, valor] of Object.entries(estilos)) {
    if (valor === null || valor === undefined) continue;
    if (prop.startsWith('--')) node.style.setProperty(prop, valor);
    else node.style[prop] = valor;
  }
}


/**
 * A marca do app: os cinco pips de mana em anel, os mesmos do icone instalado.
 *
 * Era um quadradinho com gradiente WUBRG - ilegivel em 14px, porque cinco cores
 * espremidas num degrade viram uma mancha parda. Em circulos separados cada cor
 * continua se lendo, e a forma repete a do icone da tela de inicio, o que faz o
 * app parecer a mesma coisa dentro e fora.
 *
 * Desenhado com as cores vivas do tema atual, entao acompanha claro e escuro.
 */
export function brandMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('aria-hidden', 'true');

  ['W', 'U', 'B', 'R', 'G'].forEach((cor, i) => {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', (12 + 7.4 * Math.cos(ang)).toFixed(2));
    c.setAttribute('cy', (12 + 7.4 * Math.sin(ang)).toFixed(2));
    c.setAttribute('r', '3.5');
    c.setAttribute('fill', colorHex(cor));
    svg.append(c);
  });
  return svg;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function icon(name) {
  // Glifos desenhados a mao em SVG: nenhuma dependencia de fonte de icones.
  const paths = {
    undo: 'M9 5 4 10l5 5M4 10h8a5 5 0 0 1 0 10h-1',
    redo: 'M11 5l5 5-5 5M16 10H8a5 5 0 0 0 0 10h1',
    more: 'M5 10h.01M10 10h.01M15 10h.01',
    close: 'M5 5l10 10M15 5L5 15',
    arrow: 'M4 10h11M11 6l4 4-4 4',
    plus: 'M10 4v12M4 10h12',
    minus: 'M4 10h12',
    chart: 'M4 16V9M9 16V4M14 16v-5',
    crown: 'M3 15h14M3 15 2 6l4.5 3L10 3l3.5 6L18 6l-1 9',
    skull: 'M10 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 10 2ZM7.5 9.5h.01M12.5 9.5h.01',
    back: 'M12 4l-6 6 6 6',
    grip: 'M6 6h8M6 10h8M6 14h8',
    gear: 'M10 7.2A2.8 2.8 0 1 0 10 12.8 2.8 2.8 0 0 0 10 7.2M15.6 10c0-.4 0-.8-.1-1.2l1.6-1.2-1.6-2.8-1.9.7a5.9 5.9 0 0 0-2-1.2L11.3 2H8.7l-.3 2.3c-.8.2-1.4.6-2 1.2l-1.9-.7-1.6 2.8 1.6 1.2a6.6 6.6 0 0 0 0 2.4l-1.6 1.2 1.6 2.8 1.9-.7c.6.6 1.2 1 2 1.2l.3 2.3h2.6l.3-2.3c.8-.2 1.4-.6 2-1.2l1.9.7 1.6-2.8-1.6-1.2c.1-.4.1-.8.1-1.2Z',
    dice: 'M4 4h12v12H4zM8 8h.01M12 12h.01M8 12h.01M12 8h.01',
    download: 'M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15h12',
    share: 'M10 13V3M6.5 6.5 10 3l3.5 3.5M5 9v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name] || paths.more);
  svg.append(p);
  return svg;
}

let hapticsOn = true;

/** Liga/desliga o retorno tatil de todo o app de uma vez. */
export function setHaptics(on) {
  hapticsOn = on !== false;
}

/** Feedback tatil curto. Silencioso onde nao ha suporte ou onde foi desligado. */
export function buzz(ms = 8) {
  if (!hapticsOn) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignora */
  }
}

/**
 * Fechar tocando fora, sem cair no clique fantasma.
 *
 * Num celular, o toque que ABRE um painel ainda dispara um `click` logo depois,
 * e esse clique cai na cobertura que acabou de ser montada - que entenderia
 * "tocou fora" e fecharia na hora. No desktop isso nao acontece, entao o bug
 * so aparece no aparelho.
 *
 * A regra aqui e simples: so fecha se o dedo DESCEU na cobertura. O clique
 * fantasma vem sem pointerdown proprio, e por isso e ignorado.
 */
export function dismissOnBackdrop(scrim, close) {
  let armed = false;

  scrim.addEventListener('pointerdown', (e) => {
    armed = e.target === scrim;
  });
  scrim.addEventListener('click', (e) => {
    const fechar = armed && e.target === scrim;
    armed = false;
    if (fechar) close();
  });
}

/**
 * Teclado do celular: o painel precisa subir junto.
 *
 * O painel e fixo na borda de baixo, e o teclado cobre justamente essa faixa -
 * entao o campo de texto some atras dele. `visualViewport` diz quanta tela o
 * teclado tomou; a cobertura encolhe na mesma medida e o painel sobe sozinho.
 *
 * Vale para TODO campo em painel, nao so o numero da votacao: a busca de
 * comandante e o nome do jogador tinham o mesmo problema.
 */
function acompanharTeclado() {
  const vv = window.visualViewport;
  if (!vv) return;
  const ajustar = () => {
    const tomado = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', tomado + 'px');
  };
  vv.addEventListener('resize', ajustar);
  vv.addEventListener('scroll', ajustar);
  ajustar();
}

if (typeof window !== 'undefined' && window.visualViewport) acompanharTeclado();

let sheetHost = null;
const sheetWatchers = new Set();

const SLIDE_MS = 320;

/** Ha um painel aberto agora? */
export function isSheetOpen() {
  return sheetHost !== null;
}

/**
 * Avisa quando um painel abre ou fecha.
 *
 * Serve para quem redesenha a tela por baixo: girar o aparelho remonta a mesa,
 * e remontar chama destroy(), que fecharia o painel aberto - no meio de uma
 * votacao, por exemplo. Quem escuta aqui adia o redesenho ate o painel sair.
 */
export function onSheetChange(fn) {
  sheetWatchers.add(fn);
  return () => sheetWatchers.delete(fn);
}

function avisarPaineis() {
  sheetWatchers.forEach((fn) => fn(isSheetOpen()));
}

/**
 * Painel inferior em varias telas, deslizando de lado.
 *
 * Cada passo e { title, subtitle, build(pane, api) }, e o build recebe uma api
 * com next / back / close / remeasure. As telas ficam empilhadas de verdade -
 * a anterior continua montada atras -, entao voltar nao perde o que ja estava
 * na tela nem refaz busca nenhuma.
 *
 * A altura do painel acompanha a tela ativa via ResizeObserver: a lista de
 * comandantes cresce e encolhe conforme a busca, e o painel precisa seguir.
 */
export function openFlow(firstStep, opts = {}) {
  closeSheet();

  const stack = [];
  let ro = null;

  const titleEl = el('h2', { class: 'sheet-title' });
  const subEl = el('p', { class: 'sheet-sub' });
  const backBtn = el('button', {
    class: 'icon-btn flow-back',
    'aria-label': t('common.back'),
    onClick: () => api.back(),
  }, [icon('back')]);

  const track = el('div', { class: 'flow' });
  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-grip' }),
    el('header', { class: 'sheet-head' }, [
      backBtn,
      el('div', { class: 'sheet-heading' }, [titleEl, subEl]),
      el('button', { class: 'icon-btn', 'aria-label': t('common.close'), onClick: closeSheet }, [icon('close')]),
    ]),
    el('div', { class: 'sheet-body' }, [track]),
  ]);

  sheetHost = el('div', {
    class: 'sheet-scrim' + (opts.centered ? ' is-centered' : ''),
  }, [sheet]);
  dismissOnBackdrop(sheetHost, closeSheet);

  // Encolher a cobertura ja tira o campo de tras do teclado; isto garante que
  // ele fique VISIVEL dentro do painel, e nao so fora do teclado.
  sheetHost.addEventListener('focusin', (e) => {
    const campo = e.target.closest && e.target.closest('input, textarea');
    if (!campo || !campo.scrollIntoView) return;
    setTimeout(() => campo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
  });

  const top = () => stack[stack.length - 1];

  const measure = () => {
    const cur = top();
    if (cur) track.style.height = cur.pane.scrollHeight + 'px';
  };

  const watch = (pane) => {
    if (ro) ro.disconnect();
    ro = new ResizeObserver(measure);
    ro.observe(pane);
  };

  const paintHead = () => {
    const { step } = top();
    titleEl.textContent = step.title || '';
    subEl.textContent = step.subtitle || '';
    subEl.hidden = !step.subtitle;
    backBtn.hidden = !podeVoltar();
  };

  // Um passo pode proibir voltar. No voto secreto isso nao e detalhe: voltar
  // uma tela mostraria o voto de quem passou o aparelho.
  const podeVoltar = () => stack.length > 1 && !top().step.noBack;

  const api = {
    close: closeSheet,
    remeasure: measure,
    depth: () => stack.length,
    canGoBack: () => podeVoltar(),

    next(step) {
      const prev = top();
      const pane = el('div', { class: 'flow-pane is-next' });
      track.append(pane);
      stack.push({ step, pane });
      step.build(pane, api);
      paintHead();
      watch(pane);

      if (!prev) {
        // Primeira tela: entra ja posicionada, sem deslizar de lado nem animar
        // a altura a partir de zero. Tirar `is-next` aqui e obrigatorio - ela
        // carrega opacity:0 e pointer-events:none.
        pane.classList.remove('is-next');
        track.style.transition = 'none';
        measure();
        requestAnimationFrame(() => { track.style.transition = ''; });
        return;
      }
      requestAnimationFrame(() => {
        prev.pane.classList.add('is-past');
        pane.classList.remove('is-next');
        measure();
      });
    },

    back() {
      if (!podeVoltar()) { if (stack.length < 2) closeSheet(); return; }
      const saindo = stack.pop();
      const volta = top();
      volta.pane.classList.remove('is-past');
      saindo.pane.classList.add('is-next');
      paintHead();
      watch(volta.pane);
      measure();
      setTimeout(() => saindo.pane.remove(), SLIDE_MS);
    },
  };

  sheetHost._onClose = () => {
    if (ro) ro.disconnect();
    if (opts.onClose) opts.onClose();
  };

  document.body.append(sheetHost);
  api.next(firstStep);
  bindSwipeBack(track, api);
  requestAnimationFrame(() => sheetHost && sheetHost.classList.add('is-open'));
  avisarPaineis();
  return api;
}

/**
 * Arrastar para a direita volta uma tela.
 *
 * Só engata com intencao horizontal clara (o dobro de x sobre y), senao rouba
 * a rolagem da lista de comandantes. Campos de texto ficam de fora.
 */
function bindSwipeBack(track, api) {
  let start = null;

  track.addEventListener('pointerdown', (e) => {
    if (!api.canGoBack()) return;
    if (e.target.closest('input, textarea')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, engaged: false };
  });

  track.addEventListener('pointermove', (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.engaged) {
      if (Math.abs(dy) > Math.abs(dx)) { start = null; return; } // e rolagem
      if (dx < 12 || Math.abs(dx) < Math.abs(dy) * 2) return;
      start.engaged = true;
      track.classList.add('is-swiping');
    }
    track.style.setProperty('--swipe', Math.max(0, dx) + 'px');
  });

  const finish = (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const engaged = start.engaged;
    start = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--swipe');
    if (engaged && dx > track.clientWidth * 0.28) api.back();
  };

  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', () => {
    start = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--swipe');
  });
}

/** Painel de uma tela so - a forma curta do openFlow. */
export function openSheet({ title, subtitle, build, onClose, centered }) {
  openFlow({ title, subtitle, build: (pane) => build(pane, closeSheet) }, { onClose, centered });
  return closeSheet;
}

export function closeSheet() {
  if (!sheetHost) return;
  const node = sheetHost;
  sheetHost = null;
  node.classList.remove('is-open');
  if (node._onClose) node._onClose();
  setTimeout(() => node.remove(), 200);
  avisarPaineis();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

let toastTimer = null;

/** Aviso efemero com acao opcional - o caminho principal do desfazer. */
export function toast(message, action) {
  let host = document.querySelector('.toast');
  if (host) host.remove();
  clearTimeout(toastTimer);

  host = el('div', { class: 'toast' }, [
    el('span', { class: 'toast-msg', text: message }),
    action
      ? el('button', {
          class: 'toast-action',
          onClick: () => { host.remove(); action.onClick(); },
        }, [action.label])
      : null,
  ]);
  document.body.append(host);
  requestAnimationFrame(() => host.classList.add('is-open'));
  toastTimer = setTimeout(() => {
    host.classList.remove('is-open');
    setTimeout(() => host.remove(), 200);
  }, action ? 4200 : 2200);
}

/** Confirmacao para acoes destrutivas. Resolve com true/false. */
export function confirmAction({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openSheet({
      title,
      subtitle: message,
      onClose: () => done(false),
      build: (body, close) => {
        body.append(
          el('div', { class: 'sheet-actions' }, [
            el('button', { class: 'btn ghost', onClick: () => { done(false); close(); } }, [t('common.cancel')]),
            el('button', {
              class: 'btn ' + (danger ? 'danger' : 'primary'),
              onClick: () => { done(true); close(); },
            }, [confirmLabel || t('common.confirm')]),
          ]),
        );
      },
    });
  });
}
