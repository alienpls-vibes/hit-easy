/**
 * What the app remembers about whoever signed in.
 *
 * Everything in a single object, on purpose. These are five values that are
 * born and die together - signing in fills them, signing out clears them -
 * and five loose `let`s did not say that. It is also what lets the other
 * pieces of src/cloud/ write here: assigning a property of an imported binding
 * is legal, while assigning the binding itself is a TypeError.
 *
 * Whoever watches for account changes subscribes with onAccountChange and
 * receives the new state() - the whole interface redraws from it.
 */

import { storageKey } from '../channel.js';
import { cloudEnabled } from '../config.js';
import { accountState, sessionFromStorage } from './rules.js';

const SESSION_KEY = storageKey('mtglc.session.v1');

export const account = {
  /** GoTrue session: access_token, refresh_token, expires_at, user. */
  session: readSession(),
  /** Subscription loaded from the server, or null if not known yet. */
  subscription: null,
  /** Different from `subscription: null`: tells "not subscribed" from "not read". */
  subscriptionLoaded: false,
  /** Public profile (name and @), loaded on demand. */
  profile: null,
  /** Open invites addressed to me. */
  invites: [],
};

const listeners = new Set();

function readSession() {
  try {
    return sessionFromStorage(localStorage.getItem(SESSION_KEY));
  } catch {
    return null; // private mode: not even reading the disk is allowed
  }
}

export function saveSession(s) {
  account.session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: the session lasts only while the tab is open */
  }
  notify();
}

export function notify() {
  listeners.forEach((fn) => fn(state()));
}

export function onAccountChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Listens to the account while `node` is on the page.
 *
 * Each settings block used to subscribe and never leave: opening the screen
 * ten times left ten listeners redrawing boxes nobody saw - and, added to the
 * invites loop, each one fired its own trip to the network. Here the listener
 * removes itself on the first notification after the block leaves the screen.
 *
 * "Has been on the page", and not just "is": the block is built before it is
 * attached, and a notification in that interval cannot cancel the
 * subscription.
 */
export function watchAccountWhile(node, fn) {
  let wasAttached = false;
  const stop = onAccountChange((s) => {
    if (node.isConnected) { wasAttached = true; fn(s); return; }
    if (wasAttached) stop();
  });
  return stop;
}

export function state() {
  return accountState({
    enabled: cloudEnabled(),
    session: account.session,
    subscription: account.subscription,
  });
}

export function currentUser() {
  return account.session && account.session.user ? account.session.user : null;
}

export function subscription() {
  return account.subscription;
}

/**
 * Deletes the session here, without talking to the server.
 *
 * Separate from signOut() because there are cases where there is NOBODY to
 * talk to: a refused token, the server down, or a test setting up the next
 * case. Signing out for real is this plus a notice to the server - and the
 * notice can never be a condition for the person to be able to sign out.
 */
export function forgetSession() {
  account.subscription = null;
  account.subscriptionLoaded = false;
  account.invites = [];
  account.profile = null;
  saveSession(null);
}
