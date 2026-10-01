/**
 * O deck deste assento: decks do jogador, depois recentes, depois Scryfall.
 *
 * Nessa ordem porque na pratica a galera repete deck, entao quase sempre a
 * escolha esta na primeira linha - e essa parte funciona sem internet.
 */

import { el, clear, buzz } from '../../ui.js';
import { accentOf, pips } from '../../colors.js';
import { searchCommanders, isOffline } from '../../scryfall.js';
import * as store from '../../store.js';
import { t, tn } from '../../i18n.js';

/** Escolha do comandante: decks do jogador, depois recentes, depois Scryfall. */
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
        store.rememberCommander(commander);
        buzz(12);
        api.close();
        refresh();
      };

      const showSaved = () => {
        clear(results);
        const meus = store.decksOfPlayer(seat.name, seat.handle);
        const jaListados = new Set();

        if (meus.length) {
          results.append(el('p', { class: 'sheet-legend', text: t('commander.decksOf', { name: seat.name }) }));
          meus.forEach(({ commanders }) => {
            const c = commanders[slot] || commanders[0];
            if (!c || jaListados.has(c.oracleId)) return;
            jaListados.add(c.oracleId);
            results.append(resultRow(c, choose));
          });
        }

        const outros = store.recentCommanders(12).filter((c) => !jaListados.has(c.oracleId));
        if (outros.length) {
          results.append(el('p', {
            class: 'sheet-legend',
            text: meus.length ? t('commander.otherDecks') : t('commander.recentDecks'),
          }));
          outros.forEach((c) => results.append(resultRow(c, choose)));
        }

        status.textContent = (meus.length || outros.length)
          ? t('commander.savedHere')
          : (isOffline() ? t('commander.offline') : t('commander.typeTwo'));
        api.remeasure();
      };

      const run = async (q) => {
        if (controller) controller.abort();
        controller = new AbortController();
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
          store.recentCommanders(12).forEach((c) => results.append(resultRow(c, choose)));
        }
        api.remeasure();
      };

      input.addEventListener('input', () => {
        const q = input.value.trim();
        clearTimeout(debounce);
        if (q.length < 2) { showSaved(); return; }
        debounce = setTimeout(() => run(q), 280);
      });

      pane.append(input, status, results);
      showSaved();
    },
  };
}

function resultRow(commander, choose) {
  return el('button', {
    class: 'result-row',
    style: { '--accent': accentOf(commander.colors) },
    onClick: () => choose(commander),
  }, [
    el('span', {
      class: 'result-art',
      style: commander.thumb ? { backgroundImage: 'url(' + commander.thumb + ')' } : {},
    }),
    el('span', { class: 'result-text' }, [
      el('span', { class: 'result-name', text: commander.name }),
      el('span', { class: 'result-type', text: commander.typeLine }),
    ]),
    el('span', { class: 'result-pips', text: pips(commander.colors) }),
  ]);
}
