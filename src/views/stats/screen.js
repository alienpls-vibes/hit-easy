/**
 * The statistics screen: the tabs, and which one is open.
 *
 * Each tab draws with pieces from its own files in this folder. The active tab
 * lives here because it is SCREEN state, not content state: switching tabs
 * reloads no data, it only switches what is drawn.
 */

import { el, clear, icon } from '../../ui.js';
import {
  aggregate, rivalries, summarize, formatDuration, playerColorOrder,
  playerColor, SORTS, sortRows,
} from '../../stats.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import { openData } from './backup.js';
import { deckCard } from './deck.js';
import { playerCard } from './player.js';
import { matchCard } from './match.js';
import { emptyState, miniStat } from './widgets.js';
import { emptyRivals, rivalsTab } from './rivalries.js';

const TABS = [
  { id: 'decks', key: 'stats.decks' },
  { id: 'players', key: 'stats.players' },
  { id: 'rivals', key: 'stats.rivals' },
  { id: 'matches', key: 'stats.matches' },
];

let activeTab = 'decks';

/**
 * Whom the Decks tab is filtered by. 'all' is the default.
 *
 * Outside the function, like the active tab: switching tabs and coming back
 * should not undo the filter the person just picked.
 */
let deckFilter = 'all';

/**
 * Which number the Decks and Players lists are sorted by.
 *
 * One variable for both tabs, not one per tab: the rows of both come from the
 * same aggregation and have the same fields, so "sorted by matches" means the
 * same thing in both. With one per tab, switching tabs would change the order
 * without anyone asking.
 */
let sortId = SORTS[0].id;

/**
 * The player picker of the Decks tab.
 *
 * A native `<select>`, not chips side by side: the list grows with the group,
 * and ten names do not fit on a phone row. As a bonus it gives the picker the
 * device already uses everywhere - same argument as the language field.
 *
 * It only shows with more than one person in the history: filtering among one
 * filters nothing, and the control would be decoration.
 */
function playerFilter(players, repaint) {
  const field = el('select', {
    class: 'select-input',
    'aria-label': t('stats.filterByPlayer'),
    onChange: (e) => { deckFilter = e.target.value; repaint(); },
  }, [
    el('option', {
      value: 'all',
      text: t('stats.allPlayers'),
      selected: deckFilter === 'all' ? 'selected' : null,
    }),
    ...players.map((p) => el('option', {
      value: p.key,
      text: p.label,
      selected: deckFilter === p.key ? 'selected' : null,
    })),
  ]);

  field.value = deckFilter;
  return control(t('stats.filterByPlayer'), field);
}

/**
 * Which number to sort by.
 *
 * Same argument as the filter for the native `<select>`. It only shows with
 * more than one row: sorting a list of one sorts nothing.
 *
 * The win-rate option has the usual trap - a deck with one won match comes
 * before one with ten and eight wins. The tiebreak by matches softens it among
 * equals, but 100% of one match is still 100%; it is what the person asked for
 * when choosing the rate, and the matches column is on the card next to the
 * number for whoever reads carefully.
 */
function sortPicker(repaint) {
  const field = el('select', {
    class: 'select-input',
    'aria-label': t('stats.sortBy'),
    onChange: (e) => { sortId = e.target.value; repaint(); },
  }, SORTS.map((o) => el('option', {
    value: o.id,
    text: t(o.label),
    selected: sortId === o.id ? 'selected' : null,
  })));

  field.value = sortId;
  return control(t('stats.sortBy'), field);
}

/** A `<select>` with a visible label, as wide as the column allows. */
function control(label, field) {
  return el('label', { class: 'stats-control' }, [
    el('span', { class: 'control-label', text: label }),
    el('span', { class: 'select-row' }, [
      field,
      el('span', { class: 'select-caret' }, [icon('arrow')]),
    ]),
  ]);
}

/** The strip of controls above the list. Empty, it is not drawn. */
function controlBar(parts) {
  const useful = parts.filter(Boolean);
  if (!useful.length) return null;
  return el('div', { class: 'stats-controls' }, useful);
}

/** The filtered person brought no deck that is still on the list. */
function noDecksForPlayer() {
  return el('p', { class: 'search-status', text: t('stats.noDecksForPlayer') });
}

