/**
 * A single match: its summary, the timeline and the total damage.
 *
 * The timeline reads the log event by event and writes, in the user's
 * language, what happened. That is what keeps the history readable years
 * later.
 */

import { replay, standings, elapsedOf } from '../engine.js';
import { t } from '../i18n.js';
import { lastTs } from './aggregate.js';
import { voteTitle } from './votes.js';

/**
 * Total damage of a match, adding up the three ways of dealing it: life with a
 * dealer, commander damage and area effects.
 *
 * It exists as a function because it already existed twice - once here and
 * once on the victory poster. The copy there did not know about `sweep`, so a
 * drain of 5 on three opponents showed up as zero at the end of the match.
 * Adding up in two places guarantees that one day they disagree.
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

/** Summary card of a match, for the history list. */
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

/** Readable timeline of a match. */
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
        const howMany = (ev.targets || []).length;
        // With the caster among the targets, they were "players", not
        // "opponents".
        const everyone = (ev.targets || []).includes(ev.sourceId);
        const [one, many] = everyone
          ? ['damage.player', 'damage.players']
          : ['damage.opponent', 'damage.opponents'];
        const base = t('tl.sweep', {
          name: nameOf(ev.sourceId),
          n: ev.amount,
          count: t(howMany === 1 ? one : many, { n: howMany }),
        });
        text = ev.gain ? t('tl.sweepGain', { base, gain: ev.gain }) : base;
        break;
      }
      case 'turn':
        text = t('tl.turn');
        break;
      case 'vote':
        text = t('tl.vote', { title: voteTitle(ev) })
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
    // Lifelink: the healing of the dealer, recorded in the damage event itself.
    if (ev.gain && ev.type !== 'sweep') {
      text = t('tl.lifelink', { base: text, name: nameOf(ev.sourceId), gain: ev.gain });
    }
    return { ...ev, text };
  });
}
