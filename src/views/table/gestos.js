/**
 * O painel inteiro e area de gesto, e a DURACAO do toque decide o que ele e.
 *
 * Nas BORDAS, toque curto mexe a propria vida em 1, sem autor, e segurar repete
 * acelerando - a mesma gramatica do marcador de mana, onde segurar tambem
 * repete. Quem chega a 40 de vida nao devia precisar de quarenta toques.
 *
 * No CENTRO, segurar (ou arrastar de qualquer ponto) arma o ataque, e dai em
 * diante nenhum ponto de vida se move sozinho.
 *
 * O QUE ISSO CUSTA: antes nada era aplicado ao encostar - a vida so mudava
 * quando o dedo SOLTAVA -, e isso eliminava por construcao o erro de o dedo
 * demorar na borda e a vida sair junto. Com a repeticao esse erro volta a
 * existir. O que o mantem barato e a coalescencia que ja existia: toda a
 * seguradinha entra em UM evento (ver commit() em estado.js), entao um toque em
 * "desfazer" volta os quarenta pontos de uma vez, e nao um por um. Por isso a
 * repeticao comeca em HOLD_DELAY e nao em TAP_MAX: entre os dois, um toque
 * lento continua valendo 1.
 */

import { buzz } from '../../ui.js';
import { t } from '../../i18n.js';
import {
  DOUBLE_TAP_MS, DRAG_THRESHOLD, HOLD_DELAY, TAP_MAX,
} from './constantes.js';
import { repetirSegurando } from './pecas.js';

