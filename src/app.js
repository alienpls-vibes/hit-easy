/**
 * The app glue: decides which screen to show, keeps the match saved and takes
 * care of what is global - theme, orientation and keeping the screen on.
 *
 * We save on every event. If the browser closes in the middle of the table,
 * on reopening the match is exactly where it stopped - including whose turn
 * it was.
 */

import {
  toast, setHaptics, isSheetOpen, onSheetChange, closeSheet,
} from './ui.js';
import {
  renderSetup, seedDraftFrom, openReleaseNotes, passTable, openIOSInstall,
  openReceiveTable,
} from './views/setup.js';
import { codeInText } from './cloud.js';
import { renderTable } from './views/table.js';
import { renderStats, renderPaywall } from './views/stats.js';
import { createMatch, leaveTable, returnToTable } from './engine.js';
import { applyTheme, watchTheme } from './theme.js';
import { t, setLang, detectLang } from './i18n.js';
import {
  preferOrientation, isWide, resumeOrientation, lockLost,
} from './orientation.js';
import { orientOf } from './seating.js';
import { APP_VERSION } from './version.js';
import { releaseNotesSince } from './release-notes.js';
import * as store from './store.js';
import * as cloud from './cloud.js';
import { canSeeStats } from './cloud.js';
import * as sync from './sync.js';
import { cloudEnabled } from './config.js';
import { isBeta } from './channel.js';
import { state as installState } from './install.js';

const root = document.getElementById('app');
let route = store.getCurrent() ? 'table' : 'setup';
let previous = 'setup';
let live = null; // controller of the current screen, when it needs cleanup

function settings() {
  return store.getDB().settings;
}

/**
 * The device back button, inside the app.
 *
 * The app had no navigation history at all, so Android's back found no entry
 * to consume and closed the app - right on the statistics screen, where the
 * gesture is the most natural.
 *
 * One entry per visit to the statistics, consumed on the way out.
 * `consumingBack` exists because leaving through the arrow also gives the
 * entry back (`history.back()`), and that fires `popstate`: without the mark,
 * the handler would treat the give-back as a new gesture and go back two
 * screens.
 */
let consumingBack = false;

function pushBackEntry() {
  try {
    history.pushState({ route: 'stats' }, '');
  } catch { /* no history: back works as it used to */ }
}

/** Where back from the statistics leads - arrow and gesture, the same place. */
function backTarget() {
  return previous === 'stats' ? 'setup' : previous;
}

/** Leaves the statistics giving the history entry back. */
function leaveStats() {
  const target = backTarget();
  consumingBack = true;
  try {
    history.back();
  } catch {
    consumingBack = false;
  }
  go(target);
}

window.addEventListener('popstate', () => {
  // A give-back made by the arrow: the entry was already accounted for.
  if (consumingBack) { consumingBack = false; return; }

  // An open panel has priority: closing the panel is what the person wants,
  // and navigating behind it would leave the sheet standing over the new
  // screen.
  if (isSheetOpen()) {
    closeSheet();
    pushBackEntry();
    return;
  }

  // Outside the statistics there is no entry of ours to consume, and the home
  // screen is the base: from there back leaves the app, which is what is
  // expected.
  if (route !== 'stats') return;
  go(backTarget());
});

function go(next) {
  const before = route;
  if (next !== route) previous = route;
  route = next;
  if (next === 'stats' && before !== 'stats') pushBackEntry();
  render();
}

/**
 * Draws the current route.
 *
 * The real body is in draw(); this layer only exists so that an error in one
 * screen does not leave the app BLACK. A black screen tells nothing to whoever
 * is using it and nothing to whoever will fix it - and that is exactly what a
 * malformed match coming from the cloud produced.
 */
function render() {
  try {
    draw();
  } catch (err) {
    errorScreen(err);
  }
}

function errorScreen(err) {
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'crash';
  const h = document.createElement('h2');
  h.textContent = t('common.error');
  const p = document.createElement('p');
  p.textContent = String((err && err.message) || err);
  const b = document.createElement('button');
  b.className = 'btn primary';
  b.textContent = t('common.back');
  b.addEventListener('click', () => go('setup'));
  box.append(h, p, b);
  root.append(box);
}

