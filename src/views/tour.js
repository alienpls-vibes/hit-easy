/**
 * The guided tour: how to use the app, one slide per gesture.
 *
 * The table has no buttons for most of what it does - the length and the
 * place of a touch decide everything (see table/gestures.js) - so the first
 * match used to be spent discovering by accident that a double tap drains.
 * A toast with "drag to deal damage" taught one gesture out of five.
 *
 * It opens by itself once, on the first open of a device ever (see
 * `tourDue` and app.js), and stays one tap away in the settings and in the
 * table menu. From the table it starts at the table slides: whoever is
 * mid-game wants the gestures, not how to pick a commander.
 *
 * A full-screen layer, not a sheet: the illustrations need the room, and a
 * sheet would close when the table remounts on rotation. It owns one history
 * entry while open, so the phone's back gesture closes it.
 */

import { el, brandMark, buzz } from '../ui.js';
import { colorHex } from '../colors.js';
import { t } from '../i18n.js';
import * as store from '../store.js';

/** Which section a slide belongs to - the small label above its title. */
const SECTION = { home: 'tour.sectionHome', table: 'tour.sectionTable', end: 'tour.sectionEnd' };

/**
 * The slides, in order. `art` draws the illustration; the text comes from
 * `tour.<id>.title` and `tour.<id>.text`.
 */
export const SLIDES = [
  { id: 'welcome', section: null, art: () => welcomeArt() },
  { id: 'setup', section: 'home', art: () => setupArt() },
  { id: 'edges', section: 'table', art: () => edgesArt() },
  { id: 'drag', section: 'table', art: () => dragArt() },
  { id: 'double', section: 'table', art: () => doubleArt() },
  { id: 'single', section: 'table', art: () => singleArt() },
  { id: 'hub', section: 'table', art: () => hubArt() },
  { id: 'end', section: 'end', art: () => endArt() },
];

/** Where the tour starts when opened from the table. */
export const TABLE_START = SLIDES.findIndex((s) => s.section === 'table');

/**
 * Should the tour open by itself on this startup?
 *
 * Only while it is due (first open of the device, not yet closed), and not
 * when the app was opened for something else: a table link (`?mesa=`) or the
 * daily challenge (`?daily=1`, also the link a friend shares). Those keep the
 * tour due, so it shows on the next plain open.
 */
export function tourOnStartup(settings, search = '') {
  if (!settings || !settings.tourDue) return false;
  const params = new URLSearchParams(search || '');
  return !params.get('mesa') && params.get('daily') !== '1';
}

/** The tour was seen to the end or skipped: never again by itself. */
function markSeen() {
  const s = store.getDB().settings;
  if (s.tourDue) store.setSetting('tourDue', false);
  // The drag toast at the first table repeats a slide of the tour.
  if (!s.dragHintSeen) store.setSetting('dragHintSeen', true);
}

let current = null; // the open tour, so a second open is ignored

/**
 * Opens the tour. `from: 'table'` starts at the first table slide.
 * Returns `{ close }`.
 */
