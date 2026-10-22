/**
 * The account page: sign up, sign in, password recovery and the profile.
 *
 * It is the SAME account as the app's (Supabase, through lib/app.js), so
 * everything decided here - the @, the name - shows up on the phone too. The
 * page is a small state machine; each `show*` function redraws the card:
 *
 *   loading -> forms (sign up | sign in) -> profile
 *                 \-> check inbox (sign up with e-mail confirmation on)
 *   recovery (came from the "forgot my password" e-mail) -> profile
 *
 * `account.html#criar` opens on the sign-up tab; `?next=stats` goes to the
 * statistics once signed in.
 */

import { html, fill, format, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { resolve } from '../lib/links.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function render({ text }) {
  return html`
    <section class="section account-page">
      <div class="container container-narrow">
        <header class="section-head section-head-left">
          <h1 class="section-title">${text.title}</h1>
          <p class="section-text">${text.text}</p>
        </header>
        <div class="account-card card" aria-live="polite">
          <p class="muted loading-line">${text.loading}</p>
        </div>
      </div>
    </section>`;
}

function dateText(ts, locale) {
  return new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}

/** The server's error code as a sentence the person can act on. */
function errorText(text, err) {
  const errors = text.errors;
  if (err && err.name === 'TypeError') return errors.network; // fetch failed: no network
  const code = err && err.code;
  if (code && errors[code]) return errors[code];
  const msg = String((err && err.message) || '');
  if (/429/.test(msg)) return errors.over_request_rate_limit;
  if (/already/i.test(msg)) return errors.user_already_exists;
  if (/invalid login/i.test(msg)) return errors.invalid_credentials;
  return errors.generic;
}