function draw() {
  if (live && live.destroy) live.destroy();
  live = null;
  document.body.dataset.route = route;

  // The match clock only runs with someone at the table. Going to the
  // statistics or the home screen stops it; coming back resumes it, without
  // the person asking and without the manual pause cover - a pause nobody
  // asked for should not require anyone to undo it.
  tableClock();

  if (route === 'table') {
    const match = store.getCurrent();
    if (!match) { go('setup'); return; }

    live = renderTable(root, {
      match,
      onChange: () => store.setCurrent(match),
      onStats: () => go('stats'),
      onFinish: () => {
        store.archive(match);
        // The match has just come into existence: upload it now, while the
        // person is still holding the device and probably online. Failing
        // here loses nothing - it stays without the uploaded mark and goes up
        // next time.
        sync.sync().catch(() => {});
        seedDraftFrom(match);
        go('setup');
        toast(t('victory.saved'), { label: t('victory.seeData'), onClick: () => go('stats') });
      },
      onDiscard: () => {
        store.clearCurrent();
        go('setup');
        toast(t('victory.discarded'));
      },
      // The table leaves here in the act of passing, so going back to the
      // home screen is a consequence and not a decision: the route above would
      // already refuse to enter it. It goes back BEFORE the code shows -
      // switching screens closes the panels.
      onPassTable: () => passTable(() => go('setup')),
    });
    hintRotate();
    hintIOSFullscreen();
    return;
  }

  if (route === 'stats') {
    // The gate is a ROUTE decision, not the statistics screen's: which screen
    // to show is the router's question, and this way the view stays just a
    // reading of the data - testable without an account or subscription.
    //
    // This is the screen. The real gate is the Postgres RLS: without a
    // subscription it returns an empty list, so getting around this `if`
    // hands over no match from the cloud.
    const back = leaveStats;
    if (canSeeStats(cloudEnabled(), cloud.state())) {
      renderStats(root, { onBack: back });
    } else {
      renderPaywall(root, {
        onBack: back,
        onUnlock: () => go('stats'),
        // While the subscription has not come back from the server, the answer
        // is "I don't know yet" - and denying what is not known is the worst
        // way to welcome someone who pays.
        checking: !cloud.isSubscriptionKnown(),
      });
    }
    return;
  }

  renderSetup(root, {
    onStats: () => go('stats'),
    // Receiving a table and taking back a handed-off one change which match is
    // current, so the screen has to follow. Without this the table was
    // installed and the person stayed on the home screen - only reloading the
    // page found it.
    onOpenTable: () => go('table'),
    // Switching the theme changes the WUBRG palette, which was already written
    // into the elements' style: only a full redraw puts everyone in the new
    // color.
    onRefresh: () => render(),
    onStart: (draft) => {
      // Seats tagged with an account start under the name that account chose.
      store.applyDisplayNames(draft.seats);
      const match = createMatch(draft.seats, draft.startingLife, {
        firstSeatId: draft.firstSeatId,
        layoutId: draft.layoutId,
      });
      store.setCurrent(match);
      go('table');
    },
  });
}

/* ---------------------------------------------------------------- */
/* Orientation                                                       */
/* ---------------------------------------------------------------- */

let lastWide = isWide();
let resizeTimer = null;
let relayoutPending = false;

/**
 * The table has one shape for a standing screen and another for a lying one,
 * so rotating the device requires redrawing. The setup screen rotates by
 * itself in CSS - and it is good that it does, because redrawing there would
 * steal the focus of whoever is typing (the phone keyboard shrinks the height
 * and already looks like a rotation).
 *
 * With a panel open, the redraw WAITS. Remounting the table calls destroy(),
 * which closes the panel - and the vote asks for portrait precisely while it
 * is open, so without this it would close by itself when rotating the screen.
 */
function syncOrientation() {
  const wide = isWide();
  document.body.dataset.orient = wide ? 'wide' : 'tall';
  if (wide === lastWide) return;
  lastWide = wide;
  if (route !== 'table') return;
  if (isSheetOpen()) { relayoutPending = true; return; }
  render();
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(syncOrientation, 120);
});

onSheetChange((open) => {
  if (open || !relayoutPending) return;
  relayoutPending = false;
  if (route === 'table') render();
});

let rotateHinted = false;

/** One hint per session, blocking nothing: the table works standing up too. */
function hintRotate() {
  if (rotateHinted || isWide()) return;
  rotateHinted = true;
  setTimeout(() => toast(t('table.rotateHint')), 1400);
}

