/**
 * Pecas pequenas que a mesa reusa: o par rotulo/numero, a linha com - e +, e o
 * "segurar repete" dos botoes de ajuste.
 */

import { el } from '../../ui.js';
import {
  HOLD_DELAY, REPEAT_ACCEL_AFTER, REPEAT_FAST_MS, REPEAT_MS,
} from './constantes.js';

// ---------- pecas reutilizaveis ----------

export function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-value', text: value }),
    el('span', { class: 'stat-label', text: label }),
  ]);
}

export function stepperRow({ label, sub, value, steps, onStep, accent, hot }) {
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

/**
 * Segurar repete, e acelera enquanto o dedo nao sai.
 *
 * Um lugar so para a cadencia, porque ela e usada em dois: os botoes de ajuste
 * (teclado de dano, marcador de mana) e as bordas do painel na mesa. Se os dois
 * divergirem, segurar passa a significar velocidades diferentes na mesma mesa.
 *
 * `passoInicial` diz se sai um passo ao completar o atraso. Os botoes de ajuste
 * ja dispararam uma vez no proprio toque, entao la e `false`; a borda do painel
 * nao dispara nada antes de soltar, entao la e `true` - senao o primeiro passo
 * do "segurar" so apareceria 110ms depois, e a borda pareceria travada.
 *
 * Devolve a funcao que para tudo. Chamar duas vezes nao faz mal.
 */
export function repetirSegurando(fn, opcoes = {}) {
  const { atraso = HOLD_DELAY, passoInicial = false, aoComecar } = opcoes;
  let espera = null;
  let repeticao = null;
  let passos = 0;

  espera = setTimeout(() => {
    if (aoComecar) aoComecar();
    if (passoInicial) fn();
    repeticao = setInterval(() => {
      passos += 1;
      fn();
      if (passos === REPEAT_ACCEL_AFTER) {
        clearInterval(repeticao);
        repeticao = setInterval(fn, REPEAT_FAST_MS);
      }
    }, REPEAT_MS);
  }, atraso);

  return () => {
    clearTimeout(espera);
    clearInterval(repeticao);
    espera = null;
    repeticao = null;
  };
}

/** Toque simples dispara uma vez; segurar repete e acelera. */
export function bindHold(node, fn) {
  let parar = null;

  const stop = () => {
    if (parar) parar();
    parar = null;
    node.classList.remove('is-held');
  };

  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    fn();
    parar = repetirSegurando(fn, {
      aoComecar: () => node.classList.add('is-held'),
    });
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) =>
    node.addEventListener(evt, stop),
  );
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}
