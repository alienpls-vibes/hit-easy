/**
 * Rivalries: each row is a PAIR of players.
 *
 * None of this had to be stored. Ever since damage became directional, each
 * event already carries who dealt it and who took it - the aggregation just
 * reads the same log per pair, instead of per person. Damage with no dealer
 * (life paid) creates no rivalry with anyone.
 */

import { el } from '../../ui.js';
import { rivalPeople, rivalBetween, orientRival } from '../../stats.js';
import { t, tn } from '../../i18n.js';

// Who is selected in the rivalry filters. Outside the render because the
// screen redraws entirely when hiding a player or deleting a match, and losing
// the chosen comparison on every change would be unbearable.
let rivalA = null;

let rivalB = null;

/**
 * The rivalries tab: you pick the pair, and only it shows.
 *
 * The tab used to dump ALL the pairs. At a table of five that already makes
 * ten cards, and after a few nights the comparison that matters is lost among
 * nine others nobody asked for. A rivalry is a question about two specific
 * people - the screen now asks which.
 */
export function rivalsTab(pairs, colorOf, repaint) {
  const people = rivalPeople(pairs);

  // No choice yet: start with the top pair, which has the most friction. A
  // screen that opens empty would force touching two fields before seeing
  // anything.
  //
  // The condition is "does this person still exist?", not "does this
  // combination have a chart?". Resetting on an empty combination undid the
  // choice halfway: when switching the left field to whoever was already on
  // the right, both fields went back to the initial pair by themselves - and
  // it was impossible to reach the inverted pair, which was exactly what you
  // wanted to see.
  const known = (k) => people.some((g) => g.key === k);
  if (!known(rivalA) || !known(rivalB)) {
    rivalA = pairs[0].keyA;
    rivalB = pairs[0].keyB;
  }

  const box = el('div', { class: 'rival-filters' });

  const field = (which, chosen, onSwitch) => {
    const sel = el('select', { class: 'rival-select', 'aria-label': which });
    people.forEach((g) => {
      const op = el('option', { value: g.key, text: g.label });
      if (g.key === chosen) op.setAttribute('selected', '');
      sel.append(op);
    });
    sel.addEventListener('change', (e) => { onSwitch(e.target.value); repaint(); });
    return el('label', { class: 'rival-field' }, [
      el('span', { class: 'menu-sub', text: which }),
      sel,
    ]);
  };

  box.append(
    field(t('stats.rivalA'), rivalA, (v) => { rivalA = v; }),
    el('span', { class: 'rival-vs', text: 'vs' }),
    field(t('stats.rivalB'), rivalB, (v) => { rivalB = v; }),
  );

  const outer = el('div', { class: 'rival-tab' }, [box]);

  if (rivalA === rivalB) {
    outer.append(el('p', { class: 'search-status', text: t('stats.rivalSame') }));
    return outer;
  }

  const pair = rivalBetween(pairs, rivalA, rivalB);
  if (!pair) {
    // Being on the list does not guarantee having crossed paths with everyone.
    outer.append(el('p', { class: 'search-status', text: t('stats.rivalNone') }));
    return outer;
  }

  // The left field rules the left side of the chart.
  outer.append(rivalCard(orientRival(pair, rivalA), colorOf));
  return outer;
}

/**
 * A pair and what happened between the two.
 *
 * The middle bar shows the imbalance: whoever hit more takes more space. It is
 * the number that answers "who chases whom" at a glance.
 */
function rivalCard(r, colorOf) {
  const total = r.total || 1;
  const sideA = Math.round((r.aToB.damage / total) * 100);

  const column = (name, key, side, align) => el('div', {
    class: 'rival-side' + (align === 'end' ? ' is-end' : ''),
    style: { '--accent': colorOf(key) },
  }, [
    el('span', { class: 'rival-name', text: name }),
    el('span', { class: 'rival-damage', text: String(side.damage) }),
    el('span', {
      class: 'rival-extra',
      text: [
        side.kills ? tn(side.kills, 'stats.rivalKill', 'stats.rivalKills') : '',
        side.cmdDamage ? t('stats.rivalCmd', { n: side.cmdDamage }) : '',
        side.poison ? t('stats.rivalPoison', { n: side.poison }) : '',
      ].filter(Boolean).join(' · '),
    }),
  ]);

  return el('article', {
    class: 'card rival-card',
    style: { '--rival-b': colorOf(r.keyB) },
  }, [
    el('div', { class: 'rival-head' }, [
      column(r.a, r.keyA, r.aToB),
      el('span', { class: 'rival-vs', text: 'vs' }),
      column(r.b, r.keyB, r.bToA, 'end'),
    ]),
    el('div', { class: 'rival-bar' }, [
      el('div', {
        class: 'rival-bar-a',
        style: { width: sideA + '%', background: colorOf(r.keyA) },
      }),
    ]),
    el('span', {
      class: 'rival-foot',
      text: t(r.games === 1 ? 'stats.rivalGame' : 'stats.rivalGames', {
        n: r.games, damage: r.total,
      }),
    }),
  ]);
}

export function emptyRivals() {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty-title', text: t('stats.noRivals') }),
    el('p', {
      class: 'empty-sub',
      text: t('stats.noRivalsSub'),
    }),
  ]);
}
