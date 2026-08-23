/**
 * Agregacoes derivadas do log de eventos.
 *
 * Nada aqui e gravado: tudo e recalculado a partir do historico. Se um dia a
 * definicao de uma metrica mudar, ela muda retroativamente para todas as
 * partidas ja jogadas - que e exatamente o que se quer de um event log.
 */

import { replay, standings, deckKeyOf, deckNameOf, elapsedOf } from './engine.js';
import { t, locale } from './i18n.js';
import { seriesColor } from './colors.js';

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
    voteChoices: {}, // pergunta -> { rotulo escolhido: quantas vezes }
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
 * Percorre as partidas uma unica vez e acumula em dois recortes:
 * por deck (combinacao de comandantes) e por jogador (nome).
 */
export function aggregate(matches) {
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
        decks.set(dKey, blank(dKey, deckNameOf(seat.commanders), { commanders: seat.commanders }));
      }
      const pKey = (seat.name || '').trim().toLowerCase() || seat.id;
      if (!players.has(pKey)) players.set(pKey, blank(pKey, seat.name || 'Sem nome'));
      targets[seat.id] = [decks.get(dKey), players.get(pKey)];
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
          const pergunta = tituloDaVotacao(ev);
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

/**
 * Como chamar uma votacao que ninguem nomeou.
 *
 * "Votacao sem titulo" nao diz nada e enche a estatistica de linhas iguais. As
 * proprias opcoes ja identificam a carta melhor que qualquer rotulo generico:
 * "Silence ou Snitch" e reconhecivel na hora.
 */
export function tituloDaVotacao(ev) {
  const dado = (ev.question || '').trim();
  if (dado) return dado;
  if (ev.kind === 'numero') return t('vote.preset.number');
  const opcoes = (ev.options || []).filter(Boolean);
  return opcoes.length ? opcoes.join(' / ') : t('vote.untitled');
}

function byRelevance(a, b) {
  if (b.winrate !== a.winrate) return b.winrate - a.winrate;
  return b.games - a.games;
}

function lastTs(match) {
  return match.events.length ? match.events[match.events.length - 1].ts : match.startedAt;
}

/**
 * Dano total de uma partida, somando os tres jeitos de causar: vida com autor,
 * dano de comandante e acao em area.
 *
 * Existe como funcao porque ja existiu duas vezes - uma aqui e outra no cartaz
 * de vitoria. A copia de la nao conhecia `sweep`, entao um dreno de 5 em tres
 * oponentes aparecia como zero no fim da partida. Somar em dois lugares e
 * garantir que um dia eles discordem.
 */
export function totalDamage(match) {
  let damage = 0;
  for (const ev of match.events || []) {
    if (ev.type === 'life' && ev.delta < 0) damage -= ev.delta;
    if (ev.type === 'cmd' && ev.delta > 0) damage += ev.delta;
    if (ev.type === 'sweep') damage += ev.amount * (ev.targets || []).length;
  }
  return damage;
}

/** Cartao resumido de uma partida, para a lista do historico. */
export function summarize(match) {
  const state = replay(match);
  const winner = state.winnerId ? match.seats.find((s) => s.id === state.winnerId) : null;
  const damage = totalDamage(match);
  return {
    id: match.id,
    startedAt: match.startedAt,
    duration: elapsedOf(match, state, lastTs(match)),
    turns: state.turn,
    seats: match.seats,
    winner,
    winnerId: state.winnerId,
    totalDamage: damage,
    events: match.events.length,
    standings: standings(match, state),
    state,
  };
}