export function openTour({ from = null, onClose = null } = {}) {
  if (current) return current;

  let index = from === 'table' ? TABLE_START : 0;
  const reduceMotion = prefersReducedMotion();

  const counter = el('span', { class: 'tour-count' });
  const skipBtn = el('button', { class: 'tour-skip', onClick: () => close(false) }, [t('tour.skip')]);
  const track = el('div', { class: 'tour-track' });
  const dots = el('div', { class: 'tour-dots', role: 'tablist' });
  const backBtn = el('button', { class: 'btn ghost tour-back', onClick: () => go(index - 1) }, [t('common.back')]);
  const nextBtn = el('button', { class: 'btn primary tour-next', onClick: () => next() });

  const dotNodes = [];
  const slides = SLIDES.map((s, i) => {
    const node = el('section', {
      class: 'tour-slide',
      'aria-roledescription': 'slide',
      'aria-label': t('tour.step', { n: i + 1, total: SLIDES.length }),
    }, [
      el('div', { class: 'tour-art' }, [s.art()]),
      el('div', { class: 'tour-words' }, [
        s.section ? el('span', { class: 'tour-eyebrow', text: t(SECTION[s.section]) }) : null,
        el('h2', { class: 'tour-title', text: t('tour.' + s.id + '.title') }),
        el('p', { class: 'tour-text', text: t('tour.' + s.id + '.text') }),
        i === SLIDES.length - 1 ? el('p', { class: 'tour-note', text: t('tour.whereAgain') }) : null,
      ]),
    ]);
    track.append(node);
    const dot = el('button', {
      class: 'tour-dot',
      role: 'tab',
      'aria-label': t('tour.step', { n: i + 1, total: SLIDES.length }),
      onClick: () => go(i),
    });
    dots.append(dot);
    dotNodes.push(dot);
    return node;
  });

  const viewport = el('div', { class: 'tour-viewport' }, [track]);

  const layer = el('div', {
    class: 'tour' + (reduceMotion ? ' is-still' : ''),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('tour.label'),
  }, [
    el('header', { class: 'tour-head' }, [counter, skipBtn]),
    viewport,
    el('footer', { class: 'tour-foot' }, [
      dots,
      el('div', { class: 'tour-actions' }, [backBtn, nextBtn]),
    ]),
  ]);

  function paint() {
    track.style.setProperty('--at', String(index));
    slides.forEach((node, i) => {
      node.classList.toggle('is-active', i === index);
      node.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      // Buttons do not live on hidden slides, but `inert` also keeps a
      // screen reader from wandering into the slide next door.
      node.inert = i !== index;
    });
    dotNodes.forEach((d, i) => {
      d.classList.toggle('is-on', i === index);
      d.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    counter.textContent = t('tour.step', { n: index + 1, total: SLIDES.length });
    const last = index === SLIDES.length - 1;
    backBtn.hidden = index === 0;
    nextBtn.textContent = last ? t('tour.done') : t('tour.next');
    // On the last slide "skip" would say the same as the main button.
    skipBtn.hidden = last;
  }

  function go(i) {
    const to = Math.max(0, Math.min(SLIDES.length - 1, i));
    if (to === index) return;
    index = to;
    buzz(6);
    paint();
  }

  function next() {
    if (index === SLIDES.length - 1) close(false);
    else go(index + 1);
  }

  /* ---------------- swipe ---------------- */

  // The track follows the finger and decides on release: a quarter of the
  // width, or a quick flick, turns the page. A mostly vertical move is left
  // alone - the text of a slide may need to scroll on a short screen.
  let swipe = null;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, t: Date.now(), engaged: false };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (!swipe.engaged) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { swipe = null; return; }
      if (Math.abs(dx) < 10) return;
      swipe.engaged = true;
      try { viewport.setPointerCapture(e.pointerId); } catch { /* fine without */ }
      track.classList.add('is-swiping');
    }
    // Resistance at the ends: there is nothing before the first slide.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === SLIDES.length - 1);
    track.style.setProperty('--drag', (atEdge ? dx / 3 : dx) + 'px');
  });
  const endSwipe = (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    const { engaged } = swipe;
    const dx = e.clientX - swipe.x;
    const fast = Math.abs(dx) / Math.max(1, Date.now() - swipe.t) > 0.5;
    swipe = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--drag');
    if (!engaged) return;
    if (Math.abs(dx) > viewport.clientWidth * 0.22 || (fast && Math.abs(dx) > 24)) {
      go(index + (dx < 0 ? 1 : -1));
    }
  };
  viewport.addEventListener('pointerup', endSwipe);
  viewport.addEventListener('pointercancel', (e) => {
    if (!swipe || swipe.id !== e.pointerId) return;
    swipe = null;
    track.classList.remove('is-swiping');
    track.style.removeProperty('--drag');
  });

  /* ---------------- keys and back ---------------- */

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(false); }
    else if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'ArrowLeft') go(index - 1);
  };

  // `consuming` marks our own history.back(), so its popstate is not read as
  // a second gesture. app.js ignores the event: no sheet is open under the
  // tour, and the route is not the statistics.
  let consuming = false;
  const onPop = () => {
    if (consuming) { consuming = false; return; }
    close(true);
  };

  function close(fromHistory) {
    if (!current) return;
    current = null;
    markSeen();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('popstate', onPop);
    layer.classList.remove('is-open');
    setTimeout(() => layer.remove(), 220);
    if (!fromHistory) {
      consuming = true;
      try { history.back(); } catch { consuming = false; }
    }
    if (onClose) onClose();
  }

  current = { close: () => close(false) };
  paint();
  document.body.append(layer);
  try { history.pushState({ tour: true }, ''); } catch { /* back just leaves */ }
  window.addEventListener('popstate', onPop);
  // Capture: the sheets' Escape listener is on the document too, and the tour
  // sits above them.
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => layer.classList.add('is-open'));
  nextBtn.focus({ preventScroll: true });
  return current;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/* ==========================================================================
   Illustrations.

   Schematic, not screenshots: a screenshot would show someone else's
   commanders and go stale with every visual change. Every shape takes its
   color from the theme tokens (classes in tour.css) and the deck accents from
   the current WUBRG palette, so light and dark both read.
   ========================================================================== */

