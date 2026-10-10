/** DOM utilities. Small on purpose - the app does not need a framework. */

import { t } from './i18n.js';
import { colorHex } from './colors.js';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') applyStyle(node, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Applies inline styles.
 *
 * Custom properties (--something) REQUIRE setProperty: assigning by index
 * (`style['--x'] = v`) registers nothing in the browser, it only creates a
 * loose property on the object. The whole app passes the deck's color identity
 * this way, and for a long time it silently fell through to the root --accent
 * - the translucent white - wiping the color off every panel, card and mana
 * dot.
 */
function applyStyle(node, styles) {
  for (const [prop, value] of Object.entries(styles)) {
    if (value === null || value === undefined) continue;
    if (prop.startsWith('--')) node.style.setProperty(prop, value);
    else node.style[prop] = value;
  }
}


/**
 * The app mark: the five mana pips in a ring, the same as the installed icon.
 *
 * It used to be a small square with a WUBRG gradient - unreadable at 14px,
 * because five colors squeezed into a gradient become a brownish smudge. In
 * separate circles each color still reads, and the shape repeats the home
 * screen icon, which makes the app look like the same thing inside and out.
 *
 * Drawn with the vivid colors of the current theme, so it follows light and
 * dark.
 */
export function brandMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'brand-mark');
  svg.setAttribute('aria-hidden', 'true');

  ['W', 'U', 'B', 'R', 'G'].forEach((color, i) => {
    const ang = -Math.PI / 2 + i * ((2 * Math.PI) / 5);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', (12 + 7.4 * Math.cos(ang)).toFixed(2));
    c.setAttribute('cy', (12 + 7.4 * Math.sin(ang)).toFixed(2));
    c.setAttribute('r', '3.5');
    c.setAttribute('fill', colorHex(color));
    svg.append(c);
  });
  return svg;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function icon(name) {
  // Glyphs hand-drawn in SVG: no dependency on an icon font.
  const paths = {
    undo: 'M9 5 4 10l5 5M4 10h8a5 5 0 0 1 0 10h-1',
    redo: 'M11 5l5 5-5 5M16 10H8a5 5 0 0 0 0 10h1',
    more: 'M5 10h.01M10 10h.01M15 10h.01',
    close: 'M5 5l10 10M15 5L5 15',
    arrow: 'M4 10h11M11 6l4 4-4 4',
    plus: 'M10 4v12M4 10h12',
    minus: 'M4 10h12',
    chart: 'M4 16V9M9 16V4M14 16v-5',
    crown: 'M3 15h14M3 15 2 6l4.5 3L10 3l3.5 6L18 6l-1 9',
    skull: 'M10 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 10 2ZM7.5 9.5h.01M12.5 9.5h.01',
    back: 'M12 4l-6 6 6 6',
    grip: 'M6 6h8M6 10h8M6 14h8',
    gear: 'M10 7.2A2.8 2.8 0 1 0 10 12.8 2.8 2.8 0 0 0 10 7.2M15.6 10c0-.4 0-.8-.1-1.2l1.6-1.2-1.6-2.8-1.9.7a5.9 5.9 0 0 0-2-1.2L11.3 2H8.7l-.3 2.3c-.8.2-1.4.6-2 1.2l-1.9-.7-1.6 2.8 1.6 1.2a6.6 6.6 0 0 0 0 2.4l-1.6 1.2 1.6 2.8 1.9-.7c.6.6 1.2 1 2 1.2l.3 2.3h2.6l.3-2.3c.8-.2 1.4-.6 2-1.2l1.9.7 1.6-2.8-1.6-1.2c.1-.4.1-.8.1-1.2Z',
    dice: 'M4 4h12v12H4zM8 8h.01M12 12h.01M8 12h.01M12 8h.01',
    download: 'M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15h12',
    share: 'M10 13V3M6.5 6.5 10 3l3.5 3.5M5 9v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name] || paths.more);
  svg.append(p);
  return svg;
}

let hapticsOn = true;

/** Turns haptic feedback on/off for the whole app at once. */
export function setHaptics(on) {
  hapticsOn = on !== false;
}

/** Short haptic feedback. Silent where unsupported or turned off. */
export function buzz(ms = 8) {
  if (!hapticsOn) return;
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}

/**
 * Closing by tapping outside, without falling for the ghost click.
 *
 * On a phone, the tap that OPENS a panel still fires a `click` right after,
 * and that click lands on the backdrop that was just mounted - which would
 * read it as "tapped outside" and close at once. On desktop this does not
 * happen, so the bug only shows on the device.
 *
 * The rule here is simple: it only closes if the finger went DOWN on the
 * backdrop. The ghost click comes without its own pointerdown, so it is
 * ignored.
 */
export function dismissOnBackdrop(scrim, close) {
  let armed = false;

  scrim.addEventListener('pointerdown', (e) => {
    armed = e.target === scrim;
  });
  scrim.addEventListener('click', (e) => {
    const shouldClose = armed && e.target === scrim;
    armed = false;
    if (shouldClose) close();
  });
}

/**
 * How much of the screen the phone keyboard took.
 *
 * `layout` has to be the height of the LAYOUT viewport - the same reference
 * that `position: fixed` and `100%` resolve against. The right reading of it
 * is `documentElement.clientHeight`.
 *
 * `window.innerHeight` does NOT work, and that was the defect: in browsers
 * where it follows the VISUAL viewport, the math became
 *
 *     innerHeight - visible - offset  ==  visible - visible - 0  ==  0
 *
 * that is, --kb zero, a full-size backdrop and the panel stuck to the bottom
 * edge - behind the keyboard. Whoever searched for an @ typed blind.
 *
 * The math: the visible region goes from `offset` to `offset + visible`. A
 * fixed element with `bottom: B` has its base at `layout - B`. For the base to
 * land at the end of the visible region, B = layout - visible - offset.
 */
export function keyboardHeight(layout, visible, offset, hasField) {
  // A keyboard only exists with a focused text field, and without this
  // condition the math reported a keyboard where there was none: the phone's
  // URL bar also shrinks the visual viewport, and the difference came out as
  // some 60px of "keyboard" - every panel went up a bit, for no reason.
  if (hasField === false) return 0;

  const l = Number(layout) || 0;
  const v = Number(visible) || 0;
  const d = Number(offset) || 0;
  if (!l || !v) return 0;
  return Math.max(0, Math.round(l - v - d));
}

/** Is a text field focused? It is the only situation in which there is a keyboard. */
function textFieldFocused() {
  const target = typeof document !== 'undefined' && document.activeElement;
  if (!target) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

/**
 * Makes sure the focused field is visible INSIDE the panel.
 *
 * A complement to --kb, not a replacement: --kb takes the panel out from
 * behind the keyboard, and this handles the tall panel whose field is at the
 * end. Order matters - scrolling before the panel goes up measures the wrong
 * geometry, and that is why what calls this is the viewport change itself,
 * not a timer after focus.
 *
 * `position: fixed` has no scrollable ancestor, so scrolling would NEVER fix a
 * whole panel behind the keyboard. That part belongs to --kb.
 */
function revealFocusedField() {
  const field = document.activeElement;
  if (!field || !field.closest || !field.getBoundingClientRect) return;
  if (field.tagName !== 'INPUT' && field.tagName !== 'TEXTAREA') return;
  if (!field.closest('.sheet')) return;

  const vv = window.visualViewport;
  if (!vv) return;
  const box = field.getBoundingClientRect();
  const visibleTop = vv.offsetTop;
  const visibleBottom = vv.offsetTop + vv.height;
  // Already visible with some room: moving now would be a pointless jump.
  if (box.top >= visibleTop && box.bottom <= visibleBottom - 4) return;
  if (field.scrollIntoView) {
    field.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/**
 * Phone keyboard: the panel has to go up with it.
 *
 * The panel is fixed to the bottom edge, and the keyboard covers exactly that
 * strip - so the text field disappears behind it. `visualViewport` says how
 * much screen the keyboard took; the backdrop shrinks by the same amount and
 * the panel goes up on its own.
 *
 * It applies to EVERY field in a panel: commander search, player name, the
 * secret vote number and the @ search - they all go through the same panel.
 *
 * It does everything without touching the page layout, and that is a
 * requirement, not a detail: the app screens are `height: 100%` in a chain
 * (html, #app, .stats), and changing the LAYOUT viewport while scrolling
 * re-lays out the chain and moves the scroll anchor. That is why
 * `interactive-widget=resizes-content` left the meta tag.
 */
function followKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const adjust = () => {
    const layout = document.documentElement.clientHeight || window.innerHeight;
    const taken = keyboardHeight(
      layout, vv.height, vv.offsetTop, textFieldFocused(),
    );
    document.documentElement.style.setProperty('--kb', taken + 'px');
    revealFocusedField();
  };
  vv.addEventListener('resize', adjust);
  vv.addEventListener('scroll', adjust);
  adjust();
}

if (typeof window !== 'undefined' && window.visualViewport) followKeyboard();

let sheetHost = null;
const sheetWatchers = new Set();

const SLIDE_MS = 320;

/** Is a panel open right now? */
export function isSheetOpen() {
  return sheetHost !== null;
}

/**
 * Signals when a panel opens or closes.
 *
 * It serves whoever redraws the screen underneath: rotating the device
 * remounts the table, and remounting calls destroy(), which would close the
 * open panel - in the middle of a vote, for example. Whoever listens here
 * postpones the redraw until the panel leaves.
 */
export function onSheetChange(fn) {
  sheetWatchers.add(fn);
  return () => sheetWatchers.delete(fn);
}

function notifySheetWatchers() {
  sheetWatchers.forEach((fn) => fn(isSheetOpen()));
}

/**
 * A bottom panel with several screens, sliding sideways.
 *
 * Each step is { title, subtitle, build(pane, api) }, and build receives an api
 * with next / back / close / remeasure. The screens are really stacked - the
 * previous one stays mounted behind - so going back does not lose what was on
 * screen nor redo any search.
 *
 * The panel height follows the active screen through a ResizeObserver: the
 * commander list grows and shrinks with the search, and the panel has to
 * follow.
 */
export function openFlow(firstStep, opts = {}) {
  closeSheet();

  const stack = [];
  let ro = null;

  const titleEl = el('h2', { class: 'sheet-title' });
  const subEl = el('p', { class: 'sheet-sub' });
  const backBtn = el('button', {
    class: 'icon-btn flow-back',
    'aria-label': t('common.back'),
    onClick: () => api.back(),
  }, [icon('back')]);

  const track = el('div', { class: 'flow' });
  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-grip' }),
    el('header', { class: 'sheet-head' }, [
      backBtn,
      el('div', { class: 'sheet-heading' }, [titleEl, subEl]),
      el('button', { class: 'icon-btn', 'aria-label': t('common.close'), onClick: closeSheet }, [icon('close')]),
    ]),
    el('div', { class: 'sheet-body' }, [track]),
  ]);

  sheetHost = el('div', {
    class: 'sheet-scrim' + (opts.centered ? ' is-centered' : ''),
  }, [sheet]);
  dismissOnBackdrop(sheetHost, closeSheet);

  // Safety net for when focusing does not move the viewport (physical
  // keyboard, or a field that already fit): then `resize` does not fire and
  // the --kb check does not run. When the keyboard goes up, what rules is
  // revealFocusedField called by the viewport change - which measures after
  // the panel has already gone up.
  sheetHost.addEventListener('focusin', () => {
    setTimeout(revealFocusedField, 300);
  });

  const top = () => stack[stack.length - 1];

  const measure = () => {
    const cur = top();
    if (cur) track.style.height = cur.pane.scrollHeight + 'px';
  };

  const watch = (pane) => {
    if (ro) ro.disconnect();
    ro = new ResizeObserver(measure);
    ro.observe(pane);
  };

  const paintHead = () => {
    const { step } = top();
    titleEl.textContent = step.title || '';
    subEl.textContent = step.subtitle || '';
    subEl.hidden = !step.subtitle;
    backBtn.hidden = !canGoBack();
  };

  // A step can forbid going back. In the secret vote this is no detail: going
  // back one screen would show the vote of whoever handed over the device.
  const canGoBack = () => stack.length > 1 && !top().step.noBack;

  const api = {
    close: closeSheet,
    remeasure: measure,
    depth: () => stack.length,
    canGoBack: () => canGoBack(),

    next(step) {
      const prev = top();
      const pane = el('div', { class: 'flow-pane is-next' });
      track.append(pane);
      stack.push({ step, pane });
      step.build(pane, api);
      paintHead();
      watch(pane);

      if (!prev) {
        // First screen: comes in already in place, without sliding sideways or
        // animating the height from zero. Removing `is-next` here is mandatory
        // - it carries opacity:0 and pointer-events:none.
        pane.classList.remove('is-next');
        track.style.transition = 'none';
        measure();
        requestAnimationFrame(() => { track.style.transition = ''; });
        return;
      }
      requestAnimationFrame(() => {
        prev.pane.classList.add('is-past');
        pane.classList.remove('is-next');
        measure();
      });
    },

    back() {
      if (!canGoBack()) { if (stack.length < 2) closeSheet(); return; }
      const leaving = stack.pop();
      const returning = top();
      returning.pane.classList.remove('is-past');
      leaving.pane.classList.add('is-next');
      paintHead();
      watch(returning.pane);
      measure();
      setTimeout(() => leaving.pane.remove(), SLIDE_MS);
    },
  };

  sheetHost._onClose = () => {
    if (ro) ro.disconnect();
    if (opts.onClose) opts.onClose();
  };

  document.body.append(sheetHost);
  api.next(firstStep);
  bindSwipeBack(track, api);
  requestAnimationFrame(() => sheetHost && sheetHost.classList.add('is-open'));
  notifySheetWatchers();
  return api;
}

/**
 * Dragging to the right goes back one screen.
 *
 * It only engages with a clear horizontal intent (twice as much x as y),
 * otherwise it steals the scrolling of the commander list. Text fields are
 * left out.
 */
function bindSwipeBack(track, api) {
  let start = null;

  track.addEventListener('pointerdown', (e) => {
    if (!api.canGoBack()) return;
    if (e.target.closest('input, textarea')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId, engaged: false };
  });

  track.addEventListener('pointermove', (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.engaged) {
      if (Math.abs(dy) > Math.abs(dx)) { start = null; return; } // it is a scroll
      if (dx < 12 || Math.abs(dx) < Math.abs(dy) * 2) return;
      start.engaged = true;
      track.classList.add('is-swiping');
    }
    track.style.setProperty('--swipe', Math.max(0, dx) + 'px');
  });

  const finish = (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const engaged = start.engaged;
    start = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--swipe');
    if (engaged && dx > track.clientWidth * 0.28) api.back();
  };

  track.addEventListener('pointerup', finish);
  track.addEventListener('pointercancel', () => {
    start = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--swipe');
  });
}