let fullscreenHinted = false;

/**
 * On the iPhone, fullscreen only exists with the app installed.
 *
 * iPhone Safari does not implement fullscreen for pages - only for video - so
 * in a tab the address bar stays there and no code removes it. Opened from the
 * Home Screen, the app runs with no bar at all. The hint shows at the table,
 * which is where the bar gets in the way, and leads straight to the step by
 * step.
 *
 * After the rotate hint when both apply: one notice replaces the other, and
 * the rotate one would stay 2s on screen before vanishing.
 */
function hintIOSFullscreen() {
  if (fullscreenHinted || installState().mode !== 'ios') return;
  fullscreenHinted = true;
  setTimeout(() => toast(t('table.iosFullscreenHint'), {
    label: t('table.iosFullscreenAction'),
    onClick: openIOSInstall,
  }), isWide() ? 1400 : 4000);
}

/* ---------------------------------------------------------------- */
/* Screen kept on                                                    */
/* ---------------------------------------------------------------- */

// Nobody wants to unlock the phone on every attack. Released when leaving the
// table.
//
// Safari (iPhone and iPad) only grants the lock right after a touch by the
// person. Asking on returning to the app, or on reopening straight on the
// table, is silently refused - and the screen started turning off by itself in
// the middle of the match, with nothing warning. That is why the first touch on
// the table without a lock asks again (see the `pointerup` below). The system
// also releases the lock whenever it wants (locking the phone, switching apps),
// and the same touch recovers it.
let wakeLock = null;
let requestingWakeLock = false;

/** Is the table in sight and does the person want the screen on? */
function wantsScreenOn() {
  return route === 'table'
    && settings().keepAwake
    && document.visibilityState !== 'hidden';
}

async function keepAwake(on) {
  if (!('wakeLock' in navigator)) return;
  try {
    if (on && settings().keepAwake && !wakeLock && !requestingWakeLock) {
      requestingWakeLock = true;
      const lock = await navigator.wakeLock.request('screen');
      requestingWakeLock = false;
      // The table may have closed while the request was in flight.
      if (!wantsScreenOn()) { lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null;
      });
    } else if ((!on || !settings().keepAwake) && wakeLock) {
      const lock = wakeLock;
      wakeLock = null;
      await lock.release();
    }
  } catch {
    /* unsupported or denied by the browser: the next touch tries again */
    requestingWakeLock = false;
  }
}

/**
 * Stops or resumes the clock, depending on the table being in sight.
 *
 * Saves whenever it changed something: the open period has to survive the app
 * closing, otherwise the time away would count again on the next startup.
 */
