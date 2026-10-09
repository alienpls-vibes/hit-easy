/**
 * Account and subscription in the settings: sign in, create, sign out, change
 * password.
 *
 * On the main settings screen the account is ONE row (accountSummary), which
 * opens this screen of its own. It used to come whole at the top - sign-in,
 * password, sync, @, invites and subscription, each with its own note - and
 * pushed language and theme to the end of a long scroll.
 *
 * It redraws by itself when the state changes - signing in, signing out,
 * subscription loaded - because the magic-link sign-in comes back from OUTSIDE
 * the app: the person goes to the email and returns through the URL, and the
 * screen has to reflect that without reloading.
 */

import { el, clear, buzz, toast } from '../../ui.js';
import { t } from '../../i18n.js';
import * as cloud from '../../cloud.js';
import { displayHandle } from '../../cloud.js';
import { CHECKOUT_URL } from '../../config.js';
import { formatDate } from '../../stats.js';
import { invitesBlock } from './invites.js';
import { handleBlock } from './handle.js';
import { syncBlock } from './sync.js';
import { group, row } from './rows.js';

/**
 * The account row on the main screen: who it is, and what is waiting.
 *
 * Signed out, the invitation to sign in. Signed in, the @ (or the email,
 * without an @), with the subscription beside it - and the number of invites
 * waiting, which is the only thing in the account that asks for an action.
 */
export function accountSummary(api, onRefresh) {
  const box = el('div', { class: 'set-slot' });

  const paint = () => {
    clear(box);
    const state = cloud.state();
    const open = () => api.next(accountStep(onRefresh));

    if (state === 'signed-out') {
      box.append(row({
        label: t('account.rowOut'),
        sub: t('account.rowOutSub'),
        arrow: true,
        className: 'set-account',
        onTap: open,
      }));
      return;
    }

    const user = cloud.currentUser();
    const email = (user && user.email) || '';
    const profile = cloud.myProfile();
    const handle = profile && profile.handle ? displayHandle(profile.handle) : null;
    const name = profile && profile.display_name;
    const invites = cloud.openInvites().length;

    // How the person shows up at the table comes first; the @ and the email,
    // below.
    box.append(row({
      label: name || handle || email,
      sub: [name ? handle : (handle ? email : null), state === 'subscriber' ? t('account.subActive') : null]
        .filter(Boolean).join(' \u00b7 ') || t('account.title'),
      arrow: true,
      className: 'set-account',
      extra: invites ? el('span', { class: 'set-badge', text: String(invites) }) : null,
      onTap: open,
    }));
  };

  paint();
  cloud.watchAccountWhile(box, paint);
  return box;
}

/** The account screen, stacked over the settings (it has back). */
export function accountStep(onRefresh) {
  return {
    title: t('account.title'),
    build: (pane, api) => pane.append(accountBlock(onRefresh, api)),
  };
}

/**
 * Account and subscription.
 *
 * It redraws by itself when the state changes - signing in, signing out,
 * subscription loaded - because the magic-link sign-in comes back from OUTSIDE
 * the app: the person goes to the email and returns through the URL, and the
 * screen has to reflect that without reloading.
 */
export function accountBlock(onRefresh, api) {
  const box = el('div', { class: 'account' });

  const paint = () => {
    clear(box);
    const state = cloud.state();

    if (state === 'signed-out') {
      box.append(loginBlock(paint, onRefresh));
      return;
    }

    const user = cloud.currentUser();
    const subscription = cloud.subscription();

    // Who is in, and the subscription: what the person checks first.
    box.append(group(null, [
      row({
        label: (user && user.email) || '',
        sub: t('account.connected'),
        className: 'set-email',
      }),
      state === 'subscriber'
        ? row({
          label: t('account.subActive'),
          sub: subscription && subscription.current_period_end
            ? t('account.subUntil', { date: formatDate(subscription.current_period_end) })
            : null,
          className: 'is-good',
        })
        : row({
          label: t('account.subInactive'),
          sub: t('account.subPitch'),
          value: t('account.subscribe'),
          onTap: () => {
            if (!CHECKOUT_URL) { toast(t('account.subSoon')); return; }
            location.assign(CHECKOUT_URL);
          },
        }),
    ]));

    box.append(group(t('account.yourHandle'), [handleBlock(api, paint)]));
    box.append(group(t('account.displayName'), [displayNameBlock(api, paint)]));
    box.append(group(t('sync.title'), [syncBlock()]));
    box.append(group(t('account.password'), [passwordBlock()]));
    box.append(invitesBlock());

    box.append(group(null, [row({
      label: t('account.signOut'),
      danger: true,
      onTap: async () => {
        await cloud.signOut();
        paint();
        if (onRefresh) onRefresh();
      },
    })]));
  };

  paint();
  cloud.watchAccountWhile(box, paint);
  return box;
}

