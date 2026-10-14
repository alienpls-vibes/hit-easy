/**
 * The gate: what is seen without a subscription.
 *
 * Invites show up even without subscribing, on purpose. A non-subscriber needs
 * to be able to see that matches are waiting, otherwise they would never know
 * they existed.
 */

import { el, clear, icon, toast } from '../../ui.js';
import * as store from '../../store.js';
import * as cloud from '../../cloud.js';
import { cloudEnabled } from '../../config.js';
import { t } from '../../i18n.js';

/**
 * The screen of someone who has no access yet.
 *
 * It counts the matches still waiting on this device to go up, on purpose.
 * Only those: what already reached the cloud left the device, and counting it
 * here would show the previous account's history to whoever borrowed the
 * phone. The number is the difference between "pay to use" and "what you
 * played is safe, waiting for an account".
 *
 * The check-again button exists because unlocking happens OUTSIDE the app, by
 * hand. Without it, the unlocked person would have to close and open the app
 * for the subscription to be read again, with no clue that this was what was
 * missing.
 */
export function renderPaywall(root, { onBack, onUnlock, checking = false }) {
  clear(root);
  const count = store.pendingMatches().length;
  const repaint = () => (onUnlock ? onUnlock() : null);
  const state = cloud.state();

  const recheck = el('button', { class: 'btn ghost block' }, [t('paywall.recheck')]);
  recheck.addEventListener('click', async () => {
    recheck.disabled = true;
    recheck.textContent = t('paywall.checking');
    try {
      await cloud.loadSubscription();
    } catch {
      /* no network: the state stays what it was */
    }
    if (cloud.canSeeStats(cloudEnabled(), cloud.state())) { repaint(); return; }
    recheck.disabled = false;
    recheck.textContent = t('paywall.recheck');
    toast(t('paywall.stillLocked'));
  });

  // Still asking the server: what is not known yet cannot be DENIED. The app
  // used to treat "have not asked" as "does not have it", and the lock screen
  // flashed in the face of subscribers every time the app started.
  if (checking) {
    root.append(el('div', { class: 'stats' }, [
      el('header', { class: 'stats-head' }, [
        el('button', {
          class: 'icon-btn',
          'aria-label': t('common.back'),
          onClick: () => onBack && onBack(),
        }, [icon('back')]),
        el('h1', { class: 'stats-title', text: t('stats.title') }),
      ]),
      el('div', { class: 'paywall' }, [
        el('p', { class: 'paywall-body', text: t('paywall.checking') }),
      ]),
    ]));
    return;
  }

  const body = el('div', { class: 'paywall' }, [
    el('h2', { class: 'paywall-title', text: t('paywall.title') }),
    el('p', { class: 'paywall-body', text: t('paywall.body') }),
    count
      ? el('p', {
        class: 'paywall-count',
        text: count === 1 ? t('paywall.savedOne') : t('paywall.savedCount', { n: count }),
      })
      : null,
    state === 'signed-out'
      ? el('button', {
        class: 'btn primary block',
        onClick: () => { toast(t('paywall.signInHint')); if (onBack) onBack(); },
      }, [t('paywall.signInFirst')])
      : recheck,
    el('p', { class: 'account-note', text: t('paywall.earlyAccess') }),
  ]);

  root.append(el('div', { class: 'stats' }, [
    el('header', { class: 'stats-head' }, [
      el('button', {
        class: 'icon-btn',
        'aria-label': t('common.back'),
        onClick: () => onBack && onBack(),
      }, [icon('back')]),
      el('h1', { class: 'stats-title', text: t('stats.title') }),
    ]),
    body,
  ]));
}
