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
 * Com 2, 3 e 5 jogadores a escolha e da pessoa, e a pergunta que ela responde
 * e concreta: o aparelho vai ficar EM PE ou DEITADO no meio da mesa? Era essa
 * a decisao real o tempo todo - "2 embaixo, 1 em cima" descrevia a consequencia
 * de uma escolha que ninguem tinha feito ainda. Cada variante dessas declara
 * `orient`, e a partida passa a pedir essa orientacao.
 *
 * Com 4 e 6 nao ha o que escolher: quatro e simetrico, e seis e tres de cada
 * lado. Essas duas seguem se adaptando sozinhas pela proporcao da tela, e por
 * isso ainda usam `land` - a grade 2x3 que serve o retrato vira tres colunas
 * por duas linhas na paisagem, senao os paineis ficam altos e estreitos e o
 * numero de vida nao cabe.
 *
 * Quem esta do outro lado da mesa aparece de cabeca para baixo (rot 180) para
 * ler o proprio painel sem girar o aparelho. So usamos 0 e 180: virar um
 * painel de lado deixaria o nome e o numero deitados.
 */

export const LAYOUTS = {
  2: [{
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    cols: 1, rows: 2,
    seats: [{ r: 2, c: 1, rot: 0 }, { r: 1, c: 1, rot: 180 }],
  }, {
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // A mesma pilha de dois, agora larga e baixa. Duas pessoas de frente uma
    // para a outra ficam nos lados opostos do aparelho de qualquer jeito; o
    // que muda e o formato do painel de cada uma.
    cols: 1, rows: 2,
    seats: [{ r: 2, c: 1, rot: 0 }, { r: 1, c: 1, rot: 180 }],
  }],

  3: [{
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    // Em pe, sobra altura: duas pessoas do lado de ca, uma do lado de la.
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, cs: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
    ],
  }, {
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // Deitado, sobra largura: duas do lado de la, uma ocupando a faixa de ca.
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, cs: 2, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
    ],
  }],

  4: [{
    id: 'padrao',
    labelKey: 'layout.pairs',
    cols: 2, rows: 2,
    seats: [
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
    ],
  }],

  5: [{
    id: 'retrato',
    orient: 'portrait',
    labelKey: 'layout.portrait',
    // Duas colunas por tres linhas. A celula vaga e onde o nucleo central cai.
    cols: 2, rows: 3,
    seats: [
      { r: 3, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 2, c: 2, rot: 0 },
      { r: 3, c: 2, rot: 0 },
    ],
  }, {
    id: 'paisagem',
    orient: 'landscape',
    labelKey: 'layout.landscape',
    // Tres colunas por duas linhas: tres do lado de la, dois do lado de ca.
    // Em pe esta forma daria paineis altos e estreitos, e o numero de vida nao
    // caberia - por isso ela so existe deitada.
    cols: 3, rows: 2,
    seats: [
      { r: 2, c: 1, rot: 0 },
      { r: 1, c: 1, rot: 180 },
      { r: 1, c: 2, rot: 180 },
      { r: 1, c: 3, rot: 180 },
      { r: 2, c: 3, rot: 0 },
    ],
  }],

  6: [{
    id: 'padrao',
    labelKey: 'layout.threes',
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

/**
 * Nomes antigos de variante.
 *
 * Partida salva - e partida EM ANDAMENTO - guarda o id que existia quando ela
 * comecou. Sem isto, atualizar o app no meio de um jogo de tres jogadores
 * jogaria a mesa no padrao e trocaria as pessoas de lugar, sem aviso.
 *
 * Tres dos quatro casos caem no arranjo identico ao antigo; so o '3-2' de cinco
 * nao tem equivalente exato, e vai para a forma deitada, que e a mais parecida.
 */
const APELIDOS = {
  '2-1': 'retrato',    // 3: duas embaixo, uma em cima - mesmo desenho
  '1-2': 'paisagem',   // 3: uma embaixo, duas em cima - mesmo desenho
  volta: 'retrato',    // 5: duas colunas por tres linhas - mesmo desenho
  '3-2': 'paisagem',   // 5: sem equivalente exato; a deitada e a mais proxima
};

/** A variante escolhida, caindo na primeira quando o id nao existe mais. */
export function variant(seatCount, id) {
  const list = variantsFor(seatCount);
  const alvo = APELIDOS[id] || id;
  return list.find((l) => l.id === alvo) || list[0];
}

/**
 * A forma concreta a desenhar: a mesma variante, na versao em pe ou deitada.
 * `wide` vem da proporcao real da tela, nao do angulo do aparelho - o que
 * importa e se ha mais largura que altura para distribuir.
 */
export function layoutFor(seatCount, id, wide = false) {
  const v = variant(seatCount, id);
  // Variante que JA declara orientacao nao troca de forma com a tela: foi a
  // pessoa que disse como o aparelho fica na mesa, e o app e que deve seguir a
  // escolha dela - nao adivinhar pela proporcao e desmentir o que ela pediu.
  const shape = !v.orient && wide && v.land ? v.land : v;
  return {
    id: v.id,
    labelKey: v.labelKey,
    orient: v.orient || null,
    cols: shape.cols,
    rows: shape.rows,
    seats: shape.seats,
  };
}

/**
 * Como o aparelho deve ficar nesta mesa.
 *
 * `null` quando a variante nao se importa - com 4 ou 6 a forma se adapta
 * sozinha, e travar a orientacao ali so tiraria liberdade de quem joga.
 */
export function orientOf(seatCount, id) {
  return variant(seatCount, id).orient || null;
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
