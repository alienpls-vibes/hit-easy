/**
 * Voto secreto e simultaneo.
 *
 * Nasceu do Prisoner's Dilemma ("cada oponente escolhe em segredo silence ou
 * snitch"), mas o espaco de cartas e maior e tem duas familias:
 *
 *   ESCOLHA SECRETA  Prisoner's Dilemma, Call to the Void, Menacing Ogre,
 *                    Wheel of Misfortune, Itazura. Todo mundo escolhe ao mesmo
 *                    tempo e revela junto. As vezes a escolha e uma OPCAO
 *                    nomeada, as vezes e um NUMERO qualquer - e ai o que
 *                    importa e quem tirou o maior e o menor.
 *
 *   VOTACAO          will of the council / council's dilemma: Coercive Portal,
 *                    Council Guardian, Council's Judgment e companhia. Pelas
 *                    regras o voto e aberto e em ordem de turno, mas na mesa
 *                    quase todo mundo prefere simultaneo - e alguns efeitos dao
 *                    VOTOS EXTRAS a um jogador (Brago's Representative).
 *
 * Dai os tres eixos deste modulo: `kind` ('opcoes' ou 'numero'), quem participa
 * (nem sempre a mesa toda - Prisoner's Dilemma e so oponentes) e quantos votos
 * cada um tem.
 *
 * Sem DOM de proposito: a apuracao e a parte que precisa estar certa, e ela e
 * testavel sozinha.
 */

import { t } from './i18n.js';

/**
 * Modelos prontos para as cartas mais comuns.
 *
 * `label` e getter porque o idioma pode mudar depois que o modulo carregou -
 * um texto fixo aqui ficaria congelado no idioma da primeira carga.
 */
export const PRESETS = [
  {
    id: 'duas',
    get label() { return t('vote.preset.two'); },
    kind: 'opcoes',
    options: ['Sim', 'Não'],
    excludeActive: false,
  },
  {
    id: 'dilema',
    label: "Prisoner's Dilemma",
    // Preenche a pergunta sozinho: sem titulo, a estatistica depois vira uma
    // pilha de linhas iguais e indistinguiveis.
    title: "Prisoner's Dilemma",
    kind: 'opcoes',
    options: ['Silence', 'Snitch'],
    excludeActive: true, // "cada oponente", nao a mesa toda
  },
  {
    id: 'numero',
    get label() { return t('vote.preset.number'); },
    kind: 'numero',
    options: [],
    excludeActive: false,
  },
  {
    id: 'jogador',
    get label() { return t('vote.preset.player'); },
    kind: 'opcoes',
    options: [], // preenchido com os nomes da mesa
    fromPlayers: true,
    excludeActive: false,
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

/**
 * `voters` e [{ id, name, votes }]. `votes` cobre os efeitos que dao voto
 * extra; o padrao e 1.
 */
export function createSession({ question = '', kind = 'opcoes', options = [], voters = [] }) {
  return {
    question,
    kind,
    options: [...options],
    voters: voters.map((v) => ({ id: v.id, name: v.name, votes: Math.max(1, v.votes || 1) })),
    ballots: {}, // voterId -> array de escolhas
  };
}

/** Registra o voto de alguem. Em 'numero', `choices` e [n]. */
export function cast(session, voterId, choices) {
  session.ballots[voterId] = [...choices];
  return session;
}

/** Quem ainda nao votou, na ordem em que devem receber o aparelho. */
export function pending(session) {
  return session.voters.filter((v) => !session.ballots[v.id]);
}

export function isComplete(session) {
  return pending(session).length === 0;
}

/**
 * Apuracao.
 *
 * Em 'opcoes' devolve as opcoes ordenadas por votos, quem votou em cada uma, e
 * dois fatos derivados que as cartas realmente perguntam: houve EMPATE no topo,
 * e a escolha foi UNANIME (Prisoner's Dilemma pergunta exatamente isso -
 * "se cada oponente escolheu silence...").
 *
 * Em 'numero' devolve os valores por jogador com o maior e o menor, empates
 * incluidos - que e o que Menacing Ogre e Wheel of Misfortune precisam.
 */
export function tally(session) {
  if (session.kind === 'numero') return tallyNumbers(session);

  const rows = session.options.map((label, index) => ({
    index,
    label,
    votes: 0,
    voters: [],
  }));

  let total = 0;
  for (const voter of session.voters) {
    for (const escolha of session.ballots[voter.id] || []) {
      const row = rows[escolha];
      if (!row) continue;
      row.votes += 1;
      total += 1;
      if (!row.voters.includes(voter.name)) row.voters.push(voter.name);
    }
  }

  const ordenadas = [...rows].sort((a, b) => b.votes - a.votes || a.index - b.index);
  const maisVotos = ordenadas.length ? ordenadas[0].votes : 0;
  const top = ordenadas.filter((r) => r.votes === maisVotos && maisVotos > 0).map((r) => r.index);

  return {
    kind: 'opcoes',
    rows: ordenadas,
    total,
    top,
    tie: top.length > 1,
    unanimous: top.length === 1 && maisVotos === total && total > 0,
  };
}

function tallyNumbers(session) {
  const rows = session.voters.map((v) => ({
    voterId: v.id,
    name: v.name,
    value: Number((session.ballots[v.id] || [0])[0]) || 0,
  }));

  const valores = rows.map((r) => r.value);
  const maior = valores.length ? Math.max(...valores) : 0;
  const menor = valores.length ? Math.min(...valores) : 0;

  return {
    kind: 'numero',
    rows: [...rows].sort((a, b) => b.value - a.value),
    highest: rows.filter((r) => r.value === maior).map((r) => r.voterId),
    lowest: rows.filter((r) => r.value === menor).map((r) => r.voterId),
    maior,
    menor,
    // Todo mundo no mesmo numero: nao ha maior nem menor de verdade.
    allEqual: maior === menor && rows.length > 1,
  };
}

/** Resumo de uma linha, para o histórico e para a linha do tempo. */
export function describe(session, resultado) {
  const r = resultado || tally(session);
  if (r.kind === 'numero') {
    return r.rows.map((x) => x.name + ' ' + x.value).join(' · ');
  }
  return r.rows.filter((x) => x.votes > 0).map((x) => x.label + ' ' + x.votes).join(' × ')
    || 'sem votos';
}
