/**
 * The conversation with the server: one request, and token renewal around it.
 *
 * Every app call goes through `request()`, and it is what handles an expired
 * token without the person noticing - refreshing ahead when little time is
 * left, and once more on a 401. Callers never deal with tokens.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { account, forgetSession, saveSession } from './account.js';
import { needsRefresh } from './rules.js';

export function url(path) {
  return SUPABASE_URL.replace(/\/+$/, '') + path;
}

export function headers(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer '
      + ((account.session && account.session.access_token) || SUPABASE_ANON_KEY),
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Headers for someone who has no session yet (or whose session expired). */
export function anonymousHeaders() {
  return { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}

export async function request(path, options = {}, alreadyRefreshed = false) {
  // Refreshes AHEAD when the token is about to expire: it is cheaper than
  // finding out from the 401 and redoing the request.
  if (!alreadyRefreshed && needsRefresh(account.session)) {
    try { await refreshSession(); } catch { /* the 401 below takes care of it */ }
  }

  const res = await fetch(url(path), { ...options, headers: headers(options.headers) });

  if (res.status === 401 || res.status === 403) {
    // One attempt to refresh and redo. Without this, an expired token in the
    // middle of a sync took down the whole session - and the person went back
    // to asking for an email because of a one-second delay.
    if (!alreadyRefreshed && account.session && account.session.refresh_token) {
      try {
        await refreshSession();
        return await request(path, options, true);
      } catch { /* the refresh died too: give up below */ }
    }
    forgetSession(); // now for real: there is no way to go on without signing in
    throw new Error('unauthorized');
  }

  if (!res.ok) throw new Error('server responded ' + res.status);
  return res.status === 204 ? null : res.json();
}

/** Stores what GoTrue returns on a sign-in or a refresh. */
export function storeFromServer(d) {
  saveSession({
    access_token: d.access_token,
    // Supabase rotates the refresh_token on every use; losing the new one
    // would mean losing the session on the next refresh.
    refresh_token: d.refresh_token
      || (account.session && account.session.refresh_token) || null,
    expires_at: d.expires_at
      || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600),
    user: d.user || (account.session && account.session.user) || null,
  });
  return account.session;
}

let refreshing = null;

/**
 * Trades the refresh_token for a new access_token.
 *
 * One refresh at a time: several simultaneous calls (the app loads profile,
 * subscription and invites together) would use the same refresh_token, and
 * since Supabase rotates it on every use, the second would arrive with an
 * already spent token and take the session down. They all await the same
 * promise.
 *
 * It goes with anonymous headers on purpose: sending the expired Bearer here
 * is asking the server to refuse before it even looks at the refresh_token.
 */
export async function refreshSession() {
  if (!account.session || !account.session.refresh_token) {
    throw new Error('no refresh token');
  }
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const res = await fetch(url('/auth/v1/token?grant_type=refresh_token'), {
      method: 'POST',
      headers: anonymousHeaders(),
      body: JSON.stringify({ refresh_token: account.session.refresh_token }),
    });
    if (!res.ok) {
      forgetSession();
      throw new Error('session expired');
    }
    return storeFromServer(await res.json());
  })();

  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}