export function renderStats(root, { onBack }) {
  clear(root);
  const matches = store.matches();

  // The device knows which account each name belongs to; that joins matches
  // recorded before the @ existed with the right account.
  const aliases = store.knownHandles();
  const raw = aggregate(matches, aliases);
  const reload = () => renderStats(root, { onBack });

  // Hiding removes the ROW from the list, not the data: the damage this person
  // dealt keeps adding up for whoever took it, and the timeline stays complete.
  const agg = {
    decks: raw.decks.filter((d) => !store.isDeckHidden(d.key)),
    players: raw.players.filter((p) => !store.isPlayerHidden(p.key)),
  };
  // One color per person, stable across matches: that is what lets you
  // recognize the same player at a glance. Decks keep the commander identity.
  const colorOrder = playerColorOrder(matches, aliases);
  const colorOf = (key) => playerColor(colorOrder, key);

  const rivals = rivalries(matches, aliases).filter(
    (r) => !store.isPlayerHidden(r.keyA) && !store.isPlayerHidden(r.keyB),
  );

  const panel = el('div', { class: 'stats-panel' });

  const tabBar = el('div', { class: 'tabs' }, TABS.map((tab) =>
    el('button', {
      class: 'tab' + (activeTab === tab.id ? ' is-on' : ''),
      onClick: (e) => {
        activeTab = tab.id;
        tabBar.querySelectorAll('.tab').forEach((x) => x.classList.remove('is-on'));
        e.currentTarget.classList.add('is-on');
        paint();
      },
    }, [t(tab.key)]),
  ));

  function paint() {
    clear(panel);
    if (!matches.length) {
      panel.append(emptyState());
      return;
    }
    if (activeTab === 'decks') {
      // A player who left the filter (hidden, or deleted along with the match)
      // cannot leave the tab empty and unexplained: the filter goes back to All.
      if (deckFilter !== 'all'
        && !agg.players.some((p) => p.key === deckFilter)) {
        deckFilter = 'all';
      }

      const chosen = deckFilter === 'all'
        ? agg.decks
        : agg.decks.filter((d) => (d.playerKeys || []).includes(deckFilter));

      // Sort AFTER filtering: sorting first would spend the comparison on rows
      // the screen will not show, and the top of the list would be the top of
      // the whole group instead of the top of what is on screen.
      const bar = controlBar([
        agg.players.length > 1 ? playerFilter(agg.players, paint) : null,
        chosen.length > 1 ? sortPicker(paint) : null,
      ]);
      if (bar) panel.append(bar);

      if (!chosen.length) panel.append(noDecksForPlayer());
      else sortRows(chosen, sortId).forEach((row) => panel.append(deckCard(row, reload)));
    } else if (activeTab === 'players') {
      if (agg.players.length > 1) {
        panel.append(controlBar([sortPicker(paint)]));
      }
      sortRows(agg.players, sortId)
        .forEach((row) => panel.append(playerCard(row, reload, colorOf)));
    } else if (activeTab === 'rivals') {
      if (!rivals.length) panel.append(emptyRivals());
      else panel.append(rivalsTab(rivals, colorOf, paint));
    } else {
      matches.forEach((m) => panel.append(matchCard(m, reload)));
    }
  }

  root.append(el('div', { class: 'stats' }, [
    el('header', { class: 'stats-head' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('common.back'), onClick: onBack }, [icon('back')]),
      el('h1', { class: 'stats-title', text: t('stats.title') }),
      el('button', { class: 'icon-btn', 'aria-label': t('data.title'), onClick: () => openData(root, onBack, () => renderStats(root, { onBack })) }, [icon('more')]),
    ]),
    el('div', { class: 'stats-summary' }, [
      miniStat(String(matches.length), t(matches.length === 1 ? 'stats.match' : 'stats.matchesLower')),
      miniStat(String(agg.decks.length), t(agg.decks.length === 1 ? 'stats.deck' : 'stats.decksLower')),
      miniStat(String(agg.players.length), t('stats.playersLower')),
      miniStat(
        formatDuration(matches.reduce((s, m) => s + summarize(m).duration, 0)),
        t('stats.onTable'),
      ),
    ]),
    tabBar,
    panel,
  ]));

  paint();
}
