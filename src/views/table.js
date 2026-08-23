/**
 * A mesa.
 *
 * O painel inteiro e area de gesto, e a DURACAO do toque decide o que ele e:
 *
 *   toque rapido (ate 260ms)      borda esquerda  tira 1 de vida
 *                                 borda direita   poe 1 de vida
 *                                 centro          abre o painel do jogador
 *
 *   duplo toque no centro         acao em area: dano em todos ou dreno,
 *                                 partindo daquele jogador
 *
 *   segurar, ou arrastar          arma o ataque: a unica saida e causar dano
 *                                 a um oponente, arrastando ate o painel dele
 *
 * Ou seja: mexer na propria vida so acontece no toque curto. Passou do tempo,
 * o gesto virou ataque e nenhum ponto de vida se move sozinho - o que remove a
 * classe inteira de erro em que o dedo demora e a vida sai sem querer.
 *
 * Vida so muda quando o dedo SOLTA, nunca ao encostar: e o que permite decidir,
 * na hora de soltar, se aquilo foi toque ou ataque.
 *
 * Dano exige o arraste de proposito. A direcao do gesto e a propria declaracao
 * de quem bateu em quem - nada e adivinhado. As bordas mexem na vida sem
 * origem, que e o caso de quem paga a propria vida (fetchland, Necropotence).
 *
 * Toques rapidos seguidos se acumulam e viram UM evento depois de ~900ms:
 * ninguem quer sete linhas no historico por sete toques.
 */

import { el, clear, icon, openFlow, openSheet, closeSheet, buzz, toast, confirmAction, dismissOnBackdrop } from '../ui.js';
import { accentOf, colorHex, identityGradient, withAlpha } from '../colors.js';
import {
  replay, push, undo, redo, canUndo, canRedo, elapsedOf,
  cmdKeyOf, deckNameOf, CMD_LETHAL, POISON_LETHAL,
} from '../engine.js';
import { formatDuration, totalDamage } from '../stats.js';
import * as store from '../store.js';
import { layoutFor } from '../seating.js';
import { preferOrientation } from '../orientation.js';
import { t, tn } from '../i18n.js';
// `pending` vira `faltamVotar`: renderTable ja tem um `pending` local (o Map
// dos toques ainda nao confirmados), e o de fora ficaria sombreado.
import {
  PRESETS, createSession, cast, tally, isComplete, describe,
  pending as faltamVotar,
} from '../vote.js';

const COMMIT_MS = 900;
const TAP_MAX = 260;       // acima disso o toque deixa de ser toque e vira ataque
const HOLD_DELAY = 380;    // so no teclado de dano, onde segurar ainda repete
const DRAG_THRESHOLD = 14; // px antes de um toque virar arraste
const DOUBLE_TAP_MS = 280; // janela do duplo toque, que abre a acao em area
const SVG_NS = 'http://www.w3.org/2000/svg';

// Ordem WUBRG, e incolor por ultimo - a mesma que toda carta usa.
const MANA = [
  'W', 'U', 'B', 'R', 'G', 'C',
];
const MANA_ZERO = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };


export function renderTable(root, ctx) {
  const { match } = ctx;
  const tiles = new Map();
  const pending = new Map(); // seatId -> { delta, timer }
  const rotOf = new Map();   // seatId -> graus, para orientar o teclado de dano
  let state = replay(match);
  let victoryShown = false;
  let destroyed = false;
  let pauseTimer = null; // precisa nascer aqui: o primeiro sync() ja o consulta

  clear(root);
  const layout = layoutFor(match.seats.length, match.layoutId);
  const grid = el('div', {
    class: 'table-grid',
    style: {
      gridTemplateColumns: 'repeat(' + layout.cols + ', 1fr)',
      gridTemplateRows: 'repeat(' + layout.rows + ', 1fr)',
    },
  });

  match.seats.forEach((seat, i) => {
    const spec = layout.seats[i];
    rotOf.set(seat.id, spec.rot);
    const tile = buildTile(seat, spec);
    tiles.set(seat.id, tile);
    grid.append(tile.root);
  });

  // Camada do arraste: fica fora dos paineis porque eles giram, e a seta
  // precisa ser desenhada em coordenadas de tela.
  const fx = document.createElementNS(SVG_NS, 'svg');
  fx.setAttribute('class', 'attack-fx');
  const fxPath = document.createElementNS(SVG_NS, 'path');
  const fxDot = document.createElementNS(SVG_NS, 'circle');
  fxDot.setAttribute('r', '5');
  const fxHead = document.createElementNS(SVG_NS, 'path');
  fx.append(fxPath, fxDot, fxHead);

  const hub = buildHub();
  const pauseView = buildPause();
  const wrap = el('div', { class: 'table-wrap' }, [grid, hub.root, fx, pauseView.root]);
  root.append(wrap);
  sync();
  hintOnce();

  // ---------- estado ----------

  function commit(seatId) {
    const p = pending.get(seatId);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(seatId);
    if (!p.delta) { sync(); return; }

    // Borda do painel mexe na vida sem origem: e o proprio jogador pagando.
    // Dano com autor sai do arraste, nunca daqui.
    push(match, { type: 'life', targetId: seatId, delta: p.delta, sourceId: null });
    ctx.onChange();
    state = replay(match);
    if (destroyed) return; // saindo da mesa: grava, mas nao avisa mais nada
    sync();

    const who = match.seats.find((s) => s.id === seatId);
    toast(
      who.name + ' ' + (p.delta > 0 ? '+' : '') + p.delta,
      { label: t('common.undo'), onClick: () => doUndo() },
    );
  }

  function commitAll() {
    [...pending.keys()].forEach(commit);
  }

  function nudge(seatId, step) {
    if (state.finished || state.paused) return;
    const p = pending.get(seatId) || { delta: 0, timer: null };
    p.delta += step;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => commit(seatId), COMMIT_MS);
    pending.set(seatId, p);
    buzz(6);
    sync();
  }

  function doUndo() {
    if (pending.size) { // cancelar o que ainda nao virou evento vem primeiro
      pending.forEach((p) => clearTimeout(p.timer));
      pending.clear();
      sync();
      return;
    }
    if (!canUndo(match)) { toast(t('common.nothingToUndo')); return; }
    undo(match);
    ctx.onChange();
    state = replay(match);
    sync();
    buzz(10);
  }

  function doRedo() {
    if (!canRedo(match)) { toast(t('common.nothingToRedo')); return; }
    redo(match);
    ctx.onChange();
    state = replay(match);
    sync();
  }

  function passTurn() {
    if (state.finished || state.paused) return;
    commitAll();
    limparMana(); // a mana flutuante nao atravessa a vez
    push(match, { type: 'turn' });
    ctx.onChange();
    state = replay(match);
    sync();
    buzz(14);
    const next = match.seats.find((s) => s.id === state.activeSeatId);
    if (next) toast(t('table.turnToast', { n: state.turn, name: next.name }));
  }

  function apply(partial) {
    if (state.paused && partial.type !== 'resume') return;
    push(match, partial);
    ctx.onChange();
    state = replay(match);
    sync();
    buzz(8);
  }

  /**
   * Pausa o relogio da mesa.
   *
   * Nao e so cosmetico: enquanto esta pausada, o tempo nao entra na duracao da
   * partida nem no tempo de turno de ninguem. Uma ida ao banheiro nao deve
   * virar "o turno mais longo da noite" na estatistica.
   */
  function togglePause() {
    commitAll();
    push(match, { type: state.paused ? 'resume' : 'pause' });
    ctx.onChange();
    state = replay(match);
    sync();
    buzz(14);
  }

  // ---------- gestos do painel ----------
  //
  // Um conjunto unico de handlers, no painel inteiro. ONDE o dedo encostou
  // decide o que um toque rapido faz; QUANTO TEMPO ele ficou (ou se andou)
  // decide se aquilo deixa de ser toque e vira ataque.
  //
  // A vida so muda no pointerup de um toque curto. Como nada e aplicado ao
  // encostar, nao existe o que desfazer quando o gesto vira ataque - some
  // por construcao a classe de erro em que o dedo demora e a vida sai junto.

  let gesture = null;

  function zoneOf(target) {
    if (!target || !target.closest) return 'center';
    if (target.closest('.tap-minus')) return 'minus';
    if (target.closest('.tap-plus')) return 'plus';
    return 'center';
  }

  /** Qual painel esta sob o dedo. Vale em coordenadas de tela, entao o giro
   *  de 180 dos assentos do outro lado da mesa nao atrapalha. */
  function tileUnder(x, y) {
    const node = document.elementFromPoint(x, y);
    const tile = node && node.closest ? node.closest('.tile') : null;
    const id = tile && tile.dataset.seat;
    if (!id || !state.players[id] || state.players[id].dead) return null;
    return id;
  }

  function bindTile(node, seat) {
    let holdTimer = null;
    let pressed = null;  // faixa realcada enquanto o dedo esta em cima
    let tapTimer = null; // toque unico em espera, ate saber se vira duplo
    let lastTap = null;

    const unpress = () => {
      if (pressed) pressed.classList.remove('is-pressed');
      pressed = null;
    };

    /**
     * Passa o gesto para modo ataque. Daqui em diante a vida do proprio
     * jogador nao se mexe mais - a unica saida e soltar sobre um oponente
     * (ou fora, cancelando).
     */
    const arm = () => {
      if (!gesture || gesture.active) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      lastTap = null;
      unpress();
      commitAll(); // fecha toques rapidos anteriores antes de comecar o ataque
      gesture.active = true;
      wrap.classList.add('is-dragging');
      const from = tiles.get(gesture.seatId).root;
      from.classList.add('is-source');
      fx.style.setProperty('--accent', getComputedStyle(from).getPropertyValue('--accent'));
      drawArrow(gesture.x0, gesture.y0); // mostra a origem antes de haver alvo
      buzz(14);
    };

    node.addEventListener('pointerdown', (e) => {
      if (gesture || state.finished || state.players[seat.id].dead) return;
      e.preventDefault();
      try { node.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }

      gesture = {
        seatId: seat.id,
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        zone: zoneOf(e.target),
        active: false,
        targetId: null,
      };

      pressed = e.target.closest('.tap');
      if (pressed) pressed.classList.add('is-pressed');

      // Nada de vida acontece agora: so ao soltar, e so se for rapido.
      holdTimer = setTimeout(arm, TAP_MAX);
    });

    node.addEventListener('pointermove', (e) => {
      if (!gesture || gesture.pointerId !== e.pointerId) return;

      // Mover ja arma na hora, sem esperar o tempo de toque.
      if (!gesture.active) {
        if (Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) < DRAG_THRESHOLD) return;
        arm();
      }

      const hit = tileUnder(e.clientX, e.clientY);
      const over = hit && hit !== gesture.seatId ? hit : null;
      if (over !== gesture.targetId) {
        if (gesture.targetId) tiles.get(gesture.targetId).root.classList.remove('is-target');
        gesture.targetId = over;
        if (over) {
          tiles.get(over).root.classList.add('is-target');
          buzz(7); // confirma no dedo que o alvo pegou
        }
      }
      drawArrow(e.clientX, e.clientY);
    });

    node.addEventListener('pointerup', (e) => {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      try { node.releasePointerCapture(e.pointerId); } catch { /* ja liberado */ }
      clearTimeout(holdTimer);
      unpress();
      const { seatId, zone, active, targetId } = gesture;
      gesture = null;

      if (active) {
        clearArrow();
        if (targetId) openDamagePad(seatId, targetId);
        return;
      }

      // Toque rapido: aqui, e so aqui, a vida do proprio jogador se mexe.
      if (zone === 'minus') { nudge(seatId, -1); return; }
      if (zone === 'plus') { nudge(seatId, +1); return; }

      // No centro, um toque pode ser o comeco de um duplo: seguramos a acao
      // pela janela do duplo toque antes de decidir. So o centro paga essa
      // espera - as bordas precisam responder na hora.
      const agora = Date.now();
      const perto = lastTap
        && agora - lastTap.t < DOUBLE_TAP_MS
        && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36;

      if (perto) {
        clearTimeout(tapTimer);
        lastTap = null;
        openSweepPad(seat.id);
        return;
      }

      lastTap = { t: agora, x: e.clientX, y: e.clientY };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = null; openPlayerSheet(seat); }, DOUBLE_TAP_MS);
    });

    node.addEventListener('pointercancel', (e) => {
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      unpress();
      const wasActive = gesture.active;
      gesture = null;
      if (wasActive) clearArrow();
    });

    node.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function drawArrow(x, y) {
    const box = wrap.getBoundingClientRect();
    const from = tiles.get(gesture.seatId).root.getBoundingClientRect();
    const sx = from.left + from.width / 2 - box.left;
    const sy = from.top + from.height / 2 - box.top;
    const tx = x - box.left;
    const ty = y - box.top;

    // Arco leve: uma reta fica dura e ambigua, a curva mostra o sentido.
    const cx = (sx + tx) / 2 - (ty - sy) * 0.12;
    const cy = (sy + ty) / 2 + (tx - sx) * 0.12;
    fxPath.setAttribute('d', 'M ' + sx + ' ' + sy + ' Q ' + cx + ' ' + cy + ' ' + tx + ' ' + ty);
    fxDot.setAttribute('cx', sx);
    fxDot.setAttribute('cy', sy);

    // Ponta alinhada com a tangente final da curva, nao com a reta origem-destino.
    const ang = Math.atan2(ty - cy, tx - cx);
    const h = 14;
    const w = 0.44;
    fxHead.setAttribute(
      'd',
      'M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang - w)) + ' ' + (ty - h * Math.sin(ang - w)) +
      ' M ' + tx + ' ' + ty + ' L ' + (tx - h * Math.cos(ang + w)) + ' ' + (ty - h * Math.sin(ang + w)),
    );
    fx.classList.add('is-on');
  }

  function clearArrow() {
    fx.classList.remove('is-on');
    wrap.classList.remove('is-dragging');
    tiles.forEach((t) => t.root.classList.remove('is-source', 'is-target'));
  }

  /**
   * Teclado do dano. O arraste ja disse a direcao; aqui so falta o quanto.
   * Os atalhos (1, 2, 3, 5, 7) confirmam no mesmo toque, entao o caso comum
   * fecha em dois gestos. O painel gira junto com o assento de quem atacou,
   * porque quem esta mexendo e ele.
   */
  function openDamagePad(sourceId, targetId) {
    const source = match.seats.find((s) => s.id === sourceId);
    const target = match.seats.find((s) => s.id === targetId);
    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);

    let amount = 1;
    let mode = 'dano';
    let slot = 0;

    const big = el('span', { class: 'pad-amount', text: '1' });
    const modeRow = el('div', { class: 'pad-modes' });
    const partnerRow = el('div', { class: 'pad-partners' });

    const setAmount = (n) => {
      amount = Math.max(1, Math.min(999, n));
      big.textContent = String(amount);
    };

    const labels = {
      dano: t('damage.damage'), cmd: t('damage.commander'), veneno: t('damage.poison'),
    };

    const send = () => {
      close();
      if (mode === 'cmd') {
        const c = source.commanders[slot] || source.commanders[0];
        apply({ type: 'cmd', targetId, sourceId, cmdKey: cmdKeyOf(sourceId, c), delta: amount });
      } else if (mode === 'veneno') {
        apply({ type: 'poison', targetId, sourceId, delta: amount });
      } else {
        apply({ type: 'life', targetId, delta: -amount, sourceId });
      }
      toast(
        t('damage.toast', {
          from: source.name, to: target.name, n: amount, kind: labels[mode].toLowerCase(),
        }),
        { label: t('common.undo'), onClick: doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [['dano', t('damage.damage')], ['cmd', t('damage.commander')], ['veneno', t('damage.poison')]].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => { mode = id; paintModes(); paintPartners(); buzz(); },
        }, [text]));
      });
    };

    // So aparece quando quem atacou tem parceiro: sao dois contadores de 21.
    const paintPartners = () => {
      clear(partnerRow);
      if (mode !== 'cmd' || source.commanders.length < 2) return;
      source.commanders.forEach((c, i) => {
        partnerRow.append(el('button', {
          class: 'pad-partner' + (slot === i ? ' is-on' : ''),
          onClick: () => { slot = i; paintPartners(); },
        }, [c.name]));
      });
    };

    const minus = el('button', { class: 'pad-step', 'aria-label': t('table.less') }, [icon('minus')]);
    const plus = el('button', { class: 'pad-step', 'aria-label': t('table.more') }, [icon('plus')]);
    bindHold(minus, () => setAmount(amount - 1));
    bindHold(plus, () => setAmount(amount + 1));

    const pad = el('div', {
      class: 'pad',
      style: { '--accent': accent, '--rot': (rotOf.get(sourceId) || 0) + 'deg' },
    }, [
      el('div', { class: 'pad-head' }, [
        el('span', { class: 'pad-from', text: source.name }),
        icon('arrow'),
        el('span', { class: 'pad-to', text: target.name }),
      ]),
      modeRow,
      partnerRow,
      el('div', { class: 'pad-dial' }, [minus, big, plus]),
      el('div', { class: 'pad-quick' }, [1, 2, 3, 5, 7].map((n) =>
        el('button', { class: 'pad-chip', onClick: () => { setAmount(n); send(); } }, [String(n)]),
      )),
      el('div', { class: 'pad-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => close() }, [t('common.cancel')]),
        el('button', { class: 'btn primary', onClick: send }, [t('common.confirm')]),
      ]),
    ]);

    const scrim = el('div', { class: 'pad-scrim' }, [pad]);
    dismissOnBackdrop(scrim, () => close());

    function close() {
      scrim.classList.remove('is-open');
      setTimeout(() => scrim.remove(), 200);
    }

    paintModes();
    paintPartners();
    root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  /**
   * Acao em area, a partir de um jogador: dano em todos ou dreno.
   *
   * Vira UM evento `sweep`, nao um por alvo. Assim desfazer volta o dreno
   * inteiro num toque, e a linha do tempo conta a jogada como ela aconteceu -
   * uma unica coisa - em vez de tres linhas soltas.
   *
   * O dreno oferece as duas leituras que as cartas usam: ganhar o TOTAL tirado
   * (o caso Gray Merchant) ou ganhar o mesmo tanto que cada um perdeu.
   */
  function openSweepPad(sourceId) {
    if (state.finished || state.paused) return;
    const source = match.seats.find((s) => s.id === sourceId);
    const alvos = state.order.filter((id) => id !== sourceId && !state.players[id].dead);
    if (!alvos.length) { toast(t('damage.noOpponents')); return; }

    const accent = accentOf(source.commanders[0] ? source.commanders[0].colors : []);
    let amount = 1;
    let mode = 'dano';
    let ganho = 'total';

    const gainOf = () => {
      if (mode !== 'dreno') return 0;
      return ganho === 'total' ? amount * alvos.length : amount;
    };

    const big = el('span', { class: 'pad-amount', text: '1' });
    const modeRow = el('div', { class: 'pad-modes' });
    const gainRow = el('div', { class: 'pad-gain' });

    const setAmount = (n) => {
      amount = Math.max(1, Math.min(999, n));
      big.textContent = String(amount);
      paintGain();
    };

    const send = () => {
      close();
      const gain = gainOf();
      apply({ type: 'sweep', sourceId, amount, gain, targets: alvos });
      toast(
        t('damage.sweepToast', {
          name: source.name,
          n: amount,
          count: tn(alvos.length, 'damage.opponent', 'damage.opponents'),
        }) + (gain ? ' · +' + gain : ''),
        { label: t('common.undo'), onClick: doUndo },
      );
    };

    const paintModes = () => {
      clear(modeRow);
      [['dano', t('damage.damageAll')], ['dreno', t('damage.drain')]].forEach(([id, text]) => {
        modeRow.append(el('button', {
          class: 'pad-mode' + (mode === id ? ' is-on' : ''),
          onClick: () => { mode = id; paintModes(); paintGain(); buzz(); },
        }, [text]));
      });
    };

    const paintGain = () => {
      clear(gainRow);
      if (mode !== 'dreno') return;
      gainRow.append(el('span', { class: 'pad-gain-label', text: t('damage.youGain') }));
      [['total', amount * alvos.length], ['unit', amount]].forEach(([id, valor]) => {
        gainRow.append(el('button', {
          class: 'pad-gain-opt' + (ganho === id ? ' is-on' : ''),
          onClick: () => { ganho = id; paintGain(); buzz(); },
        }, [
          el('span', { class: 'pad-gain-value', text: '+' + valor }),
          el('span', { class: 'pad-gain-sub', text: id === 'total' ? t('damage.gainTotal') : t('damage.gainEach') }),
        ]));
      });
    };

    const minus = el('button', { class: 'pad-step', 'aria-label': t('table.less') }, [icon('minus')]);
    const plus = el('button', { class: 'pad-step', 'aria-label': t('table.more') }, [icon('plus')]);
    bindHold(minus, () => setAmount(amount - 1));
    bindHold(plus, () => setAmount(amount + 1));

    const pad = el('div', {
      class: 'pad',
      style: { '--accent': accent, '--rot': (rotOf.get(sourceId) || 0) + 'deg' },
    }, [
      el('div', { class: 'pad-head' }, [
        el('span', { class: 'pad-from', text: source.name }),
        icon('arrow'),
        el('span', {
          class: 'pad-to',
          text: tn(alvos.length, 'damage.opponent', 'damage.opponents'),
        }),
      ]),
      modeRow,
      gainRow,
      el('div', { class: 'pad-dial' }, [minus, big, plus]),
      el('div', { class: 'pad-quick' }, [1, 2, 3, 5, 7].map((n) =>
        el('button', { class: 'pad-chip', onClick: () => { setAmount(n); send(); } }, [String(n)]),
      )),
      el('div', { class: 'pad-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => close() }, ['Cancelar']),
        el('button', { class: 'btn primary', onClick: send }, ['Confirmar']),
      ]),
    ]);

    const scrim = el('div', { class: 'pad-scrim' }, [pad]);
    dismissOnBackdrop(scrim, () => close());

    function close() {
      scrim.classList.remove('is-open');
      setTimeout(() => scrim.remove(), 200);
    }

    paintModes();
    paintGain();
    root.append(scrim);
    requestAnimationFrame(() => scrim.classList.add('is-open'));
    buzz(14);
  }

  /* ---------------------------------------------------------------- */
  /* Marcador de mana                                                  */
  /* ---------------------------------------------------------------- */

  /**
   * Mana flutuante do turno.
   *
   * NAO entra no log de eventos, e isso e decisao, nao esquecimento: mana e
   * efemera, some ao passar a vez e nao diz nada sobre a partida depois. Cada
   * toque viraria uma linha no historico e sujaria as estatisticas para sempre.
   *
   * Fica guardada junto da partida (fora dos eventos), entao sobrevive a
   * recarregar o navegador no meio do turno - mas `replay` a ignora por
   * completo, e o placar continua saindo so do log.
   */
  function poolMana() {
    if (!match.mana) match.mana = { ...MANA_ZERO };
    return match.mana;
  }

  function limparMana() {
    match.mana = { ...MANA_ZERO };
  }

  function totalMana() {
    return Object.values(poolMana()).reduce((a, b) => a + b, 0);
  }

  /** O atalho aparece e some com a mana; o numero e o proprio rotulo dele. */
  function syncManaBtn() {
    const total = totalMana();
    hub.manaCount.textContent = String(total);
    hub.manaBtn.hidden = total === 0;
  }

  // Segurar o +/- repete depressa; gravar a cada repeticao reescreveria a
  // partida inteira dezenas de vezes por segundo. A gravacao espera o dedo
  // parar - e o valor na tela nao espera nada.
  let manaSaveTimer = null;
  function gravarManaDepois() {
    clearTimeout(manaSaveTimer);
    manaSaveTimer = setTimeout(() => ctx.onChange(), 400);
  }

  function openMana() {
    const pool = poolMana();
    const ativo = match.seats.find((s) => s.id === state.activeSeatId);
    const refs = {};
    const total = el('span', { class: 'mana-total-value' });

    const pintar = () => {
      MANA.forEach((k) => {
        refs[k].num.textContent = String(pool[k]);
        refs[k].tile.classList.toggle('is-on', pool[k] > 0);
      });
      total.textContent = String(totalMana());
      syncManaBtn();
    };

    const mexer = (k, d) => {
      pool[k] = Math.max(0, Math.min(99, pool[k] + d));
      pintar();
      buzz(6);
      gravarManaDepois();
    };

    openSheet({
      title: t('mana.title'),
      subtitle: (ativo ? ativo.name + ' · ' : '') + t('mana.sub'),
      build: (pane, close) => {
        const grid = el('div', { class: 'mana-grid' });

        MANA.forEach((k) => {
          const num = el('span', { class: 'mana-count' });

          // Mesma gramatica do painel de vida: metade esquerda tira, metade
          // direita poe, segurar repete. Nada novo para aprender.
          const menos = el('div', { class: 'mana-tap mana-minus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('minus')]),
          ]);
          const mais = el('div', { class: 'mana-tap mana-plus', 'aria-hidden': 'true' }, [
            el('span', { class: 'tap-glyph' }, [icon('plus')]),
          ]);
          bindHold(menos, () => mexer(k, -1));
          bindHold(mais, () => mexer(k, +1));

          const tile = el('div', {
            class: 'mana-tile',
            style: { '--accent': colorHex(k) },
          }, [
            menos,
            mais,
            el('div', { class: 'mana-face' }, [
              el('span', { class: 'mana-pip', text: k }),
              el('span', { class: 'mana-name', text: t('mana.' + k) }),
              num,
            ]),
          ]);
          refs[k] = { num, tile };
          grid.append(tile);
        });

        pane.append(
          grid,
          el('div', { class: 'mana-total' }, [
            el('span', { class: 'mana-total-label', text: t('mana.available') }),
            total,
          ]),
          el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn ghost',
              onClick: () => { limparMana(); pintar(); ctx.onChange(); buzz(12); },
            }, [t('mana.clear')]),
            el('button', { class: 'btn primary', onClick: close }, [t('common.done')]),
          ]),
        );

        pintar();
      },
      onClose: () => { clearTimeout(manaSaveTimer); ctx.onChange(); },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Voto secreto                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * Um aparelho so, entao "secreto" e sequencial: cada um recebe a tela, faz a
   * escolha e passa adiante sem que nada dela fique visivel. Entre um votante e
   * o proximo entra sempre a tela de entrega, para que quem passou nao veja o
   * que o seguinte toca.
   *
   * Por isso os passos usam `noBack`: voltar uma tela mostraria o voto de quem
   * acabou de passar o aparelho.
   */
  function openVote() {
    const vivos = match.seats.filter((s) => !state.players[s.id].dead);
    if (vivos.length < 2) { toast(t('vote.needTwo')); return; }

    // O aparelho sai do meio da mesa e vai para a mão de cada um: no celular,
    // em pé. Em tablet e computador o pedido é ignorado de propósito, e a tela
    // fica centralizada em vez de colada embaixo.
    preferOrientation('portrait');
    openFlow(voteSetupStep(vivos), {
      centered: true,
      onClose: () => preferOrientation('landscape'),
    });
  }

  function voteSetupStep(vivos) {
    return {
      title: t('vote.title'),
      subtitle: t('vote.setupSub'),
      build: (pane, api) => {
        let preset = PRESETS[0];
        let pergunta = '';
        let opcoes = [...preset.options];
        const votos = new Map(vivos.map((s) => [s.id, 1])); // 0 = fora da votação

        const presetRow = el('div', { class: 'vote-presets' });
        const corpo = el('div', { class: 'vote-body' });
        const iniciar = el('button', { class: 'btn primary block' }, [t('vote.start')]);

        const aplicarPreset = (p) => {
          preset = p;
          // So sobrescreve o que o usuario ainda nao digitou.
          if (!pergunta.trim()) pergunta = p.title || '';
          opcoes = p.fromPlayers ? vivos.map((s) => s.name) : [...p.options];
          vivos.forEach((s) => {
            const fora = p.excludeActive && s.id === state.activeSeatId;
            votos.set(s.id, fora ? 0 : 1);
          });
          pintar();
        };

        const pintar = () => {
          clear(presetRow);
          PRESETS.forEach((p) => {
            presetRow.append(el('button', {
              class: 'pad-mode' + (preset.id === p.id ? ' is-on' : ''),
              onClick: () => { aplicarPreset(p); buzz(); },
            }, [p.label]));
          });

          clear(corpo);
          corpo.append(el('input', {
            class: 'search-input',
            placeholder: t('vote.questionPlaceholder'),
            value: pergunta,
            maxlength: '48',
            onInput: (e) => { pergunta = e.target.value; },
          }));

          if (preset.kind === 'opcoes') {
            corpo.append(el('p', { class: 'sheet-legend', text: t('vote.options') }));
            const lista = el('div', { class: 'vote-options' });
            opcoes.forEach((texto, i) => {
              lista.append(el('div', { class: 'vote-option-row' }, [
                el('input', {
                  class: 'search-input',
                  value: texto,
                  maxlength: '24',
                  'aria-label': t('vote.option', { n: i + 1 }),
                  onInput: (e) => { opcoes[i] = e.target.value; },
                }),
                opcoes.length > 2
                  ? el('button', {
                      class: 'seat-remove',
                      'aria-label': t('common.remove'),
                      onClick: () => { opcoes.splice(i, 1); pintar(); },
                    }, [icon('close')])
                  : null,
              ]));
            });
            if (opcoes.length < 6) {
              lista.append(el('button', {
                class: 'seat-add',
                onClick: () => { opcoes.push(t('vote.option', { n: opcoes.length + 1 })); pintar(); },
              }, [icon('plus'), 'Adicionar opção']));
            }
            corpo.append(lista);
          } else {
            corpo.append(el('p', {
              class: 'settings-note',
              text: t('vote.numberNote'),
            }));
          }

          corpo.append(el('p', { class: 'sheet-legend', text: t('vote.whoVotes') }));
          const quem = el('div', { class: 'vote-voters' });
          vivos.forEach((seat) => {
            const n = votos.get(seat.id);
            quem.append(el('button', {
              class: 'vote-voter' + (n > 0 ? ' is-on' : ''),
              style: { '--accent': accentOf(seat.commanders[0] ? seat.commanders[0].colors : []) },
              // Toca e cicla: fora → 1 → 2 → 3 → fora. Cobre os efeitos que dão
              // voto extra sem precisar de outra tela.
              onClick: () => { votos.set(seat.id, (n + 1) % 4); pintar(); buzz(); },
            }, [
              el('span', { class: 'vote-voter-name', text: seat.name }),
              el('span', {
                class: 'vote-voter-count',
                text: n === 0 ? t('vote.out') : tn(n, 'vote.oneVote', 'vote.manyVotes'),
              }),
            ]));
          });
          corpo.append(quem);

          const ativos = vivos.filter((s) => votos.get(s.id) > 0);
          iniciar.disabled = ativos.length < 2
            || (preset.kind === 'opcoes' && opcoes.filter((o) => o.trim()).length < 2);
          api.remeasure();
        };

        iniciar.addEventListener('click', () => {
          const votantes = vivos
            .filter((s) => votos.get(s.id) > 0)
            .map((s) => ({ id: s.id, name: s.name, votes: votos.get(s.id) }));
          const sessao = createSession({
            question: pergunta.trim(),
            kind: preset.kind,
            options: opcoes.map((o) => o.trim()).filter(Boolean),
            voters: votantes,
          });
          api.next(handoffStep(sessao));
        });

        aplicarPreset(PRESETS[0]);
        pane.append(presetRow, corpo, el('div', { class: 'sheet-actions' }, [iniciar]));
      },
    };
  }

  /** Tela de entrega: segura tudo até quem vai votar confirmar que é ele. */
  function handoffStep(sessao) {
    const faltam = faltamVotar(sessao);
    if (!faltam.length) return revealStep(sessao);
    const proximo = faltam[0];
    const total = sessao.voters.length;

    return {
      title: t('vote.passTo', { name: proximo.name }),
      subtitle: t('vote.progress', { done: total - faltam.length, total }),
      noBack: true,
      build: (pane, api) => {
        pane.append(
          el('p', {
            class: 'settings-note',
            text: t('vote.handoffNote'),
          }),
          el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn primary block',
              onClick: () => api.next(ballotStep(sessao, proximo)),
            }, [t('vote.iAm', { name: proximo.name })]),
          ]),
        );
      },
    };
  }

  /** A cédula de um jogador. Sai da tela assim que o voto fecha. */
  function ballotStep(sessao, votante) {
    return {
      title: votante.name,
      subtitle: sessao.question || (sessao.kind === 'numero' ? t('vote.chooseNumber') : t('vote.chooseSecret')),
      noBack: true,
      build: (pane, api) => {
        const fechar = (escolhas) => {
          cast(sessao, votante.id, escolhas);
          buzz(14);
          api.next(isComplete(sessao) ? revealStep(sessao) : handoffStep(sessao));
        };

        if (sessao.kind === 'numero') {
          const campo = el('input', {
            class: 'search-input vote-number',
            type: 'number',
            inputmode: 'numeric',
            min: '0',
            value: '0',
            'aria-label': t('vote.yourNumber'),
          });
          pane.append(campo, el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn primary block',
              onClick: () => fechar([Math.max(0, Math.floor(Number(campo.value) || 0))]),
            }, [t('common.confirm')]),
          ]));
          setTimeout(() => campo.focus(), 160);
          return;
        }

        const escolhas = [];
        const restam = el('p', { class: 'sheet-legend' });
        const lista = el('div', { class: 'vote-choices' });

        const pintar = () => {
          clear(lista);
          sessao.options.forEach((texto, i) => {
            const quantos = escolhas.filter((x) => x === i).length;
            lista.append(el('button', {
              class: 'vote-choice' + (quantos ? ' is-on' : ''),
              onClick: () => {
                escolhas.push(i);
                if (escolhas.length >= votante.votes) { fechar(escolhas); return; }
                pintar();
                buzz();
              },
            }, [
              el('span', { text: texto }),
              quantos ? el('span', { class: 'vote-choice-count', text: '×' + quantos }) : null,
            ]));
          });
          restam.textContent = votante.votes > 1
            ? t('vote.votesLeft', {
              total: votante.votes, left: votante.votes - escolhas.length,
            })
            : '';
          restam.hidden = votante.votes <= 1;
          api.remeasure();
        };

        pintar();
        pane.append(restam, lista);
      },
    };
  }

  /** Revelação em duas telas: dá tempo de pôr o aparelho no meio da mesa. */
  function revealStep(sessao) {
    return {
      title: t('vote.allVoted'),
      subtitle: t('vote.putDown'),
      noBack: true,
      build: (pane, api) => {
        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => api.next(resultStep(sessao)),
          }, [t('common.reveal')]),
        ]));
      },
    };
  }

  function resultStep(sessao) {
    const r = tally(sessao);
    return {
      title: sessao.question || t('vote.result'),
      subtitle: describe(sessao, r),
      noBack: true,
      build: (pane, api) => {
        const linhas = el('div', { class: 'vote-result' });

        if (r.kind === 'numero') {
          r.rows.forEach((row) => {
            const alto = r.highest.includes(row.voterId);
            const baixo = r.lowest.includes(row.voterId);
            linhas.append(el('div', {
              class: 'vote-result-row' + (alto ? ' is-high' : '') + (baixo ? ' is-low' : ''),
            }, [
              el('span', { class: 'vote-result-label', text: row.name }),
              el('span', {
                class: 'vote-result-tag',
                text: r.allEqual ? '' : alto ? t('vote.highest') : baixo ? t('vote.lowest') : '',
              }),
              el('span', { class: 'vote-result-value', text: String(row.value) }),
            ]));
          });
          pane.append(linhas);
          if (r.allEqual) {
            pane.append(el('p', {
              class: 'settings-note',
              text: t('vote.allEqual'),
            }));
          }
        } else {
          r.rows.forEach((row) => {
            const venceu = r.top.includes(row.index) && row.votes > 0;
            linhas.append(el('div', { class: 'vote-result-row' + (venceu ? ' is-high' : '') }, [
              el('span', { class: 'vote-result-label', text: row.label }),
              el('span', { class: 'vote-result-tag', text: row.voters.join(', ') }),
              el('span', { class: 'vote-result-value', text: String(row.votes) }),
            ]));
          });
          pane.append(linhas);

          // Os dois fatos que as cartas realmente perguntam.
          if (r.unanimous) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.unanimous', { label: r.rows[0].label }),
            }));
          } else if (r.tie) {
            pane.append(el('p', {
              class: 'vote-verdict',
              text: t('vote.tie', { labels: r.top.map((i) => sessao.options[i]).join(' / ') }),
            }));
          }
        }

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn primary block',
            onClick: () => {
              api.close();
              apply({
                type: 'vote',
                question: sessao.question,
                kind: sessao.kind,
                options: sessao.options,
                ballots: sessao.voters.map((v) => ({
                  seatId: v.id, name: v.name, choices: sessao.ballots[v.id] || [],
                })),
                summary: describe(sessao, r),
              });
              toast(t('vote.saved'), { label: t('common.undo'), onClick: doUndo });
            },
          }, [t('vote.save')]),
        ]));
      },
    };
  }

  /** Uma dica, uma vez na vida: o arraste precisa ser descoberto. */
  function hintOnce() {
    if (store.getDB().settings.dragHintSeen) return;
    store.setSetting('dragHintSeen', true);
    setTimeout(() => toast(t('table.dragHint')), 1000);
  }

  // ---------- render ----------

  function sync() {
    for (const seat of match.seats) {
      const p = state.players[seat.id];
      const tile = tiles.get(seat.id);
      const extra = pending.get(seat.id);
      const shown = p.life + (extra ? extra.delta : 0);

      tile.life.textContent = String(shown);
      tile.life.classList.toggle('is-low', shown <= 5 && !p.dead);

      if (extra && extra.delta) {
        tile.delta.textContent = (extra.delta > 0 ? '+' : '') + extra.delta;
        tile.delta.classList.add('is-on');
      } else {
        tile.delta.classList.remove('is-on');
      }

      tile.root.classList.toggle('is-active', seat.id === state.activeSeatId && !state.finished);
      tile.root.classList.toggle('is-dead', p.dead);

      const worstCmd = Math.max(0, ...Object.values(p.cmd), 0);
      const badges = [];
      if (worstCmd > 0) badges.push({ k: 'cmd', v: worstCmd + '/' + CMD_LETHAL, hot: worstCmd >= CMD_LETHAL - 4 });
      if (p.poison > 0) badges.push({ k: 'poison', v: p.poison + '/' + POISON_LETHAL, hot: p.poison >= POISON_LETHAL - 2 });
      clear(tile.badges);
      badges.forEach((b) => tile.badges.append(
        el('span', { class: 'badge badge-' + b.k + (b.hot ? ' is-hot' : ''), text: b.v }),
      ));

      clear(tile.status);
      if (p.dead) {
        tile.status.append(
          icon('skull'),
          el('span', {
            text: p.elim
              ? t('table.place', { n: match.seats.length - p.elim.place + 1 })
              : t('table.eliminated'),
          }),
        );
      }
    }

    wrap.classList.toggle('is-paused', state.paused);
    pauseView.root.classList.toggle('is-open', state.paused);
    if (state.paused) startPauseClock(); else stopPauseClock();

    syncManaBtn();

    hub.turn.textContent = String(state.turn);
    const active = state.players[state.activeSeatId];
    hub.ring.style.setProperty(
      '--accent',
      active ? accentOf(active.commanders[0] ? active.commanders[0].colors : []) : 'var(--text-dim)',
    );
    hub.undoBtn.disabled = !canUndo(match) && !pending.size;

    // O cartaz de vitoria aparece uma vez por desfecho. Se um "desfazer" trouxer
    // alguem de volta a vida, ele fica armado outra vez.
    if (!state.finished) victoryShown = false;
    else if (!victoryShown) {
      victoryShown = true;
      setTimeout(showVictory, 420);
    }
  }

  function buildTile(seat, spec) {
    const commander = seat.commanders[0];
    const colors = commander ? commander.colors : [];
    const accent = accentOf(colors);

    const life = el('div', { class: 'tile-life' });
    const delta = el('div', { class: 'tile-delta' });
    const badges = el('div', { class: 'tile-badges' });
    const status = el('div', { class: 'tile-status' });

    // As faixas so marcam territorio: quem escuta o ponteiro e o painel
    // inteiro, em bindTile. Por isso sao divs e nao botoes.
    const minus = el('div', { class: 'tap tap-minus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('minus')]),
    ]);
    const plus = el('div', { class: 'tap tap-plus', 'aria-hidden': 'true' }, [
      el('span', { class: 'tap-glyph' }, [icon('plus')]),
    ]);

    const header = el('div', { class: 'tile-head' }, [
      el('span', { class: 'tile-player', text: seat.name }),
      el('span', { class: 'tile-deck', text: deckNameOf(seat.commanders) }),
    ]);

    const band = el('div', { class: 'tile-drag' });

    const root = el('div', {
      class: 'tile',
      dataset: { seat: seat.id },
      style: {
        gridRow: spec.cs ? String(spec.r) : String(spec.r),
        gridColumn: spec.cs ? spec.c + ' / span ' + spec.cs : String(spec.c),
        transform: 'rotate(' + spec.rot + 'deg)',
        '--accent': accent,
        '--tint': identityGradient(colors, 0.16),
        '--glow': withAlpha(accent, 0.34),
      },
    }, [
      commander && commander.art
        ? el('div', { class: 'tile-art', style: { backgroundImage: 'url(' + commander.art + ')' } })
        : null,
      el('div', { class: 'tile-tint' }),
      minus,
      plus,
      band,
      el('div', { class: 'tile-face' }, [header, life, badges, status]),
      delta,
    ]);

    bindTile(root, seat);
    return { root, life, delta, badges, status };
  }

  function startPauseClock() {
    if (pauseTimer) return;
    const tick = () => {
      pauseView.clock.textContent = formatDuration(Date.now() - (state.pausedSince || Date.now()));
    };
    tick();
    pauseTimer = setInterval(tick, 1000);
  }

  function stopPauseClock() {
    clearInterval(pauseTimer);
    pauseTimer = null;
  }

  /**
   * Cobertura da pausa. Bloqueia mesmo - uma pausa que deixa tocar nao e
   * pausa, e o placar andaria com o relogio parado.
   */
  function buildPause() {
    const clock = el('span', { class: 'pause-clock', text: '0s' });
    return {
      clock,
      root: el('div', { class: 'pause' }, [
        el('div', { class: 'pause-card' }, [
          el('span', { class: 'pause-eyebrow', text: t('table.paused') }),
          clock,
          el('p', { class: 'pause-note', text: t('table.pausedNote') }),
          el('button', { class: 'btn primary', onClick: togglePause }, [t('table.resume')]),
        ]),
      ]),
    };
  }

  function buildHub() {
    const turn = el('span', { class: 'hub-turn' });
    const ring = el('button', {
      class: 'hub-ring',
      'aria-label': t('table.passTurn'),
      onClick: passTurn,
    }, [el('span', { class: 'hub-label', text: t('table.turn') }), turn]);

    const undoBtn = el('button', { class: 'hub-btn', 'aria-label': t('common.undo'), onClick: doUndo }, [icon('undo')]);

    /*
     * Atalho da mana. So existe enquanto ha mana marcada, e ai vale dois
     * papeis de uma vez: lembra que sobrou mana antes de passar a vez, e leva
     * direto ao contador - que e o caminho de ida e volta o tempo todo quando
     * se gasta parte da mana, resolve a magia e volta para acertar o resto.
     */
    const manaCount = el('span', { class: 'hub-mana-count' });
    const manaBtn = el('button', {
      class: 'hub-btn is-mana',
      'aria-label': t('mana.marker'),
      hidden: true,
      onClick: openMana,
    }, [manaCount]);

    const menuBtn = el('button', {
      class: 'hub-btn', 'aria-label': t('common.menu'), onClick: openMenu,
    }, [icon('more')]);

    return {
      root: el('div', { class: 'hub' }, [undoBtn, ring, manaBtn, menuBtn]),
      turn, ring, undoBtn, manaBtn, manaCount,
    };
  }

  // ---------- paineis ----------

  function openPlayerSheet(seat) {
    commitAll();
    const p = state.players[seat.id];

    openSheet({
      title: seat.name,
      subtitle: deckNameOf(seat.commanders),
      build: (body, close) => {
        const rebuild = () => {
          state = replay(match);
          clear(body);
          paint();
        };

        const paint = () => {
          const me = state.players[seat.id];

          // Ajuste sem origem: correcao de erro ou vida paga pelo proprio
          // jogador. Dano com autor entra pelo arraste.
          body.append(stepperRow({
            label: t('table.life'),
            value: me.life,
            steps: [-5, -1, +1, +5],
            onStep: (n) => {
              apply({ type: 'life', targetId: seat.id, delta: n, sourceId: null });
              rebuild();
            },
          }));

          // Dano de comandante: uma linha por comandante adversario.
          const foes = [];
          for (const other of match.seats) {
            if (other.id === seat.id) continue;
            for (const c of other.commanders) foes.push({ other, c, key: cmdKeyOf(other.id, c) });
          }
          if (foes.length) {
            body.append(el('p', { class: 'sheet-legend', text: t('table.cmdDamageTaken') }));
            foes.forEach(({ other, c, key }) => {
              const val = me.cmd[key] || 0;
              body.append(stepperRow({
                label: c.name,
                sub: other.name,
                value: val + ' / ' + CMD_LETHAL,
                accent: accentOf(c.colors),
                hot: val >= CMD_LETHAL - 4,
                steps: [-1, +1],
                onStep: (n) => {
                  if (val + n < 0) return;
                  apply({ type: 'cmd', targetId: seat.id, sourceId: other.id, cmdKey: key, delta: n });
                  rebuild();
                },
              }));
            });
          }

          body.append(stepperRow({
            label: t('table.poison'),
            value: me.poison + ' / ' + POISON_LETHAL,
            hot: me.poison >= POISON_LETHAL - 2,
            steps: [-1, +1],
            onStep: (n) => {
              if (me.poison + n < 0) return;
              apply({ type: 'poison', targetId: seat.id, delta: n, sourceId: null });
              rebuild();
            },
          }));

          // Caminho descoberto para a acao em area - e o lugar onde o atalho
          // do duplo toque fica escrito, ja que gesto nenhum se anuncia.
          body.append(el('button', {
            class: 'menu-item area-shortcut',
            onClick: () => { close(); openSweepPad(seat.id); },
          }, [
            el('span', { class: 'menu-label', text: t('table.areaShortcut') }),
            el('span', { class: 'menu-sub', text: t('table.areaShortcutSub') }),
          ]));

          body.append(el('div', { class: 'sheet-actions' }, [
            el('button', {
              class: 'btn ghost',
              onClick: async () => {
                close();
                const ok = await confirmAction({
                  title: t('table.concedeTitle'),
                  message: t('table.concedeMsg', { name: seat.name }),
                  confirmLabel: t('table.concede'),
                });
                if (ok) apply({ type: 'concede', targetId: seat.id });
              },
            }, [t('table.concede')]),
            el('button', { class: 'btn primary', onClick: close }, [t('common.done')]),
          ]));
        };

        paint();
      },
    });
  }

  function openMenu() {
    commitAll();
    openSheet({
      title: t('table.match'),
      subtitle: 'Turno ' + state.turn + ' · ' + formatDuration(elapsedOf(match, state)),
      build: (body, close) => {
        const item = (label, sub, fn, cls = '') =>
          el('button', { class: 'menu-item ' + cls, onClick: () => { close(); fn(); } }, [
            el('span', { class: 'menu-label', text: label }),
            sub ? el('span', { class: 'menu-sub', text: sub }) : null,
          ]);

        body.append(el('div', { class: 'menu' }, [
          item(
            state.paused ? t('table.resume') : t('table.pause'),
            state.paused ? t('table.resumeSub') : t('table.pauseSub'),
            togglePause,
          ),
          item(t('table.passTurn'), t('table.passTurnSub'), passTurn),
          item(t('common.undo'), '', doUndo),
          item(t('common.redo'), '', doRedo),
          item(t('mana.marker'), t('mana.markerSub'), openMana),
          item(t('vote.title'), t('vote.menuSub'), openVote),
          item(t('table.declareWinner'), t('table.declareWinnerSub'), pickWinner),
          item(t('common.stats'), '', ctx.onStats),
          item(t('table.discard'), t('table.discardSub'), async () => {
            const ok = await confirmAction({
              title: t('table.discardTitle'),
              message: t('table.discardMsg'),
              confirmLabel: t('table.discard'),
            });
            if (ok) ctx.onDiscard();
          }, 'is-danger'),
        ]));
      },
    });
  }

  /**
   * Vitoria declarada na mao: quem venceu e, depois, COMO.
   *
   * O motivo e opcional de proposito - a mesa nem sempre concorda no rotulo, e
   * uma tela que nao deixa sair seria pior que um dado faltando. Vitoria por
   * ultimo vivo nao passa por aqui e nao inventa causa nenhuma.
   */
  function pickWinner() {
    openFlow({
      title: t('table.whoWon'),
      build: (pane, api) => {
        pane.append(el('div', { class: 'menu' }, match.seats.map((seat) =>
          el('button', {
            class: 'menu-item',
            style: { '--accent': accentOf(seat.commanders[0] ? seat.commanders[0].colors : []) },
            onClick: () => api.next(winReasonStep(seat)),
          }, [
            el('span', { class: 'menu-label', text: seat.name }),
            el('span', { class: 'menu-sub', text: deckNameOf(seat.commanders) }),
          ]),
        )));
      },
    });
  }

  function winReasonStep(seat) {
    const MOTIVOS = [
      ['combate', 'win.combat'], ['comandante', 'win.commander'],
      ['combo', 'win.combo'], ['veneno', 'win.poison'],
      ['mill', 'win.mill'], ['alternativa', 'win.alt'],
      ['concessao', 'win.concede'], ['outro', 'win.other'],
    ];

    return {
      title: t('win.reasonTitle', { name: seat.name }),
      subtitle: t('win.reasonSub'),
      build: (pane, api) => {
        const fechar = (motivo) => {
          api.close();
          apply({ type: 'win', targetId: seat.id, reason: motivo });
        };

        pane.append(el('div', { class: 'win-reasons' }, MOTIVOS.map(([id, chave]) =>
          el('button', { class: 'win-reason', onClick: () => fechar(id) }, [t(chave)]),
        )));

        pane.append(el('div', { class: 'sheet-actions' }, [
          el('button', {
            class: 'btn ghost block',
            onClick: () => fechar(null),
          }, [t('win.skip')]),
        ]));
      },
    };
  }

  function showVictory() {
    const winner = match.seats.find((s) => s.id === state.winnerId);
    const commander = winner && winner.commanders[0];
    const overlay = el('div', { class: 'victory' }, [
      el('div', {
        class: 'victory-card',
        style: { '--accent': commander ? accentOf(commander.colors) : '#fff' },
      }, [
        commander && commander.art
          ? el('div', { class: 'victory-art', style: { backgroundImage: 'url(' + commander.art + ')' } })
          : null,
        el('div', { class: 'victory-body' }, [
          el('span', { class: 'victory-eyebrow' }, [icon('crown'), winner ? t('victory.title') : t('victory.gameOver')]),
          el('h1', { class: 'victory-name', text: winner ? winner.name : t('victory.tableWiped') }),
          el('p', { class: 'victory-deck', text: winner ? deckNameOf(winner.commanders) : '' }),
          el('div', { class: 'victory-stats' }, [
            stat(t('victory.turns'), String(state.turn)),
            stat(t('victory.duration'), formatDuration(elapsedOf(match, state))),
            stat(t('victory.totalDamage'), String(totalDamage(match))),
          ]),
          el('div', { class: 'victory-actions' }, [
            el('button', { class: 'btn ghost', onClick: () => overlay.remove() }, [t('victory.backToTable')]),
            el('button', { class: 'btn primary', onClick: () => { overlay.remove(); ctx.onFinish(); } }, [t('victory.saveMatch')]),
          ]),
        ]),
      ]),
    ]);
    root.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    buzz(24);
  }

  return {
    destroy: () => {
      destroyed = true;
      stopPauseClock();
      commitAll(); // nada de perder o ultimo toque na troca de tela
      closeSheet();
    },
  };
}