const VIEW = '0 0 320 200';

function art(inner) {
  // Built from markup we write here, never from data - nothing outside this
  // file reaches it.
  const host = el('div', { class: 'tour-figure', html: '<svg viewBox="' + VIEW + '" aria-hidden="true">' + inner + '</svg>' });
  return host;
}

const TABLE = [
  // x, y, color, rotated (seated across the table)
  { x: 24, y: 22, c: 'G', rot: true },
  { x: 164, y: 22, c: 'W', rot: true },
  { x: 24, y: 104, c: 'R', rot: false },
  { x: 164, y: 104, c: 'U', rot: false },
];
const TW = 132;
const TH = 74;

function center(seat) {
  return { x: seat.x + TW / 2, y: seat.y + TH / 2 };
}

/** The device lying on the table, landscape. */
function phone() {
  return '<rect class="ta-phone" x="10" y="10" width="300" height="180" rx="20"/>';
}

/**
 * One player's panel. `life` is the number shown; `dim` greys it out;
 * `edges` draws the - and + strips; `ring` marks it as the attack target.
 */
function tile(seat, { life = '40', dim = false, edges = false, ring = false, extra = '' } = {}) {
  const hex = colorHex(seat.c);
  const { x: cx, y: cy } = center(seat);
  const turn = seat.rot ? ' transform="rotate(180 ' + cx + ' ' + cy + ')"' : '';
  let out = '<g class="ta-tile' + (dim ? ' is-dim' : '') + '"' + turn + '>';
  out += '<rect x="' + seat.x + '" y="' + seat.y + '" width="' + TW + '" height="' + TH + '" rx="12" fill="' + hex + '" fill-opacity="0.16" stroke="' + hex + '" stroke-opacity="0.55"/>';
  if (edges) {
    const w = TW * 0.27;
    out += '<rect class="ta-strip" x="' + seat.x + '" y="' + seat.y + '" width="' + w + '" height="' + TH + '" rx="12"/>';
    out += '<rect class="ta-strip" x="' + (seat.x + TW - w) + '" y="' + seat.y + '" width="' + w + '" height="' + TH + '" rx="12"/>';
    out += '<text class="ta-glyph" x="' + (seat.x + 16) + '" y="' + (cy + 6) + '">−</text>';
    out += '<text class="ta-glyph" x="' + (seat.x + TW - 26) + '" y="' + (cy + 6) + '">+</text>';
  }
  out += '<text class="ta-life" x="' + cx + '" y="' + (cy + 10) + '">' + life + '</text>';
  out += extra;
  out += '</g>';
  if (ring) {
    out += '<rect class="ta-ring" x="' + (seat.x - 3) + '" y="' + (seat.y - 3) + '" width="' + (TW + 6) + '" height="' + (TH + 6) + '" rx="14"/>';
  }
  return out;
}

/** The round turn button in the middle, plus undo and menu at its sides. */
function hub({ big = false } = {}) {
  const r = big ? 24 : 15;
  let out = '<g class="ta-hub' + (big ? ' is-big' : '') + '">';
  if (big) {
    out += '<circle class="ta-hub-btn" cx="112" cy="100" r="13"/>';
    out += '<path class="ta-icon" d="M9 5 4 10l5 5M4 10h8a5 5 0 0 1 0 10h-1" transform="translate(105.5 92.25) scale(0.62)"/>';
    out += '<circle class="ta-hub-btn" cx="208" cy="100" r="13"/>';
    out += '<circle class="ta-icon-dot" cx="203" cy="100" r="1.6"/><circle class="ta-icon-dot" cx="208" cy="100" r="1.6"/><circle class="ta-icon-dot" cx="213" cy="100" r="1.6"/>';
  }
  out += '<circle class="ta-hub-ring" cx="160" cy="100" r="' + r + '"/>';
  out += '<text class="ta-hub-label" x="160" y="' + (big ? 95 : 98) + '">' + escapeXml(t('table.turn')) + '</text>';
  out += '<text class="ta-hub-turn" x="160" y="' + (big ? 111 : 106) + '">3</text>';
  out += '</g>';
  return out;
}

