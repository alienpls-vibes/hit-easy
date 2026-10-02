/**
 * As medidas do gesto, e as cores de mana.
 *
 * Os tempos sao o coracao da gramatica de toque da mesa, e mexer neles muda o
 * que cada gesto SIGNIFICA - por isso ficam juntos, num arquivo que se abre
 * para ajustar exatamente isso.
 */

export const COMMIT_MS = 900;

// No CENTRO do painel, acima disso o toque deixa de ser toque e vira
// ataque. Nas bordas quem manda e HOLD_DELAY, porque la segurar repete.
export const TAP_MAX = 260;

// Quanto tempo segurando antes de a repeticao comecar. Maior que TAP_MAX
// de proposito: entre os dois, um toque lento continua sendo um toque.
export const HOLD_DELAY = 380;

// Cadencia do "segurar repete". Vale nos botoes de ajuste (teclado de dano,
// marcador de mana) e nas bordas do painel na mesa - segurar tem de significar
// a mesma velocidade nos dois, senao a mesma mesa responde de dois jeitos.
export const REPEAT_MS = 110;
export const REPEAT_FAST_MS = 55;

// Quantos passos na cadencia lenta antes de acelerar. Oito da tempo de largar
// quando foi sem querer, e nao faz esperar quem quer tirar 40 de uma vez.
export const REPEAT_ACCEL_AFTER = 8;

export const DRAG_THRESHOLD = 14; // px antes de um toque virar arraste

// janela do duplo toque, que abre a acao em area
export const DOUBLE_TAP_MS = 280;

// A vida contando ate o novo valor, quando o dano vem de um painel.
//
// Duracao total fixa: tirar 28 conta rapido e tirar 2 conta devagar, que e o
// que faz a animacao durar sempre o mesmo tanto. O passo minimo existe para a
// mudanca pequena ser VISTA - sem ele, tirar 2 seria um pisca.
export const CONTAGEM_MS = 420;
export const CONTAGEM_PASSO_MIN = 26;

export const SVG_NS = 'http://www.w3.org/2000/svg';

// Ordem WUBRG, e incolor por ultimo - a mesma que toda carta usa.
export const MANA = [
  'W', 'U', 'B', 'R', 'G', 'C',
];

export const MANA_ZERO = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