/** A single-screen panel - the short form of openFlow. */
export function openSheet({ title, subtitle, build, onClose, centered }) {
  openFlow({ title, subtitle, build: (pane) => build(pane, closeSheet) }, { onClose, centered });
  return closeSheet;
}

export function closeSheet() {
  if (!sheetHost) return;
  const node = sheetHost;
  sheetHost = null;
  node.classList.remove('is-open');
  if (node._onClose) node._onClose();
  setTimeout(() => node.remove(), 200);
  notifySheetWatchers();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

let toastTimer = null;

/** A short-lived notice with an optional action - the main path for undo. */
export function toast(message, action) {
  let host = document.querySelector('.toast');
  if (host) host.remove();
  clearTimeout(toastTimer);

  host = el('div', { class: 'toast' }, [
    el('span', { class: 'toast-msg', text: message }),
    action
      ? el('button', {
          class: 'toast-action',
          onClick: () => { host.remove(); action.onClick(); },
        }, [action.label])
      : null,
  ]);
  document.body.append(host);
  requestAnimationFrame(() => host.classList.add('is-open'));
  toastTimer = setTimeout(() => {
    host.classList.remove('is-open');
    setTimeout(() => host.remove(), 200);
  }, action ? 4200 : 2200);
}

/** Confirmation for destructive actions. Resolves with true/false. */
export function confirmAction({ title, message, confirmLabel, danger = true }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    openSheet({
      title,
      subtitle: message,
      onClose: () => done(false),
      build: (body, close) => {
        body.append(
          el('div', { class: 'sheet-actions' }, [
            el('button', { class: 'btn ghost', onClick: () => { done(false); close(); } }, [t('common.cancel')]),
            el('button', {
              class: 'btn ' + (danger ? 'danger' : 'primary'),
              onClick: () => { done(true); close(); },
            }, [confirmLabel || t('common.confirm')]),
          ]),
        );
      },
    });
  });
}
