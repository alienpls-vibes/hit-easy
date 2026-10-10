/**
 * Signing in and out: magic link, password, social login and the return
 * through the URL.
 *
 * The magic link comes back from OUTSIDE the app - the person goes to their
 * email and returns through an address with the session in the fragment - so
 * captureReturn() runs at startup and not in response to a tap.
 */

import { cloudEnabled } from '../config.js';
import { loadSubscription } from './subscription.js';
import {
  account, currentUser, forgetSession, saveSession, state,
} from './account.js';
import { anonymousHeaders, storeFromServer, request, url } from './http.js';
import { loadProfile } from './profile.js';

/**
 * Where the sign-in should come back to.
 *
 * Without the fragment: if the person asks for a second link while on a URL
 * that still carries `#access_token=...`, that token would travel inside the
 * email. Without the query too, because the address has to match Supabase's
 * Redirect URLs list - anything extra makes the server refuse and fall back to
 * the Site URL.
 */
export function returnUrl(loc = location) {
  return loc.origin + loc.pathname;
}

/**
 * How the magic link request goes over the network.
 *
 * Separate from the call so it can be checked by a test. The detail that
 * matters: `redirect_to` is a QUERY parameter, not body. The Supabase SDK
 * accepts `options.emailRedirectTo` and translates it into this query; the raw
 * REST API translates nothing - it silently ignores the unknown field and
 * sends the link to the project's Site URL. That exact mistake is what made
 * the first real sign-in land on localhost:3000.
 */
export function magicLinkRequest(email, redirectTo) {
  return {
    path: '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirectTo),
    body: { email: String(email || '').trim(), create_user: true },
  };
}

/** Sends the magic link to the email. */
export async function sendMagicLink(email, redirectTo = returnUrl()) {
  const { path, body } = magicLinkRequest(email, redirectTo);
  await request(path, { method: 'POST', body: JSON.stringify(body) });
}

/** Goes to Google/Apple and comes back with the session in the URL. */
export function signInWith(provider, redirectTo = returnUrl()) {
  const target = url('/auth/v1/authorize')
    + '?provider=' + encodeURIComponent(provider)
    + '&redirect_to=' + encodeURIComponent(redirectTo);
  location.assign(target);
}

/**
 * Supabase returns the session in the URL fragment (#access_token=...).
 * A fragment never reaches the server - that is why the token travels there.
 */
export function captureReturn() {
  if (!location.hash || location.hash.length < 2) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get('access_token');
  if (!token) return false;

  saveSession({
    access_token: token,
    refresh_token: p.get('refresh_token'),
    expires_at: Number(p.get('expires_at')) || null,
    user: null,
  });
  // Cleans the address bar: a token in the browsing history is a leak.
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

let activeProviders = [];

/** Which social logins the server accepts. Empty until loadConfig() runs. */
export function providers() {
  return activeProviders;
}

/**
 * Asks the server what is turned on.
 *
 * Without this the screen would show "Sign in with Google" even with the
 * provider turned off, and the tap would lead to a Supabase error page - worse
 * than having no button.
 */
export async function loadConfig() {
  if (!cloudEnabled()) return [];
  try {
    const cfg = await request('/auth/v1/settings');
    activeProviders = Object.entries(cfg.external || {})
      .filter(([name, enabled]) => enabled && name !== 'email')
      .map(([name]) => name);
  } catch {
    activeProviders = [];
  }
  return activeProviders;
}

export async function loadUser() {
  if (!account.session) return null;
  const user = await request('/auth/v1/user');
  saveSession({ ...account.session, user });
  return user;
}

export async function signOut() {
  try {
    await request('/auth/v1/logout', { method: 'POST' });
  } catch {
    /* a server that is down cannot stop someone from signing out */
  }
  forgetSession();
}

/*
 * The email and the magic link still exist - they are the path for whoever
 * forgot the password, and the only one that does not depend on remembering
 * anything. But it cannot be the EVERYDAY path: opening the inbox to sign in
 * on your own device is too much friction, and on a borrowed device it is
 * even worse.
 */

async function requestToken(path, body) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: anonymousHeaders(),
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(d.error_description || d.msg || d.message || 'failed');
    e.code = d.error_code || d.error || res.status;
    throw e;
  }
  return d;
}

