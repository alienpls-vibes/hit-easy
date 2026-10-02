/**
 * A agregacao: o historico de partidas virando numero por deck e por jogador.
 *
 * Uma passada so pelo log de todas as partidas. Nada aqui e gravado - todo
 * numero sai do log, sempre, e e por isso que corrigir uma partida antiga
 * corrige a estatistica inteira sem migracao nenhuma.
 */

import {
  replay, standings, deckKeyOf, deckNameOf, elapsedOf,
} from '../engine.js';
import { categoriaDaVotacao } from './votacoes.js';

function blank(key, label, extra = {}) {
  return {
    key,
    label,
    games: 0,
    wins: 0,
    damageDealt: 0,
    damageTaken: 0,
    lifePaid: 0, // vida perdida sem autor: custo pago pelo proprio jogador
    healed: 0,
    cmdDealt: 0,
    cmdTaken: 0,
    poisonDealt: 0,
    poisonTaken: 0,
    kills: 0,
    deaths: 0,
    turnsTaken: 0,
    survivedTurns: 0,
    placeSum: 0,
    timeOnTurn: 0,
    matchTime: 0,
    winReasons: {},  // motivo declarado -> quantas vitorias assim
    votes: 0,        // quantas votacoes secretas este jogador participou
    voteChoices: {}, // categoria -> { rotulo escolhido: quantas vezes }
    ...extra,
  };
}

function finalize(row) {
  const g = row.games || 1;
  return {
    ...row,
    winrate: row.games ? row.wins / row.games : 0,
    avgDamageDealt: row.damageDealt / g,
    avgDamageTaken: row.damageTaken / g,
    avgLifePaid: row.lifePaid / g,
    avgHealed: row.healed / g,
    avgKills: row.kills / g,
    avgTurns: row.turnsTaken / g,
    avgSurvived: row.survivedTurns / g,
    avgPlace: row.placeSum / g,
    avgTurnTime: row.turnsTaken ? row.timeOnTurn / row.turnsTaken : 0,
    avgMatchTime: row.matchTime / g,
  };
}

/**
 * A identidade de um assento, estavel entre mesas.
 *
 * Antes a estatistica usava o NOME digitado, em minusculas. Isso significa que
 * "Alex" numa quinta e "Alexandre" na outra viravam duas pessoas diferentes, com
 * duas linhas, duas cores e duas historias - e a rivalidade entre elas era
 * contada como se fossem estranhos. O nome e como a mesa chama alguem naquele
 * dia; nao e quem a pessoa e.
 *
 * Quando ha conta vinculada, e ela que manda, e o nome passa a ser so rotulo.
 * O prefixo `@` impede que uma conta chamada `ana` colida com alguem que
 * digitou "ana" sem conta nenhuma - sao pessoas diferentes ate prova em
 * contrario.
 *
 * `apelidos` e o que o APARELHO ja sabe: nome (minusculo) -> handle. Serve para
 * partidas gravadas antes de existir @, que assim se juntam a conta certa em vez
 * de ficarem orfas para sempre.
 */
