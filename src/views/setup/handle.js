/**
 * Your own @: how friends tag you at their table.
 *
 * Whoever does not pick an @ keeps using the whole app normally - they just
 * cannot be invited. It is optional on purpose.
 */

import { el, clear, openFlow, closeSheet, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import {
  isHandleValid, displayHandle, normalizeHandle, nextHandleChange, HANDLE_CHANGE_DAYS,
} from '../../cloud.js';
import { formatDate } from '../../stats.js';
import * as store from '../../store.js';
import { row } from './rows.js';

export function handleBlock(api, onChange) {
  const profile = cloud.myProfile();
  // Inside the settings, the choice comes in as one more screen (with back);
  // outside them, it opens its own panel.
  const open = () => {
    const step = changeHandleStep(api, onChange);
    if (api) api.next(step);
    else openFlow(step);
  };

  if (profile && profile.handle) {
    // Already created: it is not a text field.
    //
    // The @ is how friends tag the person at their table. Leaving it as an
    // input with a save button invites changing it by accident - and changing
    // the @ breaks the tagging others had already saved. Changing is still
    // possible, but through a separate door, which checks whether the name is
    // free before allowing a save - and warns about the cost in there.
    // Changed less than 15 days ago: the row says when it unlocks, and tapping
    // explains instead of opening a screen that would only end in a refusal.
    const unlocksAt = nextHandleChange(profile);
    if (unlocksAt) {
      return row({
        label: displayHandle(profile.handle),
        sub: t('account.handleNextChange', { date: formatDate(unlocksAt) }),
        className: 'account-handle-fixed',
        onTap: () => toast(t('account.handleTooSoon', { date: formatDate(unlocksAt) })),
      });
    }

    return row({
      label: displayHandle(profile.handle),
      value: t('account.handleChange'),
      arrow: true,
      className: 'account-handle-fixed',
      onTap: open,
    });
  }

  return row({
    label: t('account.handleCreate'),
    sub: t('account.handleCreateSub'),
    arrow: true,
    onTap: open,
  });
}

/**
 * Picking or changing your own @, checking first whether it is free.
 *
 * The check is a query, not a reservation: between the answer and the save
 * someone may take the same name. The database's unique index is what really
 * decides. The value of this is not letting the person type, confirm and only
 * then find out the name was someone else's.
 */
function changeHandleStep(api, onChange) {
  const profile = cloud.myProfile();
  return {
    title: profile && profile.handle ? t('handle.changeTitle') : t('handle.chooseTitle'),
    subtitle: t('account.handleHint'),
    build: (pane) => {
      const message = el('div', { class: 'handle-result' });
      let free = null;   // the checked and approved @, if any

      const use = el('button', { class: 'btn primary block' }, [t('handle.useThis')]);
      use.disabled = true;

      const input = el('input', {
        class: 'search-input',
        placeholder: '@exemplo',
        autocapitalize: 'none',
        autocorrect: 'off',
        spellcheck: 'false',
        maxlength: '21',
        'aria-label': t('account.yourHandle'),
      });

      // Any new letter invalidates the previous check: without this you could
      // check a free name, type another and save the second without ever
      // having asked anything about it.
      input.addEventListener('input', () => {
        free = null;
        use.disabled = true;
        clear(message);
      });

      const check = async () => {
        clear(message);
        free = null;
        use.disabled = true;
        const raw = normalizeHandle(input.value);
        if (!isHandleValid(raw)) {
          message.append(el('p', { class: 'account-note', text: t('handle.invalid') }));
          return;
        }
        message.append(el('p', { class: 'account-note', text: t('handle.searching') }));
        try {
          const status = await cloud.handleStatusNow(raw);
          clear(message);
          // Your own @ is not "free": there is nothing to change, and offering
          // the use button would make the person save what they already have.
          const text = {
            free: 'handle.free',
            current: 'handle.yours',
            taken: 'handle.taken',
          }[status];
          message.append(el('p', {
            class: status === 'free' ? 'account-sent' : 'account-note',
            text: t(text, { handle: displayHandle(raw) }),
          }));
          if (status === 'free') { free = raw; use.disabled = false; }
        } catch {
          clear(message);
          message.append(el('p', { class: 'account-note', text: t('account.failed') }));
        }
      };

      use.addEventListener('click', async () => {
        if (!free) return;
        use.disabled = true;
        try {
          const old = profile && profile.handle;
          const saved = await cloud.saveHandle(free, null);
          // Old matches keep the previous @. Teaching the device right away
          // keeps the statistics seeing a single person, without waiting for
          // the next sync (see currentHandle in stats).
          if (old && old !== saved.handle) {
            store.learnCurrentHandles({ [old]: saved.handle });
          }
          toast(t('account.handleSaved', { handle: displayHandle(saved.handle) }));
          // In the settings, go back to the account already with the new @;
          // on its own, close the panel.
          if (api) {
            api.back();
            if (onChange) onChange();
          } else {
            closeSheet();
          }
        } catch (err) {
          use.disabled = false;
          // The database's 409 is the only reliable answer: someone may have
          // taken the name between the check and the save.
          const reason = String(err && err.message);
          if (reason === 'handle too soon') {
            toast(err.unlockedAt
              ? t('account.handleTooSoon', { date: formatDate(err.unlockedAt) })
              : t('account.handleCooldown', { n: HANDLE_CHANGE_DAYS }));
            return;
          }
          toast(reason === 'handle taken'
            ? t('account.handleTaken')
            : t('account.failed'));
        }
      });

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });

      pane.append(el('div', { class: 'name-row' }, [
        input,
        el('button', { class: 'btn primary', onClick: check }, [t('handle.check')]),
      ]));
      pane.append(message);
      pane.append(use);
      // Before saving, not after: picking already starts the 15 days.
      pane.append(el('p', {
        class: 'account-note',
        text: t('account.handleCooldown', { n: HANDLE_CHANGE_DAYS }),
      }));
      if (profile && profile.handle) {
        pane.append(el('p', { class: 'account-note', text: t('account.handleWarn') }));
      }
    },
  };
}