function isEmailValid(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

/**
 * Signing in with email and password.
 *
 * The email link is still there below, and it is still important: it is the
 * path for whoever forgot the password and the only one that does not require
 * remembering anything. It just stopped being the everyday path - opening the
 * inbox to sign in on your own device is too much friction, and on a borrowed
 * device, even worse.
 */
function loginBlock(repaint, onRefresh) {
  const box = el('div', { class: 'account-login' });

  const email = el('input', {
    class: 'search-input',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    placeholder: t('account.emailLabel'),
    'aria-label': t('account.emailLabel'),
  });
  const password = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'current-password',
    placeholder: t('account.password'),
    'aria-label': t('account.password'),
  });

  // The sign-in error has to be seen.
  //
  // It used to be a grey paragraph after the two buttons: whoever got the
  // password wrong pressed "Sign in", nothing visible happened, and the
  // explanation stayed out of sight. `role="alert"` makes the screen reader
  // announce it, and its place is now right below the fields that need fixing.
  const message = el('p', { class: 'account-error', role: 'alert' });
  const clearMessage = () => { message.textContent = ''; message.classList.remove('is-on'); };
  const fail = (text) => {
    message.textContent = text;
    message.classList.add('is-on');
    toast(text);
  };
  const signIn = el('button', { class: 'btn primary block' }, [t('account.signIn')]);
  const create = el('button', { class: 'btn ghost block' }, [t('account.createAccount')]);

  const busy = (on, button, label) => {
    signIn.disabled = on;
    create.disabled = on;
    button.textContent = on ? t('account.sending') : label;
  };

  const done = () => {
    if (onRefresh) onRefresh();
    repaint();
  };

  signIn.addEventListener('click', async () => {
    clearMessage();
    if (!isEmailValid(email.value)) { fail(t('account.invalidEmail')); return; }
    busy(true, signIn, t('account.signIn'));
    try {
      await cloud.signInWithPassword(email.value, password.value);
      buzz(12);
      done();
    } catch (err) {
      busy(false, signIn, t('account.signIn'));
      fail(errorReason(err));
    }
  });

  create.addEventListener('click', async () => {
    clearMessage();
    if (!isEmailValid(email.value)) { fail(t('account.invalidEmail')); return; }
    if (!cloud.isPasswordValid(password.value)) {
      fail(t('account.passwordShort'));
      return;
    }
    busy(true, create, t('account.createAccount'));
    try {
      const r = await cloud.createAccount(email.value, password.value);
      // With email confirmation on the server returns no session. Saying
      // "signed in" there would be a lie, and the person would be left waiting
      // for something to happen.
      if (r.signedIn) { buzz(12); done(); return; }
      clear(box);
      box.append(
        el('p', { class: 'account-sent', text: t('account.confirmEmail', { email: email.value.trim() }) }),
        el('p', { class: 'account-note', text: t('account.linkSentHint') }),
      );
    } catch (err) {
      busy(false, create, t('account.createAccount'));
      fail(errorReason(err));
    }
  });

  // Touching a field clears the error: it talks about what was there before.
  email.addEventListener('input', clearMessage);
  password.addEventListener('input', clearMessage);

  box.append(email, password, message, signIn, create);

  if (cloud.providers().includes('google')) {
    box.append(el('button', {
      class: 'btn ghost block',
      onClick: () => cloud.signInWith('google'),
    }, [t('account.withGoogle')]));
  }

  // The email link: discreet, always available, no password required.
  box.append(el('button', {
    class: 'account-link',
    onClick: async () => {
      if (!isEmailValid(email.value)) { fail(t('account.invalidEmail')); return; }
      clearMessage();
      try {
        await cloud.sendMagicLink(email.value);
        clear(box);
        box.append(
          el('p', { class: 'account-sent', text: t('account.linkSent', { email: email.value.trim() }) }),
          el('p', { class: 'account-note', text: t('account.linkSentHint') }),
        );
      } catch {
        fail(t('account.failed'));
      }
    },
  }, [t('account.orMagicLink')]));

  box.append(el('p', { class: 'account-note', text: t('account.why') }));
  return box;
}

/**
 * The name in matches: how the person shows up at friends' tables.
 *
 * The @ is the identity - lowercase only, so "@Alex" and "@alex" are never
 * two people. The name is something else: it is what the seat shows when
 * someone tags this account, and it can be written however the person wants.
 * Without a name, the table uses the @.
 *
 * It only exists with an @: the name lives in the same profile row, which is
 * born with it.
 */
function displayNameBlock(api, onChange) {
  const profile = cloud.myProfile();
  if (!profile || !profile.handle) {
    return row({ label: t('account.displayNameNeedsHandle'), className: 'is-muted' });
  }
  const name = profile.display_name;
  return row({
    label: name || t('account.displayNameEmpty'),
    sub: name ? null : t('account.displayNameSub', { handle: displayHandle(profile.handle) }),
    value: name ? t('account.handleChange') : null,
    arrow: true,
    className: name ? 'set-name' : 'set-name is-muted',
    onTap: () => {
      const step = displayNameStep(api, onChange);
      if (api) api.next(step);
    },
  });
}

