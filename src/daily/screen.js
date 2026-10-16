/**
 * The challenge screen: today's card without its name and colored mana, the
 * color board, and the reveal.
 *
 * A full-screen layer over the home screen, not a route of app.js: the
 * router, the match clock and the wake lock never learn it exists, so
 * nothing here can disturb a table. It owns one history entry while open,
 * so the phone's back gesture closes it instead of leaving the app.
 *
 * Loaded on demand by entry.js.
 */

import { el, clear, icon, buzz } from '../ui.js';
import { colorHex } from '../colors.js';
import { currentLang } from '../i18n.js';
import { group, row, selectRow, toggleRow } from '../views/setup/rows.js';
import { dt } from './i18n.js';
import {
  challengeFor, dayKey, msUntilNextDay, previousDay,
} from './schedule.js';
import { buildPuzzle } from './card.js';
import { loadCard, CARD_LANGS, isCardLang } from './fetch.js';
import {
  CHOICES, COLORLESS, MAX_TRIES, answerOf, progress, toggleChoice, totals,
} from './game.js';
import * as storage from './storage.js';
import * as notify from './notify.js';

/** The card language when the person never chose one: the app's, if Scryfall has it. */
function defaultCardLang() {
  const lang = currentLang();
  return isCardLang(lang) ? lang : 'en';
}

function cardLang() {
  const chosen = storage.settings().cardLang;
  return isCardLang(chosen) ? chosen : defaultCardLang();
}

function notifyTexts() {
  return { title: dt('daily.notifyTitle'), body: dt('daily.notifyBody') };
}

function colorName(c) {
  return c === COLORLESS ? dt('daily.colorless') : dt('daily.color.' + c);
}

/** A mana-like pip in the color's own tone. */
function pip(c, extra = '') {
  return el('span', {
    class: 'daily-pip' + extra,
    style: { '--pip': colorHex(c) },
    'aria-hidden': 'true',
  }, [c]);
}

/** One line of card text, from the segments card.js produced. */
function line(segs, tag = 'p') {
  return el(tag, {}, segs.map((s) => {
    if (s.kind === 'name') return el('span', { class: 'daily-redacted', text: dt('daily.hiddenName') });
    if (s.kind === 'mana') {
      return el('span', { class: 'daily-sym is-hidden', title: dt('daily.hiddenMana'), 'aria-label': dt('daily.hiddenMana') }, ['?']);
    }
    if (s.kind === 'symbol') return el('span', { class: 'daily-sym' }, [s.text]);
    return s.text;
  }));
}

function cardFrame(puzzle) {
  const stat = puzzle.power !== null && puzzle.toughness !== null
    ? puzzle.power + '/' + puzzle.toughness
    : (puzzle.loyalty !== null ? puzzle.loyalty : puzzle.defense);

  return el('article', { class: 'daily-card' }, [
    el('header', { class: 'daily-card-head' }, [
      el('span', { class: 'daily-card-name' }, [el('span', { class: 'daily-redacted is-title', text: '?????' })]),
      puzzle.manaValue !== null
        ? el('span', { class: 'daily-mv', title: dt('daily.manaValue') }, [
          el('span', { class: 'daily-mv-label', text: dt('daily.manaValue') }),
          el('span', { class: 'daily-mv-value', text: String(puzzle.manaValue) }),
        ])
        : null,
    ]),
    line(puzzle.typeLine, 'div'),
    el('div', { class: 'daily-card-text' }, [
      ...puzzle.text.map((segs) => line(segs)),
      puzzle.flavor ? el('div', { class: 'daily-flavor' }, [line(puzzle.flavor)]) : null,
    ]),
    stat !== null && stat !== undefined ? el('div', { class: 'daily-card-stat', text: String(stat) }) : null,
  ]);
}

function formatWait(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min';
}

let current = null; // the open screen, so a second open is ignored

/**
 * Opens the screen. `onClose` runs after it leaves (entry.js repaints the
 * home button's dot).
 */
