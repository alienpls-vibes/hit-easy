/**
 * The bridge to the app's own code.
 *
 * The site does not reimplement accounts or statistics: it imports the same
 * modules the app runs (../../src/). That is what keeps the two from
 * disagreeing - the win rate on the site is computed by the exact function
 * that computes it on the phone, and the session uses the same storage key,
 * so signing in on the site also signs the app in on that browser (same
 * origin), and the other way around.
 *
 * This file and lib/app-stats.js (split so pages without statistics do not
 * download the match engine) are the ONLY ones that know where the app
 * lives. If the site ever moves to a repository or domain of its own, these
 * paths are what changes - they
 * can become absolute URLs to the published app
 * (https://alienpls-vibes.github.io/hit-easy/src/...), which GitHub Pages
 * serves with CORS open.
 */

import * as cloud from '../../src/cloud.js';
import { cloudEnabled } from '../../src/config.js';
import {
  url, anonymousHeaders, storeFromServer,
} from '../../src/cloud/http.js';

export { cloud, cloudEnabled };

export {
  state as installState, promptInstall, onInstallChange,
} from '../../src/install.js';

/**
 * Creates the account with a password and comes back to the SITE.
 *
 * The app's createAccount() sends no `redirect_to`, so the confirmation e-mail
 * would land on the project's Site URL - the app - and the person who signed
 * up on the site would be dropped somewhere else. Same request otherwise, plus
 * the `has_password` mark the app writes itself (see hasPassword() in
 * src/cloud/auth.js), so the app never offers "set a password" to someone who
 * just chose one.
 *
 * Returns { signedIn } - false means "check your inbox".
 */
export async function signUp(email, password, redirectTo) {
  const res = await fetch(url('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirectTo)), {
    method: 'POST',
    headers: anonymousHeaders(),
    body: JSON.stringify({
      email: String(email || '').trim(),
      password: String(password || ''),
      data: { has_password: true },
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(d.error_description || d.msg || d.message || 'failed');
    e.code = d.error_code || d.error || res.status;
    throw e;
  }
  if (d.access_token) {
    storeFromServer(d);
    try {
      await cloud.loadUser();
      await cloud.loadProfile();
      await cloud.loadSubscription();
    } catch { /* signed in; the rest arrives later */ }
    return { signedIn: true };
  }
  if (cloud.accountAlreadyExisted(d)) {
    const e = new Error('account already exists');
    e.code = 'user_already_exists';
    throw e;
  }
  return { signedIn: false };
}

/**
 * Where the auth e-mails should bring the person back to: this very page.
 *
 * Must stay inside the Redirect URLs list of Supabase
 * (`https://alienpls-vibes.github.io/hit-easy/**` covers the site). Locally,
 * on localhost, the server refuses it and falls back to the Site URL.
 */
export function backHere() {
  return cloud.returnUrl();
}