export async function mount(node, { text, site, locale }) {
  const card = node.querySelector('.account-card');

  // Read BEFORE the cloud boots: boot() cleans the address bar.
  const recovering = /(^|[#&])type=recovery(&|$)/.test(location.hash);
  const startOnSignUp = location.hash === '#criar';
  const next = new URLSearchParams(location.search).get('next');

  let app;
  try {
    app = await import('../lib/app.js');
  } catch {
    fill(card, html`<p class="form-error">${text.errors.network}</p>`);
    return;
  }
  const { cloud } = app;
  if (!app.cloudEnabled()) {
    fill(card, html`<p class="muted">${text.cloudOff}</p>`);
    return;
  }

  await cloud.boot();
  let providers = [];
  if (site.socialLogin) {
    try { providers = await cloud.loadConfig(); } catch { providers = []; }
  }

  const done = () => {
    if (next === 'stats') { location.assign('stats.html'); return; }
    showProfile();
  };

  /* ---------------------------------------------------------------- forms */

  function showForms(mode, notice) {
    const signUp = mode === 'signUp';
    const social = providers.filter((p) => p === 'google' || p === 'apple');
    // '{link}' in the text marks where the privacy-policy link goes.
    const terms = text.terms.split('{link}');
    fill(card, html`
      <div class="tabs tabs-full" role="tablist">
        <button class="tab" type="button" role="tab" data-mode="signUp"
          aria-selected="${signUp ? 'true' : 'false'}">${text.tabs.signUp}</button>
        <button class="tab" type="button" role="tab" data-mode="signIn"
          aria-selected="${signUp ? 'false' : 'true'}">${text.tabs.signIn}</button>
      </div>
      ${notice ? html`<p class="form-note" role="status">${icon('check')}<span>${notice}</span></p>` : null}
      <form class="form" novalidate>
        <label class="field">
          <span class="field-label">${text.email}</span>
          <input class="input" type="email" name="email" autocomplete="email" inputmode="email"
            autocapitalize="off" autocorrect="off" spellcheck="false" required>
        </label>
        <label class="field">
          <span class="field-label">${text.password}</span>
          <span class="field-row">
            <input class="input" type="password" name="password" minlength="8" required
              autocomplete="${signUp ? 'new-password' : 'current-password'}">
            <button class="field-btn" type="button" data-reveal>${text.show}</button>
          </span>
          ${signUp ? html`<small class="field-hint">${text.passwordHint}</small>` : null}
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn-primary btn-block" type="submit">
          ${signUp ? text.signUpSubmit : text.signInSubmit}
        </button>
        ${signUp
          ? html`<p class="fine-print center">${terms[0]}<a class="text-link"
              href="${resolve('{privacy}')}">${text.termsLink}</a>${terms[1] || ''}</p>`
          : html`<button class="link-btn" type="button" data-forgot>${text.forgot}</button>`}
      </form>
      ${social.length ? html`
        <div class="divider"><span>${text.or}</span></div>
        <div class="social-buttons">
          ${social.map((p) => html`
            <button class="btn btn-ghost btn-block" type="button" data-provider="${p}">
              ${p === 'google' ? text.google : text.apple}
            </button>`)}
        </div>` : null}`);

    const form = card.querySelector('form');
    const email = form.elements.email;
    const password = form.elements.password;
    const error = form.querySelector('.form-error');
    const submit = form.querySelector('[type="submit"]');

    const fail = (message) => {
      error.textContent = message;
      error.hidden = false;
    };
    const busy = (on) => {
      submit.disabled = on;
      submit.textContent = on ? text.working : (signUp ? text.signUpSubmit : text.signInSubmit);
    };

    card.querySelectorAll('[data-mode]').forEach((tab) => {
      tab.addEventListener('click', () => {
        const keep = email.value;
        showForms(tab.getAttribute('data-mode'));
        card.querySelector('input[name="email"]').value = keep;
      });
    });

    form.querySelector('[data-reveal]').addEventListener('click', (e) => {
      const hidden = password.type === 'password';
      password.type = hidden ? 'text' : 'password';
      e.currentTarget.textContent = hidden ? text.hide : text.show;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.hidden = true;
      const mail = email.value.trim();
      if (!EMAIL_RE.test(mail)) { fail(text.errors.badEmail); email.focus(); return; }
      if (!cloud.isPasswordValid(password.value)) { fail(text.errors.shortPassword); password.focus(); return; }
      busy(true);
      try {
        if (signUp) {
          const res = await app.signUp(mail, password.value, app.backHere());
          if (res.signedIn) done();
          else showInbox(mail);
        } else {
          await cloud.signInWithPassword(mail, password.value);
          done();
        }
      } catch (err) {
        busy(false);
        fail(errorText(text, err));
      }
    });

    const forgot = form.querySelector('[data-forgot]');
    if (forgot) {
      forgot.addEventListener('click', async () => {
        error.hidden = true;
        const mail = email.value.trim();
        if (!EMAIL_RE.test(mail)) { fail(text.forgotNeedsEmail); email.focus(); return; }
        forgot.disabled = true;
        try {
          await cloud.requestPasswordReset(mail, app.backHere());
          showForms('signIn', format(text.resetSent, { email: mail }));
          card.querySelector('input[name="email"]').value = mail;
        } catch (err) {
          forgot.disabled = false;
          fail(errorText(text, err));
        }
      });
    }

    card.querySelectorAll('[data-provider]').forEach((btn) => {
      btn.addEventListener('click', () => cloud.signInWith(btn.getAttribute('data-provider'), app.backHere()));
    });
  }

  function showInbox(mail) {
    fill(card, html`
      <div class="state-block">
        <span class="state-icon">${icon('check')}</span>
        <h2 class="state-title">${text.checkInboxTitle}</h2>
        <p class="state-text">${format(text.checkInboxText, { email: mail })}</p>
        <button class="btn btn-ghost" type="button" data-back>${text.backToForm}</button>
      </div>`);
    card.querySelector('[data-back]').addEventListener('click', () => showForms('signIn'));
  }

  /* ------------------------------------------------------------- recovery */

  function showRecovery() {
    const r = text.recovery;
    fill(card, html`
      <h2 class="card-title">${r.title}</h2>
      <p class="muted">${r.text}</p>
      <form class="form" novalidate>
        <label class="field">
          <span class="field-label">${text.password}</span>
          <input class="input" type="password" name="password" minlength="8" autocomplete="new-password" required>
          <small class="field-hint">${text.passwordHint}</small>
        </label>
        <p class="form-error" role="alert" hidden></p>
        <button class="btn btn-primary btn-block" type="submit">${r.submit}</button>
      </form>`);
    const form = card.querySelector('form');
    const error = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = form.elements.password.value;
      if (!cloud.isPasswordValid(pw)) {
        error.textContent = text.errors.shortPassword;
        error.hidden = false;
        return;
      }
      form.querySelector('[type="submit"]').disabled = true;
      try {
        await cloud.setPassword(pw);
        toast(r.done);
        showProfile();
      } catch (err) {
        form.querySelector('[type="submit"]').disabled = false;
        error.textContent = errorText(text, err);
        error.hidden = false;
      }
    });
  }

  /* -------------------------------------------------------------- profile */

  function showProfile() {
    const p = text.profile;
    const user = cloud.currentUser();
    const profile = cloud.myProfile();
    const mail = (user && user.email) || '';
    const handle = profile && profile.handle ? profile.handle : '';
    const displayName = (profile && profile.display_name) || (handle ? '@' + handle : mail.split('@')[0]) || '';
    const subscriber = cloud.state() === 'subscriber';
    const sub = cloud.subscription();
    const until = subscriber && sub && sub.current_period_end ? Date.parse(sub.current_period_end) : null;

    fill(card, html`
      <div class="profile-head">
        <span class="avatar" aria-hidden="true">${(displayName || '?').replace(/^@/, '').slice(0, 1).toUpperCase()}</span>
        <div>
          <h2 class="card-title">${format(p.hello, { name: displayName })}</h2>
          ${mail ? html`<p class="muted">${format(p.signedInAs, { email: mail })}</p>` : null}
        </div>
      </div>

      <div class="profile-block">
        <h3 class="block-title">${p.handleTitle}</h3>
        ${handle ? html`
          <p class="handle-big">@${handle}</p>
          <p class="fine-print">${p.handleChangeInApp}</p>` : html`
          <p class="muted">${p.handleText}</p>
          <form class="form form-inline" data-handle novalidate>
            <label class="field">
              <span class="sr-only">${p.handleTitle}</span>
              <span class="field-row field-prefix">
                <span class="prefix" aria-hidden="true">@</span>
                <input class="input" name="handle" placeholder="${p.handlePlaceholder}" maxlength="21"
                  autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="username">
              </span>
              <small class="field-hint" data-handle-status>${p.handleRules}</small>
            </label>
            <button class="btn btn-primary" type="submit">${p.handleSave}</button>
          </form>`}
      </div>

      ${profile ? html`
        <div class="profile-block">
          <h3 class="block-title">${p.nameTitle}</h3>
          <p class="muted">${p.nameText}</p>
          <form class="form form-inline" data-name novalidate>
            <label class="field">
              <span class="sr-only">${p.nameTitle}</span>
              <input class="input" name="name" maxlength="18" placeholder="${p.namePlaceholder}"
                value="${profile.display_name || ''}" autocomplete="nickname">
            </label>
            <button class="btn btn-ghost" type="submit">${p.nameSave}</button>
          </form>
        </div>` : null}

      <div class="profile-block">
        <h3 class="block-title">${p.accessTitle}</h3>
        <p><span class="status ${subscriber ? 'is-on' : 'is-off'}">${icon(subscriber ? 'check' : 'lock')}
          <span>${subscriber ? p.accessOn : p.accessOff}</span></span>
          ${until ? html`<span class="muted"> · ${format(p.accessUntil, { date: dateText(until, locale) })}</span>` : null}</p>
        ${subscriber ? null : html`
          <p class="muted">${p.accessOffText}</p>
          <button class="link-btn" type="button" data-recheck>${p.recheck}</button>`}
      </div>

      <div class="button-row">
        <a class="btn btn-primary" href="stats.html">${icon('chart')}<span>${p.stats}</span></a>
        <a class="btn btn-ghost" href="download.html">${icon('download')}<span>${p.install}</span></a>
        <a class="btn btn-ghost" href="${resolve('{app}')}">${icon('external')}<span>${p.openApp}</span></a>
      </div>
      <p class="fine-print">${p.tip}</p>
      <div class="profile-foot">
        <button class="link-btn" type="button" data-signout>${p.signOut}</button>
      </div>`);

    const handleForm = card.querySelector('[data-handle]');
    if (handleForm) wireHandle(handleForm);

    const nameForm = card.querySelector('[data-name]');
    if (nameForm) {
      nameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = nameForm.querySelector('button');
        btn.disabled = true;
        try {
          await cloud.saveName(nameForm.elements.name.value);
          toast(p.nameSaved);
          showProfile();
        } catch (err) {
          btn.disabled = false;
          toast(errorText(text, err));
        }
      });
    }

    const recheck = card.querySelector('[data-recheck]');
    if (recheck) {
      recheck.addEventListener('click', async () => {
        recheck.disabled = true;
        try { await cloud.loadSubscription(); } catch { /* stays as it was */ }
        if (cloud.state() === 'subscriber') showProfile();
        else { recheck.disabled = false; toast(p.stillLocked); }
      });
    }

    card.querySelector('[data-signout]').addEventListener('click', async () => {
      await cloud.signOut();
      showForms('signIn');
    });
  }

  /**
   * Choosing the @, with a live check while typing.
   *
   * The check is a QUERY, not a reservation - the database decides on save
   * (unique index, 409), and that answer is handled too.
   */
  function wireHandle(form) {
    const p = text.profile;
    const input = form.elements.handle;
    const status = form.querySelector('[data-handle-status]');
    const btn = form.querySelector('button');
    let timer = null;
    let asked = '';

    const say = (msg, kind) => {
      status.textContent = msg;
      status.className = 'field-hint' + (kind ? ' is-' + kind : '');
    };

    input.addEventListener('input', () => {
      const h = cloud.normalizeHandle(input.value);
      clearTimeout(timer);
      if (!h) { say(p.handleRules); return; }
      if (!cloud.isHandleValid(h)) { say(p.handleInvalid, 'bad'); return; }
      say(p.handleChecking);
      timer = setTimeout(async () => {
        asked = h;
        try {
          const st = await cloud.handleStatusNow(h);
          if (asked !== h) return; // the person kept typing
          if (st === 'taken') say(p.handleTaken, 'bad');
          else if (st === 'current') say(p.handleCurrent, 'ok');
          else say(p.handleFree, 'ok');
        } catch {
          say(p.handleRules);
        }
      }, 450);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const h = cloud.normalizeHandle(input.value);
      if (!cloud.isHandleValid(h)) { say(p.handleInvalid, 'bad'); input.focus(); return; }
      btn.disabled = true;
      try {
        await cloud.saveHandle(h);
        toast(p.handleSaved);
        showProfile();
      } catch (err) {
        btn.disabled = false;
        const msg = String((err && err.message) || '');
        if (msg === 'handle taken') say(p.handleTaken, 'bad');
        else if (msg === 'handle too soon' && err.unlockedAt) {
          say(format(p.handleTooSoon, { date: dateText(err.unlockedAt, locale) }), 'bad');
        } else say(errorText(text, err), 'bad');
      }
    });
  }

  /* ---------------------------------------------------------------- start */

  if (cloud.account.session) {
    if (recovering) showRecovery();
    else if (next === 'stats') location.assign('stats.html');
    else showProfile();
  } else {
    showForms(startOnSignUp ? 'signUp' : 'signIn');
  }
}
