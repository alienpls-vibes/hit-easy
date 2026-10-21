/**
 * Cases for the daily color challenge (src/daily/).
 *
 * Kept in their own file, spliced into the suite by tests/cases.js, so the
 * feature and its tests leave together if it is ever removed. Same rules as
 * the rest: no network, no real clock, every case starts from scratch.
 */

import {
  simulated, findAll, fire, textOf, fireWindow,
} from './dom-stub.js';
import { CALENDAR } from '../src/daily/calendar.js';
import {
  challengeFor, dayKey, isDayKey, daysBetween, previousDay, msUntilNextDay, lastListedDay,
} from '../src/daily/schedule.js';
import {
  buildPuzzle, colorsOf, hideNames, isColoredSymbol, nameForms, segments,
} from '../src/daily/card.js';
import {
  answerOf, judge, progress, toggleChoice, totals, MAX_TRIES,
} from '../src/daily/game.js';
import { bestPrint, slim, loadCard } from '../src/daily/fetch.js';
import { DAILY_DICTS, dt } from '../src/daily/i18n.js';
import * as storage from '../src/daily/storage.js';
import { dailyButton } from '../src/daily/entry.js';
import { syncDaily } from '../src/daily/sync.js';
import { backupText, importBackup } from '../src/views/stats/backup.js';
import { account } from '../src/cloud/account.js';
import {
  resultText, squares, challengeLink, whatsappUrl,
} from '../src/daily/share.js';
import { openDailyScreen } from '../src/daily/screen.js';
import { setLang } from '../src/i18n.js';
import { isSheetOpen, closeSheet } from '../src/ui.js';
import * as store from '../src/store.js';

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((what || 'value') + ': expected ' + e + ', got ' + a);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'false condition');
}

/** The visible text of a puzzle part, with the hidden pieces as markers. */
const show = (segs) => segs.map((s) => (s.kind === 'text' ? s.text
  : s.kind === 'name' ? '[NAME]'
    : s.kind === 'mana' ? '{?}' : '{' + s.text + '}')).join('');

/** A Scryfall-shaped card, English. */
const KRENKO = {
  object: 'card',
  lang: 'en',
  name: 'Krenko, Mob Boss',
  type_line: 'Legendary Creature — Goblin Warrior',
  oracle_text: "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.\nWhenever Krenko attacks, Krenko, Mob Boss's power doubles. {2}{R}: Krenko gains haste.",
  flavor_text: 'Krenko does not share.',
  cmc: 4,
  power: '3',
  toughness: '3',
  colors: ['R'],
  artist: 'Karl Kopinski',
  scryfall_uri: 'https://scryfall.com/card/x/1/krenko',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/a/b/krenko.jpg' },
};

/** The same card as a Portuguese print. */
const KRENKO_PT = {
  ...KRENKO,
  lang: 'pt',
  printed_name: 'Krenko, Chefe da Gangue',
  printed_type_line: 'Criatura Lendária — Goblin Guerreiro',
  printed_text: '{T}: Crie X fichas de criatura 1/1 vermelha do tipo Goblin.\nToda vez que Krenko, Chefe da Gangue, atacar, ganha {R}.',
};

/** A fake Scryfall: answers by URL, records what was asked. */
function fakeScryfall(routes) {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    asked.push(String(url));
    const hit = routes.find(([re]) => re.test(decodeURIComponent(String(url))));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => hit[1] };
  };
  return { asked, restore: () => { globalThis.fetch = real; } };
}

const ticks = async (n = 6) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0)); };

