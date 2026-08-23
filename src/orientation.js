/**
 * Orientacao da tela.
 *
 * A mesa quer o aparelho DEITADO, no meio do grupo. A votacao quer ele EM PE,
 * porque passa de mao em mao e se segura como um celular normal.
 *
 * O que da para fazer de verdade, e o que nao da:
 *
 *   - travar orientacao so funciona em tela cheia, e so no Chrome/Android.
 *     O Safari do iPhone nao implementa nem uma coisa nem outra.
 *   - por isso tudo aqui e "pedido", nao ordem: falha em silencio onde nao ha
 *     suporte, e o CSS precisa continuar funcionando na orientacao errada.
 *
 * Em tablet e computador nao mexemos em nada: a tela e grande o bastante para
 * as duas coisas caberem deitadas, e girar um tablet apoiado seria pior.
 */

import * as store from './store.js';

/** Lado menor da tela. Celular fica abaixo disso em qualquer orientacao. */
const LADO_PEQUENO = 560;

export function isSmallScreen() {
  if (typeof window === 'undefined') return false;
  return Math.min(window.innerWidth, window.innerHeight) < LADO_PEQUENO;
}

export function isWide() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= window.innerHeight;
}

function permitido() {
  try {
    return store.getDB().settings.autoRotate !== false;
  } catch {
    return false;
  }
}

/**
 * Pede uma orientacao. `mode` e 'landscape', 'portrait' ou null (soltar).
 *
 * Entrar em tela cheia e condicao para travar, entao o pedido de paisagem
 * (feito ao abrir a mesa) e quem abre a tela cheia; os demais so trocam a
 * trava, sem sair e entrar de novo - o que piscaria a tela a cada votacao.
 */
export async function preferOrientation(mode) {
  if (typeof window === 'undefined') return;
  if (!permitido()) return;

  // Retrato so faz sentido no celular. Num tablet apoiado na mesa, girar a
  // tela para votar seria mais atrapalho que ajuda.
  if (mode === 'portrait' && !isSmallScreen()) return;

  try {
    if (mode === null) {
      if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock(mode);
  } catch {
    /* sem suporte ou negado: o CSS se vira nas duas orientacoes */
  }
}
