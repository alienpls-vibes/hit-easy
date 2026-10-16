/**
 * Checks the daily challenge calendar against Scryfall.
 *
 *   node tools/daily-calendar.js             every line
 *   node tools/daily-calendar.js 2026-11     only the lines whose date starts so
 *
 * For each day: does the card exist, what are its colors, its EDHREC rank,
 * which of pt / es / de have a print, and whether any piece of its name is
 * still readable after the game hides it (a "leak": fix it with the line's
 * optional third item). Then the totals per color, so the mix stays
 * balanced.
 *
 * Needs internet; it is NOT part of `npm test` or `npm run verify`, which
 * must never depend on the network. The offline checks (dates, duplicates,
 * days left) are in tests/daily-cases.js.
 *
 * Scryfall allows about two requests per second on the card search and
 * named endpoints; this waits 600 ms between requests and backs off when
 * told to slow down (HTTP 429). A full calendar takes a few minutes.
 */

import { CALENDAR } from '../src/daily/calendar.js';
import { buildPuzzle, colorsOf } from '../src/daily/card.js';
import { bestPrint, slim } from '../src/daily/fetch.js';
import { isDayKey, daysBetween } from '../src/daily/day.js';

const API = 'https://api.scryfall.com';
const LANGS = ['pt', 'es', 'de'];
const HEADERS = { Accept: 'application/json', 'User-Agent': 'HitEasy-daily-calendar/1.0' };
const filter = process.argv[2] || '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempt = 0) {
  await sleep(600);
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && attempt < 5) {
    // Scryfall keeps a cooldown after a burst; its Retry-After says how long.
    const wait = Number(res.headers.get('retry-after')) || 30;
    console.log('   (Scryfall asked to slow down - waiting ' + wait + ' s)');
    await sleep(wait * 1000);
    return get(url, attempt + 1);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Scryfall ' + res.status + ' for ' + url);
  return res.json();
}

/**
 * Words of the name still readable in the rules or flavor text.
 *
 * Words that are also in the type line are skipped: "Dragon" in "Mirrorwing
 * Dragon" is a creature type the puzzle shows anyway. What is left is worth a
 * look - usually a nickname the card uses for itself, or flavor text quoting
 * it - and the line's optional third item hides it.
 */
function leaks(card) {
  const puzzle = buildPuzzle(card);
  const words = (segs) => segs.filter((s) => s.kind === 'text').map((s) => s.text).join(' ').toLowerCase();
  const typeLine = words(puzzle.typeLine);
  const visible = words([...puzzle.text, puzzle.flavor || []].flat());
  const escape = (w) => w.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const has = (text, w) => new RegExp('(^|[^\\p{L}])' + escape(w) + '($|[^\\p{L}])', 'u').test(text);
  const names = [card.name, card.printed_name].filter(Boolean).join(' ');
  return [...new Set(names.split(/[^\p{L}\p{N}'-]+/u))]
    .filter((w) => w.length >= 5)
    .map((w) => w.toLowerCase())
    .filter((w) => has(visible, w) && !has(typeLine, w));
}

const pad = (s, n) => String(s).padEnd(n);
const problems = [];
const notes = [];

// Offline structure first: it costs nothing and explains odd results below.
CALENDAR.forEach((line, i) => {
  if (!isDayKey(line[0])) problems.push(line[0] + ': not a valid date');
  if (i > 0 && isDayKey(line[0]) && isDayKey(CALENDAR[i - 1][0])
    && daysBetween(CALENDAR[i - 1][0], line[0]) !== 1) {
    problems.push(line[0] + ': does not follow ' + CALENDAR[i - 1][0] + ' (gap or out of order)');
  }
});

const totals = {};
const rows = CALENDAR.filter((line) => line[0].startsWith(filter));
console.log(`\n Checking ${rows.length} day(s) against Scryfall…\n`);
console.log(' ' + pad('date', 11) + pad('colors', 7) + pad('EDHREC', 8) + pad('pt es de', 10) + 'card');

for (const [date, name, hide] of rows) {
  const card = await get(API + '/cards/named?exact=' + encodeURIComponent(name));
  if (!card) {
    problems.push(date + ': "' + name + '" not found on Scryfall (check the exact English name)');
    console.log(' ' + pad(date, 11) + pad('?', 7) + pad('', 8) + pad('', 10) + name + '   <- NOT FOUND');
    continue;
  }
  const colors = colorsOf(card).join('') || 'C';
  totals[colors.length > 1 ? 'multi' : colors] = (totals[colors.length > 1 ? 'multi' : colors] || 0) + 1;

  const langs = [];
  const leaked = new Set(leaks({ ...slim(card), lang: 'en' }));
  for (const lang of LANGS) {
    const list = await get(API + '/cards/search?unique=prints&order=released&dir=desc&q='
      + encodeURIComponent('!"' + name.split('"').join('\\"') + '" lang:' + lang));
    const print = bestPrint(list && list.data);
    langs.push(print ? '✓ ' : '· ');
    if (print) for (const w of leaks(slim(print))) leaked.add(w);
  }
  for (const w of hide || []) leaked.delete(w.toLowerCase());

  const flag = leaked.size ? '   <- check: ' + [...leaked].join(', ') : '';
  if (leaked.size) notes.push(date + ': "' + name + '" - the text still reads ' + [...leaked].join(', '));
  console.log(' ' + pad(date, 11) + pad(colors, 7) + pad(card.edhrec_rank || '-', 8)
    + pad(langs.join(' '), 10) + name + flag);
}

console.log('\n Per color: ' + Object.entries(totals).map(([k, v]) => k + ' ' + v).join(' · '));
if (notes.length) {
  // Notes, not problems: most are a word the name shares with the rules
  // ("Phoenix" in a card about phoenixes). Only a word that would let
  // someone search the card deserves the line's third item.
  console.log('\n Worth a look (a word of the name is still readable):');
  for (const n of notes) console.log('  - ' + n);
}
if (problems.length) {
  console.log('\n To review:');
  for (const p of problems) console.log('  - ' + p);
  console.log('');
  process.exit(1);
}
console.log('\n Everything checks out.\n');
