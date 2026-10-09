/**
 * Backup: exporting and importing everything as JSON.
 *
 * It is the only path between devices without a subscription - each one keeps
 * the history in its own browser. Importing merges with what already exists,
 * without duplicating.
 */

import { el, openSheet, toast, confirmAction } from '../../ui.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import { deckNameByKey } from './deck.js';

/** Backup: export/import everything as JSON. */
export function openData(root, onBack) {
  openSheet({
    title: t('data.title'),
    subtitle: t('data.sub'),
    build: (body, close) => {
      const fileInput = el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        try {
          store.importJSON(await file.text());
          close();
          toast(t('data.imported'));
          redraw();
        } catch {
          toast(t('data.importFailed'));
        }
      });

      const hidden = store.hiddenCount();
      if (hidden) {
        body.append(el('p', { class: 'sheet-legend', text: t('stats.hidden') }));
        const list = el('div', { class: 'menu' });
        const db = store.getDB();

        db.hiddenPlayers.forEach((name) => {
          list.append(el('button', {
            class: 'menu-item',
            onClick: () => { store.unhidePlayer(name); close(); redraw(); },
          }, [
            el('span', { class: 'menu-label', text: name }),
            el('span', { class: 'menu-sub', text: t('stats.hiddenPlayer') }),
          ]));
        });
        db.hiddenDecks.forEach((key) => {
          list.append(el('button', {
            class: 'menu-item',
            onClick: () => { store.unhideDeck(key); close(); redraw(); },
          }, [
            el('span', { class: 'menu-label', text: deckNameByKey(key) }),
            el('span', { class: 'menu-sub', text: t('stats.hiddenDeck') }),
          ]));
        });
        body.append(list);
        body.append(el('p', { class: 'sheet-legend', text: t('data.backup') }));
      }

      body.append(el('div', { class: 'menu' }, [
        el('button', {
          class: 'menu-item',
          onClick: () => {
            const blob = new Blob([store.exportJSON()], { type: 'application/json' });
            const a = el('a', {
              href: URL.createObjectURL(blob),
              download: 'commander-stats-' + new Date().toISOString().slice(0, 10) + '.json',
            });
            document.body.append(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
            close();
          },
        }, [
          el('span', { class: 'menu-label', text: t('data.export') }),
          el('span', { class: 'menu-sub', text: t('data.exportSub') }),
        ]),
        el('button', { class: 'menu-item', onClick: () => fileInput.click() }, [
          el('span', { class: 'menu-label', text: t('data.import') }),
          el('span', { class: 'menu-sub', text: t('data.importSub') }),
        ]),
        el('button', {
          class: 'menu-item is-danger',
          onClick: async () => {
            close();
            const ok = await confirmAction({
              title: t('data.wipeTitle'),
              message: t('data.wipeMsg'),
              confirmLabel: t('data.wipe'),
            });
            if (ok) { store.wipe(); redraw(); }
          },
        }, [
          el('span', { class: 'menu-label', text: t('data.wipe') }),
          el('span', { class: 'menu-sub', text: t('data.wipeSub') }),
        ]),
        fileInput,
      ]));
    },
  });
}
