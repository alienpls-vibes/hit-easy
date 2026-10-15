/**
 * This seat's deck: the decks this player brought in the history, then Scryfall.
 *
 * In that order because in practice people repeat decks, so the choice is
 * almost always on the first row - and that part works without internet.
 *
 * Only THIS player's decks. There used to be a second list, every commander
 * ever picked on this device, but matches no longer stay on the device: what
 * a player brought is in the history (see decksOfPlayer), and a borrowed
 * phone has no business suggesting a stranger's decks.
 */

import { el, clear, buzz } from '../../ui.js';
import { accentOf, pips } from '../../colors.js';
import { searchCommanders, isOffline } from '../../scryfall.js';
import * as store from '../../store.js';
import { t, tn } from '../../i18n.js';
import { thumbOf } from '../../engine.js';

/** Choosing the commander: the player's decks from the history, then Scryfall. */
export function commanderStep(seat, slot, refresh) {
  return {
    title: slot === 0 ? t('commander.title') : t('commander.partnerTitle'),
    subtitle: t('commander.sub', { name: seat.name }),
    build: (pane, api) => {
      let controller = null;
      let debounce = null;

      const input = el('input', {
        class: 'search-input',
        type: 'search',
        placeholder: t('commander.searchPlaceholder'),
        autocomplete: 'off',
        'aria-label': t('commander.search'),
      });
      const status = el('p', { class: 'search-status' });
      const results = el('div', { class: 'result-list' });

      const choose = (commander) => {
        seat.commanders[slot] = commander;
        buzz(12);
        api.close();
        refresh();
      };

      /** Appends this player's decks to the list; returns how many went in. */
      const appendHistory = () => {
        const listed = new Set();
        const rows = [];
        store.decksOfPlayer(seat.name, seat.handle).forEach(({ commanders }) => {
          const c = commanders[slot] || commanders[0];
          if (!c || listed.has(c.oracleId)) return;
          listed.add(c.oracleId);
          rows.push(resultRow(c, choose));
        });
        if (rows.length) {
          results.append(el('p', { class: 'sheet-legend', text: t('commander.decksOf', { name: seat.name }) }), ...rows);
        }
        return rows.length;
      };

      const showHistory = () => {
        clear(results);
        const found = appendHistory();
        const name = { name: seat.name };
        let text = '';
        if (!found) {
          // The cloud history arrives a moment after the app opens. Saying
          // "no decks" while it is on its way would be a lie that fixes
          // itself a second later - see the subscription below.
          if (store.cloudStatus() === 'loading') text = t('stats.cloudLoading');
          else text = isOffline() ? t('commander.offline', name) : t('commander.noHistory', name);
        }
        status.textContent = text;
        status.hidden = !text;
        api.remeasure();
      };

      // Redraws when the history changes (the cloud download landing), while
      // nothing is typed. The sheet has no per-screen close hook, so the
      // listener drops itself once this screen is gone.
      const stop = store.subscribe(() => {
        if (!pane.isConnected) { stop(); return; }
        if (input.value.trim().length < 2) showHistory();
      });

      const run = async (q) => {
        if (controller) controller.abort();
        controller = new AbortController();
        status.hidden = false;
        status.textContent = t('commander.searching');
        try {
          const list = await searchCommanders(q, { signal: controller.signal });
          clear(results);
          status.textContent = list.length
            ? tn(list.length, 'commander.result', 'commander.results')
            : t('commander.noResults');
          list.forEach((c) => results.append(resultRow(c, choose)));
        } catch (err) {
          if (err.name === 'AbortError') return;
          clear(results);
          status.textContent = t('commander.searchFailed');
          appendHistory();
        }
        api.remeasure();
      };

      input.addEventListener('input', () => {
        const q = input.value.trim();
        clearTimeout(debounce);
        if (q.length < 2) { showHistory(); return; }
        debounce = setTimeout(() => run(q), 280);
      });

      pane.append(input, status, results);
      showHistory();
    },
  };
}

function resultRow(commander, choose) {
  const thumb = thumbOf(commander);
  return el('button', {
    class: 'result-row',
    style: { '--accent': accentOf(commander.colors) },
    onClick: () => choose(commander),
  }, [
    el('span', {
      class: 'result-art',
      style: thumb ? { backgroundImage: 'url(' + thumb + ')' } : {},
    }),
    el('span', { class: 'result-text' }, [
      el('span', { class: 'result-name', text: commander.name }),
      el('span', { class: 'result-type', text: commander.typeLine }),
    ]),
    el('span', { class: 'result-pips', text: pips(commander.colors) }),
  ]);
}
