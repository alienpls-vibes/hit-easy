/**
 * The daily challenge's door into the app - the ONLY file the rest of Hit
 * Easy imports from src/daily/.
 *
 * Two things go out:
 *   dailyButton()   the home screen's header button, with a dot while today's
 *                   card is unplayed
 *   initDaily()     startup: opens the challenge from a notice (`?daily=1`,
 *                   or a message from the service worker), and re-checks
 *                   the notice if it is on
 *
 * The screen itself is loaded with a dynamic import() on the tap. That is
 * the whole isolation: this file only pulls tiny modules with no network and
 * no calendar (plus back.js, which must listen from startup), so an error anywhere in the challenge - a typo in
 * calendar.js, Scryfall down - can cost the challenge, never the home screen
 * or a match in progress. Removing the feature is deleting src/daily/ and
 * the lines that call these two functions.
 */

import { el, toast } from '../ui.js';
import { dayKey } from './day.js';
import { isDone, settings, setSetting } from './storage.js';
import { dt } from './i18n.js';
// Imported for its side effect: the back-gesture listener has to be
// registered before app.js registers its own (see back.js).
import './back.js';

const SVG = 'http://www.w3.org/2000/svg';

/** A card with a question mark, in the stroke style of ui.js icons. */
function cardIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', 'M6 2.5h8a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 16V4A1.5 1.5 0 0 1 6 2.5ZM8.4 8.2a1.7 1.7 0 1 1 2.4 1.5c-.5.3-.8.7-.8 1.3M10 13.4h.01');
  svg.append(p);
  return svg;
}

/** Only from the home screen: never on top of a table or the statistics. */
function canOpen() {
  return document.body.dataset.route === 'setup';
}

let opening = false;
let refreshHome = null; // the home screen's redraw, from the last dailyButton()

/** Opens the challenge screen, loading its code on demand. */
export function openDaily() {
  if (opening || document.querySelector('.daily-screen')) return;
  opening = true;
  import('./screen.js')
    .then((m) => m.openDailyScreen({ onClose: refreshButtons, onRefresh: refreshHome }))
    .catch(() => toast(dt('daily.loadFailed')))
    .finally(() => { opening = false; });
}

const buttons = new Set();

/** Repaints the dot of every live button (today played, or a new day). */
function refreshButtons() {
  const done = isDone(dayKey());
  for (const b of buttons) {
    if (!b.isConnected) { buttons.delete(b); continue; }
    b.classList.toggle('has-news', !done);
  }
}

/**
 * The header button of the home screen.
 *
 * Inside a `display: contents` slot, like the install button: on screen it
 * sits in the row as any other button, but it is not a direct child of
 * `.head-actions`, so the header's own buttons keep their positions for
 * anything that finds them by order (the browser journeys do).
 */
export function dailyButton(onRefresh) {
  refreshHome = onRefresh || null;
  const b = el('button', {
    class: 'icon-btn daily-entry' + (isDone(dayKey()) ? '' : ' has-news'),
    'aria-label': dt('daily.open'),
    title: dt('daily.title'),
    onClick: openDaily,
  }, [cardIcon(), el('span', { class: 'daily-entry-dot', 'aria-hidden': 'true' })]);
  buttons.add(b);
  return el('span', { class: 'daily-entry-slot', style: { display: 'contents' } }, [b]);
}

/**
 * Startup hook. Opens the challenge when the app was launched from the
 * notice, and listens for the worker asking an already-open app to do so.
 */
export function initDaily() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('daily') === '1') {
      params.delete('daily');
      const rest = params.toString();
      history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
      setTimeout(() => { if (canOpen()) openDaily(); }, 300);
    }
  } catch { /* no URL or history API: the notice just opens the app */ }

  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'DAILY_OPEN' && canOpen()) openDaily();
    });
  }

  // A notice that is on gets re-checked on every opening: a subscription
  // lost to a reinstall or cleared data is made again, and the server learns
  // today's language, time zone and whether today was played. Loaded on
  // demand, like the screen - and a failure here costs only the notice.
  if (settings().notify) {
    const today = dayKey();
    import('./notify.js')
      .then((m) => m.refresh(
        { title: dt('daily.notifyTitle'), body: dt('daily.notifyBody') },
        isDone(today) ? today : null,
      ))
      .then((mode) => { if (['push', 'on', 'limited'].includes(mode)) setSetting('notifyMode', mode); })
      .catch(() => { /* the switch stays as it was */ });
  }

  // The day can turn while the app sits open on the home screen.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshButtons();
  });
}