export async function signInWithPassword(email, password) {
  const d = await requestToken('/auth/v1/token?grant_type=password', {
    email: String(email || '').trim(),
    password: String(password || ''),
  });
  storeFromServer(d);
  try {
    await loadUser();
    // Signed in WITH a password, so there is a password. Covers whoever
    // already had one before this field existed, without them having to set
    // it again.
    if (!hasPassword()) await markHasPassword();
    await loadProfile();
    await loadSubscription();
  } catch { /* signed in; the rest arrives later */ }
  return state();
}

/**
 * Did the account already exist?
 *
 * With email confirmation on, GoTrue does NOT say "that email already has an
 * account" - it would be answering whether an address exists to anyone who
 * asked, which would turn sign-up into an email checker. Instead it returns a
 * decoy user, with EMPTY `identities`. That empty array is the only signal,
 * and it is the documented one.
 *
 * Without reading it, the app said "check your inbox" to someone who already
 * had an account - and the person waited for an email that would not come, or
 * came and was useless.
 */
export function accountAlreadyExisted(response) {
  if (!response || response.access_token) return false;
  return Array.isArray(response.identities) && response.identities.length === 0;
}

/**
 * Creates the account already with a password.
 *
 * If the project requires email confirmation, the server does NOT return a
 * session - only the user. In that case the caller has to say "check your
 * inbox", and not pretend it signed in.
 */
export async function createAccount(email, password) {
  const d = await requestToken('/auth/v1/signup', {
    email: String(email || '').trim(),
    password: String(password || ''),
  });

  if (d.access_token) {
    storeFromServer(d);
    try { await loadUser(); await loadSubscription(); } catch { /* later */ }
    return { signedIn: true, state: state() };
  }

  // Without email confirmation on, the server refuses with user_already_exists
  // and we never get here. With it on, the signal is the empty `identities`.
  if (accountAlreadyExisted(d)) {
    const e = new Error('account already exists');
    e.code = 'user_already_exists';
    throw e;
  }

  return { signedIn: false, state: state() };
}

/**
 * Does this account already have a password?
 *
 * GoTrue does not say: the email identity exists both for whoever came in by
 * magic link and for whoever has a password. So the app itself writes it down,
 * in `user_metadata`, which travels with the account and arrives the same on
 * any device - unlike a mark stored on this disk.
 */
export function hasPassword() {
  const u = currentUser();
  return Boolean(u && u.user_metadata && u.user_metadata.has_password);
}

async function markHasPassword() {
  try {
    const u = await request('/auth/v1/user', {
      method: 'PUT',
      body: JSON.stringify({ data: { has_password: true } }),
    });
    if (u && u.id) saveSession({ ...account.session, user: u });
  } catch {
    /* the password is already set; the note tries again next time */
  }
}

/**
 * Sets the first password.
 *
 * This is the step that closes the problem: whoever arrived by magic link sets
 * a password once and never needs email again - on any device.
 *
 * Password and mark go in the SAME request, on purpose. In two calls the second
 * request can fail - network dropped, token expired - and the account ends up
 * in a lying state: it has a password, but the app thinks it does not, and
 * keeps offering "save password" forever. A single call has no middle ground.
 */
export async function setPassword(password) {
  if (!account.session) throw new Error('no session');
  const u = await request('/auth/v1/user', {
    method: 'PUT',
    body: JSON.stringify({
      password: String(password || ''),
      data: { has_password: true },
    }),
  });
  // The response already is the updated user: storing it here avoids a trip
  // to the network just to find out what the server has just said.
  if (u && u.id) saveSession({ ...account.session, user: u });
  else await loadUser();
}

/**
 * Requests a password change by email.
 *
 * Changing the password cannot be as easy as setting it the first time:
 * whoever sits at an already signed-in device - and a table life counter lives
 * on loan - could change the person's password and take the account. The
 * email is what proves whoever asks is the owner.
 *
 * `redirect_to` goes in the QUERY, as in every GoTrue endpoint. In the body it
 * is silently ignored and the link lands on the project's Site URL - that is
 * how the first real sign-in ended up on localhost:3000.
 */
export async function requestPasswordReset(email, redirectTo = returnUrl()) {
  await request('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), {
    method: 'POST',
    body: JSON.stringify({ email: String(email || '').trim() }),
  });
}
