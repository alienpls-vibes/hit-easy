/**
 * The subscription: whether it is valid, and until when.
 *
 * `subscriptionLoaded` is different from `subscription: null`, and the
 * distinction matters on screen: "not subscribed" is an answer, "have not
 * asked yet" is a spinner.
 */

import { cloudEnabled } from '../config.js';
import { notify, account } from './account.js';
import { request } from './http.js';

/**
 * Is it already known whether this person subscribes?
 *
 * Without this the app treated "have not asked yet" as "does not have it" -
 * and the lock screen flashed for a few seconds in the face of whoever DOES
 * subscribe, every time the app started. For someone who pays, being told
 * they did not pay is the worst possible defect.
 *
 * Without a session the answer is immediate and final: there is no
 * subscription for anyone. Only with a session is there an open question.
 */
export function isSubscriptionKnown() {
  if (!cloudEnabled()) return true;
  if (!account.session) return true;
  return account.subscriptionLoaded;
}

export async function loadSubscription() {
  if (!account.session) {
    account.subscription = null;
    account.subscriptionLoaded = true;
    return null;
  }
  const before = JSON.stringify([account.subscription, account.subscriptionLoaded]);
  try {
    const rows = await request('/rest/v1/subscriptions?select=*&limit=1');
    account.subscription = Array.isArray(rows) && rows.length
      ? rows[0]
      : null;
    return account.subscription;
  } finally {
    // Even on failure, the question stops being open: insisting on
    // "checking" forever would be worse than saying there is no access.
    account.subscriptionLoaded = true;
    // Only notifies if something changed - see pendingInvites(), which had
    // the loop.
    if (JSON.stringify([account.subscription, account.subscriptionLoaded]) !== before) notify();
  }
}