/** A fingertip. `taps` ripples play on it; `cls` adds the animation. */
function finger(x, y, { taps = 1, cls = '' } = {}) {
  let out = '<g class="ta-finger ' + cls + '" transform="translate(' + x + ' ' + y + ')">';
  for (let i = 0; i < taps; i += 1) {
    out += '<circle class="ta-ripple" style="animation-delay:' + (i * 0.28) + 's" r="10"/>';
  }
  out += '<circle class="ta-tip" r="9"/>';
  out += '</g>';
  return out;
}

function welcomeArt() {
  const mark = brandMark();
  mark.classList.add('tour-mark');
  return el('div', { class: 'tour-figure is-welcome' }, [mark]);
}

/** The home screen standing up: life chips, three seats, the start button. */
function setupArt() {
  const x = 104;
  let out = '<rect class="ta-phone" x="' + x + '" y="6" width="112" height="188" rx="16"/>';
  // Starting life chips, 40 chosen.
  [['20', 0], ['30', 1], ['40', 2]].forEach(([v, i]) => {
    const cx = x + 22 + i * 34;
    out += '<rect class="ta-chip' + (v === '40' ? ' is-on' : '') + '" x="' + (cx - 14) + '" y="20" width="28" height="15" rx="7.5"/>';
    out += '<text class="ta-chip-text' + (v === '40' ? ' is-on' : '') + '" x="' + cx + '" y="31">' + v + '</text>';
  });
  ['R', 'U', 'G'].forEach((c, i) => {
    const y = 44 + i * 40;
    const hex = colorHex(c);
    out += '<rect class="ta-card" x="' + (x + 8) + '" y="' + y + '" width="96" height="34" rx="9"/>';
    out += '<rect x="' + (x + 13) + '" y="' + (y + 5) + '" width="24" height="24" rx="6" fill="' + hex + '" fill-opacity="0.55"/>';
    out += '<rect class="ta-line" x="' + (x + 43) + '" y="' + (y + 9) + '" width="38" height="6" rx="3"/>';
    out += '<rect class="ta-line is-soft" x="' + (x + 43) + '" y="' + (y + 20) + '" width="50" height="5" rx="2.5"/>';
    out += '<path class="ta-grip" d="M' + (x + 94) + ' ' + (y + 13) + 'h5M' + (x + 94) + ' ' + (y + 17) + 'h5M' + (x + 94) + ' ' + (y + 21) + 'h5"/>';
  });
  out += '<rect class="ta-start" x="' + (x + 8) + '" y="168" width="96" height="16" rx="8"/>';
  out += finger(x + 25, 66, { cls: 'is-tap' });
  return art(out);
}

/** A tap on the right edge: +1, and the number moves. */
function edgesArt() {
  const me = TABLE[2];
  const { y: cy } = center(me);
  let out = phone();
  TABLE.forEach((s) => {
    out += s === me
      ? tile(s, { life: '41', edges: true, extra: '<text class="ta-float" x="' + (me.x + TW - 20) + '" y="' + (cy - 14) + '">+1</text>' })
      : tile(s, { dim: true });
  });
  out += hub();
  out += finger(me.x + TW - 18, cy + 2, { cls: 'is-tap' });
  return art(out);
}