/** Linha do tempo legivel de uma partida. */
export function timeline(match) {
  const nameOf = (id) => {
    const seat = match.seats.find((s) => s.id === id);
    return seat ? seat.name : '?';
  };
  const cmdName = (key) => {
    if (!key) return t('tl.commander');
    const [seatId, oracleId] = key.split(':');
    const seat = match.seats.find((s) => s.id === seatId);
    const c = seat && seat.commanders.find((x) => x.oracleId === oracleId);
    return c ? c.name : t('tl.commander');
  };

  return match.events.map((ev) => {
    let text;
    switch (ev.type) {
      case 'life':
        if (ev.delta > 0) text = t('tl.gained', { name: nameOf(ev.targetId), n: ev.delta });
        else if (ev.sourceId) {
          text = t('tl.dealt', {
            from: nameOf(ev.sourceId), n: -ev.delta, to: nameOf(ev.targetId),
          });
        } else text = t('tl.paid', { name: nameOf(ev.targetId), n: -ev.delta });
        break;
      case 'cmd':
        text = t('tl.cmd', {
          name: nameOf(ev.targetId), n: ev.delta, cmd: cmdName(ev.cmdKey),
        });
        break;
      case 'poison':
        text = ev.sourceId && ev.delta > 0
          ? t('tl.poisonFrom', {
            from: nameOf(ev.sourceId), n: ev.delta, to: nameOf(ev.targetId),
          })
          : t('tl.poison', {
            name: nameOf(ev.targetId), n: (ev.delta > 0 ? '+' : '') + ev.delta,
          });
        break;
      case 'sweep': {
        const quantos = (ev.targets || []).length;
        const base = t('tl.sweep', {
          name: nameOf(ev.sourceId),
          n: ev.amount,
          count: quantos === 1
            ? t('damage.opponent', { n: quantos })
            : t('damage.opponents', { n: quantos }),
        });
        text = ev.gain ? t('tl.sweepGain', { base, gain: ev.gain }) : base;
        break;
      }
      case 'turn':
        text = t('tl.turn');
        break;
      case 'vote':
        text = t('tl.vote', { title: tituloDaVotacao(ev) })
          + (ev.summary ? ' — ' + ev.summary : '');
        break;
      case 'pause':
        text = t('tl.pause');
        break;
      case 'resume':
        text = t('tl.resume');
        break;
      case 'concede':
        text = t('tl.concede', { name: nameOf(ev.targetId) });
        break;
      case 'win':
        text = t('tl.win', { name: nameOf(ev.targetId) });
        break;
      default:
        text = ev.type;
    }
    return { ...ev, text };
  });
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return '--';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return h + 'h ' + String(m).padStart(2, '0') + 'm';
  if (m) return m + 'm ' + String(s).padStart(2, '0') + 's';
  return s + 's';
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(locale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function pct(v) {
  return Math.round((v || 0) * 100) + '%';
}

export function num(v, digits = 1) {
  if (!isFinite(v)) return '--';
  const rounded = Number(v).toFixed(digits);
  return rounded.replace(/\.0$/, '').replace('.', ',');
}

/**
 * Posicao de cada jogador na fila de cores, por PRIMEIRA APARICAO no historico.
 *
 * A ordem precisa ser estavel: se fosse alfabetica, cadastrar uma "Ana" mudaria
 * a cor de todo mundo depois dela, e o ponto da cor e justamente reconhecer a
 * mesma pessoa entre partidas. Por primeira aparicao, quem chega depois so
 * ganha o proximo numero da fila e ninguem antes se mexe.
 */
export function playerColorOrder(matches) {
  const ordem = new Map();
  const antigas = [...(matches || [])].sort(
    (a, b) => (a.startedAt || 0) - (b.startedAt || 0),
  );
  for (const match of antigas) {
    for (const seat of match.seats || []) {
      const chave = (seat.name || '').trim().toLowerCase();
      if (chave && !ordem.has(chave)) ordem.set(chave, ordem.size);
    }
  }
  return ordem;
}

/** Atalho: a cor de um nome, dada a ordem ja calculada. */
export function playerColor(ordem, nome) {
  const chave = (nome || '').trim().toLowerCase();
  return seriesColor(ordem.has(chave) ? ordem.get(chave) : 0);
}

/* ------------------------------------------------------------------ */
/* Rivalidades                                                         */
/* ------------------------------------------------------------------ */

function parVazio() {
  return { damage: 0, cmdDamage: 0, poison: 0, kills: 0, hits: 0 };
}

/**
 * Quem bate em quem, somado por par de JOGADORES ao longo de todas as
 * partidas.
 *
 * Nada disso precisa ser gravado: cada evento de dano ja carrega quem causou e
 * quem levou desde que o dano virou direcional. Aqui so lemos o log de outro
 * angulo - por par, e nao por pessoa.
 *
 * O par e guardado em ordem alfabetica para que A-B e B-A caiam na mesma
 * linha, e cada sentido soma no seu proprio lado.
 */
export function rivalries(matches) {
  const pares = new Map();

  const chave = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

  for (const match of matches) {
    if (!match || !match.seats) continue;

    const nome = {};
    for (const seat of match.seats) {
      nome[seat.id] = (seat.name || '').trim() || seat.id;
    }

    const par = (deId, paraId) => {
      const de = nome[deId];
      const para = nome[paraId];
      if (!de || !para || de === para) return null;

      const k = chave(de.toLowerCase(), para.toLowerCase());
      if (!pares.has(k)) {
        const [primeiro, segundo] = de.toLowerCase() < para.toLowerCase() ? [de, para] : [para, de];
        pares.set(k, {
          a: primeiro, b: segundo, games: 0, total: 0,
          aToB: parVazio(), bToA: parVazio(),
          _partidas: new Set(),
        });
      }
      const linha = pares.get(k);
      linha._partidas.add(match.id);
      return { linha, lado: de === linha.a ? linha.aToB : linha.bToA };
    };

    const somar = (deId, paraId, campo, quanto) => {
      const alvo = par(deId, paraId);
      if (!alvo) return;
      alvo.lado[campo] += quanto;
      alvo.lado.hits += 1;
      if (campo !== 'kills') alvo.linha.total += quanto;
    };

    for (const ev of match.events || []) {
      switch (ev.type) {
        case 'life':
          if (ev.sourceId && ev.delta < 0) somar(ev.sourceId, ev.targetId, 'damage', -ev.delta);
          break;
        case 'cmd':
          if (ev.sourceId && ev.delta > 0) {
            somar(ev.sourceId, ev.targetId, 'damage', ev.delta);
            const alvo = par(ev.sourceId, ev.targetId);
            if (alvo) alvo.lado.cmdDamage += ev.delta;
          }
          break;
        case 'poison':
          if (ev.sourceId && ev.delta > 0) somar(ev.sourceId, ev.targetId, 'poison', ev.delta);
          break;
        case 'sweep':
          for (const id of ev.targets || []) {
            if (ev.sourceId) somar(ev.sourceId, id, 'damage', ev.amount);
          }
          break;
        default:
          break;
      }
    }

    // Eliminacoes: quem deu o golpe final em quem.
    const estado = replay(match);
    for (const seat of match.seats) {
      const p = estado.players[seat.id];
      if (p.elim && p.elim.byId) somar(p.elim.byId, seat.id, 'kills', 1);
    }
  }

  return [...pares.values()]
    .map((linha) => {
      const { _partidas, ...resto } = linha;
      return { ...resto, games: _partidas.size };
    })
    .sort((x, y) => y.total - x.total);
}
