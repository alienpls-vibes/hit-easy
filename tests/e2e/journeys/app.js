/**
 * What a person does with Hit Easy, as reusable steps.
 *
 * Selectors are classes the app's CSS already depends on - renaming one breaks
 * the styling too, so they are as stable as the UI gets. Text is never matched
 * against a hardcoded language: `t()` asks the running app for its own string,
 * so a journey passes in any language the browser starts in.
 */

/** The localStorage key of the app's database on this channel. */
export const dbKey = (base) => (/\/beta\/$/.test(base) ? 'mtglc.db.v1.beta' : 'mtglc.db.v1');

/** The running app's translation of a key. */
export function t(page, key, vars = {}) {
  return page.eval(`import('./src/i18n.js').then((m) => m.t(${JSON.stringify(key)}, ${JSON.stringify(vars)}))`);
}

/** The app's database, as stored on the device. */
export async function readDb(page, base) {
  return page.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(dbKey(base))}) || 'null')`);
}

/** Opens the app and waits for the home screen. */
export async function openHome(page, base) {
  await page.goto(base);
  await waitHome(page);
}

export async function waitHome(page) {
  await page.waitFor(`document.querySelectorAll('.seat-card').length >= 2`, 'the home screen with player cards', 15000);
}

/** The version the page is running, from the module it loaded. */
export function runningVersion(page) {
  return page.eval(`import('./src/version.js').then((m) => m.APP_VERSION)`);
}

/** Waits for the service worker to control the page (it does from the 2nd load). */
export async function waitControlled(page) {
  await page.waitFor(`navigator.serviceWorker.ready.then(() => true)`, 'the service worker to activate', 20000);
  if (!(await page.eval('Boolean(navigator.serviceWorker.controller)'))) await page.reload();
  await page.waitFor('Boolean(navigator.serviceWorker.controller)', 'the service worker to control the page', 15000);
}

/** No sheet open and none animating out. */
export async function waitNoSheet(page) {
  await page.waitFor(`!document.querySelector('.sheet-scrim')`, 'the panel to close');
}

/**
 * Picks a commander for one seat through the real picker: open, type, choose.
 * `term` searches Scryfall (mocked); `fromHistory` picks the first deck the
 * picker offers without typing - the offline path.
 */
export async function pickCommander(page, seatIndex, { term = null, fromHistory = false } = {}) {
  await page.tap('.seat-card .seat-art', { index: seatIndex });
  await page.waitFor(`document.querySelector('.sheet-scrim.is-open .search-input')`, 'the commander picker');
  if (fromHistory) {
    await page.waitFor(`document.querySelectorAll('.sheet-scrim .result-row').length > 0`, 'decks from the history in the picker');
  } else {
    await page.type('.sheet-scrim .search-input', term);
    await page.waitFor(`document.querySelectorAll('.sheet-scrim .result-row').length > 0`, 'search results for "' + term + '"');
  }
  await page.tap('.sheet-scrim .result-row', { index: 0 });
  await waitNoSheet(page);
  await page.waitFor(
    `!document.querySelectorAll('.seat-card .seat-art')[${seatIndex}].classList.contains('is-empty')`,
    'seat ' + (seatIndex + 1) + ' to show its commander',
  );
}

/** Commanders for every seat, by searching. */
export async function pickAllCommanders(page, terms) {
  const seats = await page.count('.seat-card');
  for (let i = 0; i < seats; i += 1) await pickCommander(page, i, { term: terms[i % terms.length] });
  return seats;
}

/** Start on the home screen, then Start on the pre-game panel; waits for the table. */
export async function startMatch(page) {
  const seats = await page.count('.seat-card');
  await page.tap('.setup .btn.primary.block');
  await page.waitFor(`document.querySelector('.sheet-scrim.is-open .sheet-actions .btn.primary')`, 'the pre-game panel');
  await page.tap('.sheet-scrim .sheet-actions .btn.primary');
  await page.waitFor(`document.querySelectorAll('.tile').length === ${seats}`, 'the table with ' + seats + ' players', 10000);
  return seats;
}

/** The life shown on a player's panel. */
export async function lifeOf(page, index) {
  return Number((await page.text('.tile .tile-life', index) || '').trim());
}

/** Taps the + or - half of a player's panel once. */
export async function tapLife(page, index, sign = '+') {
  await page.tap('.tile .tap-' + (sign === '+' ? 'plus' : 'minus'), { index });
}

/** Opens the table menu (the last button of the central hub). */
export async function openTableMenu(page) {
  await page.tap('.hub > .hub-btn:last-child');
  await page.waitFor(`document.querySelector('.sheet-scrim.is-open .menu')`, 'the table menu');
}

/** Menu > declare winner > first player > first reason; then saves on the victory card. */
export async function declareWinnerAndSave(page, seatIndex = 0) {
  await openTableMenu(page);
  await page.tap('.sheet-scrim .menu-item', { text: await t(page, 'table.declareWinner') });
  await page.waitFor(`document.querySelectorAll('.sheet-scrim .flow-pane:last-child .menu-item').length > 0`, 'the list of players to win');
  await page.tap('.sheet-scrim .flow-pane:last-child .menu-item', { index: seatIndex });
  await page.waitFor(`document.querySelector('.sheet-scrim .win-reason')`, 'the win reasons');
  await page.tap('.sheet-scrim .win-reason', { index: 0 });
  await page.waitFor(`document.querySelector('.victory.is-open .btn.primary')`, 'the victory card', 10000);
  await page.tap('.victory .btn.primary');
  await waitHome(page);
}

/** Header button: statistics (the last icon of the home header). */
export async function openStats(page) {
  await page.tap('.head-actions > .icon-btn:last-child');
  await page.waitFor(`document.querySelector('.stats, .paywall')`, 'the statistics screen', 10000);
}