export function criarGestos(mesa) {
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
    const p = id && mesa.state.players[id];
    if (!p || p.dead) return null;
    return id;
  }

  function bindTile(node, seat) {
    let holdTimer = null;
    let pressed = null;  // faixa realcada enquanto o dedo esta em cima
    let tapTimer = null; // toque unico em espera, ate saber se vira duplo
    let lastTap = null;
    // Segurar na borda: guarda a funcao que para, e por isso nao-nulo
    // significa 'ha repeticao em curso' - que e o que os guardas perguntam.
    let repeticao = null;

    const unpress = () => {
      if (pressed) {
        pressed.classList.remove('is-pressed');
        pressed.classList.remove('is-held');
      }
      pressed = null;
    };

    /** Para a repeticao. Chamar sem nenhuma em curso nao faz mal. */
    const pararRepeticao = () => {
      if (repeticao) repeticao();
      repeticao = null;
    };

    /**
     * Segurar na borda: repete o mesmo passo, acelerando.
     *
     * Marca `repeated` no gesto para o soltar nao somar outro passo por cima -
     * a borda aplica no soltar quando foi toque curto, e aqui ja aplicou.
     */
    const repetirNaBorda = (zona) => {
      const passo = zona === 'minus' ? -1 : +1;
      repeticao = repetirSegurando(
        () => {
          // O gesto pode ter acabado entre um tick e o clearInterval.
          if (!mesa.gesture) return;
          mesa.gesture.repeated = true;
          mesa.nudge(seat.id, passo);
        },
        {
          atraso: HOLD_DELAY,
          passoInicial: true,
          aoComecar: () => { if (pressed) pressed.classList.add('is-held'); },
        },
      );
    };

    /**
     * Passa o gesto para modo ataque. Daqui em diante a vida do proprio
     * jogador nao se mexe mais - a unica saida e soltar sobre um oponente
     * (ou fora, cancelando).
     */
    const arm = () => {
      if (!mesa.gesture || mesa.gesture.active) return;
      // Repeticao em curso e ajuste de vida, nao ataque. O pointermove ja
      // barra, e aqui e a rede: chamar arm() por outro caminho no futuro nao
      // pode deixar a mesa com a vida saindo e a seta na tela.
      if (repeticao) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      lastTap = null;
      unpress();
      // Fecha toques rapidos anteriores antes de comecar o ataque.
      mesa.commitAll();
      mesa.gesture.active = true;
      mesa.wrap.classList.add('is-dragging');
      const from = mesa.tiles.get(mesa.gesture.seatId).root;
      from.classList.add('is-source');
      mesa.fx.style.setProperty('--accent', getComputedStyle(from).getPropertyValue('--accent'));
      // Mostra a origem antes de haver alvo.
      mesa.drawArrow(mesa.gesture.x0, mesa.gesture.y0);
      buzz(14);
    };

    node.addEventListener('pointerdown', (e) => {
      if (mesa.gesture
        || mesa.state.finished
        || mesa.state.players[seat.id].dead) return;
      e.preventDefault();
      try { node.setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }

      mesa.gesture = {
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

      // Nada de vida acontece agora. Na borda, segurar comeca a repetir; no
      // centro, segurar arma o ataque. Os dois relogios sao diferentes de
      // proposito - ver o cabecalho deste arquivo.
      const zona = mesa.gesture.zone;
      if (zona === 'minus' || zona === 'plus') {
        repetirNaBorda(zona);
      } else {
        holdTimer = setTimeout(arm, TAP_MAX);
      }
    });

    node.addEventListener('pointermove', (e) => {
      if (!mesa.gesture || mesa.gesture.pointerId !== e.pointerId) return;

      // Mover ja arma na hora, sem esperar o tempo de toque.
      if (!mesa.gesture.active) {
        // Depois que a repeticao aplicou um passo o gesto JA e ajuste de vida,
        // e nao pode virar ataque no meio do caminho: a vida ja saiu, e
        // converter agora deixaria o jogador com o ajuste aplicado e um ataque
        // armado.
        if (mesa.gesture.repeated) return;
        if (Math.hypot(e.clientX - mesa.gesture.x0, e.clientY - mesa.gesture.y0) < DRAG_THRESHOLD) return;
        // Antes disso, nenhum ponto saiu: o dedo encostou no + ou no - so
        // porque o painel e pequeno, e ja saiu arrastando para atacar. A
        // repeticao que esperava para comecar e cancelada, e o gesto vira o
        // ataque que a pessoa queria - sem vida nenhuma mexida no caminho.
        pararRepeticao();
        arm();
      }

      const hit = tileUnder(e.clientX, e.clientY);
      const over = hit && hit !== mesa.gesture.seatId ? hit : null;
      if (over !== mesa.gesture.targetId) {
        if (mesa.gesture.targetId) mesa.tiles.get(mesa.gesture.targetId).root.classList.remove('is-target');
        mesa.gesture.targetId = over;
        if (over) {
          mesa.tiles.get(over).root.classList.add('is-target');
          buzz(7); // confirma no dedo que o alvo pegou
        }
      }
      mesa.drawArrow(e.clientX, e.clientY);
    });

    node.addEventListener('pointerup', (e) => {
      if (!mesa.gesture || mesa.gesture.pointerId !== e.pointerId) return;
      try { node.releasePointerCapture(e.pointerId); } catch { /* ja liberado */ }
      clearTimeout(holdTimer);
      pararRepeticao();
      unpress();
      const { seatId, zone, active, targetId, repeated } = mesa.gesture;
      mesa.gesture = null;

      if (active) {
        mesa.clearArrow();
        if (targetId) mesa.openDamagePad(seatId, targetId);
        return;
      }

      // A repeticao ja mexeu a vida enquanto o dedo estava em cima: somar um
      // passo agora cobraria o toque duas vezes.
      if (repeated) return;

      // Toque rapido na borda: um passo, aplicado so agora.
      if (zone === 'minus') { mesa.nudge(seatId, -1); return; }
      if (zone === 'plus') { mesa.nudge(seatId, +1); return; }

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
        mesa.openSweepPad(seat.id);
        return;
      }

      lastTap = { t: agora, x: e.clientX, y: e.clientY };
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = null; mesa.openPlayerSheet(seat); }, DOUBLE_TAP_MS);
    });

    node.addEventListener('pointercancel', (e) => {
      if (!mesa.gesture || mesa.gesture.pointerId !== e.pointerId) return;
      clearTimeout(holdTimer);
      clearTimeout(tapTimer);
      pararRepeticao();
      unpress();
      const wasActive = mesa.gesture.active;
      mesa.gesture = null;
      if (wasActive) mesa.clearArrow();
    });

    node.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { zoneOf, tileUnder, bindTile };
}
