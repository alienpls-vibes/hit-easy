/**
 * Bringing the cloud up, in order.
 *
 * The order is not arbitrary: it captures the link return BEFORE looking at
 * the stored session, otherwise whoever just clicked the email would come in
 * as signed out.
 */

import { cloudEnabled } from '../config.js';
import { loadSubscription } from './subscription.js';
import { captureReturn, loadConfig, loadUser } from './auth.js';
import { pendingInvites } from './invites.js';
import { notify, account, state } from './account.js';
import { refreshSession } from './http.js';
import { loadProfile } from './profile.js';
import { needsRefresh } from './rules.js';

/**
 * Account startup, called once by the app.
 *
 * Order matters: first capture the token that came in the URL (otherwise it
 * stays in the browser history), then load who the person is and whether
 * they subscribe.
 */
export async function boot() {
  if (!cloudEnabled()) return state();
  const returned = captureReturn();
  loadConfig();

  if (account.session) {
    try {
      // A session stored yesterday arrives expired; refreshing here is what
      // makes the app open already signed in instead of asking for an email
      // again.
      if (needsRefresh(account.session)) await refreshSession();
      await loadUser();
      await loadProfile();
      await loadSubscription();
      // Invites too: without this the home screen would have no way to know
      // something is waiting, and the feature would only exist for whoever
      // went looking.
      await pendingInvites();
    } catch {
      /* an invalid session was already cleared by request() */
    }
  }
  if (returned) notify();
  return state();
}
