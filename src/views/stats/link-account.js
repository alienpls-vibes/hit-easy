/**
 * Saying that someone is an account, and with that joining their history.
 *
 * Two paths lead here, and the search screen is the same in both:
 *
 *   from a match's details   pick the seat, then the account;
 *   from the player's row    the person is already picked - it is the case of
 *                            seeing two rows that are the same person, because
 *                            each device typed a name, and fixing it right
 *                            there.
 *
 * What changes between them is only what is done with the found profile, so
 * the search receives `onConfirm` instead of knowing about matches or seats.
 */

import { el, clear, openFlow, closeSheet, toast } from '../../ui.js';
import * as cloud from '../../cloud.js';
import * as sync from '../../sync.js';
import { cloudEnabled } from '../../config.js';
import { t } from '../../i18n.js';

/** Tagging an account only makes sense for someone who is in an account. */
export function canTag() {
  return cloudEnabled() && cloud.state() !== 'signed-out';
}

/**
 * Picking the seat and its account, in a match already played.
 *
 * Two screens instead of one: who sits here, and who that person is in the
 * app. Asking for both together in a single list would force repeating the @
 * search for each seat.
 */
export function openTagPlayer(match, refresh) {
  openFlow({
    title: t('stats.tagPlayer'),
    subtitle: t('stats.tagWhich'),
    build: (pane, api) => {
      for (const seat of match.seats || []) {
        const existing = String(seat.handle || '').trim();
        pane.append(el('button', {
          class: 'player-row',
          onClick: () => api.next(accountStep({
            name: seat.name,
            refresh,
            onConfirm: (profile) => sync.tagPlayer(match, seat.id, profile),
          })),
        }, [
          el('span', { class: 'player-avatar', text: (seat.name || '?').slice(0, 1).toUpperCase() }),
          el('span', { class: 'player-text' }, [
            el('span', { class: 'player-name', text: seat.name }),
            el('span', {
              class: 'player-sub',
              text: existing ? '@' + existing.replace(/^@+/, '') : t('stats.tagNone'),
            }),
          ]),
        ]));
      }
      pane.append(el('p', { class: 'account-note', text: t('stats.tagHint') }));
    },
  });
}

/**
 * The person is already picked: only which account it is remains.
 *
 * Used by the player's row in the statistics, where what is seen is "this
 * person is the same as that other row" - and tagging here rewrites ALL their
 * matches, not one.
 */
export function openLinkPerson(name, refresh) {
  openFlow({
    ...accountStep({
      name,
      refresh,
      onConfirm: (profile) => sync.linkAccount(name, profile),
    }),
  });
}

function accountStep({ name, refresh, onConfirm }) {
  return {
    title: t('player.findUser'),
    subtitle: t('handle.sub', { name }),
    build: (pane) => {
      const result = el('div', { class: 'handle-result' });
      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        'aria-label': t('player.findUser'),
      });

      const search = async () => {
        clear(result);
        result.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const profile = await cloud.findHandle(input.value);
          clear(result);
          if (!profile) {
            result.append(el('p', { class: 'account-note', text: t('handle.notFound', { handle: input.value }) }));
            return;
          }
          result.append(el('div', { class: 'handle-found' }, [
            el('span', { class: 'menu-label', text: '@' + profile.handle }),
            profile.display_name ? el('span', { class: 'menu-sub', text: profile.display_name }) : null,
          ]));
          result.append(el('button', {
            class: 'btn primary block',
            onClick: async () => {
              const r = await onConfirm(profile);
              if (!r.ok) {
                toast(r.reason === 'duplicate' ? t('handle.accountTaken') : t('account.failed'));
                return;
              }
              // How many matches changed: it is the difference between "I
              // tagged a seat" and "I joined this person's history", and
              // without saying the number nobody knows which one happened.
              toast(r.changed > 1
                ? t('stats.tagMerged', { n: r.changed })
                : (r.invited ? t('stats.tagSent') : t('stats.tagLocal')));
              closeSheet();
              refresh();
            },
          }, [t('handle.use')]));
        } catch {
          clear(result);
          result.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: search }, [t('handle.search')]),
      ]));
      pane.append(result);
      pane.append(el('p', { class: 'account-note', text: t('stats.tagWhy') }));
    },
  };
}