function tableClock() {
  const match = store.getCurrent();
  if (!match) return;

  const atTable = route === 'table'
    && (typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const changed = atTable ? returnToTable(match) : leaveTable(match);
  if (changed) store.setCurrent(match);
}

document.addEventListener('visibilitychange', () => {
  // Locking the phone or switching apps is also leaving the table.
  tableClock();
  if (document.visibilityState === 'visible' && route === 'table') keepAwake(true);
  // The return tries right away. It usually does not work - fullscreen asks
  // for a touch - and then the first touch on the table redoes the request.
  if (document.visibilityState === 'visible') resumeOrientation();
});

/**
 * Leaving the app drops fullscreen, and with it the landscape lock: the device
 * came back standing up, in the middle of the match. The browser only allows
 * entering fullscreen from a touch, so the request is redone on the first
 * touch after the return - `pointerup`, because that is what counts as the
 * person's gesture on touch (`pointerdown` only counts with a mouse). Without
 * a lost lock, it does nothing.
 */
document.addEventListener('pointerup', () => {
  if (lockLost()) resumeOrientation();
  // The same rule applies to keeping the screen on in Safari - see keepAwake().
  if (!wakeLock && wantsScreenOn()) keepAwake(true);
}, true);

// Closing the app stops the clock. Best effort: a shutdown forced by the
// system may fire nothing, and then that time counts - there is no event the
// browser guarantees.
window.addEventListener('pagehide', tableClock);

const observer = new MutationObserver(() => {
  const atTable = document.body.dataset.route === 'table';
  keepAwake(atTable);
  // The table asks for the orientation the PERSON chose when setting up the
  // game. It used to ask for landscape always, which went against whoever had
  // chosen to stand the device up between two players.
  preferOrientation(atTable ? tableOrientation() : null, atTable);
});

/** The orientation declared by the match in progress; landscape when there is none. */
function tableOrientation() {
  try {
    const m = store.getCurrent();
    return (m && orientOf(m.seats.length, m.layoutId)) || 'landscape';
  } catch {
    return 'landscape';
  }
}
observer.observe(document.body, { attributes: true, attributeFilter: ['data-route'] });

/* ---------------------------------------------------------------- */
/* Startup                                                           */
/* ---------------------------------------------------------------- */

// Language before anything: each screen reads its texts when drawn.
setLang(settings().lang || detectLang());
applyTheme(settings().theme);
setHaptics(settings().haptics);
watchTheme(() => render()); // the system switched from light to dark (or the other way)
syncOrientation();

// A test version has to announce itself. Without that you can play a whole
// table on beta thinking it is the real app - and later look in the wrong
// place for the match that stayed stored on the other channel.
if (isBeta()) {
  const mark = document.createElement('div');
  mark.className = 'beta-flag';
  mark.textContent = 'BETA';
  document.body.appendChild(mark);
}

render();

/**
 * The link of a handed-off table: `?mesa=K7M2QX`.
 *
 * Whoever receives the code over WhatsApp taps the link and lands here, with
 * receive already open and the code filled in - only confirming is left. The
 * parameter leaves the bar right away: reloading the page cannot offer again a
 * table that was already received.
 */
export function codeFromLink(search) {
  try {
    return codeInText(new URLSearchParams(search || '').get('mesa') || '');
  } catch {
    return null;
  }
}

const codeReceivedByLink = codeFromLink(typeof location === 'undefined' ? '' : location.search);
if (codeReceivedByLink) {
  try {
    history.replaceState(history.state, '', location.pathname + location.hash);
  } catch { /* no history: the parameter stays, and receive refuses the used code */ }
  // After the release notes (700ms): receiving the table is what the person
  // came to do, and a panel opened on top of another closes the one below.
  setTimeout(() => openReceiveTable(() => go('table'), codeReceivedByLink), 900);
}

/**
 * What's new after updating, only once.
 *
 * Whoever installs now sees nothing: showing the whole change history to
 * someone who never used the app is noise before the first use. Only whoever
 * was already here and got a new version has something to be told.
 *
 * It has a name and is exported because it was an IIFE that ran on import: it
 * happened once, before any test, and there was no way to exercise it.
 * Deleting the previous-version line went through the whole suite without a
 * single failure.
 *
 * Returns what the person has not seen yet - the startup decides whether to
 * open the screen.
 *
 * `versaoVista` and `versaoAnterior` are stored settings: do not translate.
 */
export function announceVersion(now = APP_VERSION) {
  const seen = settings().versaoVista || null;
  store.setSetting('versaoVista', now);
  if (!seen || seen === now) return [];

  // Where the person came from, so the menu can show the same slice later.
  // Saved only when the version CHANGED: reopening the app on the same version
  // cannot reset the slice and turn the notes into the whole history.
  store.setSetting('versaoAnterior', seen);

  return releaseNotesSince(seen);
}

const newInThisStartup = announceVersion();
if (newInThisStartup.length) {
  setTimeout(() => openReleaseNotes(newInThisStartup), 700);
}

// The account comes up after the first screen: nobody should wait for the
// network to see the app. When the state arrives, whoever depends on it
// redraws.
cloud.boot().then((state) => {
  if (state !== 'off') render();
  // Syncs after knowing who the person is. Failing here gets in the way of
  // nothing: what did not go up stays unmarked and goes up on the next open.
  sync.sync().then((r) => {
    if (r && (r.downloaded || r.uploaded || r.people)) render();
  }).catch(() => {});
});

// The account may change after the first screen - the subscription arrives
// from the network, and signing in happens inside the settings. Whoever is
// looking at the statistics needs to see the change without leaving and
// coming back.
cloud.onAccountChange(() => {
  // My own chosen name, as soon as the profile says it: the open table, the
  // statistics and the next seats use it without waiting for a sync.
  const profile = cloud.myProfile();
  const learned = profile && profile.handle
    ? store.learnDisplayNames({ [profile.handle]: profile.display_name || null })
    : { changed: 0, table: false };
  if (route === 'stats' || (route === 'table' && learned.table)) render();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline keeps working through the browser cache */
    });
  });
}
