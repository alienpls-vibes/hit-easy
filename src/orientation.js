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

/**
 * O aparelho esta NO MEIO da mesa, ou de FRENTE para uma pessoa so?
 *
 * Celular e tablet ficam deitados entre os jogadores: cada um olha de um lado,
 * e girar o teclado de dano para o assento de quem ataca e o que faz ele ser
 * legivel. Num computador ninguem senta em volta do monitor - ele fica de pe,
 * de frente para uma pessoa - e ai o mesmo giro entrega a tela de cabeca para
 * baixo, que era o que estava acontecendo.
 *
 * O sinal e o ponteiro, nao o tamanho da tela: tablet grande em paisagem tem a
 * largura de um notebook, e chutar por pixels erraria nos dois sentidos. Mouse
 * ou trackpad significa alguem sentado de frente. Um notebook com tela sensivel
 * ao toque tambem tem mouse, e tambem nao deve girar - o que da o resultado
 * certo. iPad com teclado e trackpad conta como computador, e ai ele esta mesmo
 * apoiado feito notebook.
 */
export function apontadorPreciso(mm) {
  const media = mm || (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia.bind(window)
    : null);
  if (!media) return false;
  try {
    return Boolean(media('(hover: hover) and (pointer: fine)').matches);
  } catch {
    return false;
  }
}

/** Decisao pura, para poder ser testada dos dois lados. */
export function giraComOAssento(temApontadorPreciso) {
  return !temApontadorPreciso;
}

/** Os teclados do jogo devem girar para o assento de quem age? */
export function rotatesToSeat() {
  return giraComOAssento(apontadorPreciso());
}

/**
 * Quanto o teclado de dano gira, ja no formato que o CSS espera.
 *
 * Existe como funcao para que o teste alcance a decisao inteira - inclusive o
 * sufixo, que e a parte que quebra em silencio: `transform: rotate(0)` sem
 * unidade e invalido, e a regra toda seria descartada pelo navegador.
 */
export function grausDoPad(graus, temApontadorPreciso) {
  return (giraComOAssento(temApontadorPreciso) ? (graus || 0) : 0) + 'deg';
}
