/**
 * Uma partida so: o resumo dela, a linha do tempo e o dano total.
 *
 * A linha do tempo le o log evento por evento e escreve em portugues o que
 * aconteceu. E o que deixa o historico legivel anos depois.
 */

import { replay, standings, elapsedOf } from '../engine.js';
import { t } from '../i18n.js';
import { lastTs } from './agregar.js';
import { tituloDaVotacao } from './votacoes.js';

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