/** The screen for writing the name, with a preview of how it looks at the table. */
function displayNameStep(api, onChange) {
  const profile = cloud.myProfile() || {};
  return {
    title: t('account.displayNameTitle'),
    subtitle: t('account.displayNameStepSub'),
    build: (pane) => {
      const field = el('input', {
        class: 'search-input',
        placeholder: profile.handle || '',
        autocapitalize: 'words',
        autocomplete: 'nickname',
        spellcheck: 'false',
        enterkeyhint: 'done',
        'aria-label': t('account.displayName'),
      });
      field.value = profile.display_name || '';

      // The preview is what convinces: "Alê" with the accent, the way it will
      // come out on the panel. And it shows the cut when it goes over the
      // size, instead of cutting silently at save time.
      const preview = el('p', { class: 'account-note' });
      const count = () => {
        const clean = cloud.normalizeName(field.value);
        const tooLong = [...field.value.trim()].length > cloud.NAME_MAX;
        preview.textContent = t('account.displayNamePreview', {
          name: clean || displayHandle(profile.handle),
          n: [...clean].length,
          max: cloud.NAME_MAX,
        }) + (tooLong ? ' \u00b7 ' + t('account.displayNameCut') : '');
      };
      field.addEventListener('input', count);
      count();

      const save = el('button', { class: 'btn primary block' }, [t('account.displayNameSave')]);
      const store = async (text) => {
        save.disabled = true;
        try {
          const saved = await cloud.saveName(text);
          toast(saved
            ? t('account.displayNameSaved', { name: saved })
            : t('account.displayNameCleared'));
          if (api) api.back();
          if (onChange) onChange();
        } catch {
          save.disabled = false;
          toast(t('account.failed'));
        }
      };
      save.addEventListener('click', () => store(field.value));
      field.addEventListener('keydown', (e) => { if (e.key === 'Enter') store(field.value); });

      pane.append(field, preview, save);
      if (profile.display_name) {
        pane.append(el('button', {
          class: 'btn ghost block',
          onClick: () => store(''),
        }, [t('account.displayNameUseHandle')]));
      }
    },
  };
}

/**
 * Setting a password after already being in.
 *
 * It is the step that closes the problem for whoever came in through the
 * magic link: one password, once, and never again email on any device.
 */
function passwordBlock() {
  // Already has a password: changing goes through email.
  //
  // Setting the FIRST password while signed in is safe - whoever is in has
  // already proven to be the owner. Changing is something else: a table life
  // counter lives on loan, and whoever picked up the unlocked device could
  // change the password and take the account. The email is what proves the
  // request comes from the owner.
  if (cloud.hasPassword()) {
    const user = cloud.currentUser();
    const email = (user && user.email) || '';
    let sent = false;

    const change = row({
      label: t('account.changePassword'),
      sub: t('account.changePasswordSub'),
      arrow: true,
      onTap: async () => {
        if (sent || change.disabled) return;
        change.disabled = true;
        change._sub.textContent = t('account.sending');
        try {
          await cloud.requestPasswordReset(email);
          sent = true;
          change._sub.textContent = t('account.recoverSent', { email });
          change.classList.add('is-good');
        } catch {
          change.disabled = false;
          change._sub.textContent = t('account.changePasswordSub');
          toast(t('account.failed'));
        }
      },
    });
    return change;
  }

  const box = el('div', { class: 'set-row is-form' });
  const field = el('input', {
    class: 'search-input',
    type: 'password',
    autocomplete: 'new-password',
    placeholder: t('account.newPassword'),
    'aria-label': t('account.newPassword'),
  });
  const save = el('button', { class: 'btn primary' }, [t('account.setPassword')]);

  save.addEventListener('click', async () => {
    if (!cloud.isPasswordValid(field.value)) { toast(t('account.passwordShort')); return; }
    save.disabled = true;
    try {
      await cloud.setPassword(field.value);
      field.value = '';
      toast(t('account.passwordSaved'));
      // The whole row changes shape: from here on only changing exists.
      const next = passwordBlock();
      if (box.parentElement) box.parentElement.replaceChild(next, box);
    } catch {
      toast(t('account.failed'));
    } finally {
      save.disabled = false;
    }
  });

  box.append(
    el('div', { class: 'name-row' }, [field, save]),
    el('span', { class: 'set-sub', text: t('account.setPasswordSub') }),
  );
  return box;
}

/**
 * Translates what the server complained about.
 *
 * "server responded 400" helps nobody sign in. The codes that matter are few
 * and each one has a different way out: a wrong password is fixed by typing
 * again, an existing account is fixed by signing in instead of creating.
 */
function errorReason(err) {
  const c = String((err && err.code) || '');
  const m = String((err && err.message) || '').toLowerCase();
  if (c === 'invalid_credentials' || m.includes('invalid login')) return t('account.wrongCredentials');
  if (c === 'user_already_exists' || m.includes('already registered')) return t('account.accountExists');
  if (c === 'weak_password' || m.includes('password')) return t('account.passwordShort');
  if (c === 'email_not_confirmed' || m.includes('not confirmed')) return t('account.notConfirmed');
  return t('account.failed');
}
