/**
 * O contexto da mesa: o que todas as pecas compartilham.
 *
 * Antes eram dezenove `const`/`let` dentro de renderTable(), vistos de graca
 * por trinta e nove funcoes aninhadas. Isso e comodo enquanto e um arquivo, e
 * impossivel de dividir depois: qualquer peca que saia do closure perde tudo
 * de uma vez, sem que nada avise.
 *
 * Agora e um objeto. Cada peca recebe `mesa` e le `mesa.state`, `mesa.tiles`,
 * `mesa.hub` - o que antes era invisivel passou a estar escrito. As pecas
 * tambem se penduram aqui (`mesa.sync`, `mesa.apply`), e e assim que uma chama
 * a outra sem que as duas precisem se importar mutuamente.
 *
 * Objeto, e nao variaveis exportadas: `let` exportado e somente leitura de
 * fora, e `mesa.state = ...` precisa funcionar de sete arquivos diferentes.
 */

import { layoutFor } from '../../seating.js';
import { replay } from '../../engine.js';
import { SVG_NS } from './constantes.js';
import { grausNaMesa, apontadorPreciso } from '../../orientation.js';

export function criarContexto(root, ctx) {
  const { match } = ctx;
  const rotOf = new Map(); // seatId -> graus, para orientar o teclado de dano

  const mesa = {
    root,
    ctx,
    match,

    /** seatId -> o painel daquele assento. */
    tiles: new Map(),
    /** seatId -> { delta, timer }: o que ainda nao virou evento. */
    pending: new Map(),
    rotOf,

    /**
     * Quanto o teclado de dano gira.
     *
     * Deitado na mesa, ele acompanha o assento de quem esta agindo - e assim
     * que a pessoa consegue ler o proprio ataque. Num computador o monitor
     * esta de pe diante de uma pessoa so, e o mesmo giro punha a tela de
     * cabeca para baixo.
     */
    rotDoPad: (seatId) => grausNaMesa(rotOf.get(seatId), apontadorPreciso()),

    /** O estado visivel e SEMPRE replay(match) - nunca editado na mao. */
    state: replay(match),
    victoryShown: false,
    destroyed: false,
    pauseTimer: null, // o primeiro sync() ja o consulta
    manaSaveTimer: null,
    /** O gesto em curso, ou null. */
    gesture: null,

    layout: layoutFor(match.seats.length, match.layoutId),

    // Preenchidos por mesa.js ao montar a tela.
    grid: null,
    fx: null,
    fxPath: null,
    fxDot: null,
    fxHead: null,
    hub: null,
    pauseView: null,
    wrap: null,
  };

  return mesa;
}

/**
 * A camada do arraste.
 *
 * Fica FORA dos paineis porque eles giram, e a seta precisa ser desenhada em
 * coordenadas de tela.
 */
export function criarCamadaDeArraste(mesa) {
  const fx = document.createElementNS(SVG_NS, 'svg');
  fx.setAttribute('class', 'attack-fx');
  const fxPath = document.createElementNS(SVG_NS, 'path');
  const fxDot = document.createElementNS(SVG_NS, 'circle');
  fxDot.setAttribute('r', '5');
  const fxHead = document.createElementNS(SVG_NS, 'path');
  fx.append(fxPath, fxDot, fxHead);

  mesa.fx = fx;
  mesa.fxPath = fxPath;
  mesa.fxDot = fxDot;
  mesa.fxHead = fxHead;
}