export function identityOf(seat, apelidos) {
  if (!seat) return '?';
  const h = String(seat.handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (h) return '@' + h;

  const nome = String(seat.name || '').trim().toLowerCase();
  if (nome && apelidos) {
    const lembrado = apelidos[nome] || (apelidos.get ? apelidos.get(nome) : null);
    if (lembrado) return '@' + String(lembrado).trim().replace(/^@+/, '').toLowerCase();
  }
  return nome || seat.id || '?';
}

/**
 * Como esta pessoa aparece na tela.
 *
 * Com conta vinculada, o @ - e nao o nome digitado. O @ e o unico rotulo que
 * significa a mesma coisa em todo aparelho: o nome e o que ALGUEM digitou
 * naquele dia, e dois aparelhos digitam diferente. Enquanto o nome ganhava
 * aqui, a mesma pessoa aparecia como "Alex" numa linha e "Alexandre" noutra
 * mesmo com a identidade por baixo ja unificada.
 *
 * `apelidos` entra porque a conta pode nao estar na cadeira e sim no mapa do
 * aparelho (partida gravada antes de existir @). Nesse caso a linha tambem
 * mostra o @, senao a mesma pessoa voltaria a ter dois rotulos.
 *
 * Sem conta, o nome digitado - com a caixa original, que e como a mesa escreve.
 */
export function labelOf(seat, apelidos) {
  const identidade = identityOf(seat, apelidos);
  if (identidade.startsWith('@')) return identidade;

  const nome = String((seat && seat.name) || '').trim();
  return nome || 'Sem nome';
}

/**
 * O nome digitado, quando ele diz algo que o rotulo nao diz.
 *
 * Serve a linha "registrado como" no detalhe da partida: com conta, a tela
 * mostra @alex, e isto responde "mas naquela mesa escreveram Alexandre". Vazio
 * quando o rotulo ja E o nome, porque ai repetir nao informa nada.
 */
export function nomeRegistrado(seat, apelidos) {
  const nome = String((seat && seat.name) || '').trim();
  if (!nome) return '';
  return labelOf(seat, apelidos) === nome ? '' : nome;
}

/**
 * Percorre as partidas uma unica vez e acumula em dois recortes:
 * por deck (combinacao de comandantes) e por jogador (identidade).
 */
export function aggregate(matches, apelidos = null) {
  const decks = new Map();
  const players = new Map();

  for (const match of matches) {
    if (!match || !match.seats || !match.seats.length) continue;
    const state = replay(match);
    const places = new Map(standings(match, state).map((s) => [s.seatId, s.place]));
    const duration = elapsedOf(match, state, lastTs(match));

    // Um assento contribui para a linha do seu deck E para a linha do seu jogador.
    const targets = {};
    for (const seat of match.seats) {
      const dKey = deckKeyOf(seat.commanders);
      if (!decks.has(dKey)) {
        decks.set(dKey, blank(dKey, deckNameOf(seat.commanders), {
          commanders: seat.commanders,
          // Quem levou este deck. A linha agrega todo mundo, que e o certo -
          // em Commander o mesmo deck passa de mao em mao -, mas sem esta
          // lista nao da para responder "quais decks o Bruno joga".
          jogadores: [],
        }));
      }
      // A primeira partida encontrada define o rotulo, e o historico vem do
      // mais recente para o mais antigo - entao a linha mostra o nome que a
      // pessoa usou por ultimo, que e o que a mesa vai reconhecer.
      const pKey = identityOf(seat, apelidos);
      if (!players.has(pKey)) {
        players.set(pKey, blank(pKey, labelOf(seat, apelidos), { nomes: [] }));
      }
      // Os nomes digitados que esta pessoa ja teve, do mais recente para o mais
      // antigo. Com conta, o rotulo e o @, e sem isto nao haveria como dizer
      // "e a mesma pessoa que voces chamavam de Alexandre".
      const pRow = players.get(pKey);
      const nomeDito = String(seat.name || '').trim();
      if (nomeDito && !pRow.nomes.includes(nomeDito)) pRow.nomes.push(nomeDito);

      const dRow = decks.get(dKey);
      if (!dRow.jogadores.includes(pKey)) dRow.jogadores.push(pKey);
      targets[seat.id] = [dRow, pRow];
    }

    const bump = (seatId, field, amount) => {
      const rows = targets[seatId];
      if (rows) rows.forEach((r) => { r[field] += amount; });
    };

    /**
     * Escolhas em votacao secreta.
     *
     * Agrupado por PERGUNTA e nao so por rotulo: "Silence" do Prisoner's
     * Dilemma e "Sim" de um voto qualquer nao contam a mesma historia, e
     * misturar os dois num monte so nao diria nada sobre nenhum.
     */
    const registrarVoto = (seatId, pergunta, rotulos) => {
      const rows = targets[seatId];
      if (!rows) return;
      rows.forEach((r) => {
        r.votes += 1;
        const grupo = r.voteChoices[pergunta] || (r.voteChoices[pergunta] = {});
        rotulos.forEach((l) => { grupo[l] = (grupo[l] || 0) + 1; });
      });
    };

    for (const seat of match.seats) {
      const p = state.players[seat.id];
      bump(seat.id, 'games', 1);
      bump(seat.id, 'turnsTaken', p.turnsTaken);
      bump(seat.id, 'timeOnTurn', p.timeOnTurn);
      bump(seat.id, 'matchTime', duration);
      bump(seat.id, 'placeSum', places.get(seat.id) || match.seats.length);
      bump(seat.id, 'survivedTurns', p.elim ? p.elim.turn : state.turn);
      if (p.dead) bump(seat.id, 'deaths', 1);
      if (state.winnerId === seat.id) bump(seat.id, 'wins', 1);
      // Motivo so existe quando a mesa declarou na mao; vitoria por ultimo
      // vivo nao inventa causa nenhuma.
      const declarada = (match.events || []).find(
        (e) => e.type === 'win' && e.targetId === seat.id && e.reason,
      );
      if (declarada) {
        const linhas = targets[seat.id];
        if (linhas) {
          linhas.forEach((r) => {
            r.winReasons[declarada.reason] = (r.winReasons[declarada.reason] || 0) + 1;
          });
        }
      }
      if (p.elim && p.elim.byId) bump(p.elim.byId, 'kills', 1);
    }

    for (const ev of match.events) {
      switch (ev.type) {
        case 'life':
          // Com autor e dano levado; sem autor e vida que a pessoa pagou por
          // conta propria (fetchland, Necropotence, custo de habilidade).
          if (ev.delta < 0) {
            if (ev.sourceId) {
              bump(ev.targetId, 'damageTaken', -ev.delta);
              bump(ev.sourceId, 'damageDealt', -ev.delta);
            } else {
              bump(ev.targetId, 'lifePaid', -ev.delta);
            }
          } else if (ev.delta > 0) {
            bump(ev.targetId, 'healed', ev.delta);
          }
          break;
        case 'cmd':
          if (ev.delta > 0) {
            bump(ev.targetId, 'cmdTaken', ev.delta);
            bump(ev.targetId, 'damageTaken', ev.delta);
            if (ev.sourceId) {
              bump(ev.sourceId, 'cmdDealt', ev.delta);
              bump(ev.sourceId, 'damageDealt', ev.delta);
            }
          }
          break;
        case 'poison':
          if (ev.delta > 0) {
            bump(ev.targetId, 'poisonTaken', ev.delta);
            if (ev.sourceId) bump(ev.sourceId, 'poisonDealt', ev.delta);
          }
          break;
        case 'vote': {
          // Agrupa pela CATEGORIA: e ela que diz o que a pessoa costuma
          // escolher. A traducao so acontece na tela.
          const pergunta = categoriaDaVotacao(ev);
          for (const cedula of ev.ballots || []) {
            const rotulos = (cedula.choices || []).map((c) => (
              ev.kind === 'numero' ? String(c) : (ev.options || [])[c]
            )).filter((x) => x !== undefined && x !== '');
            if (rotulos.length) registrarVoto(cedula.seatId, pergunta, rotulos);
          }
          break;
        }
        case 'sweep':
          // O evento ja carrega quem foi atingido, entao a soma nao depende de
          // reconstruir quem estava vivo naquele instante.
          for (const id of ev.targets || []) {
            bump(id, 'damageTaken', ev.amount);
            if (ev.sourceId) bump(ev.sourceId, 'damageDealt', ev.amount);
          }
          if (ev.gain && ev.sourceId) bump(ev.sourceId, 'healed', ev.gain);
          break;
        default:
          break;
      }
    }
  }

  return {
    decks: [...decks.values()].map(finalize).sort(byRelevance),
    players: [...players.values()].map(finalize).sort(byRelevance),
  };
}

function byRelevance(a, b) {
  if (b.winrate !== a.winrate) return b.winrate - a.winrate;
  return b.games - a.games;
}

export function lastTs(match) {
  return match.events.length ? match.events[match.events.length - 1].ts : match.startedAt;
}