// ---------- pecas reutilizaveis ----------

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-value', text: value }),
    el('span', { class: 'stat-label', text: label }),
  ]);
}

function stepperRow({ label, sub, value, steps, onStep, accent, hot }) {
  return el('div', {
    class: 'stepper' + (hot ? ' is-hot' : ''),
    style: accent ? { '--accent': accent } : {},
  }, [
    el('div', { class: 'stepper-text' }, [
      el('span', { class: 'stepper-label', text: label }),
      sub ? el('span', { class: 'stepper-sub', text: sub }) : null,
    ]),
    el('span', { class: 'stepper-value', text: String(value) }),
    el('div', { class: 'stepper-btns' }, steps.map((n) =>
      el('button', {
        class: 'step-btn' + (n > 0 ? ' is-plus' : ''),
        onClick: () => onStep(n),
      }, [(n > 0 ? '+' : '') + n]),
    )),
  ]);
}

/** Toque simples dispara uma vez; segurar repete e acelera. */
function bindHold(node, fn) {
  let holdTimer = null;
  let repeat = null;
  let count = 0;

  const stop = () => {
    clearTimeout(holdTimer);
    clearInterval(repeat);
    holdTimer = null;
    repeat = null;
    count = 0;
    node.classList.remove('is-held');
  };

  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    fn();
    holdTimer = setTimeout(() => {
      node.classList.add('is-held');
      repeat = setInterval(() => {
        count += 1;
        fn();
        if (count === 8) { // acelera depois de um tempo segurando
          clearInterval(repeat);
          repeat = setInterval(fn, 55);
        }
      }, 110);
    }, HOLD_DELAY);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) =>
    node.addEventListener(evt, stop),
  );
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}

function ordinal(n) {
  return n + 'º';
}