export const DAILY_CASES = [
  ['daily: every calendar line is a real date, in order, with no gaps', () => {
    ok(CALENDAR.length > 0, 'the calendar is empty');
    CALENDAR.forEach((line, i) => {
      ok(Array.isArray(line) && line.length >= 2 && line.length <= 3,
        'line ' + (i + 1) + ' must be [date, "name"] or [date, "name", [words]]');
      ok(isDayKey(line[0]), 'line ' + (i + 1) + ': "' + line[0] + '" is not a YYYY-MM-DD date');
      ok(typeof line[1] === 'string' && line[1].trim() === line[1] && line[1].length > 1,
        line[0] + ': the card name is empty or has spaces at the ends');
      if (line.length === 3) ok(Array.isArray(line[2]), line[0] + ': the third item must be a list of words');
      if (i > 0) {
        eq(daysBetween(CALENDAR[i - 1][0], line[0]), 1,
          line[0] + ' must come the day after ' + CALENDAR[i - 1][0]);
      }
    });
  }],

  ['daily: no card appears twice in the calendar', () => {
    const seen = new Map();
    for (const [date, name] of CALENDAR) {
      ok(!seen.has(name), '"' + name + '" is on ' + seen.get(name) + ' and again on ' + date);
      seen.set(name, date);
    }
  }],

  ['daily: the calendar still has days ahead (a warning, not a failure)', () => {
    // A failure here would block unrelated releases once the list runs out.
    // After the last line the list loops, so the game keeps working; this
    // only reminds whoever runs the tests to add more days.
    const left = daysBetween(dayKey(), lastListedDay());
    if (left < 14) {
      console.warn('\n  ⚠ daily calendar: ' + (left < 0 ? 'ran out ' + -left + ' day(s) ago, cards are repeating'
        : 'only ' + left + ' day(s) left') + ' - add lines to src/daily/calendar.js\n');
    }
  }],

  ['daily: each day gets its card, and days outside the list loop through it', () => {
    const cal = [['2026-10-16', 'A'], ['2026-10-17', 'B', ['bee']], ['2026-10-18', 'C']];
    eq(challengeFor('2026-10-16', cal).name, 'A');
    eq(challengeFor('2026-10-16', cal).number, 1, 'the first day is #1');
    eq(challengeFor('2026-10-17', cal).hide, ['bee'], 'the extra words to hide come along');
    eq(challengeFor('2026-10-18', cal).listed, true);
    eq(challengeFor('2026-10-19', cal).name, 'A', 'after the end it starts over');
    eq(challengeFor('2026-10-19', cal).listed, false);
    eq(challengeFor('2026-10-23', cal).name, 'B');
    eq(challengeFor('2026-10-15', cal).name, 'C', 'before the start it loops backwards');
    eq(challengeFor('2026-10-20', []), null, 'an empty calendar has no challenge');
  }],

  ['daily: the day turns at local midnight', () => {
    eq(dayKey(new Date(2026, 9, 16, 23, 59)), '2026-10-16');
    eq(dayKey(new Date(2026, 9, 17, 0, 0)), '2026-10-17');
    eq(previousDay('2027-01-01'), '2026-12-31');
    eq(previousDay('2028-03-01'), '2028-02-29', 'leap year');
    eq(msUntilNextDay(new Date(2026, 9, 16, 23, 0)), 60 * 60 * 1000);
    ok(!isDayKey('2026-02-30'), 'February 30th does not exist');
    ok(!isDayKey('16/10/2026'), 'only YYYY-MM-DD');
  }],

  ['daily: the name is hidden whole, by its short form, in any case, never inside other words', () => {
    const forms = nameForms(['Krenko, Mob Boss'], { legendary: true });
    eq(forms, ['Krenko, Mob Boss', 'Krenko'], 'longest first');
    eq(hideNames("Whenever Krenko attacks, Krenko, Mob Boss's power doubles.", forms, '#'),
      "Whenever # attacks, #'s power doubles.");
    eq(hideNames('KRENKO and krenko', forms, '#'), '# and #', 'case does not matter');
    eq(hideNames('Krenkos are not Krenko', forms, '#'), 'Krenkos are not #', 'whole words only');
    eq(nameForms(['Gwaihir the Windlord'], { legendary: true }), ['Gwaihir the Windlord', 'Gwaihir'],
      'legendary names without a comma still get their short form');
    eq(nameForms(['Sword of Fire and Ice']), ['Sword of Fire and Ice'],
      'a non-legendary card keeps only its full name - "Sword" is not its nickname');
    eq(nameForms(['Esika, God of the Tree // The Prismatic Bridge']).includes('The Prismatic Bridge'), true,
      'each face of a two-faced card is a name');
    eq(hideNames('Ação de Ícaro e ícaro', nameForms(['Ícaro']), '#'), 'Ação de # e #', 'accents and case');
  }],

  ['daily: only colored mana symbols are hidden', () => {
    for (const s of ['{W}', '{U}', '{B}', '{R}', '{G}', '{W/U}', '{2/W}', '{B/P}', '{G/U/P}', '{C/W}', '{H/W}']) {
      ok(isColoredSymbol(s), s + ' should be hidden');
    }
    for (const s of ['{1}', '{2}', '{X}', '{C}', '{T}', '{Q}', '{S}', '{E}', '{PW}', '{CHAOS}', '{1/2}', '{∞}']) {
      ok(!isColoredSymbol(s), s + ' gives no color away and should stay');
    }
    eq(show(segments('{2}{R}, {T}: Krenko deals 1 damage.', ['Krenko'])), '{2}{?}, {T}: [NAME] deals 1 damage.');
  }],

  ['daily: a card becomes a puzzle with no name and no colored mana anywhere', () => {
    const p = buildPuzzle(KRENKO);
    const all = [p.typeLine, ...p.text, p.flavor].map(show).join('\n');
    ok(!/krenko/i.test(all), 'the name leaked: ' + all);
    ok(!/\{R\}/.test(all), 'a red mana symbol leaked');
    eq(show(p.text[1]), "Whenever [NAME] attacks, [NAME]'s power doubles. {2}{?}: [NAME] gains haste.");
    eq(show(p.flavor), '[NAME] does not share.', 'the flavor text hides it too');
    eq([p.manaValue, p.power, p.toughness], [4, '3', '3']);
    eq(p.colors, ['R']);
    eq(p.reveal.name, 'Krenko, Mob Boss', 'the reveal shows the name');
  }],

  ['daily: a translated print uses its own text and hides its own name', () => {
    const p = buildPuzzle(KRENKO_PT);
    eq(p.lang, 'pt');
    eq(p.mixed, false);
    eq(show(p.typeLine), 'Criatura Lendária — Goblin Guerreiro');
    eq(show(p.text[1]), 'Toda vez que [NAME], atacar, ganha {?}.');
    eq(p.reveal.name, 'Krenko, Chefe da Gangue', 'the reveal uses the printed name');

    const half = buildPuzzle({ ...KRENKO_PT, printed_type_line: undefined });
    eq(half.mixed, true, 'a print missing a translated part says so');
    eq(show(half.typeLine), 'Legendary Creature — Goblin Warrior', 'and fills the gap in English');
  }],

  ['daily: the colors to guess are the card colors, front face for two-faced cards', () => {
    eq(colorsOf({ colors: ['G', 'W'] }), ['W', 'G'], 'WUBRG order');
    eq(colorsOf({ colors: [] }), [], 'colorless');
    eq(colorsOf({ card_faces: [{ colors: ['B'] }, { colors: ['B', 'G'] }] }), ['B']);
    eq(answerOf([]), ['C']);
  }],

  ['daily: a guess only says how many picked colors are on the card, never which', () => {
    eq(judge(['R'], ['R']), { exact: true, hits: 1, picked: 1 });
    eq(judge(['R', 'G'], ['R']), { exact: false, hits: 1, picked: 2 });
    eq(judge(['W', 'U'], ['U', 'B']), { exact: false, hits: 1, picked: 2 },
      'one of two is right - and nothing says it is the blue');
    eq(judge(['C'], []), { exact: true, hits: 1, picked: 1 }, 'colorless is a valid answer');
    eq(judge(['C'], ['G']), { exact: false, hits: 0, picked: 1 });
    eq(judge(['W'], ['W', 'U']).exact, false, 'a part of the answer is not the answer');
    ok(!('marks' in judge(['W', 'U'], ['W'])), 'no per-color verdict leaves judge()');
  }],

  ['daily: three tries, and a miss never tells how many colors the card has', () => {
    const colors = ['U', 'B'];
    let p = progress([], colors);
    eq([p.status, p.triesLeft], ['playing', MAX_TRIES]);
    p = progress([['U']], colors);
    eq([p.status, p.triesLeft], ['playing', 2]);
    ok(!('colorCount' in p), 'no hint with the number of colors');
    p = progress([['U'], ['U', 'B']], colors);
    eq(p.status, 'won');
    p = progress([['W'], ['R'], ['G']], colors);
    eq(p.status, 'lost');
  }],

  ['daily: colorless excludes the five colors on the board', () => {
    eq(toggleChoice([], 'G'), ['G']);
    eq(toggleChoice(['G'], 'W'), ['W', 'G'], 'board order');
    eq(toggleChoice(['W', 'G'], 'C'), ['C'], 'colorless clears the colors');
    eq(toggleChoice(['C'], 'U'), ['U'], 'a color clears colorless');
    eq(toggleChoice(['U'], 'U'), [], 'tapping again unpicks');
  }],

  ['daily: streaks count consecutive won days, and today unplayed does not break one', () => {
    const days = {
      '2026-10-10': { done: true, won: true },
      '2026-10-11': { done: true, won: true },
      '2026-10-12': { done: true, won: false },
      '2026-10-13': { done: true, won: true },
      '2026-10-14': { done: true, won: true },
      '2026-10-15': { done: true, won: true },
      '2026-10-16': { guesses: [['W']], done: false },
    };
    eq(totals(days, '2026-10-16', previousDay), { played: 6, wins: 5, current: 3, best: 3 });
    days['2026-10-16'] = { done: true, won: false };
    eq(totals(days, '2026-10-16', previousDay).current, 0, 'losing today ends it');
    eq(totals({ '2026-10-01': { done: true, won: true } }, '2026-10-16', previousDay).current, 0,
      'a gap ends it');
  }],

  ['daily: Scryfall answers are slimmed, and the really translated print wins', () => {
    const fat = { ...KRENKO_PT, prices: { usd: '1' }, legalities: {}, games: ['paper'] };
    const s = slim(fat);
    ok(!('prices' in s) && !('legalities' in s), 'only the fields the puzzle reads are kept');
    eq(s.printed_text, KRENKO_PT.printed_text);
    const untranslated = { ...KRENKO_PT, printed_text: undefined, printed_type_line: undefined };
    eq(bestPrint([untranslated, KRENKO_PT]), KRENKO_PT);
    eq(bestPrint([]), null);
  }],

  ['daily: the card comes in the chosen language, English when that language has no print', async () => {
    storage.reset();
    let net = fakeScryfall([[/lang:pt/, { data: [KRENKO_PT] }], [/named\?exact=Krenko/, KRENKO]]);
    try {
      const pt = await loadCard('2026-10-16', 'Krenko, Mob Boss', 'pt');
      eq([pt.card.lang, pt.fallback], ['pt', false]);
      ok(/!"Krenko, Mob Boss" lang:pt/.test(decodeURIComponent(net.asked[0])), 'searched by exact name and language');

      const de = await loadCard('2026-10-16', 'Krenko, Mob Boss', 'de');
      eq([de.card.lang, de.fallback], ['en', true], 'no German print: English, flagged');

      const asked = net.asked.length;
      await loadCard('2026-10-16', 'Krenko, Mob Boss', 'pt');
      eq(net.asked.length, asked, 'the second time it comes from the device');
    } finally {
      net.restore();
    }
    net = fakeScryfall([]);
    try {
      let failed = false;
      await loadCard('2026-10-17', 'Nonexistent Card', 'en').catch(() => { failed = true; });
      ok(failed, 'a name Scryfall does not know is an error, not a blank card');
    } finally {
      net.restore();
      storage.reset();
    }
  }],

  ['daily: a translated print without a scan reveals the English scan', async () => {
    storage.reset();
    const placeholder = {
      ...KRENKO_PT,
      image_status: 'placeholder',
      image_uris: { normal: 'https://cards.scryfall.io/normal/front/p/t/placeholder.jpg' },
    };
    eq(bestPrint([placeholder, { ...KRENKO_PT, image_status: 'highres_scan' }]).image_status, 'highres_scan',
      'a scanned translation wins over a placeholder');
    const net = fakeScryfall([[/lang:pt/, { data: [placeholder] }], [/named\?exact=Krenko/, KRENKO]]);
    try {
      const found = await loadCard('2026-10-16', 'Krenko, Mob Boss', 'pt');
      eq(found.card.lang, 'pt', 'the text stays Portuguese');
      eq(found.card.image_uris.normal, KRENKO.image_uris.normal, 'the image is the English scan');
    } finally {
      net.restore();
      storage.reset();
    }
  }],

  ['daily: progress lives in its own key, apart from the matches', () => {
    storage.reset();
    const before = localStorage.getItem('mtglc.db.v1');
    storage.saveDay('2026-10-16', { guesses: [['R']], done: true, won: true });
    storage.setSetting('cardLang', 'de');
    eq(storage.day('2026-10-16').won, true);
    eq(storage.settings().cardLang, 'de');
    eq(localStorage.getItem('mtglc.db.v1'), before, 'the app database was not touched');
    ok(localStorage.getItem('mtglc.daily.v1'), 'stored under mtglc.daily.v1');
    storage.reset();
    eq(storage.day('2026-10-16'), null);
  }],

  ['daily: the four languages have the same keys and variables', () => {
    const vars = (txt) => (String(txt).match(/\{\w+\}/g) || []).sort().join(',');
    const base = Object.keys(DAILY_DICTS.pt).sort();
    for (const [code, dict] of Object.entries(DAILY_DICTS)) {
      eq(Object.keys(dict).sort(), base, code + ' keys');
      for (const key of base) {
        ok(String(dict[key]).trim(), code + ' / ' + key + ' is empty');
        eq(vars(dict[key]), vars(DAILY_DICTS.pt[key]), code + ' / ' + key + ' variables');
      }
    }
    setLang('de');
    eq(dt('daily.triesLeft', { n: 2 }), 'Verbleibende Versuche: 2');
    setLang('pt');
  }],

  ['daily: the home button shows a dot until today is played', () => {
    if (!simulated) return 'skip';
    storage.reset();
    ok(dailyButton().childNodes[0].classList.contains('has-news'), 'unplayed today: dot');
    storage.saveDay(dayKey(), { done: true, won: false });
    ok(!dailyButton().childNodes[0].classList.contains('has-news'), 'played today: no dot');
    storage.reset();
    return undefined;
  }],

  ['daily: the home screen does not load the challenge until the tap', async () => {
    // The isolation the feature promises: the home screen imports entry.js
    // only, and entry.js must not pull the calendar (edited by hand), the
    // network code or the screen. A typo in calendar.js may break the
    // challenge, never the life counter.
    if (typeof process === 'undefined') return 'skip';
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/daily/entry.js', import.meta.url), 'utf8');
    const statics = [...src.matchAll(/^import[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]);
    for (const banned of ['./calendar.js', './schedule.js', './screen.js', './fetch.js', './notify.js']) {
      ok(!statics.includes(banned), 'entry.js imports ' + banned + ' statically');
    }
    ok(/import\('\.\/screen\.js'\)/.test(src), 'the screen is loaded on demand');
    const day = readFileSync(new URL('../src/daily/day.js', import.meta.url), 'utf8');
    ok(!/^import /m.test(day), 'day.js stays free of imports');
    return undefined;
  }],

  ['daily: playing a day on the screen - masked card, a miss, a hint, a win', async () => {
    if (!simulated) return 'skip';
    storage.reset();
    const name = challengeFor(dayKey()).name;
    const card = {
      ...KRENKO,
      name,
      oracle_text: '{2}{R}, {T}: ' + name + ' deals 1 damage to any target.',
      flavor_text: undefined,
    };
    const net = fakeScryfall([[/lang:pt/, { data: [] }], [/named\?exact=/, card]]);
    let screen = null;
    try {
      screen = openDailyScreen();
      await ticks();
      const layer = findAll(document.body, 'daily-screen')[0];
      ok(layer, 'the layer is on the page');
      const text = textOf(findAll(layer, 'daily-card')[0]);
      ok(!text.toLowerCase().includes(name.toLowerCase()), 'the name is not on screen: ' + text);
      ok(!/\{R\}|R/.test(text.replace(/\{T\}|T/g, '')), 'no red mana on screen: ' + text);
      ok(findAll(layer, 'daily-note').length === 1, 'English fallback is announced');

      const pick = (c) => findAll(layer, 'daily-pick')[['W', 'U', 'B', 'R', 'G', 'C'].indexOf(c)];
      const submit = () => fire(findAll(layer, 'daily-board')[0].childNodes[2], 'click');

      fire(pick('G'), 'click');
      submit();
      eq(storage.day(dayKey()).guesses, [['G']], 'the guess is saved');
      eq(findAll(layer, 'daily-hint').length, 0, 'a miss earns no hint');
      eq(textOf(findAll(layer, 'daily-guess-hits')[0]), '0 de 1 na carta', 'the miss shows only a count');
      eq(textOf(findAll(layer, 'daily-guess-verdict')[0]), 'Palpite errado', 'the miss says it was wrong');
      ok(findAll(layer, 'is-wrong').length === 1 && findAll(findAll(layer, 'daily-guess-icon')[0], 'icon').length === 1,
        'the wrong row carries its icon');

      fire(pick('R'), 'click');
      submit();
      const rec = storage.day(dayKey());
      eq([rec.done, rec.won, rec.answer], [true, true, ['R']]);
      ok(findAll(layer, 'daily-result').length === 1, 'the result shows');
      ok(findAll(layer, 'daily-reveal-img').length === 1, 'the card is revealed');
    } finally {
      if (screen) screen.close(false);
      net.restore();
      storage.reset();
    }
    return undefined;
  }],

  ['daily: settings open as a panel; back closes only the panel; the app language applies', async () => {
    if (!simulated) return 'skip';
    storage.reset();
    const name = challengeFor(dayKey()).name;
    const net = fakeScryfall([[/lang:/, { data: [] }], [/named\?exact=/, { ...KRENKO, name }]]);
    const langBefore = store.getDB().settings.lang;
    let refreshed = 0;
    let screen = null;
    try {
      screen = openDailyScreen({ onRefresh: () => { refreshed += 1; } });
      await ticks();
      const layer = findAll(document.body, 'daily-screen').pop();
      const gear = () => findAll(layer, 'daily-head')[0].childNodes[2];
      const panel = () => findAll(document.body, 'sheet-scrim').pop();

      fire(gear(), 'click');
      ok(isSheetOpen(), 'the gear opens a panel');
      ok(findAll(panel(), 'daily-app-lang').length === 1, 'the app language is in the panel');
      ok(findAll(panel(), 'daily-card-lang').length === 1, 'the card language is in the panel');

      // The phone's back with the panel open: only the panel goes.
      fireWindow('popstate');
      ok(!isSheetOpen(), 'back closed the panel');
      ok(openDailyScreen() === screen, 'and the challenge is still open');

      fire(gear(), 'click');
      const field = findAll(findAll(panel(), 'daily-app-lang')[0], 'set-select')[0];
      field.value = 'en';
      fire(field, 'change');
      eq(textOf(findAll(layer, 'daily-title')[0]), 'Guess the Colors', 'the challenge speaks the new language');
      eq(refreshed, 1, 'the home screen underneath was redrawn');
      eq(store.getDB().settings.lang, 'en', 'saved as the home settings save it');
      ok(isSheetOpen(), 'the panel came back in the new language');

      fireWindow('popstate');
      fireWindow('popstate');
      ok(openDailyScreen() !== screen, 'with no panel, back closes the challenge');
    } finally {
      store.setSetting('lang', langBefore);
      setLang('pt');
      closeSheet();
      const again = openDailyScreen();
      again.close(false);
      net.restore();
      storage.reset();
    }
    return undefined;
  }],
  ['daily: the shared result shows how the day went, never the answer', () => {
    const colors = ['W', 'U'];
    // A miss with one color right, a miss with none, then the answer.
    const p = progress([['W', 'R'], ['B', 'G'], ['U', 'W']], colors);
    eq(p.status, 'won', 'the day was won');
    eq(squares(p.results), '🟨⬛🟩', 'one square per try');
    const text = resultText({
      number: 12, results: p.results, status: p.status, max: MAX_TRIES,
      link: 'https://alienpls-vibes.github.io/hit-easy/?daily=1',
    });
    eq(text.split('\n'), [
      'Hit Easy · ' + dt('daily.title') + ' #12',
      '🟨⬛🟩 3/' + MAX_TRIES,
      dt('daily.shareDareWon'),
      dt('daily.shareInvite', { link: 'https://alienpls-vibes.github.io/hit-easy/?daily=1' }),
    ], 'the message');
    // The exact English message, as people will read it in the group.
    eq(resultText({ number: 5, results: progress([['G']], ['G']).results, status: 'won', max: 3, link: 'L' }, (key, vars) => DAILY_DICTS.en[key].replace('{link}', vars ? vars.link : '')),
      'Hit Easy · Guess the Colors #5\n🟩 1/3\nCan you guess it too?\nPlay here: L', 'the English message');

    // The winning row is ONE square whatever the card's colors: a mono and
    // a five-color card share the same way, so the count never leaks.
    const mono = progress([['G']], ['G']);
    const five = progress([['W', 'U', 'B', 'R', 'G']], ['W', 'U', 'B', 'R', 'G']);
    eq(squares(mono.results), squares(five.results), 'the color count does not show');
    // A miss shows "some" or "none", not how many: 1 of 1 and 2 of 3 look alike.
    eq(squares(progress([['W']], ['W', 'U']).results), squares(progress([['W', 'U', 'R']], ['W', 'U', 'B']).results), 'hit counts do not show');

    const colorWords = ['W', 'U', 'B', 'R', 'G'].map((c) => dt('daily.color.' + c).toLowerCase());
    for (const word of colorWords) ok(!text.toLowerCase().includes(word), 'a color name is in the message: ' + word);
  }],

  ['daily: a lost day shares X and asks instead of daring, the link opens the challenge', () => {
    const p = progress([['W'], ['U'], ['B']], ['G']);
    const text = resultText({ number: 3, results: p.results, status: p.status, max: MAX_TRIES, link: 'L' });
    ok(text.includes('⬛⬛⬛ X/' + MAX_TRIES), 'the lost line: ' + text);
    eq(text.split('\n')[2], dt('daily.shareDareLost'), 'a lost day asks the friend');
    ok(!text.includes(dt('daily.shareDareWon')), 'a lost day does not say "too"');
    eq(challengeLink({ origin: 'https://alienpls-vibes.github.io', pathname: '/hit-easy/beta/index.html' }),
      'https://alienpls-vibes.github.io/hit-easy/beta/?daily=1', 'the link keeps the channel');
    eq(challengeLink({ origin: 'https://alienpls-vibes.github.io', pathname: '/hit-easy/' }),
      'https://alienpls-vibes.github.io/hit-easy/?daily=1', 'production');
    eq(decodeURIComponent(whatsappUrl('a b\n🟩').split('text=')[1]), 'a b\n🟩', 'the WhatsApp link carries the text intact');
  }],
  ['daily: merging days never loses one - a finished day beats an unfinished one', () => {
    storage.reset();
    try {
      const won = (n) => ({ number: n, card: 'C', guesses: [['G']], done: true, won: true, answer: ['G'] });
      storage.saveDay('2026-10-16', won(1));
      storage.saveDay('2026-10-18', { number: 3, guesses: [['W']] });
      const changed = storage.mergeDays({
        '2026-10-16': { number: 1, guesses: [] },            // unfinished: loses to the finished one
        '2026-10-17': won(2),                                  // new day: comes in
        '2026-10-18': { number: 3, guesses: [['W'], ['U']] }, // more tries: wins
        'not-a-day': won(9),
        '2026-10-19': 'junk',
      });
      eq(changed, 2, 'days changed');
      const days = storage.allDays();
      eq(Object.keys(days).sort(), ['2026-10-16', '2026-10-17', '2026-10-18'], 'the days kept');
      ok(days['2026-10-16'].done && days['2026-10-16'].won, 'the finished day stayed finished');
      eq(days['2026-10-18'].guesses.length, 2, 'the record with more tries won');
      eq(storage.mergeDays({ '2026-10-17': { ...won(2), won: false } }), 0, 'a finished day is not replaced by another');
      eq(storage.betterDay(null, won(1)), won(1), 'nothing beats nothing');
    } finally {
      storage.reset();
    }
  }],

  ['daily: a stored state that cannot be read is put aside, not written over', () => {
    storage.reset();
    try {
      localStorage.setItem('mtglc.daily.v1', '{"days": {"2026-10-1');  // cut short
      eq(storage.allDays(), {}, 'nothing readable');
      storage.setSetting('cardLang', 'pt');                           // a save happens
      eq(localStorage.getItem('mtglc.daily.v1.unreadable'), '{"days": {"2026-10-1', 'the raw text was kept');
      localStorage.setItem('mtglc.daily.v1', 'also broken');
      storage.allDays();
      eq(localStorage.getItem('mtglc.daily.v1.unreadable'), '{"days": {"2026-10-1', 'a second bad read keeps the first copy');
    } finally {
      storage.reset();
      ok(localStorage.getItem('mtglc.daily.v1.unreadable') === null, 'reset clears the copy too');
    }
  }],

  ['daily: the backup file carries the progress, and importing it brings the streak back', () => {
    storage.reset();
    try {
      const won = (n) => ({ number: n, card: 'C', guesses: [['G']], done: true, won: true, answer: ['G'] });
      const today = dayKey();
      let k = previousDay(today);
      for (let i = 0; i < 3; i += 1) { storage.saveDay(k, won(i)); k = previousDay(k); }
      const file = backupText();
      const parsed = JSON.parse(file);
      ok(parsed.daily && Object.keys(parsed.daily.days).length === 3, 'the file has the three days');
      ok(Array.isArray(parsed.history), 'and still the matches');

      storage.reset(); // the device loses the challenge
      eq(totals(storage.allDays(), today, previousDay).current, 0, 'streak gone');
      importBackup(file);
      eq(totals(storage.allDays(), today, previousDay).current, 3, 'the streak is back');
      ok(!('daily' in store.getDB()), 'the challenge did not leak into the app database');
      importBackup(JSON.stringify({ history: [] })); // an old file, from before 1.12.1
      eq(totals(storage.allDays(), today, previousDay).current, 3, 'an old file erases nothing');
    } finally {
      storage.reset();
    }
  }],

  ['daily: with an account, the days go to the server and come back merged', async () => {
    storage.reset();
    const before = account.session;
    const realFetch = globalThis.fetch;
    const sent = [];
    try {
      storage.saveDay('2026-10-19', { number: 4, guesses: [['G']], done: true, won: true });
      ok(await syncDaily() === false, 'without an account nothing is sent');

      account.session = { access_token: 'tok', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1' } };
      globalThis.fetch = async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(init.body), auth: init.headers.Authorization });
        // The server had a day this device never saw (played elsewhere).
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...JSON.parse(init.body).dias, '2026-10-18': { number: 3, guesses: [['W']], done: true, won: true } }),
        };
      };
      ok(await syncDaily(), 'synced');
      eq(sent.length, 1, 'one call');
      ok(sent[0].url.endsWith('/rest/v1/rpc/juntar_progresso_diario'), 'the merge RPC: ' + sent[0].url);
      eq(sent[0].body.c, 'producao', 'the channel');
      eq(Object.keys(sent[0].body.dias), ['2026-10-19'], 'the device days');
      eq(sent[0].auth, 'Bearer tok', 'as the signed-in user');
      ok(storage.allDays()['2026-10-18'] && storage.allDays()['2026-10-18'].won, 'the day from the server came in');

      globalThis.fetch = async () => { throw new Error('offline'); };
      ok(await syncDaily() === false, 'offline: false, and nothing breaks');
      ok(storage.allDays()['2026-10-19'], 'the local days are untouched');
    } finally {
      globalThis.fetch = realFetch;
      account.session = before;
      storage.reset();
    }
  }],
];
