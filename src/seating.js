/**
 * Disposicao dos assentos na mesa.
 *
 * Separado da view de proposito: e dado puro, sem DOM, e por isso da para
 * TESTAR a propriedade que realmente importa - a ordem dos assentos, que e a
 * ordem dos turnos, precisa correr no sentido horario visto de cima.
 *
 * Horario e o certo porque em Commander a vez passa para o vizinho da
 * esquerda, e como todo mundo olha para o centro da mesa, "a esquerda de cada
 * um" desenha um giro horario na vista de cima.
 *
 * Cada contagem de jogadores tem uma ou mais variantes. Mesa de 3 e de 5 nao
 * tem arranjo obvio - depende de como a galera sentou de verdade -, entao ali
 * a escolha e do usuario. A primeira variante da lista e o padrao.
 *
 * Uma variante pode declarar `land`: a forma que ela assume com a tela
 * deitada. Com 5 ou 6 jogadores isso e essencial - a grade 2x3 que serve o
 * retrato vira tres colunas por duas linhas na paisagem, senao os paineis
 * ficam altos e estreitos e o numero de vida nao cabe. Sem `land`, a mesma
 * forma serve as duas orientacoes.
 *
 * Quem esta do outro lado da mesa aparece de cabeca para baixo (rot 180) para
 * ler o proprio painel sem girar o aparelho. So usamos 0 e 180: virar um
 * painel de lado deixaria o nome e o numero deitados.
 */

export const LAYOUTS = {
  2: [{
    id: 'padrao',
    label: 'Frente a frente',
    cols: 1, rows: 2,
    seats: [{ r: 2, c: 1, rot: 0 }, { r: 1, c: 1, rot: 180 }],
  }],

  3: [{
    id: '2-1',
    label: '2 embaixo · 1 em cima',
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
    ],
  }, {
    id: '1-2',
    label: '1 embaixo · 2 em cima',
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, cs: 2, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
    ],
  }],

  4: [{
    id: 'padrao',
    label: 'Dois a dois',
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
    ],
  }],

  5: [{
    // A celula vaga e onde o nucleo central cai: meio-esquerda em pe,
    // meio-baixo deitado.
    id: 'volta',
    label: 'Em volta (2-2-1)',
    cols: 2, rows: 3,
    seats: [
      { r: 3, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
    ],
    land: {
      cols: 3, rows: 2,
      seats: [
        { r: 2, c: 1, rot: 0 },
        { r: 1, c: 1, rot: 180 },
        { r: 1, c: 2, rot: 180 },
        { r: 1, c: 3, rot: 180 },
        { r: 2, c: 3, rot: 0 },
      ],
    },
  }, {
    // Seis colunas para caber tres embaixo e dois em cima sem sobra. Ja e uma
    // forma larga por natureza, entao serve as duas orientacoes.
    id: '3-2',
    label: 'Duas fileiras (3-2)',
    cols: 6, rows: 2,
    seats: [
      { r: 2, c: 1, cs: 2, rot: 0 },
      { r: 1, c: 1, cs: 3, rot: 180 },
      { r: 1, c: 4, cs: 3, rot: 180 },
      { r: 2, c: 5, cs: 2, rot: 0 },
      { r: 2, c: 3, cs: 2, rot: 0 },
    ],
  }],

  6: [{
    id: 'padrao',
    label: 'Três a três',
    cols: 2, rows: 3,
    seats: [
      { r: 3, c: 1, rot: 0 },
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
    ],
    land: {
      cols: 3, rows: 2,
      seats: [
        { r: 2, c: 1, rot: 0 },
        { r: 1, c: 1, rot: 180 },
        { r: 1, c: 2, rot: 180 },
        { r: 1, c: 3, rot: 180 },
        { r: 2, c: 3, rot: 0 },
        { r: 2, c: 2, rot: 0 },
      ],
    },
  }],
};

/** Todas as variantes para essa quantidade de jogadores. */
export function variantsFor(seatCount) {
  return LAYOUTS[seatCount] || LAYOUTS[4];
}

/** A variante escolhida, caindo na primeira quando o id nao existe mais. */
export function variant(seatCount, id) {
  const list = variantsFor(seatCount);
  return list.find((l) => l.id === id) || list[0];
}

/**
 * A forma concreta a desenhar: a mesma variante, na versao em pe ou deitada.
 * `wide` vem da proporcao real da tela, nao do angulo do aparelho - o que
 * importa e se ha mais largura que altura para distribuir.
 */
export function layoutFor(seatCount, id, wide = false) {
  const v = variant(seatCount, id);
  const shape = wide && v.land ? v.land : v;
  return { id: v.id, label: v.label, cols: shape.cols, rows: shape.rows, seats: shape.seats };
}

/** As formas de uma variante (uma ou duas), para varrer nos testes. */
export function shapesOf(v) {
  return v.land ? [{ nome: 'retrato', shape: v }, { nome: 'paisagem', shape: v.land }] : [{ nome: 'única', shape: v }];
}

/** Centro do assento na grade, em fracao de 0 a 1. */
export function seatCenter(spec, layout) {
  const colSpan = spec.cs || 1;
  return {
    x: (spec.c - 1 + colSpan / 2) / layout.cols,
    y: (spec.r - 1 + 0.5) / layout.rows,
  };
}

/**
 * Angulo do assento em relacao ao centro da mesa, em graus de 0 a 360.
 * Coordenada de tela tem Y para baixo, entao angulo CRESCENTE = sentido
 * horario - que e exatamente a propriedade que queremos verificar.
 */
export function seatAngle(spec, layout) {
  const { x, y } = seatCenter(spec, layout);
  const deg = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI;
  return (deg + 360) % 360;
}