/** Press in the middle and drag to the target: the arrow follows. */
function dragArt() {
  const from = TABLE[2];
  const to = TABLE[1];
  const a = center(from);
  const b = center(to);
  const c = { x: (a.x + b.x) / 2 - (b.y - a.y) * 0.12, y: (a.y + b.y) / 2 + (b.x - a.x) * 0.12 };
  const d = 'M ' + a.x + ' ' + a.y + ' Q ' + c.x + ' ' + c.y + ' ' + b.x + ' ' + b.y;
  let out = phone();
  TABLE.forEach((s) => {
    out += tile(s, { dim: s !== from && s !== to, ring: s === to });
  });
  out += hub();
  out += '<path class="ta-arrow" pathLength="1" d="' + d + '"/>';
  out += '<circle class="ta-arrow-dot" cx="' + a.x + '" cy="' + a.y + '" r="4"/>';
  // The finger rides the same curve the app draws.
  out += '<g class="ta-finger is-drag">'
    + '<circle class="ta-tip" r="9"/>'
    + (prefersReducedMotion() ? '' : '<animateMotion dur="2.6s" repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes="0;0.15;0.7;1" calcMode="linear" path="' + d + '"/>')
    + '</g>';
  if (prefersReducedMotion()) out += finger(b.x, b.y);
  return art(out);
}

/** Two quick taps: everyone else loses life at once. */
function doubleArt() {
  const me = TABLE[2];
  const { x, y } = center(me);
  let out = phone();
  TABLE.forEach((s) => {
    if (s === me) { out += tile(s); return; }
    const hit = center(s);
    out += tile(s, {
      life: '37',
      extra: '<text class="ta-hit" x="' + hit.x + '" y="' + (hit.y - 18) + '">−3</text>',
    });
  });
  out += hub();
  out += finger(x, y - 4, { taps: 2, cls: 'is-double' });
  return art(out);
}

/** One tap in the middle: the player's panel comes up. */
function singleArt() {
  const me = TABLE[2];
  const hex = colorHex(me.c);
  const { x, y } = center(me);
  let out = phone();
  TABLE.forEach((s) => { out += tile(s, { dim: s !== me }); });
  out += hub();
  // The sheet, rising from the bottom edge of the device.
  // Clipped to the device, so the sheet comes up from its bottom edge.
  out += '<clipPath id="ta-clip-sheet"><rect x="10" y="10" width="300" height="180" rx="20"/></clipPath>';
  out += '<g clip-path="url(#ta-clip-sheet)"><g class="ta-sheet">'
    + '<rect class="ta-sheet-bg" x="70" y="96" width="180" height="94" rx="14"/>'
    + '<rect class="ta-line" x="140" y="102" width="40" height="4" rx="2"/>'
    + '<rect class="ta-line" x="84" y="116" width="44" height="7" rx="3.5"/>'
    + ['−5', '−1', '+1', '+5'].map((v, i) => '<rect class="ta-chip" x="' + (150 + i * 22) + '" y="112" width="19" height="15" rx="7"/>'
      + '<text class="ta-chip-text" x="' + (159.5 + i * 22) + '" y="123">' + v + '</text>').join('')
    + '<rect class="ta-line is-soft" x="84" y="138" width="70" height="6" rx="3"/>'
    + '<circle cx="214" cy="141" r="6" fill="' + hex + '" fill-opacity="0.6"/>'
    + '<circle cx="230" cy="141" r="6" fill="' + colorHex('U') + '" fill-opacity="0.6"/>'
    + '<rect class="ta-line is-soft" x="84" y="158" width="54" height="6" rx="3"/>'
    + '<rect class="ta-line is-soft" x="84" y="174" width="40" height="6" rx="3"/>'
    + '</g></g>';
  out += finger(x, y - 18, { cls: 'is-tap' });
  return art(out);
}

/** The middle of the table: turn, undo, menu. */
function hubArt() {
  let out = phone();
  TABLE.forEach((s) => { out += tile(s, { dim: true }); });
  out += '<circle class="ta-hub-glow" cx="160" cy="100" r="44"/>';
  out += hub({ big: true });
  out += finger(166, 108, { cls: 'is-tap' });
  return art(out);
}

/** The last one standing wins. */
function endArt() {
  const winner = TABLE[3];
  const { x, y } = center(winner);
  let out = phone();
  TABLE.forEach((s) => {
    out += s === winner ? tile(s, { life: '12', ring: true }) : tile(s, { life: '0', dim: true });
  });
  out += '<path class="ta-crown" d="M' + (x - 13) + ' ' + (y - 16) + 'h26M' + (x - 13) + ' ' + (y - 16) + 'l-1.5-12 6.5 4.5L' + x + ' ' + (y - 34) + 'l6.5 9.5 6.5-4.5-1.5 12"/>';
  return art(out);
}

/** Text placed between tags; attributes never carry translated text. */
function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