export function openDailyScreen({ onClose } = {}) {
  if (current) return current;

  const today = dayKey();
  const challenge = challengeFor(today);
  let selection = [];
  let load = null;          // { puzzle, fallback } once the card arrived
  let failed = false;
  let optionsOpen = false;
  let controller = null;
  let ticker = null;

  const body = el('div', { class: 'daily-body' });
  const options = el('section', { class: 'daily-options' });
  options.hidden = true;

  const record = () => storage.day(today) || {};

  const close = (fromHistory) => {
    if (!current) return;
    current = null;
    if (controller) controller.abort();
    clearInterval(ticker);
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    layer.classList.remove('is-open');
    setTimeout(() => layer.remove(), 200);
    if (!fromHistory) {
      consuming = true;
      try { history.back(); } catch { consuming = false; }
    }
    if (onClose) onClose();
  };

  // The history entry: back closes the challenge. `consuming` marks our own
  // history.back() so its popstate is not read as a second gesture.
  let consuming = false;
  const onPop = () => {
    if (consuming) { consuming = false; return; }
    close(true);
  };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-scrim')) close(false); };

  const backBtn = el('button', { class: 'icon-btn', 'aria-label': dt('daily.close'), onClick: () => close(false) }, [icon('back')]);
  const gearBtn = el('button', {
    class: 'icon-btn',
    'aria-label': dt('daily.settings'),
    'aria-expanded': 'false',
    onClick: () => {
      optionsOpen = !optionsOpen;
      gearBtn.setAttribute('aria-expanded', String(optionsOpen));
      paintOptions();
    },
  }, [icon('gear')]);

  const layer = el('div', { class: 'daily-screen', role: 'dialog', 'aria-modal': 'true', 'aria-label': dt('daily.title') }, [
    el('div', { class: 'daily' }, [
      el('header', { class: 'daily-head' }, [
        backBtn,
        el('div', { class: 'daily-heading' }, [
          el('h1', { class: 'daily-title', text: dt('daily.title') }),
          el('p', { class: 'daily-sub', text: dt('daily.number', { n: challenge ? challenge.number : '–' }) }),
        ]),
        gearBtn,
      ]),
      options,
      body,
    ]),
  ]);

  /* ---------------- options ---------------- */

  function notifyStatus() {
    const perm = notify.permission();
    if (perm === 'unsupported') return dt('daily.notifyUnsupported');
    if (perm === 'denied') return dt('daily.notifyDenied');
    const s = storage.settings();
    if (!s.notify) return dt('daily.notifyOff');
    return s.notifyMode === 'limited' ? dt('daily.notifyLimited') : dt('daily.notifyOn');
  }

  function paintOptions() {
    clear(options);
    options.hidden = !optionsOpen;
    if (!optionsOpen) return;

    const s = storage.settings();
    const perm = notify.permission();
    options.append(
      group(dt('daily.settings'), [
        selectRow(dt('daily.cardLang'), cardLang(), CARD_LANGS, (lang) => {
          storage.setSetting('cardLang', lang);
          fetchCard();
        }),
        el('p', { class: 'daily-option-note', text: dt('daily.cardLangSub') }),
        perm === 'unsupported'
          ? row({ label: dt('daily.notify'), sub: notifyStatus() })
          : toggleRow(dt('daily.notify'), notifyStatus(), Boolean(s.notify), async (on) => {
            if (on) {
              const result = await notify.enable(notifyTexts());
              const enabled = result === 'on' || result === 'limited';
              storage.setSetting('notify', enabled);
              storage.setSetting('notifyMode', enabled ? result : null);
              if (enabled && storage.isDone(today)) notify.updateConfig({ playedOn: today });
            } else {
              storage.setSetting('notify', false);
              await notify.disable();
            }
            paintOptions();
          }),
        s.notify && perm === 'granted'
          ? row({ label: dt('daily.notifyTest'), onTap: () => notify.sendTest(notifyTexts()) })
          : null,
      ]),
    );
  }

  /* ---------------- the card ---------------- */

  async function fetchCard() {
    if (!challenge) return;
    if (controller) controller.abort();
    controller = new AbortController();
    const mine = controller;
    failed = false;
    load = null;
    paint();
    try {
      const found = await loadCard(today, challenge.name, cardLang(), { signal: mine.signal });
      if (mine !== controller || !current) return;
      load = { puzzle: buildPuzzle(found.card, { extraHide: challenge.hide }), fallback: found.fallback };
    } catch (err) {
      if (mine !== controller || !current || (err && err.name === 'AbortError')) return;
      failed = true;
    }
    paint();
  }

  /* ---------------- the board ---------------- */

  function guess() {
    if (!selection.length || !load) return;
    const rec = record();
    const guesses = [...(rec.guesses || []), selection];
    const p = progress(guesses, load.puzzle.colors);
    const done = p.status !== 'playing';
    storage.saveDay(today, {
      number: challenge.number,
      card: challenge.name,
      guesses,
      done,
      won: p.status === 'won',
      answer: done ? answerOf(load.puzzle.colors) : undefined,
    });
    if (done) notify.updateConfig({ playedOn: today });
    selection = [];
    buzz(p.status === 'won' ? 24 : 10);
    paint();
  }

  function board(p) {
    const picks = el('div', { class: 'daily-picks', role: 'group', 'aria-label': dt('daily.question') },
      CHOICES.map((c) => el('button', {
        class: 'daily-pick' + (selection.includes(c) ? ' is-on' : ''),
        'aria-pressed': String(selection.includes(c)),
        style: { '--pip': colorHex(c) },
        onClick: () => { selection = toggleChoice(selection, c); buzz(); paint(); },
      }, [pip(c), el('span', { class: 'daily-pick-label', text: colorName(c) })])));

    return el('section', { class: 'daily-board' }, [
      el('p', { class: 'daily-question', text: dt('daily.question') }),
      picks,
      el('button', {
        class: 'btn primary block',
        disabled: selection.length ? null : true,
        onClick: guess,
      }, [selection.length ? dt('daily.guess') : dt('daily.pickFirst')]),
      el('p', { class: 'daily-tries', text: dt('daily.triesLeft', { n: p.triesLeft }) }),
    ]);
  }

  function guessList(p) {
    if (!p.results.length) return null;
    return el('ol', { class: 'daily-guesses' }, p.results.map((r) => el('li', { class: 'daily-guess' + (r.exact ? ' is-exact' : '') },
      r.guess.map((c) => el('span', { class: 'daily-guess-item' + (r.marks[c] ? ' is-hit' : ' is-miss') }, [
        pip(c),
        el('span', { class: 'daily-guess-mark', 'aria-label': colorName(c) }, [r.marks[c] ? '✓' : '✕']),
      ])))));
  }

  function hint(p) {
    if (p.status !== 'playing' || p.colorCount === null) return null;
    return el('p', {
      class: 'daily-hint',
      text: p.colorCount === 0 ? dt('daily.hintColorless') : dt('daily.hintCount', { n: p.colorCount }),
    });
  }

  function statsRow() {
    const all = totals(storage.allDays(), today, previousDay);
    const stat = (key, value) => el('div', { class: 'daily-stat' }, [
      el('span', { class: 'daily-stat-value', text: String(value) }),
      el('span', { class: 'daily-stat-label', text: dt(key) }),
    ]);
    return el('div', { class: 'daily-stats' }, [
      stat('daily.stats.played', all.played),
      stat('daily.stats.wins', all.wins),
      stat('daily.stats.streak', all.current),
      stat('daily.stats.best', all.best),
    ]);
  }

  function result(p) {
    const answer = answerOf(load.puzzle.colors);
    const won = p.status === 'won';
    const tryNumber = p.results.findIndex((r) => r.exact) + 1;
    const { reveal } = load.puzzle;
    const next = el('p', { class: 'daily-next', text: dt('daily.next', { time: formatWait(msUntilNextDay()) }) });
    clearInterval(ticker);
    ticker = setInterval(() => {
      if (dayKey() !== today) { close(false); return; }
      next.textContent = dt('daily.next', { time: formatWait(msUntilNextDay()) });
    }, 30000);

    return el('section', { class: 'daily-result' + (won ? ' is-won' : ' is-lost') }, [
      el('h2', { class: 'daily-result-title', text: won ? dt('daily.won') : dt('daily.lost') }),
      el('p', {
        class: 'daily-result-sub',
        text: won
          ? dt('daily.wonIn', { n: tryNumber, max: MAX_TRIES })
          : dt('daily.lostAnswer', { colors: answer.map(colorName).join(' + ') }),
      }),
      el('div', { class: 'daily-answer' }, answer.map((c) => pip(c, ' is-big'))),
      el('figure', { class: 'daily-reveal' }, [
        reveal.image ? el('img', { class: 'daily-reveal-img', src: reveal.image, alt: reveal.name, loading: 'lazy' }) : null,
        el('figcaption', {}, [
          el('strong', { text: reveal.name }),
          reveal.artist ? el('span', { text: dt('daily.artist', { name: reveal.artist }) }) : null,
          reveal.link ? el('a', { href: reveal.link, target: '_blank', rel: 'noopener', text: dt('daily.seeOnScryfall') }) : null,
        ]),
      ]),
      statsRow(),
      next,
    ]);
  }

  /* ---------------- painting ---------------- */

  function paint() {
    clear(body);
    if (!challenge) return;

    if (failed) {
      body.append(el('div', { class: 'daily-state' }, [
        el('p', { text: dt('daily.loadFailed') }),
        el('button', { class: 'btn ghost', onClick: fetchCard }, [dt('daily.retry')]),
      ]));
      return;
    }
    if (!load) {
      body.append(el('div', { class: 'daily-state is-loading' }, [el('p', { text: dt('daily.loading') })]));
      return;
    }

    const p = progress(record().guesses, load.puzzle.colors);
    const note = load.fallback ? dt('daily.fallback') : (load.puzzle.mixed ? dt('daily.mixed') : null);
    // Filtered: the native append() writes a null as the text "null".
    body.append(...[
      note ? el('p', { class: 'daily-note', text: note }) : null,
      cardFrame(load.puzzle),
      guessList(p),
      hint(p),
      p.status === 'playing' ? board(p) : result(p),
    ].filter(Boolean));
  }

  /* ---------------- open ---------------- */

  current = { close };
  document.body.append(layer);
  try { history.pushState({ daily: true }, ''); } catch { /* back just leaves */ }
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => layer.classList.add('is-open'));
  backBtn.focus();

  // The worker speaks the language the app speaks today.
  if (storage.settings().notify) notify.updateConfig(notifyTexts());

  paintOptions();
  fetchCard();
  return current;
}
