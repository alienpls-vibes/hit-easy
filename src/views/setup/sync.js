/**
 * The sync block of the settings: what went up, what is still to go up.
 */

import { el, clear, toast } from '../../ui.js';
import * as store from '../../store.js';
import { t } from '../../i18n.js';
import * as sync from '../../sync.js';
import { row } from './rows.js';

/**
 * Taking the history to the cloud, and seeing how much is missing.
 *
 * Syncing happens by itself when the app opens and when a match ends. This
 * block exists for the two cases where that is not enough: the initial
 * migration, when a whole history is waiting, and the network that dropped -
 * without a visible number, "did it go up?" has no answer.
 */
export function syncBlock() {
  const box = el('div', { class: 'set-slot' });

  const paint = () => {
    clear(box);
    const history = store.getDB().history || [];
    const uploaded = new Set(store.uploadedIds());
    const missing = history.filter((m) => m && m.id && !uploaded.has(m.id)).length;

    const button = row({
      label: missing
        ? (missing === 1 ? t('sync.pendingOne') : t('sync.pendingMany', { n: missing }))
        : t('sync.allUp', { n: history.length }),
      sub: t('sync.auto'),
      value: missing ? t('sync.now') : t('sync.check'),
      className: missing ? 'is-pending' : 'is-good',
      onTap: async () => {
        if (button.disabled) return;
        button.disabled = true;
        button._value.textContent = t('sync.working');
        const r = await sync.sync({
          onProgress: (p) => {
            button._value.textContent = t('sync.progress', { n: p.uploaded });
          },
        });
        paint();
        if (r.failed) toast(t('sync.partial', { n: r.failed }));
        else if (r.uploaded || r.downloaded) toast(t('sync.done', { sent: r.uploaded, received: r.downloaded }));
        else toast(t('sync.nothing'));
      },
    });
    box.append(button);
  };

  paint();
  return box;
}
