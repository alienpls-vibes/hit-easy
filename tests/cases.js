/**
 * Test cases - single source.
 *
 * It does not need the DOM on purpose: the same cases run in Node
 * (`npm test`) and in the browser (`tests.html`). A test that only passes in
 * one of the two is not worth much.
 */

// First of all: installs the simulated DOM before ui.js is evaluated.
import {
  simulated, flushFrames, findAll, fire, textOf, simulateKeyboard, currentKb,
  pointAt, fireWindow, historyLog,
} from './dom-stub.js';
import {
  createMatch, replay, push, undo, standings, elapsedOf, duplicatePerson, isValidMatch,
  leaveTable, returnToTable, awayBetween, mergeDecks, deckKeyOf,
  handOffTable, reclaimTable, isHandedOff, receiveTable, tableNow,
  cmdKeyOf, CMD_LETHAL, POISON_LETHAL,
} from '../src/engine.js';
import {
  SORTS, sortById, sortRows,
  aggregate, rivalries, voteTitle, totalDamage, summarize,
  playerColorOrder, playerColor,
  identityOf, labelOf, recordedName,
  voteKey, voteKeyLabel, orientRival,
  voteCategory, categoryLabel, CURRENT_HANDLES, currentHandle,
} from '../src/stats.js';
import {
  LAYOUTS, variantsFor, layoutFor, shapesOf, seatAngle, orientOf, layoutOfMatch,
} from '../src/seating.js';
import { createSession, cast, tally, pending, isComplete, describe } from '../src/vote.js';
import {
  openFlow, closeSheet, dismissOnBackdrop, el, isSheetOpen, onSheetChange,
  keyboardHeight,
} from '../src/ui.js';
import { DICTS, LANGS, t, tn, setLang, currentLang, ordinal } from '../src/i18n.js';
import { fromRow as rowToMatch } from '../src/cloud.js';
import {
  accountState, isSubscriptionActive, isSessionValid, toRow, fromRow, pendingUploads,
  state as accountNow, providers, magicLinkRequest, returnUrl,
  captureReturn, forgetSession, needsRefresh, isSessionUsable, isPasswordValid,
  canSeeStats, isSubscriptionKnown,
  accountAlreadyExisted,
  sessionFromStorage,
  normalizeHandle, isHandleValid, displayHandle, participantsOf, buildInvites,
  decksColumn, downloadMatches, remoteIds,
  uploadMatch, sendParticipants, saveMyDecks, account,
  trustHost, untrustHost, pendingInvites,
  handleStatus, normalizeName, NAME_MAX, saveHandle, saveName,
  nextHandleChange, HANDLE_CHANGE_DAYS,
} from '../src/cloud.js';
import { handleBlock } from '../src/views/setup/handle.js';
import { accountBlock } from '../src/views/setup/account.js';
import { cloudEnabled } from '../src/config.js';
import { channelOf, channelOfCache } from '../src/channel.js';
import { RELEASE_NOTES, releaseNotesSince, releaseNotesFor } from '../src/release-notes.js';
import { openReleaseNotes } from '../src/views/setup.js';
// Straight from the piece: the install block is a detail of the settings, and
// exporting it through the door would announce it as public API of the screen.
import { installBlock } from '../src/views/setup/install.js';
import { iosBrowser } from '../src/install.js';
import { APP_VERSION } from '../src/version.js';
import {
  toUpload, toDownload, toDelete, canSync,
  seatsToLink, learnedAliases, linkAccount, decksChanged, refreshHandles,
} from '../src/sync.js';
import { rotatesWithSeat, tableRotation, rotatesToSeat } from '../src/orientation.js';
import { renderTable } from '../src/views/table.js';
// Straight from the piece, not through the door: the "hold to repeat" cadence
// is an internal detail of the table, and exporting it from the barrel would
// announce it as public API.
import { repeatWhileHeld } from '../src/views/table/widgets.js';
import {
  COMMIT_MS, COUNT_MS, COUNT_MIN_STEP, DOUBLE_TAP_MS, HOLD_DELAY,
  REPEAT_ACCEL_AFTER, REPEAT_FAST_MS, REPEAT_MS,
} from '../src/views/table/constants.js';
import {
  renderSetup, seedDraftFrom, resumeTableBanner, tableFileName,
  handedOffBanner, passTable, openReceiveTable, tableLink,
} from '../src/views/setup.js';
import {
  normalizeCode, isCodeValid, formatCode, codeInText,
} from '../src/cloud.js';
import { renderStats, renderPaywall } from '../src/views/stats.js';
import { brandMark } from '../src/ui.js';
import * as store from '../src/store.js';
// Importing app.js ALREADY is the test: it starts up by itself when evaluated.
import { announceVersion, codeFromLink } from '../src/app.js';

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((what || 'value') + ': expected ' + e + ', got ' + a);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'false condition');
}

/**
 * Timer ids NEVER repeat, not even across calls.
 *
 * Restarting at 1 for every new clock produced a hard defect: app modules keep
 * an id in a module variable (`toastTimer` in ui.js, for example) and call
 * `clearTimeout` on it. That id survives the end of the case; in the next
 * case, the new clock handed the SAME number to another timer, and the toast's
 * `clearTimeout` cancelled an animation that had nothing to do with it.
 *
 * The symptom was perfect for fooling you: one of the four numbers stopped
 * counting, always the same, and only inside the suite - run alone it worked.
 */
let nextFakeId = 1000000;

/**
 * A controlled clock, to measure gestures that depend on time.
 *
 * runAll() is synchronous (there is no `await` here), so really waiting is
 * not an option: sleeping two seconds per case would multiply the suite, and
 * measuring "how many steps came out of a hold" would require guessing.
 * Swapping the timers, the test MOVES the clock and counts exactly.
 *
 * Returns whatever `fn(advance)` returns, and restores the real timers even
 * if the case fails halfway - otherwise the next case would run with the
 * clock stopped and report an error that is not its own.
 */
function withFakeClock(fn) {
  const real = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };

  let now = 0;
  const scheduled = new Map();

  globalThis.setTimeout = (f, ms = 0) => {
    const id = nextFakeId; nextFakeId += 1;
    scheduled.set(id, { at: now + ms, every: null, fn: f });
    return id;
  };
  globalThis.setInterval = (f, ms = 0) => {
    const id = nextFakeId; nextFakeId += 1;
    scheduled.set(id, { at: now + ms, every: ms, fn: f });
    return id;
  };
  globalThis.clearTimeout = (id) => { scheduled.delete(id); };
  globalThis.clearInterval = (id) => { scheduled.delete(id); };

  /** Moves the clock, running whatever is due on the way, in time order. */
  const advance = (ms) => {
    const end = now + ms;
    // A safety ceiling: a 0ms interval that reschedules itself would hang the
    // suite instead of failing.
    for (let round = 0; round < 20000; round += 1) {
      let next = null;
      for (const [id, task] of scheduled) {
        if (task.at <= end && (!next || task.at < next.task.at)) {
          next = { id, task };
        }
      }
      if (!next) break;
      now = next.task.at;
      if (next.task.every === null) scheduled.delete(next.id);
      else next.task.at = now + next.task.every;
      next.task.fn();
    }
    now = end;
  };

  try {
    return fn(advance);
  } finally {
    Object.assign(globalThis, real);
  }
}

/** Mounts the table in the simulated DOM and returns what the gesture cases need. */
function tableOnScreen(m) {
  document.body.childNodes.length = 0;
  const root = document.createElement('div');
  const view = renderTable(root, {
    match: m, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
  });
  return { root, view, tiles: findAll(root, 'tile') };
}

const lifeEvents = (m) => m.events.filter((e) => e.type === 'life');

/**
 * The home screen's statistics button, in any language.
 *
 * The home screen is drawn at app.js STARTUP, in the language the system
 * reports - before runAll switches to Portuguese. Comparing with fixed text
 * passed on Windows in Portuguese and broke on the CI Ubuntu, in English.
 */
function statsButton() {
  const labels = LANGS.map(([code]) => DICTS[code]['common.stats']);
  return findAll(document.getElementById('app'), 'icon-btn')
    .find((b) => labels.includes(b.attributes['aria-label']));
}

/** Below HOLD_DELAY: a tap that never turns into a repetition. */
const SHORT_TAP = HOLD_DELAY - 100;

const commander = (n) => ({
  oracleId: 'o' + n, name: 'Cmd ' + n, colors: ['U'], art: null, thumb: null,
});

/** A helper table with made-up commanders. */
function makeMatch(n = 4, life = 40, options = {}) {
  return createMatch(
    Array.from({ length: n }, (_, i) => ({
      id: 's' + i, name: 'P' + i, commanders: [commander(i)],
    })),
    life,
    options,
  );
}

/**
 * Opens a panel on a clean body.
 *
 * closeSheet() delays removing the node by 200ms to let the animation finish,
 * so without this cleanup a case's panel is still in the body during the next
 * one - and the search for screens picks up the neighbor's leftovers.
 */
function openPanel(step) {
  document.body.childNodes.length = 0;
  const api = openFlow(step);
  flushFrames();
  return api;
}

/** The screens of the panel open now, in the order they were stacked. */
function panes() {
  const scrims = findAll(document.body, 'sheet-scrim');
  return findAll(scrims[scrims.length - 1], 'flow-pane');
}

export const cases = [
  ['a new table starts with everyone at starting life', () => {
    const s = replay(makeMatch());
    eq(Object.values(s.players).map((p) => p.life), [40, 40, 40, 40], 'lives');
    eq(s.turn, 1, 'turn');
    eq(s.activeSeatId, 's0', 'active seat');
    eq(s.finished, false, 'finished');
  }],

  ['damage takes life and is credited to the source declared by the drag', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    eq(replay(m).players.s1.life, 33, 'target life');
    eq(m.events[0].sourceId, 's0', 'source');
  }],

  ['undo goes back exactly to the previous state', () => {
    const m = makeMatch();
    const before = JSON.stringify(replay(m).players);
    push(m, { type: 'life', targetId: 's2', delta: -12, sourceId: 's0' });
    eq(replay(m).players.s2.life, 28, 'life after damage');
    undo(m);
    eq(JSON.stringify(replay(m).players), before, 'state after undo');
  }],

  ['commander damage also comes out of life', () => {
    const m = makeMatch();
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 9 });
    const s = replay(m);
    eq(s.players.s1.life, 31, 'life');
    eq(s.players.s1.cmd[key], 9, 'commander counter');
  }],

  ['21 commander damage eliminates even with life left', () => {
    const m = makeMatch(4, 100);
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: CMD_LETHAL });
    const s = replay(m);
    ok(s.players.s1.life > 0, 'still has life');
    eq(s.players.s1.dead, true, 'eliminated');
    eq(s.players.s1.elim.byId, 's0', 'credit for the elimination');
  }],

  ['damage from different commanders does not add up to 21', () => {
    const m = makeMatch(4, 100);
    const k0 = cmdKeyOf('s0', m.seats[0].commanders[0]);
    const k2 = cmdKeyOf('s2', m.seats[2].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: k0, delta: 15 });
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's2', cmdKey: k2, delta: 15 });
    const p = replay(m).players.s1;
    eq(p.dead, false, 'still alive: 15 and 15 are separate counters');
    eq(p.life, 70, 'but life took the 30');
  }],

  ['10 poison eliminates', () => {
    const m = makeMatch();
    push(m, { type: 'poison', targetId: 's2', delta: POISON_LETHAL, sourceId: 's0' });
    eq(replay(m).players.s2.dead, true, 'eliminated by poison');
  }],

  ['the turn closes the round and skips whoever died', () => {
    const m = makeMatch();
    push(m, { type: 'turn' });
    push(m, { type: 'turn' });
    eq(replay(m).activeSeatId, 's2', 'active seat');
    eq(replay(m).turn, 1, 'still in the first round');
    push(m, { type: 'turn' });
    push(m, { type: 'turn' });
    const s = replay(m);
    eq(s.activeSeatId, 's0', 'back to the first');
    eq(s.turn, 2, 'turn 2');
  }],

  ['an eliminated seat is skipped in turn order', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    eq(replay(m).activeSeatId, 's2', 'skipped the eliminated one');
  }],

  ['the last one alive wins and the match ends', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });
    const s = replay(m);
    eq(s.winnerId, 's0', 'winner');
    eq(s.finished, true, 'finished');
  }],

  ['the same person cannot take two seats', () => {
    const table4 = [
      { id: 's0', name: 'Alexandre', handle: 'alienpls' },
      { id: 's1', name: 'Bruno' },
      { id: 's2', name: 'Carla', handle: 'carlinha' },
    ];
    const fresh = { id: 's3', name: '' };

    eq(duplicatePerson(table4, fresh, { name: 'Davi' }), null, 'new people get in');
    eq(duplicatePerson(table4, fresh, { name: 'Bruno' }), 'name', 'a repeated name is blocked');
    eq(duplicatePerson(table4, fresh, { name: ' bruno ' }), 'name', 'spaces and case do not get around it');

    // The other path to the same person: the account. It was what had no lock
    // at all - @alienpls could be linked to two seats.
    eq(duplicatePerson(table4, fresh, { handle: 'alienpls' }), 'account', 'a repeated account is blocked');
    eq(duplicatePerson(table4, fresh, { handle: '@AlienPls' }), 'account', 'at sign and case do not get around it');
    eq(duplicatePerson(table4, fresh, { handle: 'outro' }), null, 'another account gets in');

    // The seat itself never conflicts with itself: editing whoever is already
    // seated cannot be refused because they are already there.
    eq(duplicatePerson(table4, table4[1], { name: 'Bruno' }), null, 'the seat itself does not count');
    eq(duplicatePerson(table4, table4[0], { handle: 'alienpls' }), null);

    eq(duplicatePerson(table4, fresh, {}), null, 'nothing declared, nothing to block');
    eq(duplicatePerson(null, fresh, { name: 'Bruno' }), null, 'no table, no conflict');
  }],

  ['placing: winner 1st, whoever left last comes first', () => {
    const m = makeMatch();
    // One per turn: here there really is who outlived whom.
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    eq(standings(m).map((x) => x.seatId), ['s0', 's3', 's2', 's1'], 'final order');
    eq(standings(m).map((x) => x.place), [1, 2, 3, 4], 'no tie, distinct placings');
  }],

  ['whoever dies on the same turn shares the placing', () => {
    // The case the table recognizes: someone wipes the whole table at once.
    // Nothing separates the three - they did not outlive each other, and the
    // order in which the engine processed the events is an internal detail that
    // means nothing. Breaking the tie there would be inventing a result.
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    const place = new Map(standings(m).map((x) => [x.seatId, x.place]));
    eq(place.get('s0'), 1, 'whoever is left is first');
    // The group takes the WORST placing it occupies. Saying two of them were
    // 2nd and 3rd would give them a place nobody earned.
    eq(place.get('s1'), 4, 'the three fell together');
    eq(place.get('s2'), 4);
    eq(place.get('s3'), 4);
  }],

  ['partial tie: only whoever fell together shares the place', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    // These two fall on the same turn, after s1.
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    const place = new Map(standings(m).map((x) => [x.seatId, x.place]));
    eq(place.get('s0'), 1, 'the winner');
    eq(place.get('s2'), 3, 'the two from the last turn occupy 2nd and 3rd, and take 3rd');
    eq(place.get('s3'), 3);
    eq(place.get('s1'), 4, 'whoever fell earlier stays behind both');
  }],

  ['conceding takes the player off the table', () => {
    const m = makeMatch();
    push(m, { type: 'concede', targetId: 's3' });
    const s = replay(m);
    eq(s.players.s3.dead, true, 'off the table');
    eq(s.alive.length, 3, 'remaining');
  }],

  ['reviving through undo gives the placing back', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    eq(replay(m).players.s1.dead, true, 'died');
    undo(m);
    const s = replay(m);
    eq(s.players.s1.dead, false, 'came back');
    eq(s.elimOrder.length, 0, 'elimination queue clean');
  }],

  ['statistics add up damage dealt and taken by the right source', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -10, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -6, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: +4, sourceId: null });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P0').damageDealt, 16, 'damage dealt by P0');
    eq(players.find((p) => p.label === 'P1').damageTaken, 10, 'damage taken by P1');
    eq(players.find((p) => p.label === 'P1').healed, 4, 'healing of P1');
  }],

  ['the invite always carries the @, even without knowing the account id', () => {
    // The defect this guards: when the device REMEMBERS which account a name
    // belongs to, it fills in the @ but not the id - it does not have it,
    // because remembering exists precisely to avoid looking up again. The row
    // went to the database with a null user_id, and the answer policy requires
    // `user_id = auth.uid()`. In SQL null equals nothing: the invite was born
    // impossible to claim, with no error and no warning.
    //
    // The fix is on the server (sql/003), which resolves the @ on insert. What
    // the client has to guarantee is the raw material of that resolution:
    // never send a tagged seat without the @.
    const match = createMatch([
      { id: 's0', name: 'Alexandre', handle: 'alienpls', userId: 'uid-1', commanders: [commander(0)] },
      { id: 's1', name: 'Bruno', handle: 'brunomtg', commanders: [commander(1)] },
      { id: 's2', name: 'Carla', commanders: [commander(2)] },
    ], 40);

    const rows = participantsOf(match);
    eq(rows.length, 2, 'only the tagged seats');
    ok(rows.every((l) => l.handle && l.handle.length > 0),
      'every row carries the @: it is how the server finds out whose it is');

    const withId = rows.find((l) => l.seat_id === 's0');
    const withoutId = rows.find((l) => l.seat_id === 's1');
    eq(withId.user_id, 'uid-1', 'when the client knows the id, it sends it');
    eq(withoutId.user_id, null, 'when it does not, it sends null - and the server resolves it');
    eq(withoutId.handle, 'brunomtg', 'but the @ always goes, otherwise there is no resolving');
  }],

  ['the linked account survives from the table to the invite', () => {
    // This is the whole path, and it was broken at the first link:
    // createMatch built the seat with id, name and commanders, and dropped
    // handle and userId. The choice of @ died in the draft. The saved match
    // knew of no account, participantsOf() never found a seat to invite, and
    // the statistics went back to having only the typed name.
    //
    // Nothing failed loudly: the invite simply never arrived.
    const m = createMatch([
      { id: 's0', name: 'Alexandre', handle: 'alienpls', userId: 'uid-1', commanders: [commander(0)] },
      { id: 's1', name: 'Bruno', commanders: [commander(1)] },
    ], 40);

    eq(m.seats[0].handle, 'alienpls', 'the seat keeps the @');
    eq(m.seats[0].userId, 'uid-1', 'and the account');
    eq(m.seats[1].handle, null, 'a seat without an account stays without one');

    // And the saved match really generates the invite.
    const rows = participantsOf(m);
    eq(rows.length, 1, 'one claimable seat');
    eq(rows[0].handle, 'alienpls');
    eq(rows[0].user_id, 'uid-1');
    eq(rows[0].seat_id, 's0');

    // And the statistics identify the person, not the text.
    eq(identityOf(m.seats[0]), '@alienpls', 'the statistics see the account');
  }],

  ['the same account with different names is a single person', () => {
    // The point of the whole feature: the name is what the table calls someone
    // THAT day. Adding "Alex" one Thursday and "Alexandre" the next cannot
    // produce two rows, two colors and two stories - nor turn that person's
    // rivalry with Bruno into two half rivalries.
    const withAccount = (name) => {
      const m = createMatch([
        { id: 's0', name, handle: 'alienpls', commanders: [commander(0)] },
        { id: 's1', name: 'Bruno', commanders: [commander(1)] },
      ], 40);
      push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
      return m;
    };

    const matches = [withAccount('Alexandre'), withAccount('Alex')];
    const { players } = aggregate(matches);

    const theirs = players.filter((p) => p.key === '@alienpls');
    eq(theirs.length, 1, 'a single row for the account');
    eq(theirs[0].games, 2, 'both matches add up on the same person');
    eq(theirs[0].damageDealt, 14, 'the damage of both tables adds up together');
    // The label is the @, not the most recent name. While it was the name, the
    // same person showed up as "Alexandre" on this device and "Alex" on the
    // device of whoever typed differently - with the identity underneath
    // already unified. The @ is the only label that means the same on both.
    eq(theirs[0].label, '@alienpls', 'the label of someone with an account is the @');
    // The typed names are not lost: they become the "recorded as".
    eq(theirs[0].names, ['Alexandre', 'Alex'], 'the names the table used');
    eq(players.length, 2, 'only two people exist: the account and Bruno');

    // The color follows the account, not the typed text.
    const order = playerColorOrder(matches);
    eq(playerColor(order, '@alienpls'), playerColor(order, '@alienpls'), 'stable color');

    const rivals = rivalries(matches);
    eq(rivals.length, 1, 'one rivalry, not two halves');
    eq(rivals[0].games, 2, 'both tables count for the same pair');
  }],

  ['identity falls back to the name when there is no account, and never collides with one', () => {
    eq(identityOf({ id: 's0', name: 'Ana' }), 'ana', 'without an account, the name works');
    eq(identityOf({ id: 's0', name: ' ANA ' }), 'ana', 'spaces and case do not create another person');
    eq(identityOf({ id: 's0', name: 'Ana', handle: '@Ana' }), '@ana', 'with an account, the account rules');

    // The prefix exists for this: whoever typed "ana" with no account at all
    // is not the owner of the @ana account until someone says so.
    ok(identityOf({ id: 's0', name: 'ana' }) !== identityOf({ id: 's1', handle: 'ana' }),
      'a loose name does not become the owner of the account with the same text');

    // An old match, recorded before @ existed: the device remembers whom that
    // name belongs to, and it joins the account instead of staying orphaned.
    eq(identityOf({ id: 's0', name: 'Alex' }, { alex: 'alienpls' }), '@alienpls',
      'what the device remembers reconciles the old history');

    eq(identityOf({ id: 's9' }), 's9', 'with no name and no account, the seat is what is left');
    eq(labelOf({ id: 's0', handle: 'alienpls' }), '@alienpls', 'with no name, shows the @');
    // With an account, the @ beats the typed name: see labelOf() in stats/aggregate.js.
    eq(labelOf({ id: 's0', name: 'Ana', handle: 'alienpls' }), '@alienpls',
      'with an account, the label is the @ even when there is a name');
    eq(labelOf({ id: 's0', name: 'Ana' }), 'Ana', 'without an account, the typed name');
    // And the device's alias also switches the label, otherwise the same
    // person would have two again: the @ on tagged tables and the name on old
    // ones.
    eq(labelOf({ id: 's0', name: 'Alex' }, { alex: 'alienpls' }), '@alienpls',
      'a known alias also shows the @');
    eq(recordedName({ id: 's0', name: 'Ana', handle: 'alienpls' }), 'Ana',
      'the typed name stays available for "recorded as"');
    eq(recordedName({ id: 's0', name: 'Ana' }), '',
      'without an account the label already is the name, and repeating tells nothing');
  }],

  ['life lost with no dealer counts as paid, not as damage taken', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's0', delta: -3, sourceId: null });
    push(m, { type: 'life', targetId: 's0', delta: -8, sourceId: 's1' });
    const p0 = aggregate([m]).players.find((p) => p.label === 'P0');
    eq(p0.lifePaid, 3, 'life paid');
    eq(p0.damageTaken, 8, 'damage taken');
    eq(replay(m).players.s0.life, 29, 'final life adds both');
  }],

  ['nobody gets credit for damage with no declared source', () => {
    const m = makeMatch();
    push(m, { type: 'turn' }); // P1 is on turn...
    push(m, { type: 'life', targetId: 's2', delta: -9, sourceId: null });
    const { players } = aggregate([m]);
    // ...and even so does not inherit the damage: no drag, no dealer.
    eq(players.find((p) => p.label === 'P1').damageDealt, 0, 'damage credited to P1');
    eq(players.find((p) => p.label === 'P2').lifePaid, 9, 'life paid by P2');
  }],

  ['dragged poison credits whoever applied it', () => {
    const m = makeMatch();
    push(m, { type: 'poison', targetId: 's1', delta: 4, sourceId: 's0' });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P0').poisonDealt, 4, 'poison applied by P0');
    eq(players.find((p) => p.label === 'P1').poisonTaken, 4, 'poison taken by P1');
  }],

  ['commander damage goes into the total damage on both sides', () => {
    const m = makeMatch();
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 6 });
    const { players } = aggregate([m]);
    const p0 = players.find((p) => p.label === 'P0');
    eq(p0.cmdDealt, 6, 'commander damage dealt');
    eq(p0.damageDealt, 6, 'and it also counts in the total damage');
    eq(players.find((p) => p.label === 'P1').damageTaken, 6, 'damage taken by P1');
  }],

  ['statistics count wins and eliminations', () => {
    const m = makeMatch(2);
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const p0 = aggregate([m]).players.find((p) => p.label === 'P0');
    eq(p0.wins, 1, 'wins');
    eq(p0.kills, 1, 'eliminations');
    eq(p0.winrate, 1, 'winrate');
  }],

  ['statistics aggregate the same deck across several matches', () => {
    const a = makeMatch(2);
    push(a, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const b = makeMatch(2);
    push(b, { type: 'life', targetId: 's0', delta: -40, sourceId: 's1' });
    const { decks } = aggregate([a, b]);
    const d0 = decks.find((d) => d.label === 'Cmd 0');
    eq(d0.games, 2, 'deck matches');
    eq(d0.wins, 1, 'wins');
    eq(d0.winrate, 0.5, 'winrate');
  }],

  ['every variant turns clockwise, standing and lying', () => {
    // The seat order is the turn order. Walking from one seat to the next, the
    // angle relative to the center must always GROW (screen Y points down, so
    // a growing angle = clockwise), and the full round must add up to exactly
    // 360°. A counter-clockwise table would give negative steps; one that goes
    // back and forth would not close at 360.
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const { name, shape } of shapesOf(v)) {
          const where = n + ' players / ' + v.id + ' / ' + name;
          const angles = shape.seats.map((s) => seatAngle(s, shape));
          let round = 0;
          for (let i = 0; i < n; i += 1) {
            const step = (angles[(i + 1) % n] - angles[i] + 360) % 360;
            ok(step > 0, where + ': seat ' + i + ' does not move clockwise');
            round += step;
          }
          ok(Math.abs(round - 360) < 0.001, where + ': the round added up to ' + round + '°, not 360°');
        }
      }
    }
  }],

  ['every shape fills the grid without overlapping seats', () => {
    for (const [n, variants] of Object.entries(LAYOUTS)) {
      const ids = new Set();
      for (const v of variants) {
        ok(!ids.has(v.id), n + ': repeated variant id');
        ids.add(v.id);
        // The label was fixed Portuguese text inside seating.js, so the table
        // choice showed in Portuguese for whoever used the app in English,
        // Spanish or German. Now it is a key, and the key has to exist in all
        // four - otherwise the screen shows the raw key name.
        ok(v.labelKey, n + '/' + v.id + ': variant with no label to show the user');
        for (const [code] of LANGS) {
          ok(DICTS[code][v.labelKey],
            n + '/' + v.id + ': missing ' + v.labelKey + ' in ' + code);
        }

        for (const { name, shape } of shapesOf(v)) {
          const where = n + ' players / ' + v.id + ' / ' + name;
          ok(shape.seats.length === Number(n), where + ': has ' + shape.seats.length + ' seats');

          const taken = new Set();
          for (const s of shape.seats) {
            // Only 0 and 180: a sideways panel would leave name and number lying down.
            ok(s.rot === 0 || s.rot === 180, where + ': invalid rotation ' + s.rot);
            for (let c = s.c; c < s.c + (s.cs || 1); c += 1) {
              const cell = s.r + ':' + c;
              ok(!taken.has(cell), where + ': cell ' + cell + ' used twice');
              taken.add(cell);
              ok(s.r <= shape.rows && c <= shape.cols, where + ': seat outside the grid');
            }
          }
        }
      }
    }
  }],

  ['the lying-down shape is wider than tall where it exists', () => {
    for (const n of [5, 6]) {
      for (const v of variantsFor(n)) {
        if (!v.land) continue;
        ok(v.land.cols > v.land.rows, n + '/' + v.id + ': the lying-down shape is not wide');
        ok(v.cols <= v.rows, n + '/' + v.id + ': the standing shape is not tall');
      }
    }
  }],

  ['layoutFor picks the variant and the orientation', () => {
    eq(layoutFor(5, 'inventado').id, variantsFor(5)[0].id, 'falls back to the default');
    eq(layoutFor(3, 'paisagem').id, 'paisagem', 'a valid variant is respected');

    // 4 and 6 have nothing to choose, and keep adapting to the screen.
    eq(layoutFor(6, 'padrao', false).cols, 2, 'standing: two columns');
    eq(layoutFor(6, 'padrao', true).cols, 3, 'lying: three columns');
    eq(layoutFor(4, 'padrao', true).cols, 2, 'with no lying shape, keeps the same one');
  }],

  ['an old match does not swap people\'s places when the app updates', () => {
    // A match in progress keeps the variant id from when it started. Renaming
    // the variants without handling that would throw the table into the
    // default in the middle of the game, moving everyone without warning.
    const same = (n, old, current) => {
      const a = layoutFor(n, old);
      const b = layoutFor(n, current);
      eq(JSON.stringify(a.seats), JSON.stringify(b.seats),
        n + '/' + old + ' has to land exactly on ' + current);
    };
    same(3, '2-1', 'retrato');
    same(3, '1-2', 'paisagem');
    same(5, 'volta', 'retrato');

    // This one has no exact equivalent; what matters is that it goes to the
    // lying-down shape instead of falling into the standing default, which
    // would be the most abrupt change.
    eq(layoutFor(5, '3-2').id, 'paisagem', 'no exact equivalent, goes to the closest');

    // And a made-up id still falls into the default, as always.
    eq(layoutFor(3, 'nao-existe').id, variantsFor(3)[0].id, 'an unknown id falls into the default');
  }],

  ['with 2, 3 and 5 the choice is how the device sits on the table', () => {
    // The question the person answers becomes concrete: standing or lying in
    // the middle of the table. "2 below, 1 above" described the consequence of
    // a choice nobody had made yet.
    for (const n of [2, 3, 5]) {
      const vs = variantsFor(n);
      eq(vs.length, 2, n + ' players: exactly two options');
      eq(vs.map((v) => v.orient).sort().join(','), 'landscape,portrait',
        n + ' players: one standing and one lying');
      eq(orientOf(n, 'retrato'), 'portrait');
      eq(orientOf(n, 'paisagem'), 'landscape');
    }

    // 4 and 6 ask for no orientation: locking the screen there would only take
    // freedom from the players, without resolving any ambiguity.
    eq(orientOf(4, 'padrao'), null, 'four is symmetric');
    eq(orientOf(6, 'padrao'), null, 'six is three on each side');
  }],

  ['the chosen orientation is not contradicted by the screen', () => {
    // What guarantees this is the DATA, not the `if`: a variant that declares
    // an orientation has no alternative shape to switch to. The invariant is
    // worth pinning, because it is what holds the behavior - the guard in
    // layoutFor is just belt and braces for the day someone adds both.
    for (const [n, variants] of Object.entries(LAYOUTS)) {
      for (const v of variants) {
        ok(!(v.orient && v.land),
          n + '/' + v.id + ': declares an orientation AND an alternative shape - one of '
          + 'the two will be ignored, and nobody will know which');
      }
    }

    for (const wide of [false, true]) {
      eq(layoutFor(5, 'retrato', wide).cols, 2, 'standing stays 2 columns (wide=' + wide + ')');
      eq(layoutFor(5, 'retrato', wide).rows, 3, 'standing stays 3 rows (wide=' + wide + ')');
      eq(layoutFor(5, 'paisagem', wide).cols, 3, 'lying stays 3 columns (wide=' + wide + ')');
      eq(layoutFor(5, 'paisagem', wide).rows, 2, 'lying stays 2 rows (wide=' + wide + ')');
    }
  }],

  ['the match can start with any player', () => {
    const m = makeMatch(4, 40, { firstSeatId: 's2' });
    eq(replay(m).activeSeatId, 's2', 'who opens');
    eq(replay(m).turn, 1, 'initial turn');
  }],

  ['the round closes on whoever started, not on the first seat', () => {
    const m = makeMatch(4, 40, { firstSeatId: 's2' });
    push(m, { type: 'turn' }); // s2 -> s3
    push(m, { type: 'turn' }); // s3 -> s0 (wraps the array, but not the table)
    eq(replay(m).turn, 1, 'still in the first round');
    eq(replay(m).activeSeatId, 's0', 'active seat');
    push(m, { type: 'turn' }); // s0 -> s1
    push(m, { type: 'turn' }); // s1 -> s2, now it closes
    const s = replay(m);
    eq(s.activeSeatId, 's2', 'back to whoever opened');
    eq(s.turn, 2, 'turn 2');
  }],

  ['the turn count does not slip when whoever started dies', () => {
    const m = makeMatch(4, 40, { firstSeatId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -40, sourceId: 's1' });
    push(m, { type: 'turn' }); // s0 (dead) leaves the scene -> s1
    const start = replay(m).turn;
    push(m, { type: 'turn' }); // s1 -> s2
    push(m, { type: 'turn' }); // s2 -> s3
    push(m, { type: 'turn' }); // s3 -> skips dead s0 -> s1: one round of the living
    const s = replay(m);
    eq(s.activeSeatId, 's1', 'back to the first one alive');
    eq(s.turn, start + 1, 'exactly one round counted');
  }],

  ['on a computer no table panel is upside down', () => {
    if (!simulated) return 'skip';
    // What the person saw: on the monitor, the players "at the top" showed up
    // with name, life and commander upside down. At the table that is right -
    // each panel points to its owner. On an upright monitor there is nobody on
    // the other side, and half the screen was unreadable.
    const tableRotations = () => {
      const root = document.createElement('div');
      const view = renderTable(root, {
        match: makeMatch(4),
        onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
      });
      const rotations = findAll(root, 'tile').map((n) => String(n.style.transform || ''));
      view.destroy();
      return rotations;
    };

    const before = globalThis.matchMedia;
    try {
      // No fine pointer: device lying on the table, the panels rotate.
      globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      ok(tableRotations().some((g) => g.includes('180deg')), 'at the table, the ones across rotate');

      // With a mouse or trackpad: upright monitor, nobody on the other side.
      globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
      const onPc = tableRotations();
      eq(onPc.length, 4, 'the four panels were drawn');
      ok(!onPc.some((g) => g.includes('180deg')), 'on the computer, none upside down');
      ok(onPc.every((g) => g.includes('0deg')), 'and all with a unit, otherwise the CSS drops the rule');
    } finally {
      globalThis.matchMedia = before;
    }
  }],

  ['panel: the first screen comes in visible and clickable', () => {
    if (!simulated) return 'skip';
    // The regression that motivated this test: the screen was born with
    // `is-next` (opacity:0 + pointer-events:none) and nobody removed it. The
    // panel opened empty and nothing answered to touch.
    openPanel({ title: 'A', build: (pane) => pane.append(document.createElement('p')) });

    const list = panes();
    eq(list.length, 1, 'mounted screens');
    ok(!list[0].classList.contains('is-next'), 'the first screen stayed hidden on the right');
    ok(!list[0].classList.contains('is-past'), 'the first screen was marked as previous');
    closeSheet();
  }],

  ['panel: moving forward stacks and going back restores the previous screen', () => {
    if (!simulated) return 'skip';
    const api = openPanel({ title: 'A', build: () => {} });

    api.next({ title: 'B', build: () => {} });
    flushFrames();
    let [a, b] = panes();
    eq(panes().length, 2, 'stacked screens');
    ok(a.classList.contains('is-past'), 'the previous one should step back');
    ok(!b.classList.contains('is-next'), 'the new one should be in sight');

    api.back();
    flushFrames();
    [a, b] = panes();
    ok(!a.classList.contains('is-past'), 'going back, the first returns to sight');
    ok(b.classList.contains('is-next'), 'the one leaving should leave to the right');
    closeSheet();
  }],

  ['an area action hits all the listed targets at once', () => {
    const m = makeMatch();
    push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 0, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq([s.players.s1.life, s.players.s2.life, s.players.s3.life], [37, 37, 37], 'opponents');
    eq(s.players.s0.life, 40, 'whoever fired is not hit');
    eq(m.events.length, 1, 'a single event, not one per target');
  }],

  ['a drain takes from everyone and gives back to whoever drained', () => {
    const m = makeMatch();
    push(m, { type: 'sweep', sourceId: 's0', amount: 2, gain: 6, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq(s.players.s1.life, 38, 'opponent');
    eq(s.players.s0.life, 46, 'whoever drained');
  }],

  ['undoing a drain reverts everything in one step', () => {
    const m = makeMatch();
    const before = JSON.stringify(replay(m).players);
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 15, targets: ['s1', 's2', 's3'] });
    undo(m);
    eq(JSON.stringify(replay(m).players), before, 'state after undo');
  }],

  ['an area action credits the eliminations to whoever fired it', () => {
    const m = makeMatch(4, 5);
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 0, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq(s.winnerId, 's0', 'winner');
    eq(s.players.s1.elim.byId, 's0', 'credit for the elimination');
    eq(aggregate([m]).players.find((p) => p.label === 'P0').kills, 3, 'eliminations counted');
  }],

  ['an area action goes into the statistics on both sides', () => {
    const m = makeMatch();
    push(m, { type: 'sweep', sourceId: 's0', amount: 4, gain: 12, targets: ['s1', 's2', 's3'] });
    const { players } = aggregate([m]);
    const p0 = players.find((p) => p.label === 'P0');
    eq(p0.damageDealt, 12, 'damage dealt (4 × 3)');
    eq(p0.healed, 12, 'life gained in the drain');
    eq(players.find((p) => p.label === 'P1').damageTaken, 4, 'damage taken per target');
  }],

  ['the startup stores which version the person came from', () => {
    // The release-notes slice depends on this, and it was an IIFE running on
    // import - deleting the line went through the whole suite without a
    // failure.
    const seen = store.getDB().settings.versaoVista;
    const previous = store.getDB().settings.versaoAnterior;
    try {
      ok(RELEASE_NOTES.length > 1, 'the test needs at least two versions');
      const old = RELEASE_NOTES[1].version;

      store.setSetting('versaoVista', old);
      store.setSetting('versaoAnterior', null);
      const fresh = announceVersion(APP_VERSION);

      eq(store.getDB().settings.versaoAnterior, old,
        'it did not store where the person came from');
      eq(store.getDB().settings.versaoVista, APP_VERSION,
        'it did not mark the current version as seen');
      eq(fresh.map((n) => n.version), [RELEASE_NOTES[0].version],
        'it announced more than the difference');

      // Reopening on the same version cannot reset the slice: reset, the menu
      // notes would go back to being the whole history.
      eq(announceVersion(APP_VERSION), [], 'it announced without the version changing');
      eq(store.getDB().settings.versaoAnterior, old,
        'reopening on the same version erased where the person came from');

      // A fresh install: nothing to announce, and nothing to remember.
      store.setSetting('versaoVista', null);
      store.setSetting('versaoAnterior', null);
      eq(announceVersion(APP_VERSION), [], 'it announced to someone who just installed');
      eq(store.getDB().settings.versaoAnterior, null,
        'it made up a previous version on a fresh install');
    } finally {
      store.setSetting('versaoVista', seen || null);
      store.setSetting('versaoAnterior', previous || null);
    }
    return undefined;
  }],

  ['the notes open on what came in since the previous version', () => {
    if (!simulated) return 'skip';
    // The slice is what makes the screen readable: with the whole history, the
    // three new lines sit under nine versions already read and what the person
    // learns is to close the screen without reading.
    const before = store.getDB().settings.versaoAnterior;
    try {
      ok(RELEASE_NOTES.length > 2, 'the test needs at least three versions');
      const secondToLast = RELEASE_NOTES[1].version;

      store.setSetting('versaoAnterior', secondToLast);
      openReleaseNotes();
      // On the OPEN sheet, and not on `document.body`: closeSheet removes the
      // node after 200ms, and in a synchronous test the previous sheet is
      // still in the document - the two added up and the count gave 12 where
      // there are 11.
      const sheet = () => findAll(document.body, 'sheet').slice(-1)[0];
      const versions = () => findAll(sheet(), 'news-version').map((n) => textOf(n));

      eq(versions(), [RELEASE_NOTES[0].version],
        'more than the difference since the previous version came');

      // The way out to the history exists: hiding cannot become deleting.
      const all = findAll(sheet(), 'news-all')[0];
      ok(all, 'no path to see all the versions');
      fire(all, 'click');
      eq(versions().length, RELEASE_NOTES.length,
        '"see all" did not show the whole history');

      // And on the whole history the button does not repeat: there is nothing
      // more to open.
      eq(findAll(sheet(), 'news-all').length, 0,
        'the see-all button showed on the screen that already shows everything');
      closeSheet();

      // A fresh install: with no previous version, only this version's notes.
      // The change history of an app the person never used is noise before the
      // first use.
      store.setSetting('versaoAnterior', null);
      openReleaseNotes();
      eq(versions(), [APP_VERSION],
        'a fresh install should only see the notes of the installed version');
      closeSheet();

      // An explicit list still rules: it is the startup path, which already
      // knows exactly what the person has not seen.
      openReleaseNotes([RELEASE_NOTES[1]]);
      eq(versions(), [RELEASE_NOTES[1].version], 'the given list was ignored');
    } finally {
      closeSheet();
      store.setSetting('versaoAnterior', before || null);
    }
    return undefined;
  }],

  ['the update button shows that it is updating', () => {
    if (!simulated) return 'skip';
    // The button waits up to ten seconds in silence: it checks the network and
    // then waits for the new worker to take over. Only disabled, it dims and
    // stays still - indistinguishable from a button that did not work.
    //
    // `navigator.standalone` is what makes `state()` say 'installed', the only
    // situation in which this button exists.
    const had = Object.prototype.hasOwnProperty.call(navigator, 'standalone');
    Object.defineProperty(navigator, 'standalone', {
      value: true, configurable: true, writable: true,
    });
    try {
      const box = installBlock();
      const button = findAll(box, 'set-row')[0];
      ok(button, 'installed, there should be the update button');
      eq(findAll(button, 'spinner').length, 0, 'spinner before tapping');

      // The spinner goes in BEFORE the await, so it is already there at the
      // moment of the tap - which is what the synchronous test can prove, and
      // what matters: the feedback has to be immediate, not after the network.
      fire(button, 'click');
      eq(findAll(button, 'spinner').length, 1, 'tapped and no spinner showed');
      ok(button.disabled, 'the button stayed clickable during the wait');
      ok(button.className.includes('is-updating'), 'no waiting class');
      ok(textOf(button).includes(t('settings.updating')),
        'the label did not say it is updating');
    } finally {
      if (!had) delete navigator.standalone;
      else navigator.standalone = false;
    }
    return undefined;
  }],

  ['a handed-off table does not open the game screen', () => {
    if (!simulated) return 'skip';
    // The baton is enforced where it is cheap to enforce. Inside the table
    // there would be twenty controls to disable, and forgetting one is enough
    // for two live copies of the same match to exist.
    store.wipe();
    try {
      const m = makeMatch(4);
      m.id = 'p-bastao';
      store.setCurrent(m);

      ok(store.getCurrent(), 'the live table should be available');

      handOffTable(m, 1234);
      store.setCurrent(m);

      // The invariant, and not an `if` in the router: for the rest of the app
      // the handed-off table simply does not exist. That way every path that
      // already handled "there is no open table" handles this case for free -
      // and there is no guard line someone could delete without anything
      // breaking.
      eq(store.getCurrent(), null, 'the handed-off table still counts as the current one');
      ok(store.storedTable(), 'the handed-off table vanished from the device');
      eq(store.storedTable().id, 'p-bastao');

      // Redrawing the home screen with the handed-off table: the notice shows
      // up, and it is what explains why the game vanished.
      const root = document.createElement('div');
      renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
      ok(findAll(root, 'handed-off').length === 1,
        'the home screen did not warn that the table was handed off');

      // And the receive button is there for whoever is going to carry on.
      ok(findAll(root, 'receive-table').length === 1,
        'the home screen does not offer receiving a table');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['untrusting records the refusal, instead of deleting the row', () => {
    if (!simulated) return 'skip';
    // With auto-accept coming from the history, deleting the row undoes
    // nothing: the trigger rebuilds it from the matches already played, and
    // the person would tap the button every month without understanding why it
    // has no effect.
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    const requests = [];
    globalThis.fetch = (u, o) => {
      requests.push({ url: String(u), method: (o && o.method) || 'GET',
        body: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    };
    account.session = { user: { id: 'eu' }, access_token: 'x' };

    try {
      untrustHost('aquele-anfitriao');
      const p1 = requests[requests.length - 1];
      eq(p1.method, 'POST', 'refusing still deletes the row instead of recording');
      eq(p1.body.confia, false, 'the refusal was not recorded as a refusal');
      eq(p1.body.host_id, 'aquele-anfitriao');

      trustHost('aquele-anfitriao');
      const p2 = requests[requests.length - 1];
      eq(p2.body.confia, true, 'trusting did not record trust');

      // Changing your mind has to count: with ignore-duplicates the second tap
      // would be swallowed and the button would look broken.
      ok(String(p2.url).includes('trusted_hosts'));
      ok(!/ignore-duplicates/.test(JSON.stringify(p2)), 'conflict ignored');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
    }
    return undefined;
  }],

  ['taking back leads back to the table, not to the home screen', async () => {
    if (!simulated) return 'skip';
    // The reported defect, now reachable: the path goes through
    // `await confirmAction`, and the synchronous runner could not observe
    // anything after the await. Eleven mutations did not catch it - not for
    // lack of a test, but because a test was impossible.
    store.wipe();
    try {
      const m = makeMatch(4);
      m.id = 'p-retomada';
      handOffTable(m, 1000);
      store.setCurrent(m);

      let redraws = 0;
      let opens = 0;
      const banner = handedOffBanner(() => { redraws += 1; },
        () => { opens += 1; });
      ok(banner, 'without a handed-off table there is nothing to test');

      const takeBack = findAll(banner, 'btn')[0];
      ok(takeBack, 'the notice does not offer taking back');
      fire(takeBack, 'click');

      // The confirmation opens in a sheet; confirming is what fires the rest.
      await Promise.resolve();
      const actions = findAll(document.body, 'sheet-actions').slice(-1)[0];
      ok(actions, 'taking back did not ask for confirmation');
      fire(actions.childNodes[1], 'click');
      await Promise.resolve();
      await Promise.resolve();

      ok(store.getCurrent(), 'took back and the table did not count again');
      eq(isHandedOff(store.storedTable()), false, 'the stamp stayed');
      eq(opens, 1, 'taking back did not lead back to the table');
      eq(redraws, 0, 'taking back only redrew the home screen, which is where the person '
        + 'got stuck with no way to the match');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['receiving a file installs the table and opens it', async () => {
    if (!simulated) return 'skip';
    // The reported defect: the table was installed and the screen stayed on
    // the home screen - only reloading the page found it, because the initial
    // route is the only one that looks at `getCurrent()` by itself. The cause
    // was the wrong callback reaching the button, and proving it takes walking
    // the whole path: with no file chosen, no callback is called and both look
    // the same.
    store.wipe();
    try {
      // A table packed by "another device".
      const original = makeMatch(4);
      original.id = 'p-chegando';
      push(original, { type: 'life', targetId: 's1', sourceId: 's0', delta: -11 });
      store.setCurrent(original);
      const file = store.packTable(1000);
      store.wipe();

      let redraws = 0;
      let opens = 0;
      const root = document.createElement('div');
      renderSetup(root, {
        onStart() {}, onStats() {},
        onRefresh: () => { redraws += 1; },
        onOpenTable: () => { opens += 1; },
      });

      const receive = findAll(root, 'receive-table')[0];
      ok(receive, 'the home screen does not offer receiving a table');
      fire(receive, 'click');

      // With a cloud, receiving opens the code field; the file is one tap
      // away, under "I have a file", for when there is no internet.
      if (cloudEnabled()) {
        const haveFile = findAll(document.body, 'btn')
          .find((b) => textOf(b) === t('pass.haveFile'));
        ok(haveFile, 'receiving by code does not offer the file');
        fire(haveFile, 'click');
      }

      const field = document.body.childNodes[document.body.childNodes.length - 1];
      eq(field.attributes.type, 'file', 'tapping receive did not open the picker');

      // The file the person chose.
      field.files = [{ name: 'mesa.json', text: () => Promise.resolve(file) }];
      fire(field, 'change');
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      const actions = findAll(document.body, 'sheet-actions').slice(-1)[0];
      ok(actions, 'receiving did not ask for confirmation');
      fire(actions.childNodes[1], 'click');
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      const arrived = store.getCurrent();
      ok(arrived, 'the table was not installed');
      eq(arrived.id, 'p-chegando');
      eq(replay(arrived).players.s1.life, 40 - 11, 'the match did not arrive whole');

      eq(opens, 1, 'it installed the table and did not open it: the page had '
        + 'to be reloaded for the match to show up');
      eq(redraws, 0, 'receiving only redrew the home screen');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['the table file carries the match id', () => {
    // A fixed name turned two tables in the downloads folder into
    // `mesa-hit-easy (1).json`, and then nobody knows which is which - neither
    // the sender nor the receiver.
    const a1 = makeMatch(4);
    const b1 = makeMatch(4);
    ok(a1.id !== b1.id, 'the test needs two different matches');

    const n1 = tableFileName(a1);
    const n2 = tableFileName(b1);
    ok(n1.includes(a1.id), 'the name does not carry the id: ' + n1);
    ok(n1 !== n2, 'two tables produced the same file name');
    ok(n1.endsWith('.json'), 'the file lost its extension: ' + n1);

    // Characters that cannot be saved in a file cannot get through. Today's
    // id only has letters, digits and `_`, but finding out otherwise on
    // someone else's phone would be too late.
    const dirty = tableFileName({ id: 'a/b\\c:d*e?f"g<h>i|j' });
    ok(!/[\/\\:*?"<>|]/.test(dirty), 'the name came out with a forbidden character: ' + dirty);

    // Without an id it still produces a valid name, instead of 'mesa-hit-easy-.json'.
    eq(tableFileName(null), 'mesa-hit-easy.json');
    eq(tableFileName({ id: '' }), 'mesa-hit-easy.json');
  }],

  ['with an open match, the home screen offers to go into it', () => {
    if (!simulated) return 'skip';
    // The reported defect: taking back returned the table and left the person
    // stuck on the home screen, with no way back to the match - and the table
    // menu, where passing lives, was out of reach. That was the "the button to
    // move the match disappeared".
    //
    // Normally this state does not even exist: the app opens straight on the
    // table when there is a match. Taking back created a new state, and the
    // way out has to exist wherever it comes from.
    store.wipe();
    try {
      eq(resumeTableBanner(() => {}), null, 'offered to go in without a match');

      const m = makeMatch(4);
      m.id = 'p-aberta';
      store.setCurrent(m);

      let opened = 0;
      const banner = resumeTableBanner(() => { opened += 1; });
      ok(banner, 'with an open match, the home screen did not offer to go into it');
      fire(banner, 'click');
      eq(opened, 1, 'tapping resume did not open the table');

      // A handed-off table does NOT count: for the rest of the app it does not
      // exist, and offering "resume" would lead to a screen the router refuses.
      handOffTable(m, 1000);
      store.setCurrent(m);
      eq(resumeTableBanner(() => {}), null,
        'it offered to resume a table that was handed off');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['passing the table takes the baton from this device', () => {
    // The whole point: after the handoff there are two copies with the same
    // id, and the upload uses ignore-duplicates - the first one up wins and
    // the other vanishes silently. If the old device kept playing, it would be
    // the one losing someone's half or making them lose it.
    const m = makeMatch(4);
    eq(isHandedOff(m), false, 'a new table was born handed off');

    eq(handOffTable(m, 5000), true, 'it did not pass');
    eq(isHandedOff(m), true, 'it passed and was not marked');
    eq(m.passadaEm, 5000);

    // Passing twice does not re-stamp: the baton date is the first one, and
    // rewriting it would erase when the table left here.
    eq(handOffTable(m, 9000), false, 'it passed again');
    eq(m.passadaEm, 5000, 'the handoff date was rewritten');

    // Taking back is the only way back, and it is explicit.
    eq(reclaimTable(m), true);
    eq(isHandedOff(m), false, 'took back and it stayed marked');
    eq(reclaimTable(m), false, 'it took back a table that was not handed off');

    eq(handOffTable(null), false, 'it passed a table that does not exist');
  }],

  ['the received table moves the clock forward', () => {
    // The events carry the `ts` of the device that recorded them. If the
    // receiver's clock is behind, the next event is born BEFORE the previous
    // one - and `elapsedOf` and `advanceTurn` subtract instants, so time going
    // backwards becomes a negative duration on the table.
    const m = makeMatch(4);
    m.startedAt = 1000000;
    m.events.push({ id: 'e1', ts: 1000000 + 600000, type: 'life', targetId: 's0', delta: -3 });
    handOffTable(m, 1000000 + 600000);

    // A device ten minutes behind: it needs an offset.
    const behind = receiveTable(m, 1000000);
    ok(behind.desvioDeRelogio > 600000,
      'a clock behind got too small an offset: ' + behind.desvioDeRelogio);
    ok(tableNow(behind, 1000000) > 1000000 + 600000,
      'the next event would be born before the last one that already happened');

    // A device ahead: nothing to fix. Pushing the clock forward without
    // precision would inflate the match duration.
    const ahead = receiveTable(m, 1000000 + 9999999);
    eq(ahead.desvioDeRelogio, 0, 'a clock ahead should not get an offset');

    // And the table arrives playable: without the stamp and without redo.
    eq(isHandedOff(ahead), false, 'the table arrived still marked as handed off');
    eq(ahead.redo, []);
    eq(ahead.id, m.id, 'the id changed: the match would stop being the same');

    eq(receiveTable({ id: 'x' }), null, 'it accepted a broken table');
  }],

  ['the table file carries one table, not your history', () => {
    // The backup exporter sends the whole database. Using it here would hand
    // the friend every match of whoever passed it, the @s the device knows and
    // the preferences. It is the easiest mistake to make and the most
    // expensive.
    store.wipe();
    try {
      const old = makeMatch(4);
      old.id = 'p-antiga';
      old.events.push({ id: 'w', ts: old.startedAt + 1, type: 'win', targetId: 's0' });
      store.mergeMatches([old]);
      store.rememberPlayer('Bruno');

      const current = makeMatch(4);
      current.id = 'p-atual';
      store.setCurrent(current);

      const text = store.packTable(7777);
      ok(text, 'it did not pack');
      ok(!text.includes('p-antiga'), 'the file took the history along');
      ok(!text.includes('Bruno'), 'the file took the names the device knows');

      const data = store.readTable(text);
      eq(data.partida.id, 'p-atual');
      eq(data.versao, store.TABLE_FORMAT_VERSION);

      // Packing ALREADY releases the table: packing without releasing would
      // leave two live copies, which is the only way to lose data here.
      eq(store.getCurrent(), null,
        'it packed and the table still counted as the current one');
      eq(isHandedOff(store.storedTable()), true, 'it packed and did not release');
      eq(store.packTable(8888), null, 'it packed a table already handed off');

      // And the file is refused with a reason, instead of opening halfway.
      const refuse = (text2, expected) => {
        try { store.readTable(text2); } catch (e) { eq(e.message, expected); return; }
        throw new Error('it accepted what it should refuse: ' + expected);
      };
      refuse('{{{', 'unreadable');
      refuse(JSON.stringify({ history: [] }), 'not-a-table');
      refuse(JSON.stringify({ formato: store.TABLE_FORMAT, versao: 99, partida: current }), 'newer-version');
      refuse(JSON.stringify({ formato: store.TABLE_FORMAT, versao: 1, partida: { id: 'x' } }), 'invalid-table');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['receiving installs the table and the game carries on where it stopped', () => {
    store.wipe();
    try {
      const m = makeMatch(4);
      m.id = 'p-viajante';
      push(m, { type: 'life', targetId: 's1', sourceId: 's0', delta: -7 });
      const lifeBefore = replay(m).players.s1.life;

      store.setCurrent(m);
      const text = store.packTable(1000);

      // Another device, from scratch.
      store.wipe();
      eq(store.getCurrent(), null);

      store.installTable(store.readTable(text), 2000);
      const arrived = store.getCurrent();
      ok(arrived, 'the table was not installed');
      eq(arrived.id, 'p-viajante');
      eq(replay(arrived).players.s1.life, lifeBefore,
        'the life did not survive the trip');
      eq(isHandedOff(arrived), false, 'it arrived marked as handed off: it cannot be played');

      // And it keeps yielding new events, after the old ones.
      const lastBefore = arrived.events[arrived.events.length - 1].ts;
      push(arrived, { type: 'life', targetId: 's2', sourceId: 's0', delta: -2 });
      const fresh = arrived.events[arrived.events.length - 1];
      ok(fresh.ts > lastBefore,
        'the new event was born before the last old one: ' + fresh.ts + ' <= ' + lastBefore);
      eq(replay(arrived).players.s2.life, 40 - 2);

      // Taking back undoes it, for when the handoff did not work out.
      handOffTable(arrived, 3000);
      store.setCurrent(arrived);
      eq(store.getCurrent(), null, 'handed off and still playable');
      eq(store.takeTableBack(), true);
      ok(store.getCurrent(), 'took back and the table did not count again');
      eq(isHandedOff(store.getCurrent()), false);
      eq(store.takeTableBack(), false, 'took back what was not handed off');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['what goes up carries the channel stamp', () => {
    // Production and beta live on the same origin and the same database. The
    // disk was already separated by `storageKey()`; the cloud did not know
    // what a channel was, and a test table went up to the same table the real
    // app reads.
    const m = createMatch([
      { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
      { id: 's1', name: 'Bruno', handle: 'bruno', commanders: [commander(2)] },
    ], 40);
    m.id = 'p-canal';

    eq(toRow(m, 'dono-1', 'beta').canal, 'beta', 'the match went up without the channel');
    eq(toRow(m, 'dono-1', 'producao').canal, 'producao');

    // Without a channel, 'producao'. The database also sets that default, and
    // it is right for the old rows - but here the explicit value is what
    // prevents the dangerous case: beta going up stamped as real by omission.
    eq(toRow(m, 'dono-1').canal, 'producao', 'without a channel it should become production');

    // The seats too. A seat tagged at a test table would become an invite
    // visible in the real app - the test channel writing into someone else's
    // life.
    const seats = participantsOf(m, 'beta');
    eq(seats.length, 2, 'both tagged seats should become rows');
    seats.forEach((c, i) => {
      eq(c.canal, 'beta', 'seat ' + i + ' went up without the channel');
      eq(c.match_id, 'p-canal');
    });
    eq(participantsOf(m)[0].canal, 'producao', 'without a channel it should become production');
  }],

  ['the profile decks have one column per channel', () => {
    // `decks` keeps the decks that follow the account. Without separating, a
    // test table with made-up commanders would get into the deck picker of the
    // real app - and the feature exists precisely so the picker knows the
    // person's decks.
    eq(decksColumn('beta'), 'decks_beta');
    eq(decksColumn('producao'), 'decks');
    eq(decksColumn(undefined), 'decks', 'without a channel it should be the real column');
    eq(decksColumn('qualquer-outra-coisa'), 'decks',
      'an unknown channel cannot become the test column');
  }],

  ['beta goes up stamped as beta, end to end', () => {
    if (!simulated) return 'skip';
    // Covering only `toRow` was not enough: it is pure and receives the
    // channel ready. The point that matters is where `channel()` is CALLED,
    // and swapping that call for 'producao' went through the whole suite -
    // the mutation that means, in one line, "beta poisons the real database".
    const realFetch = globalThis.fetch;
    const realPath = location.pathname;
    const realSession = account.session;
    const realProfile = account.profile;
    const bodies = [];

    globalThis.fetch = (u, o) => {
      bodies.push({ url: String(u), body: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve([]),
      });
    };
    account.session = { user: { id: 'dono-de-teste' }, access_token: 'x' };
    account.profile = { id: 'dono-de-teste', handle: 'alienpls' };

    try {
      const m = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
        { id: 's1', name: 'Bruno', handle: 'bruno', commanders: [commander(2)] },
      ], 40);
      m.id = 'p-subida';

      const ofMatch = () => bodies.find((c) => c.url.includes('/matches'));
      const ofSeats = () => bodies.find((c) => c.url.includes('/match_players'));
      const ofProfile = () => bodies.find((c) => c.url.includes('/profiles'));

      location.pathname = '/hit-easy/beta/';
      // The two calls separated on purpose: inside `uploadMatch` the seats
      // only go out AFTER the match's `await`, and this runner is synchronous -
      // waiting for them here would be waiting forever.
      uploadMatch(m);
      sendParticipants(m);
      saveMyDecks([{ commanders: [commander(1)], lastUsed: 10 }]);

      ok(ofMatch(), 'the match was never sent');
      eq(ofMatch().body.canal, 'beta',
        'beta uploaded the match stamped as production');

      ok(ofSeats(), 'the tagged seats were not sent');
      ofSeats().body.forEach((row, i) => {
        eq(row.canal, 'beta', 'seat ' + i + ' went up with the wrong channel');
      });

      ok(ofProfile(), 'the decks were never sent');
      ok('decks_beta' in ofProfile().body,
        'beta wrote the decks to the real column: '
        + Object.keys(ofProfile().body).join(', '));
      ok(!('decks' in ofProfile().body), 'beta touched the production column');

      // And production keeps writing where it always wrote.
      bodies.length = 0;
      location.pathname = '/hit-easy/';
      const m2 = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
      ], 40);
      m2.id = 'p-subida-2';
      uploadMatch(m2);
      saveMyDecks([{ commanders: [commander(1)], lastUsed: 10 }]);

      eq(ofMatch().body.canal, 'producao', 'production went up outside its channel');
      ok('decks' in ofProfile().body, 'production stopped writing to decks');
      ok(!('decks_beta' in ofProfile().body),
        'production wrote to the test column');
    } finally {
      globalThis.fetch = realFetch;
      location.pathname = realPath;
      account.session = realSession;
      account.profile = realProfile;
    }
    return undefined;
  }],

  ['what comes down is filtered by this app\'s channel', () => {
    if (!simulated) return 'skip';
    // Stamping on the way up and not filtering on the way down would leave
    // everything as it was: production would keep downloading the test
    // matches. Both ends have to hold, and here the proof is the URL that
    // really goes out.
    const realFetch = globalThis.fetch;
    const realPath = location.pathname;
    const requests = [];
    globalThis.fetch = (u, o) => {
      requests.push(String(u));
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve([]),
      });
    };

    try {
      const last = () => requests[requests.length - 1];

      location.pathname = '/hit-easy/beta/';
      downloadMatches();
      ok(last().includes('canal=eq.beta'),
        'beta downloaded without filtering the channel: ' + last());
      remoteIds();
      ok(last().includes('canal=eq.beta'),
        'the beta id list did not filter: ' + last());

      location.pathname = '/hit-easy/';
      downloadMatches();
      ok(last().includes('canal=eq.producao'),
        'production downloaded without filtering the channel: ' + last());
      ok(!last().includes('beta'), 'production asked for test matches');
      remoteIds();
      ok(last().includes('canal=eq.producao'),
        'the production id list did not filter: ' + last());
    } finally {
      globalThis.fetch = realFetch;
      location.pathname = realPath;
    }
    return undefined;
  }],

  ['sorting goes up for placing and down for everything else', () => {
    // Placing is the only one that inverts: first place is 1, so the best is
    // the SMALLEST. Getting the direction wrong here would give a list headed
    // by the worst player under the label "best placing" - and nobody looks
    // twice at a sorted list, which is precisely what makes it dangerous.
    const row = (key, extra) => ({
      key, label: key, games: 0, wins: 0, winrate: 0,
      avgDamageDealt: 0, avgKills: 0, avgPlace: 0, ...extra,
    });

    const rows = [
      row('pouco', { games: 1, wins: 1, winrate: 1, avgPlace: 3, avgDamageDealt: 10 }),
      row('muito', { games: 10, wins: 8, winrate: 0.8, avgPlace: 1.2, avgDamageDealt: 90 }),
      row('meio', { games: 5, wins: 2, winrate: 0.4, avgPlace: 2.1, avgDamageDealt: 50 }),
    ];

    const keys = (id) => sortRows(rows, id).map((l) => l.key);

    eq(keys('matches'), ['muito', 'meio', 'pouco'], 'matches did not go down');
    eq(keys('wins'), ['muito', 'meio', 'pouco'], 'wins did not go down');
    eq(keys('damage'), ['muito', 'meio', 'pouco'], 'damage did not go down');
    eq(keys('place'), ['muito', 'meio', 'pouco'],
      'placing did not go up: the best placed has to come first');

    // The rate has the known trap: one won match is 100%. It is what the
    // person asked for when choosing the rate, and the test records that it is
    // on purpose.
    eq(keys('winrate'), ['pouco', 'muito', 'meio'], 'rate did not go down');

    // The default is the usual one, and an id that no longer exists falls
    // back to it instead of returning the list in Map order.
    eq(keys('relevance'), keys('id-que-nao-existe'),
      'an unknown id did not fall back to the default');
    eq(sortById('nada').id, SORTS[0].id);

    // It does not touch the caller's list: the screen sorts on every repaint,
    // and sorting in place would shuffle the agg the other tabs are reading.
    //
    // After an order that REORDERS. The assertion used to come after sorting
    // by relevance, which in this fixture returns the original order - it
    // passed the same with the list mutated, and the mutation test is what
    // told.
    sortRows(rows, 'matches');
    eq(rows.map((l) => l.key), ['pouco', 'muito', 'meio'], 'the original list changed');
  }],

  ['a tie in matches is broken by relevance, always the same', () => {
    // Half a group ties on two matches. Without an explicit tiebreaker the
    // order came from the Map insertion, which changes when an old match is
    // deleted: the list reshuffled by itself without that number changing.
    const row = (key, winrate) => ({ key, label: key, games: 2, wins: 1, winrate });
    const a = [row('x', 0.1), row('y', 0.9), row('z', 0.5)];
    const b = [row('z', 0.5), row('x', 0.1), row('y', 0.9)];

    eq(sortRows(a, 'matches').map((l) => l.key), ['y', 'z', 'x']);
    eq(sortRows(b, 'matches').map((l) => l.key), ['y', 'z', 'x'],
      'the same list in another input order came out different');
  }],

  ['every sort has a label in the four languages', () => {
    // An option with no translation shows up as the key itself in the picker -
    // and only in German, which is exactly the kind of defect nobody sees.
    const before = currentLang();
    try {
      for (const lang of LANGS) {
        setLang(lang);
        for (const o of SORTS) {
          const text = t(o.label);
          ok(text && text !== o.label,
            'no translation of ' + o.label + ' in ' + lang);
        }
      }
    } finally {
      setLang(before);
    }
    return undefined;
  }],

  ['the sort picker reorders both tabs', () => {
    if (!simulated) return 'skip';
    store.wipe();
    let root = null;
    try {
      // Three matches between the same two: Ana wins one, Bruno two. That way
      // "best placing" and "most wins" point to Bruno, and the list has a first
      // place that can be asserted.
      // Bruno wins more, Ana deals more damage. The two orders point to
      // different people, and that is what proves the picker is in charge:
      // with an order that matches the aggregation's default, not sorting
      // would give the same result and the test would pass with nothing wired.
      const matchOf = (id, winner) => {
        const m = createMatch([
          { id: 's0', name: 'Ana', commanders: [commander(1)] },
          { id: 's1', name: 'Bruno', commanders: [commander(2)] },
        ], 40);
        m.id = 'p-' + id;
        m.events.push({
          type: 'life', ts: m.startedAt + 1, targetId: 's1', sourceId: 's0', delta: -9,
        });
        m.events.push({ type: 'win', ts: m.startedAt + 2, targetId: winner });
        return m;
      };
      store.mergeMatches([matchOf('a', 's0'), matchOf('b', 's1'), matchOf('c', 's1')]);

      const screen = document.createElement('div');
      root = screen;
      renderStats(screen, { onBack() {} });
      const panel = () => findAll(screen, 'stats-panel')[0];
      const names = () => findAll(panel(), 'card-name').map((n) => textOf(n));
      const picker = () => findAll(screen, 'select-input')
        .find((c) => c.getAttribute('aria-label') === t('stats.sortBy'));

      ok(picker(), 'the Decks tab has no sort picker');
      eq(names().length, 2, 'both decks should be on the list');

      // Placing is the inverted direction, the one that fails silently: Bruno's
      // deck has to lead, because he won more.
      fire(picker(), 'change', { target: { value: 'place' } });
      eq(names()[0], 'Cmd 2',
        'by best placing the first should be the deck of whoever won more');

      fire(picker(), 'change', { target: { value: 'matches' } });
      eq(names().length, 2, 'sorting by matches lost a row');

      // The Players tab has the picker too, and really reorders.
      fire(findAll(screen, 'tab')[1], 'click');
      ok(picker(), 'the Players tab has no sort picker');
      eq(names().length, 2, 'the Players tab did not list both');

      // By relevance (the default) Bruno leads, because he won more.
      eq(names()[0], 'Bruno', 'the default should start with whoever won more');

      // By damage the list INVERTS: Ana dealt all the damage. It is the only
      // way to prove the tab sorts, instead of just repeating the aggregation
      // order.
      fire(picker(), 'change', { target: { value: 'damage' } });
      eq(names()[0], 'Ana', 'by damage dealt the first should be whoever hit');

      fire(picker(), 'change', { target: { value: 'place' } });
      eq(names()[0], 'Bruno',
        'by best placing the first should be whoever won more');
    } finally {
      // The active tab and the order are MODULE state of the screen and
      // survive the case. Leaving the Players tab on made the filter test count
      // player cards thinking it counted decks - and the failure message
      // blamed the filter, which had nothing to do with it. Undo it on the
      // root this case created, because it was never attached to the document.
      if (root) {
        const field = findAll(root, 'select-input')
          .find((c) => c.getAttribute('aria-label') === t('stats.sortBy'));
        if (field) fire(field, 'change', { target: { value: 'relevance' } });
        const first = findAll(root, 'tab')[0];
        if (first) fire(first, 'click');
      }
      store.wipe();
    }
    return undefined;
  }],

  ['merging decks does not repeat, and keeps the newest date', () => {
    const deck = (n, at) => ({ commanders: [commander(n)], lastUsed: at });

    // The same deck in both lists: the most recent date stays, because it is
    // what answers "which deck have they been playing".
    const merged = mergeDecks([deck(1, 100), deck(2, 300)], [deck(1, 500)]);
    eq(merged.length, 2, 'the same deck went in twice');
    eq(merged[0].lastUsed, 500, 'the list did not come from the most recent to the oldest');
    eq(merged[1].lastUsed, 300);

    // Junk does not get in: a deck with no commander has no key, and would
    // become an empty row in the picker.
    eq(mergeDecks([{ commanders: [] }, null], [undefined]).length, 0,
      'a deck with no commander got into the list');
  }],

  ['the decks only go up to the profile when the set changes', () => {
    // `lastUsed` changes with every match. Without comparing by set, every
    // sync would write to the profile to say the same thing.
    const deck = (n, at) => ({ commanders: [commander(n)], lastUsed: at });

    eq(decksChanged([deck(1, 100)], [deck(1, 999)]), false,
      'the same list with a different date was treated as a change');
    eq(decksChanged([deck(1, 100), deck(2, 100)], [deck(1, 100)]), true,
      'a new deck was not noticed');
    eq(decksChanged([], []), false, 'two empty lists differ');
    eq(decksChanged([deck(1, 100)], undefined), true,
      'a profile with no decks should receive the first list');

    // The order does not count: it is a set, not a sequence.
    eq(decksChanged([deck(1, 1), deck(2, 2)], [deck(2, 9), deck(1, 9)]), false,
      'the order of the lists became a difference');
  }],

  ['on a new device, the account decks show up without history', () => {
    // It is the whole case: signing in on a device where nobody ever played.
    // The local history is empty, and without the account decks the person
    // has to search Scryfall for a commander the app already knows.
    store.wipe();
    try {
      eq(store.decksOfPlayer(null, 'alienpls').length, 0,
        'a deck showed up with no history and no profile');

      store.saveAccountDecks('alienpls', [
        { commanders: [commander(1)], lastUsed: 200 },
        { commanders: [commander(2)], lastUsed: 100 },
      ]);

      const noHistory = store.decksOfPlayer(null, 'alienpls');
      eq(noHistory.length, 2, 'the account decks did not show up');
      eq(deckKeyOf(noHistory[0].commanders), deckKeyOf([commander(1)]),
        'the list did not come from the most recent to the oldest');

      // And with local history, both sources merge without repeating.
      const m = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(2)] },
        { id: 's1', name: 'Bruno', commanders: [commander(9)] },
      ], 40);
      m.startedAt = 900;
      store.mergeMatches([m]);

      const merged = store.decksOfPlayer(null, 'alienpls');
      eq(merged.length, 2, 'the repeated deck went in twice');
      eq(deckKeyOf(merged[0].commanders), deckKeyOf([commander(2)]),
        'the deck played now did not go to the top');

      // Another account on the same device does not see the first one's decks.
      eq(store.decksOfPlayer(null, 'outra').length, 0,
        'one account\'s decks leaked to another');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['the deck row knows who brought it', () => {
    // The row aggregates everyone who played that deck, and that is how it has
    // to be - in Commander the same deck passes from hand to hand. But without
    // knowing WHO, there is no answering "which decks does Bruno play".
    const withDeck = (name, whichDeck) => createMatch([
      { id: 's0', name, commanders: [commander(whichDeck)] },
      { id: 's1', name: 'Bruno', commanders: [commander(9)] },
    ], 40);

    const { decks } = aggregate([withDeck('Ana', 1), withDeck('Caio', 1)]);
    const shared = decks.find((d) => d.playerKeys.length === 2);
    ok(shared, 'no deck recorded both players');
    eq(shared.playerKeys.slice().sort(), ['ana', 'caio'],
      'the deck did not keep who brought it');

    const brunos = decks.find((d) => d.playerKeys.includes('bruno'));
    eq(brunos.playerKeys, ['bruno'], 'Bruno\'s deck ended up with extra people');
  }],

  ['the Decks tab filter shows only that player\'s decks', () => {
    if (!simulated) return 'skip';
    store.wipe();
    let root = null;
    try {
      // Ana plays two decks, Bruno plays one. "All" shows the three.
      const matchOf = (anasDeck, id) => {
        const m = createMatch([
          { id: 's0', name: 'Ana', commanders: [commander(anasDeck)] },
          { id: 's1', name: 'Bruno', commanders: [commander(9)] },
        ], 40);
        m.id = 'p-' + id;
        return m;
      };
      store.mergeMatches([matchOf(1, 'a'), matchOf(2, 'b')]);

      const screen = document.createElement('div');
      root = screen;
      renderStats(screen, { onBack() {} });

      const panel = () => findAll(screen, 'stats-panel')[0];
      const deckCount = () => findAll(panel(), 'card').length;
      eq(deckCount(), 3, '"All" did not show the three decks');

      // By aria-label, not by position: the tab now has two `<select>`s, and
      // `[0]` would pick the sort one the day the sort came first - a test
      // that changes subject by itself.
      const filter = () => findAll(screen, 'select-input')
        .find((c) => c.getAttribute('aria-label') === t('stats.filterByPlayer'));
      ok(filter(), 'the Decks tab has no player filter');

      // Filtering by Bruno: only his deck.
      fire(filter(), 'change', { target: { value: 'bruno' } });
      eq(deckCount(), 1, 'the filter did not reduce the list to Bruno\'s deck');

      // And going back to All returns the three.
      fire(filter(), 'change', { target: { value: 'all' } });
      eq(deckCount(), 3, '"All" did not return the whole list');
    } finally {
      // The filter is MODULE state of the screen and survives the case:
      // leaving it stuck would make the next test see a filtered list for no
      // reason.
      //
      // On this case's root, not on `document.body`: the root was never
      // attached to the document, so the old search found nothing and the
      // cleanup was a no-op passing for cleanup.
      if (root) {
        const field = findAll(root, 'select-input')
          .find((c) => c.getAttribute('aria-label') === t('stats.filterByPlayer'));
        if (field) fire(field, 'change', { target: { value: 'all' } });
      }
      store.wipe();
    }
    return undefined;
  }],

  ['in the statistics, the device back button goes back inside the app', () => {
    if (!simulated) return 'skip';
    // Without this Android's back CLOSED the app: there was no history entry
    // to consume, and a fullscreen PWA exits. Precisely on the screen where the
    // gesture is the most natural.
    const onRoute = () => document.body.dataset.route;
    const wasRoute = onRoute();
    try {
      const stats = statsButton();
      ok(stats, 'the home screen has no statistics button');

      const before = historyLog.pushed;
      fire(stats, 'click');
      eq(onRoute(), 'stats', 'did not get to the statistics');
      eq(historyLog.pushed, before + 1,
        'entering the statistics did not push a history entry');

      // The system gesture: goes back inside the app, does not close.
      fireWindow('popstate');
      eq(onRoute(), 'setup', 'back did not bring us to the home screen');
    } finally {
      if (onRoute() !== wasRoute) document.body.dataset.route = wasRoute;
    }
    return undefined;
  }],

  ['with a panel open, back closes the panel and does not navigate', () => {
    if (!simulated) return 'skip';
    // The worst possible effect of the back that just came in: leaving the
    // screen with the sheet standing over the new one.
    const onRoute = () => document.body.dataset.route;
    const wasRoute = onRoute();
    try {
      const stats = statsButton();
      ok(stats, 'the home screen has no statistics button');
      fire(stats, 'click');
      eq(onRoute(), 'stats', 'did not get to the statistics');

      openFlow({ title: 'teste', build: (pane) => pane.append(el('p', { text: 'x' })) });
      ok(isSheetOpen(), 'the panel did not open');

      const before = historyLog.pushed;
      fireWindow('popstate');
      ok(!isSheetOpen(), 'back did not close the panel');
      eq(onRoute(), 'stats', 'back navigated with a panel open');
      eq(historyLog.pushed, before + 1,
        'closing the panel did not give the history entry back');

      fireWindow('popstate');
      eq(onRoute(), 'setup', 'the next back did not leave the statistics');
    } finally {
      closeSheet();
      if (onRoute() !== wasRoute) document.body.dataset.route = wasRoute;
    }
    return undefined;
  }],

  ['hiding the app stops the clock of the match in progress', () => {
    if (!simulated) return 'skip';
    // The wiring, not the math: it proves the visibility listener is hung and
    // reaches the engine. app.js starts along with the suite (see the import
    // at the top), so the listener is already registered here.
    store.wipe();
    try {
      const m = makeMatch();
      store.setCurrent(m);

      const before = document.visibilityState;
      document.visibilityState = 'hidden';
      fire(document, 'visibilitychange');
      document.visibilityState = before;

      ok(store.getCurrent().ausenteDesde,
        'hiding the app did not stop the clock');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['time away from the table counts neither in the duration nor in the turn', () => {
    // The defect this fixes: the duration was WALL time. Going to the
    // statistics, locking the phone or closing the app added all of that to
    // the match - and, when passing the turn, to the turn of whoever was
    // playing. Half an hour in the bathroom became "the longest turn of the
    // night".
    const m = makeMatch();
    const t0 = m.startedAt;

    // Turn 1 from 0 to 100s, with 60s away in the middle of it.
    m.ausencias = [[t0 + 20000, t0 + 80000]];
    m.events.push({ id: 'a', ts: t0 + 100000, turn: 1, type: 'turn' });

    const s1 = replay(m);
    eq(elapsedOf(m, s1, t0 + 100000), 40000, 'the duration did not discount the time away');
    eq(s1.players.s0.timeOnTurn, 40000, 'the turn did not discount the time away');
  }],

  ['time away is discounted by overlap, not in total', () => {
    // By overlap because turn time has to discount only what fell INSIDE that
    // turn - an added total would discount from the wrong turn.
    const m = makeMatch();
    const t0 = m.startedAt;
    m.ausencias = [[t0 + 100, t0 + 200], [t0 + 500, t0 + 900]];

    eq(awayBetween(m, t0, t0 + 1000), 500, 'the two ranges add up');
    eq(awayBetween(m, t0, t0 + 150), 50, 'the range is clipped at the end');
    eq(awayBetween(m, t0 + 150, t0 + 1000), 450, 'and at the start');
    eq(awayBetween(m, t0 + 250, t0 + 450), 0, 'a window between the ranges discounts nothing');

    // The period still OPEN counts up to the moment of the question: it is the
    // case of the closed app, where nobody wrote the end.
    m.ausenteDesde = t0 + 2000;
    eq(awayBetween(m, t0, t0 + 3000), 1500, 'the open period counts up to now');
  }],

  ['the clock does not stop twice, nor after the end', () => {
    // With a manual pause in progress the time no longer counts. Opening an
    // away period on top would discount the same period twice, and the match
    // would come out shorter than it was.
    const paused = makeMatch();
    paused.events.push({
      id: 'p', ts: paused.startedAt + 1000, turn: 1, type: 'pause',
    });
    eq(leaveTable(paused, paused.startedAt + 2000), false,
      'it opened an away period with the table already paused');
    eq(paused.ausenteDesde, undefined, 'and dirtied the match');

    // A finished match: the clock stopped moving, there is nothing to discount.
    const end = makeMatch(2);
    push(end, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    ok(replay(end).finished, 'the match should be over');
    eq(leaveTable(end, Date.now()), false, 'it opened an away period with the match over');
  }],

  ['an away period left open closes on returning to the table', () => {
    // It is the case of the app closed with the table open: `ausenteDesde`
    // stayed saved, and all the time the app was away has to come out of the
    // match.
    const m = makeMatch();
    const t0 = m.startedAt;

    ok(leaveTable(m, t0 + 10000), 'it did not open the away period');
    eq(m.ausenteDesde, t0 + 10000, 'it did not mark since when');

    // Two hours away, and the app comes back.
    ok(returnToTable(m, t0 + 7210000), 'it did not close the away period');
    eq(m.ausenteDesde, null, 'it left the period open');
    eq(m.ausencias, [[t0 + 10000, t0 + 7210000]], 'it did not keep the period');

    m.events.push({ id: 'a', ts: t0 + 7215000, turn: 1, type: 'turn' });
    eq(elapsedOf(m, replay(m), t0 + 7215000), 15000,
      'the two hours away went into the duration');

    // Returning without having left does nothing.
    eq(returnToTable(m, t0 + 7220000), false, 'it closed a period that did not exist');
  }],

  ['paused time does not count in the match duration', () => {
    const m = makeMatch();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 1000, turn: 1, type: 'pause' });
    m.events.push({ id: 'b', ts: t0 + 61000, turn: 1, type: 'resume' });
    m.events.push({ id: 'c', ts: t0 + 71000, turn: 1, type: 'life', targetId: 's1', delta: -1, sourceId: 's0' });
    const s = replay(m);
    eq(s.pausedTotal, 60000, 'total paused');
    eq(elapsedOf(m, s, t0 + 71000), 11000, 'duration already without the pause');
  }],

  ['paused time also comes out of the player\'s turn time', () => {
    const m = makeMatch();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 2000, turn: 1, type: 'pause' });
    m.events.push({ id: 'b', ts: t0 + 32000, turn: 1, type: 'resume' });
    m.events.push({ id: 'c', ts: t0 + 40000, turn: 1, type: 'turn' });
    eq(replay(m).players.s0.timeOnTurn, 10000, 'P0 turn without the 30s stopped');
  }],

  ['a pause still open counts up to the last event, and not beyond', () => {
    const m = makeMatch();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 5000, turn: 1, type: 'pause' });
    const s = replay(m);
    eq(s.paused, true, 'still paused');
    eq(s.pausedSince, t0 + 5000, 'start of the pause');
    eq(s.pausedTotal, 0, 'nothing closed yet');
    // With the pause running, the match clock freezes at the 5s before it.
    eq(elapsedOf(m, s, t0 + 90000), 5000, 'frozen duration');
  }],

  ['the table mounts without blowing up', () => {
    if (!simulated) return 'skip';
    // Pure smoke, and worth the price: a `let` declared after its first use
    // brought down the whole renderTable and left the screen black. Valid
    // syntax, correct imports, 38 green tests - and nothing on screen.
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(4),
      onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    ok(root.childNodes.length > 0, 'the table drew nothing');
    ok(findAll(root, 'tile').length === 4, 'panels drawn');
    ok(findAll(root, 'hub').length === 1, 'central core drawn');
    view.destroy();
  }],

  ['the setup screen mounts without blowing up', () => {
    if (!simulated) return 'skip';
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    ok(root.childNodes.length > 0, 'the home screen drew nothing');
    ok(findAll(root, 'seat-card').length >= 2, 'player cards drawn');
  }],

  ['tapping outside closes, but the phone\'s ghost click does not', () => {
    if (!simulated) return 'skip';
    // On a phone, the tap that OPENS the panel fires a `click` right after,
    // and it lands on the freshly mounted backdrop. Without this rule, the
    // area-action panel opened and closed in the same gesture - and only on
    // the device.
    const scrim = el('div', {});
    let closed = 0;
    dismissOnBackdrop(scrim, () => { closed += 1; });

    fire(scrim, 'click');                    // ghost click: no pointerdown
    eq(closed, 0, 'the ghost click cannot close');

    fire(scrim, 'pointerdown');              // a real tap on the backdrop
    fire(scrim, 'click');
    eq(closed, 1, 'tapping outside has to close');

    fire(scrim, 'click');                    // a loose click again
    eq(closed, 1, 'it does not close twice for the same tap');
  }],

  ['the whole app starts and draws the first screen', () => {
    if (!simulated) return 'skip';
    // The most complete case that can run without a browser: it really
    // imports app.js, which applies the theme, turns on orientation, mounts
    // the initial route and registers the observers. The previous tests
    // mounted the views in isolation - this one catches what only breaks at
    // the seams between them.
    const app = document.getElementById('app');
    ok(app, 'the stub has to offer #app');
    ok(app.childNodes.length > 0, 'the app drew nothing on startup');
    ok(document.body.dataset.route, 'no route was set');
    eq(document.documentElement.dataset.theme, 'dark', 'theme applied on load');
  }],

  ['the vote counts the votes and says who voted for what', () => {
    const v = createSession({
      question: 'Carnage ou homage?',
      options: ['Carnage', 'Homage'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }, { id: 'c', name: 'Caio' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [1]); cast(v, 'c', [0]);
    const r = tally(v);
    eq(r.rows[0].label, 'Carnage', 'most voted');
    eq(r.rows[0].votes, 2, 'votes of the winner');
    eq(r.rows[0].voters, ['Ana', 'Caio'], 'who voted for it');
    eq(r.tie, false, 'there was no tie');
    eq(r.total, 3, 'total votes');
  }],

  ['the vote detects a tie at the top', () => {
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [1]);
    const r = tally(v);
    eq(r.tie, true, 'tie');
    eq(r.top.length, 2, 'two options at the top');
  }],

  ["unanimity is recognized — it is what Prisoner's Dilemma asks", () => {
    const v = createSession({
      options: ['Silence', 'Snitch'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [0]);
    eq(tally(v).unanimous, true, 'everyone chose the same');

    cast(v, 'b', [1]);
    eq(tally(v).unanimous, false, 'with different choices, it is not unanimous');
  }],

  ['extra votes count, and can go to different options', () => {
    // Brago's Representative: "you get an additional vote. (The votes can be
    // for different choices or for the same choice.)"
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana', votes: 2 }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0, 1]); cast(v, 'b', [1]);
    const r = tally(v);
    eq(r.total, 3, 'three votes with two voters');
    eq(r.rows[0].label, 'B', 'B won with two');
    eq(r.rows[0].votes, 2, 'votes of B');
  }],

  ['a secret number finds the highest and the lowest, with ties', () => {
    const v = createSession({
      kind: 'numero',
      voters: [
        { id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' },
        { id: 'c', name: 'Caio' }, { id: 'd', name: 'Duda' },
      ],
    });
    cast(v, 'a', [7]); cast(v, 'b', [7]); cast(v, 'c', [3]); cast(v, 'd', [0]);
    const r = tally(v);
    eq(r.max, 7, 'highest number');
    eq(r.min, 0, 'lowest number');
    eq(r.highest, ['a', 'b'], 'a tie at the top goes in whole');
    eq(r.lowest, ['d'], 'lowest alone');
    eq(r.rows[0].name, 'Ana', 'sorted from highest to lowest');
  }],

  ['everyone on the same number has no highest nor lowest', () => {
    const v = createSession({
      kind: 'numero',
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [5]); cast(v, 'b', [5]);
    eq(tally(v).allEqual, true, 'a general tie');
  }],

  ['the vote knows whose vote is still missing', () => {
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    eq(pending(v).map((x) => x.name), ['Ana', 'Bruno'], 'nobody voted');
    cast(v, 'a', [0]);
    eq(pending(v).map((x) => x.name), ['Bruno'], 'Bruno is missing');
    eq(isComplete(v), false, 'still incomplete');
    cast(v, 'b', [1]);
    eq(isComplete(v), true, 'complete');
    eq(describe(v), 'A 1 × B 1', 'summary for the history');
  }],

  ['switching vote models does not leave the old title stuck', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    // The reported bug: tapping "Prisoner's Dilemma" - which titles itself -
    // and then switching to "Player" left the old question in the field. The
    // vote went to the statistics saying the table played a dilemma that
    // never happened.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const activePane = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const findText = (cls, txt) =>
      findAll(activePane(), cls).find((n) => textOf(n).includes(txt));
    const field = () => findAll(activePane(), 'search-input')[0];
    const model = (txt) => findAll(activePane(), 'pad-mode').find((b) => textOf(b).includes(txt));

    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(findText('menu-item', 'Votação secreta'), 'click');

    eq(field().value, '', 'starts with no title');

    fire(model('Prisoner'), 'click');
    eq(field().value, "Prisoner's Dilemma", 'the model fills in the title by itself');

    fire(model(t('vote.preset.player')), 'click');
    eq(field().value, '', 'switching models clears the title the app itself put there');

    // What the person typed is untouchable: only the app erases what the app
    // wrote.
    fire(model('Prisoner'), 'click');
    const c = field();
    c.value = 'Quem leva o combo?';
    fire(c, 'input');
    fire(model(t('vote.preset.player')), 'click');
    eq(field().value, 'Quem leva o combo?', 'a typed title survives the switch');

    // And erasing everything gives the field back to the app: whoever emptied
    // it has no opinion.
    const c2 = field();
    c2.value = '';
    fire(c2, 'input');
    fire(model('Prisoner'), 'click');
    eq(field().value, "Prisoner's Dilemma", 'an empty field accepts the model again');

    closeSheet();
    view.destroy();
  }],

  ['the vote goes from the menu to the reveal without getting stuck', () => {
    if (!simulated) return 'skip';
    // Born from a real bug: renderTable already had a local `pending` (the Map
    // of taps), which shadowed the `pending` function imported from vote.js.
    // The "Start the vote" button existed, was enabled, and did nothing. Valid
    // syntax, correct imports, 49 green tests.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    // The previous screens stay mounted behind (that is how going back works
    // without redoing anything), so searching the whole body would find old
    // buttons.
    const activePane = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const findText = (cls, txt) =>
      findAll(activePane(), cls).find((n) => textOf(n).includes(txt));

    const menu = findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu');
    fire(menu, 'click');
    const open = findText('menu-item', 'Votação secreta');
    ok(open, 'the menu does not offer the vote');
    fire(open, 'click');

    const start = findText('btn', 'Começar');
    ok(start, 'no start button');
    ok(!start.disabled, 'the button was born disabled');
    fire(start, 'click');

    // Each voter goes through handoff + ballot, and at the end comes the reveal.
    for (let i = 0; i < 4; i += 1) {
      const iAm = findText('btn', 'Sou ');
      ok(iAm, 'the handoff screen of voter ' + (i + 1) + ' was missing');
      fire(iAm, 'click');
      const choice = findAll(activePane(), 'vote-choice')[i % 2];
      ok(choice, 'the options for voter ' + (i + 1) + ' were missing');
      fire(choice, 'click');
    }

    const reveal = findText('btn', 'Revelar');
    ok(reveal, 'it did not get to the reveal');
    fire(reveal, 'click');
    eq(findAll(activePane(), 'vote-result-row').length, 2, 'result rows');
    ok(findText('btn', 'Guardar'), 'no button to save to the history');

    closeSheet();
    view.destroy();
  }],

  ['the app knows when a panel is open, and tells whoever redraws underneath', () => {
    if (!simulated) return 'skip';
    // Rotating the device remounts the table, and remounting calls destroy(),
    // which closes the panel. Since the vote asks for portrait PRECISELY while
    // it is open, without this notice it would ask to rotate the screen and
    // then close by itself.
    document.body.childNodes.length = 0;
    const seen = [];
    const stop = onSheetChange((open) => seen.push(open));

    eq(isSheetOpen(), false, 'starts with no panel');
    openFlow({ title: 'X', build: () => {} });
    flushFrames();
    eq(isSheetOpen(), true, 'panel open');
    closeSheet();
    eq(isSheetOpen(), false, 'panel closed');
    eq(seen, [true, false], 'notices in the right order');
    stop();
  }],

  ['the vote opens centered and asks for landscape again on leaving', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    let restored = false;
    openFlow({ title: 'Votação', build: () => {} }, {
      centered: true,
      onClose: () => { restored = true; },
    });
    flushFrames();
    const scrim = findAll(document.body, 'sheet-scrim')[0];
    ok(scrim.classList.contains('is-centered'), 'no centered class');
    closeSheet();
    ok(restored, 'it did not restore the orientation on closing');
  }],

  ['whoever is already at the table shows up last in the player picker', () => {
    if (!simulated) return 'skip';
    // The list is for finding whoever has NOT sat yet. Unclickable names in the
    // middle of the way spoil the aim, so they go to the end.
    ['Ana', 'Bruno', 'Caio', 'Duda'].forEach(store.rememberPlayer);

    const commander = (n) => ({ oracleId: 'o' + n, name: 'Cmd ' + n, colors: ['U'] });
    seedDraftFrom(createMatch([
      { id: 'x0', name: 'Ana', commanders: [commander(0)] },
      { id: 'x1', name: 'Bruno', commanders: [commander(1)] },
    ], 40));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    // Opens the picker of Ana's seat: only Bruno is taken.
    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();

    const rows = findAll(document.body, 'player-row');
    const names = rows.map((n) => textOf(findAll(n, 'player-name')[0]));
    const busy = rows.map((n) => n.classList.contains('is-busy'));

    ok(rows.length === 4, 'expected the four saved people, got ' + rows.length);
    eq(names[names.length - 1], 'Bruno', 'whoever is at the table should be last');
    ok(busy[busy.length - 1], 'the last row should be marked as taken');

    // No available row can come after a taken one.
    const firstBusy = busy.indexOf(true);
    ok(
      busy.slice(firstBusy).every(Boolean),
      'someone selectable was left after whoever is already at the table',
    );
    closeSheet();
  }],

  ['marked mana resets when the turn passes, and does not become an event', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const match = makeMatch(4);
    const view = renderTable(root, {
      match, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const openMenu = () => fire(
      findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click',
    );
    const inBody = (cls, txt) =>
      findAll(document.body, cls).find((n) => textOf(n).includes(txt));

    openMenu();
    fire(inBody('menu-item', 'Marcador de mana'), 'click');

    // Three taps on the "+" of the first color (white) and two on the second (blue).
    const tiles = findAll(document.body, 'mana-tile');
    eq(tiles.length, 6, 'the six colors');
    for (let i = 0; i < 3; i += 1) fire(findAll(tiles[0], 'mana-plus')[0], 'pointerdown');
    for (let i = 0; i < 2; i += 1) fire(findAll(tiles[1], 'mana-plus')[0], 'pointerdown');
    eq(match.mana.W, 3, 'white marked');
    eq(match.mana.U, 2, 'blue marked');

    // Taking off works too.
    fire(findAll(tiles[0], 'mana-minus')[0], 'pointerdown');
    eq(match.mana.W, 2, 'white after taking one off');
    // And it does not go below zero.
    for (let i = 0; i < 5; i += 1) fire(findAll(tiles[1], 'mana-minus')[0], 'pointerdown');
    eq(match.mana.U, 0, 'blue does not go negative');

    const eventsBefore = match.events.length;
    closeSheet();

    // Passing the turn clears the pool.
    fire(findAll(root, 'hub-ring')[0], 'click');
    eq(match.mana, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, 'mana reset at the turn');
    eq(match.events.length, eventsBefore + 1, 'only the turn event went into the log');
    eq(match.events[match.events.length - 1].type, 'turn', 'and it is the turn one');

    view.destroy();
  }],

  ['a secret-number vote goes all the way to the reveal', () => {
    if (!simulated) return 'skip';
    // The path where the phone keyboard comes into play. Here we guarantee at
    // least that the flow closes; the keyboard overlap is CSS and only the
    // device confirms it.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(3), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    const activePane = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const find = (cls, txt) =>
      findAll(activePane(), cls).find((n) => textOf(n).includes(txt));

    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes('Votação')), 'click');

    fire(find('pad-mode', 'Número'), 'click');
    fire(find('btn', 'Começar'), 'click');

    const numbers = [7, 7, 2];
    for (let i = 0; i < 3; i += 1) {
      fire(find('btn', 'Sou '), 'click');
      const field = findAll(activePane(), 'vote-number')[0];
      ok(field, 'the number field of voter ' + (i + 1) + ' was missing');
      field.value = String(numbers[i]);
      fire(find('btn', 'Confirmar'), 'click');
    }

    fire(find('btn', 'Revelar'), 'click');
    const rows = findAll(activePane(), 'vote-result-row');
    eq(rows.length, 3, 'one row per player');
    // 7 and 7 tie at the top; the 2 stays alone at the bottom.
    eq(rows.filter((l) => l.classList.contains('is-high')).length, 2, 'tie on the highest');
    eq(rows.filter((l) => l.classList.contains('is-low')).length, 1, 'a single lowest');

    closeSheet();
    view.destroy();
  }],

  ['the deck color identity really reaches the CSS', () => {
    if (!simulated) return 'skip';
    // A custom property requires setProperty: `style['--accent'] = color`
    // registers nothing in the browser. The app passes the deck color this way
    // in 17 places, and for a long time everything fell into the root's white
    // --accent - panels, cards and mana dots all lost their color, silently.
    const n = el('div', { style: { '--accent': '#5C9FD6', width: '10px' } });
    eq(n.style.getPropertyValue('--accent'), '#5C9FD6', 'custom property registered');
    eq(n.style.width, '10px', 'a normal property keeps working');

    // And end to end: the panel of a blue deck carries its color.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    const panel = findAll(root, 'tile')[0];
    ok(panel.style.getPropertyValue('--accent'), 'the panel ended up with no deck color');
    view.destroy();
  }],

  ['each mana dot comes out in its own color', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: makeMatch(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes('mana')), 'click');

    const colors = findAll(document.body, 'mana-tile')
      .map((tile) => tile.style.getPropertyValue('--accent'));
    eq(colors.length, 6, 'six colors');
    ok(colors.every(Boolean), 'some dot ended up with no color');
    eq(new Set(colors).size, 6, 'the six have to be distinct colors');

    closeSheet();
    view.destroy();
  }],

  ["the statistics keep what each one chose in Prisoner's Dilemma", () => {
    const m = makeMatch(4);
    const vote = (choices) => push(m, {
      type: 'vote',
      question: "Prisoner's Dilemma",
      preset: 'dilema',
      kind: 'opcoes',
      options: ['Silence', 'Snitch'],
      ballots: [
        { seatId: 's1', name: 'P1', choices: [choices[0]] },
        { seatId: 's2', name: 'P2', choices: [choices[1]] },
        { seatId: 's3', name: 'P3', choices: [choices[2]] },
      ],
    });
    vote([0, 0, 1]); // P1 and P2 silent, P3 snitched
    vote([0, 1, 1]); // P1 silent again

    const { players } = aggregate([m]);
    const p1 = players.find((p) => p.label === 'P1');
    const p3 = players.find((p) => p.label === 'P3');

    eq(p1.votes, 2, 'P1 took part in two');
    eq(p1.voteChoices.dilema, { Silence: 2 }, 'P1 chose Silence in both');
    eq(p3.voteChoices.dilema, { Snitch: 2 }, 'P3 snitched in both');
    eq(players.find((p) => p.label === 'P2').voteChoices.dilema,
      { Silence: 1, Snitch: 1 }, 'P2 did one of each');
  }],

  ['whoever never voted gets no vote statistics', () => {
    const m = makeMatch(4);
    push(m, {
      type: 'vote',
      question: "Prisoner's Dilemma",
      kind: 'opcoes',
      options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's1', name: 'P1', choices: [0] }],
    });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P1').votes, 1, 'whoever voted has it');
    eq(players.find((p) => p.label === 'P0').votes, 0, 'whoever did not vote stays at zero');
    eq(players.find((p) => p.label === 'P0').voteChoices, {}, 'and with no choices at all');
  }],

  ['the statistics group by category, not by the written question', () => {
    const m = makeMatch(2);
    const vote = (extra, choice) => push(m, Object.assign({
      type: 'vote', kind: 'opcoes', options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [choice] }],
    }, extra));

    // Two nights, the same model, questions written in different ways. That
    // used to become two rows - and the free-form question changes every time,
    // so the list grew without ever answering "does this person usually
    // snitch?".
    vote({ preset: 'dilema', question: "Prisoner's Dilemma" }, 0);
    vote({ preset: 'dilema', question: 'Quem entrega quem?' }, 0);
    vote({ preset: 'jogador', question: 'Quem leva o combo?', options: ['P0', 'P1'] }, 1);
    push(m, {
      type: 'vote', preset: 'numero', kind: 'numero', question: '', options: [],
      ballots: [{ seatId: 's0', name: 'P0', choices: [7] }],
    });

    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.votes, 4, 'four votes');
    eq(Object.keys(p0.voteChoices).sort(), ['dilema', 'jogador', 'numero'],
      'three categories, not four questions');
    eq(p0.voteChoices.dilema, { Silence: 2 }, 'the two dilemma nights add up together');
    eq(p0.voteChoices.numero, { 7: 1 }, 'the secret number keeps the value');

    // The key is the model, and the model is not screen text: switching the
    // language cannot split the history into two piles.
    const keysIn = (lang) => {
      setLang(lang);
      return Object.keys(aggregate([m]).players.find((x) => x.label === 'P0').voteChoices).sort();
    };
    eq(keysIn('en'), keysIn('pt'), 'the same categories in any language');
    setLang('pt');

    // Only the screen translates. The card name is never translated.
    eq(categoryLabel('numero'), t('vote.preset.number'));
    eq(categoryLabel('dilema'), "Prisoner's Dilemma", 'a card name stays as it is');
    setLang('de');
    eq(categoryLabel('dilema'), "Prisoner's Dilemma", 'even in German');
    eq(categoryLabel('numero'), t('vote.preset.number'), 'the rest follows the language');
    setLang('pt');
  }],

  ['an old vote, with no recorded category, is not guessed', () => {
    // The `preset` field did not exist. The essentials can be recovered from
    // `kind`; the rest becomes a generic category. Inventing which model was
    // used would be worse than admitting it is unknown.
    eq(voteCategory({ kind: 'numero' }), 'numero', 'a number recognizes itself');
    eq(voteCategory({ kind: 'opcoes', options: ['Silence', 'Snitch'] }), 'opcoes',
      'looking like a dilemma does not prove it was one');
    eq(voteCategory({ preset: 'jogador', kind: 'opcoes' }), 'jogador',
      'when recorded, the category rules');
    eq(voteCategory(null), 'opcoes', 'with no event, a generic category');
    eq(categoryLabel('opcoes'), t('vote.preset.other'));
  }],

  ['an untitled vote is named by its own options', () => {
    // "Untitled vote" says nothing and fills the statistics with identical
    // rows. A neutral separator: " ou " would be Portuguese in the middle of
    // German.
    eq(voteTitle({ kind: 'opcoes', options: ['Silence', 'Snitch'] }),
      'Silence / Snitch', 'the name comes from the options');
    eq(voteTitle({ kind: 'opcoes', options: ['A'], question: '  ' }),
      'A', 'blank space does not count as a title');
    eq(voteTitle({ kind: 'numero', options: [] }),
      'Número secreto', 'the number has its own name');
    eq(voteTitle({ kind: 'opcoes', options: [], question: 'Carnage?' }),
      'Carnage?', 'a given title beats the derivation');

    // This is the TITLE, used in the match timeline - where it matters to know
    // which vote it was. The statistics group by category, which is another
    // question: what this person usually chooses.
    const m = makeMatch(2);
    push(m, {
      type: 'vote', preset: 'dilema', kind: 'opcoes',
      options: ['Silence', 'Snitch'], question: '',
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(Object.keys(p0.voteChoices), ['dilema'], 'the statistics group by model');
    eq(voteKey(m.events[0]), 'Silence / Snitch',
      'and the title still comes from the options when nobody wrote one');
  }],

  ['rivalries add up each one\'s damage against the other', () => {
    const m = makeMatch(3);
    push(m, { type: 'life', targetId: 's1', delta: -10, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: -4, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -6, sourceId: 's1' });
    push(m, { type: 'life', targetId: 's2', delta: -3, sourceId: 's0' });

    const pairs = rivalries([m]);
    const p01 = pairs.find((r) => (r.a === 'P0' && r.b === 'P1') || (r.a === 'P1' && r.b === 'P0'));
    ok(p01, 'the P0-P1 pair has to exist');
    const fromP0 = p01.a === 'P0' ? p01.aToB : p01.bToA;
    const fromP1 = p01.a === 'P0' ? p01.bToA : p01.aToB;
    eq(fromP0.damage, 14, 'P0 hit P1 for 14');
    eq(fromP1.damage, 6, 'P1 hit back 6');
    eq(p01.total, 20, 'damage exchanged');
    eq(pairs[0], p01, 'the most violent pair comes first');
    eq(pairs.length, 2, 'P0-P1 and P0-P2, but not P1-P2');
  }],

  ['rivalries count elimination, commander and poison', () => {
    const m = makeMatch(2, 30);
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 5 });
    push(m, { type: 'poison', targetId: 's1', delta: 2, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: -30, sourceId: 's0' });

    const r = rivalries([m])[0];
    const fromP0 = r.a === 'P0' ? r.aToB : r.bToA;
    eq(fromP0.cmdDamage, 5, 'commander damage');
    eq(fromP0.poison, 2, 'poison');
    eq(fromP0.kills, 1, 'elimination credited');
    eq(fromP0.damage, 35, 'commander goes into the total damage');
    eq(r.games, 1, 'one match together');
  }],

  ['damage with no dealer creates no rivalry', () => {
    const m = makeMatch(2);
    push(m, { type: 'life', targetId: 's1', delta: -8, sourceId: null });
    eq(rivalries([m]).length, 0, 'life paid is no rivalry with anyone');
  }],

  ['an area action counts as a rivalry for every target', () => {
    const m = makeMatch(4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 0, targets: ['s1', 's2', 's3'] });
    const pairs = rivalries([m]);
    eq(pairs.length, 3, 'three pairs, one per target');
    ok(pairs.every((r) => r.total === 3), 'three damage on each');
  }],

  ['a malformed match does not get into the history', () => {
    if (!simulated) return 'skip';
    // This really took down the statistics screen: a test row with
    // `payload: {t:1}`, forgotten in the database, was downloaded by the sync
    // and got into the history. replay() and the statistics assume seats and
    // events - a row without them does not sit quietly in a corner, it takes
    // down the WHOLE SCREEN.
    const good = makeMatch(4);
    ok(isValidMatch(good), 'a real match passes');

    ok(!isValidMatch(null), 'nothing');
    ok(!isValidMatch({ id: 'x' }), 'just an id is not a match');
    ok(!isValidMatch({ ...good, seats: [] }), 'empty table');
    ok(!isValidMatch({ ...good, seats: undefined }), 'no seats');
    ok(!isValidMatch({ ...good, events: undefined }), 'no events');
    ok(!isValidMatch({ ...good, startedAt: undefined }), 'no start');
    ok(!isValidMatch({ ...good, id: '' }), 'no id');
    ok(isValidMatch({ ...good, events: [] }), 'a match with no move yet is still a match');

    // And the entry door refuses. This is the exact case that happened.
    store.wipe();
    const junk = rowToMatch({ id: 'rec-1', payload: { t: 1 } });
    eq(store.mergeMatches([junk]), 0, 'what is not a match does not get in');
    eq(store.getDB().history.length, 0, 'and the history stays clean');

    // What is good gets in alongside what is bad, without contamination.
    eq(store.mergeMatches([junk, good]), 1, 'the good one gets in even arriving with junk');
    eq(store.getDB().history.length, 1);
  }],

  ['the statistics screen survives junk coming from the cloud', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(makeMatch(3));
    // Even if something gets through the door - an edited localStorage, a
    // future defect - the screen cannot go black. Black tells nothing to the
    // user nor to whoever will fix it.
    store.getDB().history.push({ id: 'quebrada' });

    const root = document.createElement('div');
    let blewUp = null;
    try {
      renderStats(root, { onBack() {} });
    } catch (e) {
      blewUp = e.message;
    }
    ok(!blewUp, 'the screen cannot blow up with a bad record: ' + blewUp);
    ok(root.childNodes.length > 0, 'and it cannot be empty');
  }],

  ['a non-subscriber uploads once, and does not resend forever', () => {
    // The detail that defines the design: the database lets INSERT without a
    // subscription but does not let READ. A non-subscriber gets an empty list
    // on download - so, without noting on the device what already went up,
    // every open would look like "the cloud is empty" and the whole history
    // would be resent. Forever.
    const local = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    // First time: nothing noted, nothing visible on the other side.
    eq(toUpload(local, [], []).map((m) => m.id), ['a', 'b', 'c'], 'uploads everything');

    // After uploading, even without being able to read the cloud, it does not
    // repeat.
    eq(toUpload(local, ['a', 'b', 'c'], []).length, 0, 'does not resend what already went');
    eq(toUpload(local, ['a'], []).map((m) => m.id), ['b', 'c'], 'only what is missing');

    // A new device that downloaded everything does not need to send anything
    // back.
    eq(toUpload(local, [], ['a', 'b', 'c']).length, 0, 'the server already has it');

    // And a match that failed stays in the queue, because the queue is
    // derived: with no mark, it is pending by definition - there is no
    // separate structure that could diverge from the history.
    eq(toUpload(local, ['a', 'c'], []).map((m) => m.id), ['b'], 'the one that failed comes back');
  }],

  ['tagging the account in a match already played', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0' });
    store.archive(m);
    store.setCurrent(makeMatch(2)); // there is a table happening right now

    const saved = store.getDB().history[0];
    eq(saved.seats[0].handle, null, 'nobody was tagged at the time');

    // Tags the seat and writes it back.
    saved.seats[0].handle = 'alienpls';
    saved.seats[0].userId = 'uid-1';
    ok(store.updateMatch(saved), 'the match is written again');
    eq(store.getDB().history[0].seats[0].handle, 'alienpls', 'the tag stayed');

    // archive() clears the match in progress as part of finishing. Using
    // archive to edit an old record would wipe the table happening right now -
    // silent and absurd damage.
    ok(store.getCurrent(), 'the table in progress is still standing');

    // And the invite now exists for that seat.
    const rows = participantsOf(store.getDB().history[0]);
    eq(rows.length, 1);
    eq(rows[0].seat_id, 's0');
    eq(rows[0].handle, 'alienpls');

    // A match that is not in the history is not created by mistake.
    ok(!store.updateMatch({ ...makeMatch(3), id: 'nao-existe' }), 'does not invent a record');
    ok(!store.updateMatch({ id: 'x' }), 'nor accepts something malformed');
  }],

  ['deleting on one device deletes on all - and never by mistake', () => {
    // Device B had the match and marked it as uploaded when downloading it.
    // Device A deleted it. Without reconciling, it stayed on B forever: nothing
    // in the upload or download flow reached it.
    eq(toDelete(['p1', 'p2'], ['p2'], true), ['p1'], 'what vanished there goes here');
    eq(toDelete(['p1', 'p2'], ['p1', 'p2'], true), [], 'what is still there, stays');

    // A match that never went up cannot be judged by its absence from the cloud.
    eq(toDelete([], ['p9'], true), [], 'nothing marked, nothing to delete');

    // The two locks against disaster. The read returns an empty list for
    // NON-subscribers - identical to what it would return if everything had
    // been deleted. Confusing the two cases would destroy the history of
    // someone who just stopped paying, and there is no undo.
    eq(toDelete(['p1', 'p2'], [], false), [], 'without really being able to read, does not delete');
    eq(toDelete(['p1', 'p2'], [], true), [],
      'an empty remote list with things uploaded is too suspicious to act on');

    // Erring on the side of leftovers is recoverable; erring on the side of
    // deleting is not.
    eq(toDelete(['p1'], ['p1', 'p2', 'p3'], true), [], 'the cloud having more deletes nothing here');
  }],

  ['downloading brings only what this device does not have', () => {
    const here = [{ id: 'a' }, { id: 'b' }];
    const there = [{ id: 'b' }, { id: 'c' }, { id: 'd' }];
    eq(toDownload(here, there).map((m) => m.id), ['c', 'd'], 'neither duplicates nor loses');
    eq(toDownload([], there).length, 3, 'a new device gets everything');
    eq(toDownload(here, []).length, 0, 'without a subscription the server returns empty');
    eq(toDownload(null, null).length, 0, 'empty lists do not blow up');
  }],

  ['syncing only makes sense with an account', () => {
    ok(!canSync(true, 'signed-out'), 'without an account there is nowhere to upload to');
    ok(!canSync(false, 'subscriber'), 'with no cloud configured there is no cloud');
    ok(canSync(true, 'unsubscribed'), 'without subscribing you can still UPLOAD');
    ok(canSync(true, 'subscriber'));
  }],

  ['the local history is not deleted on upload, and merging does not overwrite', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    store.archive(m);

    eq(store.getDB().history.length, 1, 'the match is here');
    store.markUploaded(m.id);
    eq(store.uploadedIds(), [m.id], 'noted as uploaded');
    eq(store.getDB().history.length, 1, 'and it is still here: uploading deletes nothing');

    // A finished match is immutable, and the local copy may have something the
    // remote one does not if an upload failed halfway. When in doubt, what is
    // already here wins.
    const forged = { ...m, seats: [] };
    eq(store.mergeMatches([forged]), 0, 'does not bring what already exists');
    eq(store.getDB().history[0].seats.length, 4, 'and does not overwrite what was here');

    const other = makeMatch(3);
    eq(store.mergeMatches([other]), 1, 'brings what is new');
    eq(store.getDB().history.length, 2);

    // Deleting takes the mark along, otherwise the match could never go up
    // again.
    store.deleteMatch(m.id);
    store.forgetUploaded(m.id);
    eq(store.uploadedIds().includes(m.id), false, 'the mark goes with the match');
  }],

  ['without a subscription, the history stays closed', () => {
    // There is no "signed-out sees what is theirs" case: signing out would be
    // enough to open the door, and a gate that opens when avoided is no gate.
    ok(!canSeeStats(true, 'signed-out'), 'without an account, closed');
    ok(!canSeeStats(true, 'unsubscribed'), 'with an account and no subscription, closed');
    ok(canSeeStats(true, 'subscriber'), 'subscribing, open');

    // With no cloud configured the app runs as it always did. Locking there
    // would protect nothing: the data is on the device of whoever is looking.
    ok(canSeeStats(false, 'off'), 'with no cloud, nothing changes');
    ok(canSeeStats(false, 'signed-out'), 'with no cloud, not even signing in matters');
  }],

  ['what is not known yet is not denied', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    // The reported defect: the lock screen showed for a few seconds and then
    // unlocked by itself. It was not the status changing - it was the app
    // treating "have not asked the server yet" as "does not have it". For
    // whoever pays, being told they did not pay is the worst possible defect.
    forgetSession();
    ok(isSubscriptionKnown(), 'without a session the answer is immediate: there is no subscription');

    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(captureReturn(), 'session captured');
    ok(!isSubscriptionKnown(), 'with a session and without having asked, it is not known yet');

    forgetSession();
    ok(isSubscriptionKnown(), 'signing out closes the question again');
  }],

  ['while checking, the paywall accuses nobody', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(makeMatch(4));

    const draw = (checking) => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderPaywall(root, { onBack() {}, onUnlock() {}, checking });
      return root;
    };

    const whileChecking = draw(true);
    eq(findAll(whileChecking, 'paywall-title').length, 0, 'does not say the history is closed');
    eq(findAll(whileChecking, 'btn').length, 0, 'nor offers to sign in or check');
    ok(findAll(whileChecking, 'paywall-body').map(textOf).join('').includes(t('paywall.checking')),
      'only says it is checking');

    // And when the answer arrives, then yes.
    const denied = draw(false);
    eq(findAll(denied, 'paywall-title').length, 1, 'with an answer, it explains the lock');
  }],

  ['the paywall says how many matches are waiting', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(makeMatch(4));
    store.archive(makeMatch(3));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderPaywall(root, { onBack() {}, onUnlock() {} });

    // The number is not decoration: it is the difference between "pay to use"
    // and "what is yours is here, waiting". Playing on was never blocked.
    const text = findAll(root, 'paywall-count').map(textOf).join('');
    ok(text.includes('2'), 'shows the two saved matches');
    ok(findAll(root, 'paywall-title').length === 1, 'and explains why');

    // Signed out, the path is to sign in; the subscription check would come
    // after.
    eq(accountNow(), 'signed-out');
    const buttons = findAll(root, 'btn').map(textOf);
    ok(buttons.includes(t('paywall.signInFirst')), 'offers to sign in');
    ok(!buttons.includes(t('paywall.recheck')), 'without an account there is no subscription to check');
  }],

  ['the vote row shows the category and the total', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    const m = makeMatch(2);
    const vote = (q) => push(m, {
      type: 'vote', preset: 'dilema', kind: 'opcoes', question: q,
      options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    vote("Prisoner's Dilemma");
    vote('Quem entrega quem?');   // another question, same model
    store.archive(m);

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderStats(root, { onBack() {} });
    fire(findAll(root, 'tab').find((b) => textOf(b) === t('stats.players')), 'click');

    const questions = findAll(root, 'vote-history-q').map(textOf);
    eq(questions.length, 1, 'the two nights of the same model give a single row');
    eq(questions[0], "Prisoner's Dilemma", 'on the left, the type of vote');

    const totals = findAll(root, 'vote-history-total').map(textOf);
    eq(totals[0], '2', 'on the right, how many votes the person cast in that category');
    ok(findAll(root, 'vote-history-picks').map(textOf)[0].includes('Silence'),
      'and what they chose is still there');
  }],

  ['the rivalries tab compares one pair at a time', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    // The tab used to dump ALL the pairs: five players give ten cards, and the
    // comparison that matters gets lost among nine nobody asked for. A rivalry
    // is a question about two people - the screen asks which.
    store.wipe();
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -9, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -5, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -4, sourceId: 's3' });
    store.archive(m);

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderStats(root, { onBack() {} });

    const tab = findAll(root, 'tab').find((b) => textOf(b) === t('stats.rivals'));
    ok(tab, 'the rivalries tab exists');
    fire(tab, 'click');

    // Three actual pairs (s0-s1, s0-s2, s0-s3), but a single chart.
    eq(findAll(root, 'rival-select').length, 2, 'two filter fields');
    eq(findAll(root, 'rival-card').length, 1, 'one chart at a time, not all');

    // And the filters only offer whoever has a recorded rivalry: offering
    // someone who never crossed paths with anyone would only produce empty
    // combinations.
    const options = findAll(root, 'rival-select')[0].childNodes.length;
    eq(options, 4, 'the four who faced each other');

    // The left field rules the left side of the chart. Without it the drawing
    // contradicts the control right above it.
    const leftName = () => textOf(findAll(root, 'rival-name')[0]);
    const picker = (i) => findAll(root, 'rival-select')[i];
    const pick = (i, value) => {
      const sel = picker(i);
      sel.value = value;
      fire(sel, 'change', { target: { value } });
    };

    eq(leftName(), 'P0', 'starts with whoever is in the left field');
    pick(0, 'p1');          // left = P1 (here both fields coincide)
    pick(1, 'p0');          // right = P0
    eq(leftName(), 'P1', 'switching the left field turns the chart');
    eq(findAll(root, 'rival-card').length, 1, 'it is still a single chart');
  }],

  ['turning the chart swaps both sides entirely', () => {
    // Swapping only the name would invert the reading of the damage - worse
    // than not swapping.
    const pair = {
      a: 'Ana', keyA: 'ana', aToB: { damage: 9, kills: 1 },
      b: 'Bruno', keyB: 'bruno', bToA: { damage: 4, kills: 0 },
      games: 2, total: 13,
    };

    eq(orientRival(pair, 'ana'), pair, 'already the way asked');

    const turned = orientRival(pair, 'bruno');
    eq(turned.a, 'Bruno', 'the name switched');
    eq(turned.keyA, 'bruno', 'the key switched along - it is what gives the color');
    eq(turned.aToB.damage, 4, 'and the damage follows whoever moved to the left');
    eq(turned.b, 'Ana');
    eq(turned.bToA.damage, 9);
    eq(turned.games, 2, 'what belongs to the pair does not change');
    eq(turned.total, 13);

    eq(orientRival(pair, 'carla'), pair, 'a key outside the pair turns nothing');
    eq(orientRival(null, 'ana'), null, 'no pair, no chart');
  }],

  ['hiding takes it off the list without touching the matches', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = makeMatch(3);
    push(m, { type: 'life', targetId: 's1', delta: -12, sourceId: 's0' });
    store.archive(m);

    eq(aggregate(store.getDB().history).players.length, 3, 'three players at the start');

    store.hidePlayer('P1');
    eq(store.isPlayerHidden('p1'), true, 'the key ignores case');
    eq(store.getDB().history.length, 1, 'the match is still saved');
    eq(store.getDB().history[0].events.length, 1, 'with the events intact');

    // The damage P0 dealt to P1 keeps counting for P0.
    const p0 = aggregate(store.getDB().history).players.find((x) => x.label === 'P0');
    eq(p0.damageDealt, 12, 'the damage does not vanish along with the row');

    store.unhidePlayer('P1');
    eq(store.isPlayerHidden('P1'), false, 'restored');
    store.wipe();
  }],

  ['total damage includes drain and area actions', () => {
    // There were two damage sums - one in the statistics, another on the
    // victory poster - and the poster's did not know `sweep`: a drain of 5 on
    // three opponents showed up as zero at the end of the match.
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 15, targets: ['s1', 's2', 's3'] });
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's2', sourceId: 's0', cmdKey: key, delta: 4 });

    eq(totalDamage(m), 26, '7 + (5 × 3) + 4');
    eq(summarize(m).totalDamage, 26, 'the summary uses the same math');
  }],

  ['life gained in a drain does not count as damage', () => {
    const m = makeMatch(4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 2, gain: 6, targets: ['s1', 's2', 's3'] });
    eq(totalDamage(m), 6, 'only the 2 × 3 that went out, not the 6 that came in');
  }],

  ['the placing is written the way each language writes it', () => {
    // The `º` is the ordinal indicator of Portuguese and Spanish. English and
    // German do not have it, and it was showing up anyway.
    eq(ordinal(1, 'pt'), '1º');
    eq(ordinal(4, 'es'), '4º');
    eq(ordinal(1, 'de'), '1.', 'German uses a period');
    eq(ordinal(4, 'de'), '4.');

    // English was worse than a wrong character: the translation said "{n}th
    // place", which produces "1th place", "2th place", "3th place".
    eq(ordinal(1, 'en'), '1st');
    eq(ordinal(2, 'en'), '2nd');
    eq(ordinal(3, 'en'), '3rd');
    eq(ordinal(4, 'en'), '4th');

    // The English exceptions: 11, 12 and 13 take "th" even though they end in
    // 1, 2 and 3. That never happens at a Commander table - but the function
    // does not know where it is called from, and a half rule is the one that
    // breaks when someone reuses it.
    eq(ordinal(11, 'en'), '11th');
    eq(ordinal(12, 'en'), '12th');
    eq(ordinal(13, 'en'), '13th');
    eq(ordinal(21, 'en'), '21st');
    eq(ordinal(111, 'en'), '111th', 'the rule looks at the last two digits');
    eq(ordinal(101, 'en'), '101st');

    // And the whole sentence, assembled, in each language.
    setLang('pt'); eq(t('table.place', { n: ordinal(1) }), '1º lugar');
    setLang('en'); eq(t('table.place', { n: ordinal(1) }), '1st place');
    setLang('es'); eq(t('table.place', { n: ordinal(3) }), '3º puesto');
    setLang('de'); eq(t('table.place', { n: ordinal(2) }), '2. Platz');
    setLang('pt');

    eq(ordinal('abc', 'en'), 'abc', 'what is not a number passes straight through');
  }],

  ['the four languages have exactly the same keys', () => {
    // Without this, a forgotten translation only shows up when someone
    // switches language and finds a Portuguese sentence in the middle of
    // German.
    const base = Object.keys(DICTS.pt).sort();
    for (const [code] of LANGS) {
      const keys = Object.keys(DICTS[code]).sort();
      const missing = base.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !base.includes(k));
      ok(!missing.length, code + ' did not translate: ' + missing.slice(0, 5).join(', '));
      ok(!extra.length, code + ' has an extra key: ' + extra.slice(0, 5).join(', '));
    }
  }],

  ['no translation loses an interpolation variable', () => {
    // "{name} won" without the {name} in German would become a sentence with
    // no subject.
    const vars = (txt) => (String(txt).match(/\{\w+\}/g) || []).sort().join(',');
    for (const key of Object.keys(DICTS.pt)) {
      const expected = vars(DICTS.pt[key]);
      for (const [code] of LANGS) {
        eq(vars(DICTS[code][key]), expected,
          code + ' / ' + key + ': variables different from Portuguese');
      }
    }
  }],

  ['no text was left empty in any language', () => {
    for (const [code] of LANGS) {
      for (const [key, text] of Object.entries(DICTS[code])) {
        ok(typeof text === 'string' && text.trim().length > 0,
          code + ' / ' + key + ' is empty');
      }
    }
  }],

  ['translating interpolates, pluralizes and falls back to Portuguese when missing', () => {
    setLang('en');
    eq(currentLang(), 'en', 'language switched');
    eq(t('pregame.startsToast', { name: 'Ana' }), 'Ana goes first', 'interpolation');
    eq(tn(1, 'player.deckSaved', 'player.decksSaved'), '1 saved deck', 'singular');
    eq(tn(3, 'player.deckSaved', 'player.decksSaved'), '3 saved decks', 'plural');
    eq(t('chave.que.nao.existe'), 'chave.que.nao.existe', 'an unknown key comes back as it is');

    setLang('zz'); // a language that does not exist
    eq(currentLang(), 'pt', 'falls back to Portuguese');
    setLang('pt');
  }],

  ['the screens come up whole in the four languages', () => {
    if (!simulated) return 'skip';
    // A missing key or a wrong variable only shows up when really drawing —
    // the dictionary test does not catch a t() written wrong in the view.
    for (const [code] of LANGS) {
      setLang(code);
      const m = makeMatch(3);
      push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 6, targets: ['s1', 's2'] });

      const home = document.createElement('div');
      renderSetup(home, { onStart() {}, onStats() {}, onRefresh() {} });
      ok(findAll(home, 'seat-card').length >= 2, code + ': the home screen did not draw');

      const tableRoot = document.createElement('div');
      const v = renderTable(tableRoot, {
        match: m, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
      });
      ok(findAll(tableRoot, 'tile').length === 3, code + ': the table did not draw');
      v.destroy();

      // No text can come out as the key itself.
      const label = textOf(findAll(tableRoot, 'hub-label')[0]);
      ok(label && !label.includes('.'), code + ': a label came out as a raw key');
    }
    setLang('pt');
  }],

  ['the reason of a declared win goes into the statistics', () => {
    const m = makeMatch(3);
    push(m, { type: 'win', targetId: 's0', reason: 'combo' });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.wins, 1, 'win counted');
    eq(p0.winReasons, { combo: 1 }, 'reason kept');
    eq(aggregate([m]).players.find((x) => x.label === 'P1').winReasons, {},
      'whoever did not win gets no reason');
  }],

  ['a win by being the last one alive does not invent a reason', () => {
    const m = makeMatch(2);
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.wins, 1, 'won');
    eq(p0.winReasons, {}, 'no declared reason');
  }],

  ['declaring without picking a reason still counts as a win', () => {
    const m = makeMatch(3);
    push(m, { type: 'win', targetId: 's2', reason: null });
    const s2 = aggregate([m]).players.find((x) => x.label === 'P2');
    eq(s2.wins, 1, 'the win counts');
    eq(s2.winReasons, {}, 'but with no reason');
  }],

  ['reasons add up over several matches', () => {
    const make = (reason) => {
      const m = makeMatch(2);
      push(m, { type: 'win', targetId: 's0', reason });
      return m;
    };
    const p0 = aggregate([make('combo'), make('combo'), make('combate')])
      .players.find((x) => x.label === 'P0');
    eq(p0.winReasons, { combo: 2, combate: 1 }, 'count per reason');
    eq(p0.wins, 3, 'total wins');
  }],

  ['each home screen seat shows its own chair on the mini table', () => {
    if (!simulated) return 'skip';
    // The list order already says the turn order; the thumbnail says the
    // PLACE, which is what is missing with 5 or 6 people around.
    setLang('pt');
    seedDraftFrom(createMatch([0, 1, 2, 3].map((i) => ({
      id: 'z' + i, name: 'J' + i,
      commanders: [{ oracleId: 'o' + i, name: 'Cmd ' + i, colors: ['U'] }],
    })), 40));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    const spots = findAll(root, 'seat-spot');
    eq(spots.length, 4, 'one thumbnail per seat');
    spots.forEach((spot, i) => {
      const lit = findAll(spot, 'is-here');
      eq(lit.length, 1, 'seat ' + i + ': exactly one chair lit');
      eq(textOf(lit[0]), String(i + 1), 'seat ' + i + ': position number');
      eq(findAll(spot, 'layout-cell').length, 4, 'the whole table shows');
    });
  }],

  ['the mark draws the five pips, each in its color and inside the box', () => {
    if (!simulated) return 'skip';
    // It used to be a small square with a gradient that became a smudge at
    // 14px. Now they are separate circles — and all of them have to fit in the
    // 24×24 viewBox, otherwise the top one shows cut off.
    //
    // It was once the silhouette of the icon's table, while the icon was the
    // table. The icon came back, and the mark came back with it: they are two
    // separate things in the code and a single one for whoever looks, and
    // leaving them different was a defect once.
    setLang('pt');
    const m = brandMark();
    eq(m.childNodes.length, 5, 'five pips');

    const colors = m.childNodes.map((c) => c.attributes.fill);
    eq(new Set(colors).size, 5, 'five distinct colors');

    m.childNodes.forEach((c, i) => {
      const cx = Number(c.attributes.cx);
      const cy = Number(c.attributes.cy);
      const r = Number(c.attributes.r);
      ok(cx - r >= 0 && cx + r <= 24, 'pip ' + i + ' leaves the box horizontally');
      ok(cy - r >= 0 && cy + r <= 24, 'pip ' + i + ' leaves the box vertically');
    });
  }],

  ['switching the language through the settings screen really works', () => {
    if (!simulated) return 'skip';
    // The dictionary test passed and the picker did not work: I forgot to
    // repaint, and the choice went nowhere. Only by exercising the control.
    setLang('pt');
    store.wipe();
    document.body.childNodes.length = 0;

    let redraws = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() { redraws += 1; } });

    const gear = findAll(root, 'icon-btn')
      .find((b) => b.attributes['aria-label'] === t('common.settings'));
    ok(gear, 'no settings button');
    fire(gear, 'click');

    const field = findAll(document.body, 'select-input')[0];
    ok(field, 'the language should be a select field');
    eq(field.value, 'pt', 'starts on the current language');
    eq(field.childNodes.length, 4, 'the four languages on the list');

    field.value = 'de';
    fire(field, 'change');

    eq(currentLang(), 'de', 'the language changed');
    eq(store.getDB().settings.lang, 'de', 'and was saved');
    ok(redraws > 0, 'the screen behind needs to be redrawn');

    // The panel reopens translated, otherwise it would stay in Portuguese
    // until closed by hand.
    const labels = findAll(document.body, 'set-label').map(textOf);
    ok(labels.includes('Sprache'), 'the panel did not reopen in German: ' + labels.join(' | '));

    closeSheet();
    setLang('pt');
    store.wipe();
  }],

  ['the mana shortcut shows with mana, opens the counter and disappears at zero', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const match = makeMatch(4);
    const view = renderTable(root, {
      match, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const shortcut = () => findAll(root, 'is-mana')[0];
    const openMenu = () => fire(
      findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === t('common.menu')), 'click',
    );

    ok(shortcut(), 'the button has to exist in the hub');
    eq(shortcut().hidden, true, 'with no mana, it stays hidden');

    // Marks mana through the normal path (menu → counter).
    openMenu();
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes(t('mana.marker'))), 'click');
    const tiles = findAll(document.body, 'mana-tile');
    for (let i = 0; i < 2; i += 1) fire(findAll(tiles[0], 'mana-plus')[0], 'pointerdown');
    fire(findAll(tiles[3], 'mana-plus')[0], 'pointerdown');
    closeSheet();

    eq(shortcut().hidden, false, 'with mana, the shortcut shows');
    eq(textOf(shortcut()), '3', 'and shows the total');

    // The shortcut opens the counter directly, without going through the menu.
    document.body.childNodes.length = 0;
    fire(shortcut(), 'click');
    eq(findAll(document.body, 'mana-tile').length, 6, 'tapping the shortcut opens the counter');

    // Spending everything makes the shortcut disappear.
    const t2 = findAll(document.body, 'mana-tile');
    for (let i = 0; i < 2; i += 1) fire(findAll(t2[0], 'mana-minus')[0], 'pointerdown');
    fire(findAll(t2[3], 'mana-minus')[0], 'pointerdown');
    eq(shortcut().hidden, true, 'empty pool, the shortcut disappears');
    closeSheet();

    // And passing the turn clears it too.
    fire(findAll(root, 'mana-plus')[0] || findAll(root, 'hub-ring')[0], 'click');
    view.destroy();
  }],

  ['a player\'s color is the same in all their matches', () => {
    // That was the problem: the color came from the commander, so switching
    // decks switched the person's color, and the matches tab became
    // impossible to read.
    const matchOf = (t0, names) => {
      const m = createMatch(names.map((n, i) => ({
        id: 's' + i, name: n,
        commanders: [{ oracleId: 'o' + t0 + i, name: 'Cmd', colors: ['U'] }],
      })), 40);
      m.startedAt = t0;
      return m;
    };
    const history = [
      matchOf(1000, ['Ana', 'Bruno', 'Caio']),
      matchOf(2000, ['Ana', 'Duda']),
    ];
    const order = playerColorOrder(history);
    eq(playerColor(order, 'Ana'), playerColor(order, 'Ana'), 'same person, same color');
    ok(playerColor(order, 'Ana') !== playerColor(order, 'Bruno'), 'different people, different colors');
    eq(playerColor(order, ' ana '), playerColor(order, 'Ana'), 'spaces and case do not create another person');
  }],

  ['a new player coming in does not change anyone\'s color', () => {
    // That is why the order is by first appearance, not alphabetical: an "Ana"
    // added later would push everyone and switch the colors already seen.
    const matchOf = (t0, names) => {
      const m = createMatch(names.map((n, i) => ({
        id: 's' + i, name: n, commanders: [{ oracleId: 'o' + i, name: 'C', colors: ['U'] }],
      })), 40);
      m.startedAt = t0;
      return m;
    };
    const before = [matchOf(1000, ['Zeca', 'Bruno'])];
    const orderBefore = playerColorOrder(before);
    const zecaColor = playerColor(orderBefore, 'Zeca');
    const brunoColor = playerColor(orderBefore, 'Bruno');

    const after = [...before, matchOf(2000, ['Ana', 'Zeca'])];
    const orderAfter = playerColorOrder(after);
    eq(playerColor(orderAfter, 'Zeca'), zecaColor, 'Zeca kept the color');
    eq(playerColor(orderAfter, 'Bruno'), brunoColor, 'Bruno kept the color');
    ok(playerColor(orderAfter, 'Ana') !== zecaColor, 'the new one got its own color');
  }],

  ['player colors spread out instead of clustering', () => {
    // The golden angle: with any amount, each new color falls in the largest
    // gap left. Two people in a row never come out in almost equal hues.
    const hue = (color) => Number(String(color).match(/hsl\(([\d.]+)/)[1]);
    const order = new Map(['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => [n, i]));
    const hues = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => hue(playerColor(order, n)));

    for (let i = 0; i < hues.length; i += 1) {
      for (let j = i + 1; j < hues.length; j += 1) {
        const raw = Math.abs(hues[i] - hues[j]);
        const dist = Math.min(raw, 360 - raw);
        ok(dist > 25, 'hues ' + i + ' and ' + j + ' ended up ' + dist.toFixed(0) + '° apart');
      }
    }
  }],

  ['the account state covers the four cases', () => {
    // The whole interface is drawn from here, so each case has to come out
    // right — including the usual one: with no cloud configured, the app is
    // local.
    const s = { access_token: 'x' };
    eq(accountState({ enabled: false, session: s, subscription: { status: 'active' } }),
      'off', 'with no cloud, nothing changes');
    eq(accountState({ enabled: true, session: null }), 'signed-out', 'cloud on, no session');
    eq(accountState({ enabled: true, session: s, subscription: null }),
      'unsubscribed', 'signed in but not subscribed');
    eq(accountState({ enabled: true, session: s, subscription: { status: 'active' } }),
      'subscriber', 'signed in and subscribed');
  }],

  ['an expired subscription loses access, but with one day of grace', () => {
    // Cards fail and Stripe retries within a few hours. Dropping access in the
    // meantime would punish someone in good standing for an issuer problem.
    const now = Date.parse('2026-08-23T12:00:00Z');
    const at = (h) => new Date(now + h * 3600e3).toISOString();

    ok(isSubscriptionActive({ status: 'active', current_period_end: at(24) }, now), 'in good standing');
    ok(isSubscriptionActive({ status: 'active', current_period_end: at(-6) }, now),
      'expired 6h ago: still within the grace');
    ok(!isSubscriptionActive({ status: 'active', current_period_end: at(-30) }, now),
      'expired 30h ago: out');
    ok(!isSubscriptionActive({ status: 'canceled', current_period_end: at(240) }, now),
      'cancelled does not count, even within the period');
    ok(!isSubscriptionActive(null, now), 'no subscription');
    ok(isSubscriptionActive({ status: 'active' }, now), 'with no end date, it counts');
  }],

  ['an expired session does not count as a session', () => {
    const now = Date.parse('2026-08-23T12:00:00Z');
    ok(isSessionValid({ access_token: 'x', expires_at: now / 1000 + 3600 }, now), 'valid');
    ok(!isSessionValid({ access_token: 'x', expires_at: now / 1000 - 10 }, now), 'expired');
    ok(!isSessionValid({ expires_at: now / 1000 + 3600 }, now), 'no token');
    ok(!isSessionValid(null, now), 'nothing at all');
  }],

  ['the match goes to the database and back without losing anything', () => {
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    push(m, { type: 'turn' });
    undo(m); // leaves something in `redo`

    const row = toRow(m, 'user-123');
    eq(row.id, m.id, 'id preserved');
    eq(row.owner, 'user-123', 'owner');
    eq(row.payload.redo, [], 'redo does not go up: it is screen state, not history');

    const back = fromRow(row);
    eq(back.events, m.events, 'the log comes back whole');
    eq(JSON.stringify(replay(back)), JSON.stringify(replay(m)), 'and the replay gives the same state');
  }],

  ['only what the server does not have yet goes up', () => {
    // A finished match is immutable, so comparing by id is enough: there is no
    // version and no conflict to resolve. That is what makes the sync so
    // simple.
    const local = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    eq(pendingUploads(local, ['b']).map((m) => m.id), ['a', 'c'], 'two missing');
    eq(pendingUploads(local, ['a', 'b', 'c']).map((m) => m.id), [], 'nothing to do');
    eq(pendingUploads(local, []).map((m) => m.id), ['a', 'b', 'c'], 'empty server');
    eq(pendingUploads([], ['a']).length, 0, 'nothing local');
  }],

  ['the default player name is singular in every language', () => {
    // It used the key of the section TITLE, which is plural: in English it
    // came out as "Players 1". A section title and a person's name are
    // different texts.
    const expected = { pt: 'Jogador 1', en: 'Player 1', es: 'Jugador 1', de: 'Spieler 1' };
    for (const [code] of LANGS) {
      setLang(code);
      eq(t('setup.playerN', { n: 1 }), expected[code], code);
      ok(!t('setup.playerN', { n: 1 }).includes('{'), code + ': variable not interpolated');
      ok(t('setup.playerN', { n: 2 }) !== t('setup.players'),
        code + ': a player name cannot be the section title');
    }
    setLang('pt');
  }],

  ['the account screen shows in the settings when there is a cloud', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');

    // The account is ONE row on the main screen, and opens its own screen. On
    // the main one it cannot come whole: it was the block that pushed language
    // and theme to the end of the scroll.
    const summary = findAll(document.body, 'set-account')[0];
    if (!cloudEnabled()) {
      ok(!summary, 'with no cloud configured, no account on the screen');
      closeSheet();
      return;
    }
    ok(summary, 'with a cloud, the account row has to exist');
    eq(findAll(document.body, 'account').length, 0, 'the whole account came back to the main screen');
    fire(summary, 'click');

    const accountScreen = findAll(document.body, 'account')[0];
    ok(accountScreen, 'the account row did not open the account screen');
    eq(accountNow(), 'signed-out', 'nobody signed in yet');

    // Email and password: signing in on a new device cannot depend on opening
    // the inbox. The email link is still there, as recovery.
    const fields = findAll(accountScreen, 'search-input');
    eq(fields.length, 2, 'email and password');
    eq(fields[1].attributes.type, 'password', 'the second field is the password');
    eq(fields[1].attributes.autocomplete, 'current-password',
      'the device password manager has to recognize the field');
    ok(findAll(accountScreen, 'account-link').length === 1, 'the email link is still available');

    // A social provider button only exists if the server says it is on.
    const labels = findAll(accountScreen, 'btn').map(textOf);
    const hasGoogle = labels.some((x) => x.includes('Google'));
    eq(hasGoogle, providers().includes('google'),
      'the Google button has to follow what the server accepts');
    closeSheet();
  }],

  ['an expired session with a refresh token is not a lost session', () => {
    // This was the bug: the refresh_token was stored and never used, so the
    // session died in one hour and the person had to ask for an email again.
    // Forever. Discarding the expired session here was what closed the door.
    const now = 1000000000000;
    const hour = 3600 * 1000;

    const alive = { access_token: 'a', expires_at: (now + hour) / 1000 };
    const expiredWithRefresh = { access_token: 'a', refresh_token: 'r', expires_at: (now - hour) / 1000 };
    const expiredNoRefresh = { access_token: 'a', expires_at: (now - hour) / 1000 };

    ok(isSessionUsable(alive, now), 'a session within its time works');
    ok(isSessionUsable(expiredWithRefresh, now), 'expired with refresh gets renewed');
    ok(!isSessionUsable(expiredNoRefresh, now), 'expired without refresh is over');
    ok(!isSessionUsable(null, now), 'no session');

    // The margin avoids the case where the token expires BETWEEN deciding and
    // the request reaching the server - slow network and a device clock that
    // is off.
    ok(!needsRefresh(alive, now), 'with an hour left, leaves it alone');
    ok(needsRefresh({ ...expiredWithRefresh, expires_at: (now + 30000) / 1000 }, now),
      'with 30s left, renews before using');
    ok(!needsRefresh(alive, now), 'without a refresh_token there is nothing to renew, even within time');
    ok(needsRefresh(expiredWithRefresh, now), 'already expired, renews');
    ok(!needsRefresh(expiredNoRefresh, now), 'without refresh there is nothing to renew');
    ok(!needsRefresh({ access_token: 'a', refresh_token: 'r' }, now),
      'with no declared expiry, it does not keep renewing for nothing');

    // And the real decision: what comes out of the disk. A correct rule kept
    // somewhere nobody consults fixes nothing - this is exactly where the
    // session died, and the test of the loose rule would not notice.
    ok(sessionFromStorage(JSON.stringify(expiredWithRefresh), now), 'comes back from disk to be renewed');
    ok(!sessionFromStorage(JSON.stringify(expiredNoRefresh), now), 'this one does not come back');
    ok(!sessionFromStorage(null, now), 'empty disk');
    ok(!sessionFromStorage('{quebrado', now), 'junk on disk does not take the app down');
  }],

  ['sign-up does not promise an email to someone who already has an account', () => {
    // With email confirmation on, GoTrue does NOT say "that email already
    // exists" - answering that would turn sign-up into an address checker for
    // anyone. It returns a decoy user with empty `identities`, and that empty
    // array is the only signal.
    //
    // Without reading it, the app said "check your inbox" to someone who
    // already had an account, and the person was left waiting for an email
    // that would solve nothing.
    ok(accountAlreadyExisted({ id: 'x', identities: [] }), 'empty array: the account already existed');
    ok(!accountAlreadyExisted({ id: 'x', identities: [{ provider: 'email' }] }), 'a truly new account');
    ok(!accountAlreadyExisted({ access_token: 'a', identities: [] }),
      'if a session came, it signed in - the rest does not matter');
    ok(!accountAlreadyExisted(null), 'an empty answer is not an existing account');
    ok(!accountAlreadyExisted({ id: 'x' }), 'without the field, nothing can be asserted');
  }],

  ['a short password does not even leave the device', () => {
    ok(!isPasswordValid(''), 'empty');
    ok(!isPasswordValid('1234567'), 'seven are not enough');
    ok(isPasswordValid('12345678'), 'eight are enough');
    ok(!isPasswordValid(null), 'null does not blow up');
  }],

  ['on a computer nothing at the table turns upside down', () => {
    // Lying on the table, the pad rotates toward the seat of whoever acts -
    // that is how the person reads their own attack. On an upright monitor,
    // facing a single person, the same rotation delivered the screen inverted.
    //
    // The signal is the pointer, not the size: a large tablet in landscape is
    // as wide as a laptop, and guessing by pixels would be wrong both ways.
    ok(rotatesWithSeat(false), 'no mouse: it is on the table, rotates');
    ok(!rotatesWithSeat(true), 'with a mouse or trackpad: it is upright, does not rotate');

    // The value that reaches the CSS, with a unit. Without the suffix,
    // `rotate(0)` is invalid and the browser silently drops the whole rule.
    eq(tableRotation(180, false), '180deg', 'at the table, follows the seat');
    eq(tableRotation(180, true), '0deg', 'on the computer, always upright');
    eq(tableRotation(undefined, false), '0deg', 'a seat with no declared rotation');

    // And that the pointer reading really reaches the decision.
    if (simulated) {
      const before = globalThis.matchMedia;
      try {
        globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
        eq(rotatesToSeat(), false, 'fine pointer: does not rotate');
        globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        eq(rotatesToSeat(), true, 'no fine pointer: rotates');
      } finally {
        globalThis.matchMedia = before;
      }
    }
  }],

  ['picking a player offers creating OR finding an account', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');

    const openPicker = () => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
      fire(findAll(root, 'seat-name')[0], 'click');
      flushFrames();
      const list = panes();
      return list[list.length - 1];
    };

    // Signed out: you can only type a name. Finding an account would require
    // an account.
    eq(accountNow(), 'signed-out', 'each case starts with no session');
    ok(findAll(openPicker(), 'search-input').length >= 1, 'typing is always possible');
    eq(findAll(openPicker(), 'is-find').length, 0, 'without an account, there is nothing to find');
    closeSheet();

    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(captureReturn(), 'session captured');

    const pane = openPicker();
    ok(findAll(pane, 'search-input').length >= 1, 'path 1: type a name');
    eq(findAll(pane, 'is-find').length, 1, 'path 2: find the account');
    closeSheet();
    forgetSession();
  }],

  ['typing the name of someone already at the table is refused', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    // The saved list already disabled whoever was seated, but typing the same
    // name by hand went straight through.
    // The names come from the screen, not from the default: the draft is
    // shared between cases and may have been touched before.
    const names = () => findAll(root, 'seat-name-text').map(textOf);
    const first = names()[0];
    const alreadySeated = names()[1];
    ok(first !== alreadySeated, 'the two seats start with distinct names');

    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();
    const pane = panes()[panes().length - 1];
    const field = findAll(pane, 'search-input')[0];
    const use = findAll(pane, 'btn').find((b) => textOf(b) === t('player.use'));

    field.value = alreadySeated;
    fire(field, 'input', { target: { value: alreadySeated } });
    fire(use, 'click');
    flushFrames();

    // It did not move on to the deck, and the seat did not become the second
    // person.
    const title = findAll(document.body, 'sheet-title').map(textOf).join(' ');
    ok(title !== t('commander.title'), 'it cannot move on to the deck with a repeated name');
    eq(names()[0], first, 'the first seat is still itself');

    closeSheet();
  }],

  ['typing a name goes straight to the deck', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();

    const pane = panes()[panes().length - 1];
    findAll(pane, 'search-input')[0].value = 'Zé da Mesa';
    const use = findAll(pane, 'btn').find((b) => textOf(b) === t('player.use'));
    ok(use, 'the button to use the typed name');
    fire(use, 'click');
    flushFrames();

    // There used to be an @ question in the middle of the way. It became a
    // choice at the START - whoever typed a name already decided not to link
    // an account, and asking again right after was redoing a question already
    // answered.
    const title = findAll(document.body, 'sheet-title').map(textOf).join(' ');
    eq(title, t('commander.title'), 'the next step is the deck');
    closeSheet();
  }],

  ['the @ sits under the name, and disappears for whoever did not sign in', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');

    const draw = () => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
      return root;
    };

    // Signed out: the rule that cannot break. Whoever will never create an
    // account does not get one more control on the screen because of a
    // feature they do not use.
    eq(accountNow(), 'signed-out', 'each case starts with no session');
    eq(findAll(draw(), 'seat-handle').length, 0, 'without an account, no @ on the seat');

    // Now with a session. Signing in through the fragment is the same path as
    // the magic link, so the test uses the real entry door and not a shortcut.
    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(captureReturn(), 'the session was captured from the URL');
    ok(accountNow() !== 'signed-out', 'now there is a session');

    const root = draw();
    const cards = findAll(root, 'seat-card');
    const lines = findAll(root, 'seat-handle');
    ok(cards.length >= 2, 'the home screen draws the seats');
    eq(lines.length, cards.length, 'one @ line per seat');

    // Under the NAME, not loose in the corner of the card: it has to be in the
    // same text block as the name and the deck. It used to be a chip on the
    // edge, far from what it described and fighting for space with the drag
    // handle.
    const info = lines[0].closest('.seat-info');
    ok(info, 'the @ line lives inside .seat-info');

    const siblings = info.childNodes.filter((n) => n && n.classList);
    const iName = siblings.findIndex((n) => n.classList.contains('seat-name'));
    const iAt = siblings.findIndex((n) => n.classList.contains('seat-handle'));
    ok(iName >= 0 && iAt >= 0, 'name and @ are both in the column');
    ok(iAt > iName, 'the @ comes AFTER the name, not before');

    forgetSession();
  }],

  ['the @ is normalized before anything else', () => {
    eq(normalizeHandle('  @AlienPls '), 'alienpls', 'removes at sign, spaces and case');
    eq(normalizeHandle('@@alex'), 'alex', 'repeated at sign');
    eq(normalizeHandle(null), '', 'null does not blow up');
    eq(displayHandle('AlienPls'), '@alienpls', 'on screen it comes back with the at sign');
    eq(displayHandle(''), '', 'without an @ it does not invent an at sign');

    ok(isHandleValid('@AlienPls'), 'what people type usually has an at sign and capitals');
    ok(isHandleValid('abc'), 'minimum of 3');
    ok(!isHandleValid('ab'), 'too short');
    ok(!isHandleValid('a'.repeat(21)), 'too long');
    ok(!isHandleValid('alex parma'), 'a space in the middle does not count');
    ok(!isHandleValid('alex@exemplo.com'), 'an email is not a public @');
    ok(!isHandleValid('alex-parma'), 'only letters, digits and underscore');
  }],

  ['only a seat tagged with an @ becomes an invite', () => {
    // The rule that cannot break: whoever will never create an account keeps
    // using the app exactly as before. A seat is free text, and stays so.
    const match = {
      id: 'p1',
      seats: [
        { id: 's1', name: 'Alexandre', handle: '@AlienPls' },
        { id: 's2', name: 'Bruno' },
        { id: 's3', name: 'Carla', handle: '   ' },
        { id: 's4', name: 'Davi', handle: 'nome invalido!' },
      ],
    };

    const rows = participantsOf(match);
    eq(rows.length, 1, 'three of the four seats become no invite at all');
    eq(rows[0].seat_id, 's1');
    eq(rows[0].handle, 'alienpls', 'it goes normalized to the database');
    eq(rows[0].match_id, 'p1');
    eq(rows[0].user_id, null, 'with no @ resolved yet, the seat has no owner');

    eq(participantsOf(null).length, 0, 'no match, no invite');
    eq(participantsOf({ seats: [{ id: 's1', handle: 'alex' }] }).length, 0,
      'a match with no id does not create an orphan row');
  }],

  ['an invite shows even when the match does not come along', () => {
    // It is the gate working, not an error. A non-subscriber needs to SEE that
    // matches are waiting - otherwise they never accept and never knew they
    // existed. The invite is free; reading the content is what is paid.
    const rows = [
      { match_id: 'p1', seat_id: 's1', status: 'pendente', handle: 'alienpls' },
      { match_id: 'p2', seat_id: 's3', status: 'pendente', handle: 'alienpls' },
    ];
    const unsubscribed = buildInvites(rows, []);
    eq(unsubscribed.length, 2, 'both invites show');
    ok(unsubscribed.every((c) => c.match === null), 'without a subscription, none of the content');
    eq(unsubscribed[0].matchId, 'p1');

    const subscribed = buildInvites(rows, [{ id: 'p2', seats: [] }]);
    eq(subscribed[0].match, null, 'this one has not come yet');
    ok(subscribed[1].match, 'this one came and can be shown');

    eq(buildInvites(null, null).length, 0, 'empty lists do not blow up');
  }],

  ['the release notes describe the version that is live', () => {
    ok(RELEASE_NOTES.length, 'there is at least one annotated version');
    ok(releaseNotesFor(APP_VERSION), 'the current version has notes: ' + APP_VERSION);

    // Order matters: the screen shows from newest to oldest, and
    // releaseNotesSince() cuts by position.
    eq(RELEASE_NOTES[0].version, APP_VERSION, 'the most recent comes first');

    for (const v of RELEASE_NOTES) {
      ok(/^\d+\.\d+\.\d+$/.test(v.version), v.version + ': malformed version number');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(v.date), v.version + ': malformed date');
      ok(v.items && v.items.length, v.version + ': a version with no change annotated');
      for (const item of v.items) {
        ok(['new', 'fixed', 'changed'].includes(item.type),
          v.version + ': unknown type "' + item.type + '"');
        ok(item.text && String(item.text).length > 20,
          v.version + ': a note too short to say anything');
      }
      // Each type has a translation in the four languages, otherwise the tag
      // comes out raw.
      for (const [code] of LANGS) {
        for (const type of ['new', 'fixed', 'changed']) {
          ok(DICTS[code]['news.' + type], 'missing news.' + type + ' in ' + code);
        }
      }
    }
  }],

  ['whoever updates sees only what they have not seen yet', () => {
    // Reading again what was already read trains people to ignore the screen.
    // And whoever installs now sees nothing: the whole change history is noise
    // before the first use.
    const fake = [{ version: '1.3.0' }, { version: '1.2.0' }, { version: '1.1.0' }];
    const since = (seen) => {
      const at = fake.findIndex((n) => n.version === seen);
      return at < 0 ? fake : fake.slice(0, at);
    };
    eq(since('1.2.0').map((n) => n.version), ['1.3.0'], 'only what came after');
    eq(since('1.3.0').length, 0, 'already on the newest: nothing to show');
    eq(since('1.1.0').map((n) => n.version), ['1.3.0', '1.2.0'], 'skipped two, sees both');

    // An unknown version returns everything - it is the case of someone coming
    // back from a very old app, and showing too much beats showing nothing.
    eq(releaseNotesSince('0.0.1').length, RELEASE_NOTES.length, 'a version that does not exist: everything');
    eq(releaseNotesSince(null).length, RELEASE_NOTES.length, 'no reference: everything');
    eq(releaseNotesSince(APP_VERSION).length, 0, 'whoever is already on the current sees nothing');
  }],

  ['the channel comes from the URL path', () => {
    eq(channelOf('/hit-easy/'), 'producao', 'published root');
    eq(channelOf('/hit-easy/beta/'), 'beta', 'test channel');
    eq(channelOf('/hit-easy/beta/index.html'), 'beta', 'a file inside beta');
    eq(channelOf('/'), 'producao', 'local server');
    // 'beta' has to be a whole path segment, not a piece of a word.
    eq(channelOf('/hit-easy/betamax/'), 'producao', 'it is not the beta channel');
    eq(channelOf('/beta-teste/'), 'producao', 'nor this one');
  }],

  ['production cannot change keys when it gains a test channel', () => {
    // localStorage is per ORIGIN. Separating beta from production is mandatory
    // - but if the separation also touched the name used in production,
    // everyone already using the app would open an empty history. Beta gets a
    // suffix; production does not change a byte. This test exists so nobody
    // "tidies" that up later.
    const keyOf = (channel, base) => (channel === 'beta' ? base + '.beta' : base);
    eq(keyOf('producao', 'mtglc.db.v1'), 'mtglc.db.v1', 'production history untouched');
    eq(keyOf('producao', 'mtglc.session.v1'), 'mtglc.session.v1', 'session untouched');
    ok(keyOf('beta', 'mtglc.db.v1') !== 'mtglc.db.v1', 'beta writes somewhere else');
  }],

  ['the service worker only deletes caches of its own channel', () => {
    // activate used to delete every cache that was not the current one. With
    // two channels on the same origin, whichever activated last would take
    // down the other's offline app - and that of any other page hosted on the
    // same domain.
    eq(channelOfCache('hiteasy-shell-v26'), 'producao', 'an old name is still production\'s');
    eq(channelOfCache('hiteasy-art-v27'), 'producao');
    eq(channelOfCache('hiteasy-beta-shell-v27'), 'beta');
    eq(channelOfCache('workbox-precache-de-outro-app'), null, 'someone else\'s cache is not touched');
    eq(channelOfCache(''), null);

    const CHANNEL = 'producao', SHELL = 'hiteasy-shell-v27', ART = 'hiteasy-art-v27';
    const toDeleteNow = (names) => names.filter(
      (k) => channelOfCache(k) === CHANNEL && k !== SHELL && k !== ART);

    eq(toDeleteNow([SHELL, ART, 'hiteasy-shell-v26', 'hiteasy-beta-shell-v27', 'outro-app-v1']),
      ['hiteasy-shell-v26'], 'only the old version of its own channel');
  }],

  ['the magic link request carries redirect_to in the query', () => {
    // The first real sign-in landed on localhost:3000 because the destination
    // went in the BODY, as `options.email_redirect_to` - the SDK's form, not
    // the REST API's. GoTrue ignores a field it does not know without
    // complaining and uses the project's Site URL. A silent error like that
    // only shows with a real email in hand; that is why the request format
    // became a pure function, so the test looks at it first.
    const target = 'https://alienpls-vibes.github.io/hit-easy/';
    const { path, body } = magicLinkRequest(' Alex@Exemplo.com ', target);

    ok(path.startsWith('/auth/v1/otp?'), 'OTP endpoint');
    const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));
    eq(query.get('redirect_to'), target, 'the destination has to travel in the query');

    eq(body.email, 'Alex@Exemplo.com', 'surrounding spaces do not go to the server');
    eq(body.create_user, true, 'the first access creates the account');
    ok(!('options' in body), 'options is an SDK field; the REST API silently drops it');
    ok(!JSON.stringify(body).includes('redirect'), 'the destination cannot go only in the body');
  }],

  ['the return address carries neither fragment nor query', () => {
    // Two reasons. One: asking for a second link while having
    // `#access_token=...` in the bar would send that token inside the email.
    // Two: the address has to match Supabase's Redirect URLs list, and
    // anything extra makes the server refuse.
    const dirty = {
      origin: 'https://alienpls-vibes.github.io',
      pathname: '/hit-easy/',
      search: '?x=1',
      hash: '#access_token=eyJhbGciOi',
    };
    const clean = returnUrl(dirty);
    eq(clean, 'https://alienpls-vibes.github.io/hit-easy/', 'only origin and path');
    ok(!clean.includes('access_token'), 'a token never goes into the link request');
    ok(!clean.includes('?'), 'no query');
  }],

  ['a wrong password shows a visible error on sign-in', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');
    fire(findAll(document.body, 'set-account')[0], 'click');

    const accountScreen = findAll(document.body, 'account')[0];
    ok(accountScreen, 'the account section');

    const notice = findAll(accountScreen, 'account-error')[0];
    ok(notice, 'there is a place for the error to show');
    ok(!notice.classList.contains('is-on'), 'with no error, it takes no space');

    // Gets the email wrong and presses sign in: this used to be a grey
    // paragraph after the two buttons, out of sight of whoever just got it
    // wrong.
    const signIn = findAll(accountScreen, 'btn').find((b) => textOf(b) === t('account.signIn'));
    ok(signIn, 'the sign-in button');
    fire(signIn, 'click');

    ok(notice.classList.contains('is-on'), 'the error shows');
    eq(textOf(notice), t('account.invalidEmail'), 'and says what happened');

    // Touching the field clears it: the message talked about what was there
    // before.
    const fields = findAll(accountScreen, 'search-input');
    fire(fields[0], 'input', { target: { value: 'a@b.co' } });
    ok(!notice.classList.contains('is-on'), 'fixing the field clears the notice');

    closeSheet();
  }],

  ['an invalid email does not fire a link request', () => {
    if (!simulated) return 'skip';
    // Without this, every slip of the finger becomes a network call and a lost
    // email.
    const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
    ok(valid('a@b.co'), 'minimum acceptable');
    ok(valid(' alex@exemplo.com '), 'surrounding spaces do not invalidate');
    ok(!valid('alex@exemplo'), 'no top-level domain');
    ok(!valid('alex exemplo.com'), 'no at sign');
    ok(!valid(''), 'empty');
  }],

  ['replay is deterministic: same log, same state', () => {
    const m = makeMatch();
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'poison', targetId: 's2', delta: 3, sourceId: 's1' });
    eq(JSON.stringify(replay(m)), JSON.stringify(replay(m)), 'two replays');
  }],

  ['holding repeats and speeds up, at the cadence both places share', () => (
    withFakeClock((advance) => {
      let steps = 0;
      const stop = repeatWhileHeld(() => { steps += 1; }, { stepRightAway: true });

      advance(HOLD_DELAY - 1);
      eq(steps, 0, 'before the delay no step comes out');

      advance(1);
      eq(steps, 1, 'the first step comes out when the delay completes');

      advance(REPEAT_MS * 3);
      eq(steps, 4, 'at the slow cadence, one step per REPEAT_MS');

      // After REPEAT_ACCEL_AFTER slow steps, the cadence switches.
      advance(REPEAT_MS * (REPEAT_ACCEL_AFTER - 3));
      eq(steps, 1 + REPEAT_ACCEL_AFTER, 'the slow steps before speeding up');

      advance(REPEAT_FAST_MS * 4);
      eq(steps, 1 + REPEAT_ACCEL_AFTER + 4, 'sped up, one step per REPEAT_FAST_MS');

      stop();
      advance(5000);
      eq(steps, 1 + REPEAT_ACCEL_AFTER + 4, 'letting go really stops');
      return undefined;
    })
  )],

  ['holding the panel edge takes life speeding up, and becomes a single event', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { tiles, view } = tableOnScreen(m);
      const minus = findAll(tiles[0], 'tap-minus')[0];
      ok(minus, 'the panel has no take-life strip');

      // The panel number, which is what the player really sees: it already
      // brings the pending amount added. Reading the log here would be reading
      // the wrong place - `nudge()` accumulates, and only `commit()` saves.
      const onPanel = () => textOf(findAll(tiles[0], 'tile-life')[0]);
      const pendingDelta = () => textOf(findAll(tiles[0], 'tile-delta')[0]);

      eq(onPanel(), '40', 'the table did not start at 40');

      fire(minus, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });

      // Before the delay, holding is not repetition yet: nothing was applied.
      advance(HOLD_DELAY - 1);
      eq(onPanel(), '40', 'the life moved too early');

      // The delay step, plus three at the slow cadence.
      advance(1 + REPEAT_MS * 3);
      eq(onPanel(), '36', 'four steps, four life points');
      eq(pendingDelta(), '-4', 'the floating delta does not show what has not been saved yet');

      fire(minus, 'pointerup', { pointerId: 1, clientX: 5, clientY: 5 });

      // Letting go cannot charge a step on top of what the repetition applied.
      eq(onPanel(), '36', 'letting go charged one extra step');
      eq(lifeEvents(m).length, 0, 'it saved before the coalescing closed');

      // And the whole hold goes in as ONE event, otherwise "undo" would go
      // back point by point - forty taps to undo one gesture.
      advance(COMMIT_MS + 10);
      const life = lifeEvents(m);
      eq(life.length, 1, 'the whole hold became a single event');
      eq(life[0].delta, -4, 'the event does not add up the four steps');
      eq(life[0].sourceId, null, 'the panel edge has no dealer: it is life paid');

      view.destroy();
      return undefined;
    });
  }],

  ['the panel goes up with the keyboard, measuring the layout viewport', () => {
    if (!simulated) return 'skip';

    // The math: the visible region goes from `offset` to `offset + visible`.
    // A fixed element with `bottom: B` has its base at `layout - B`, so
    // B = layout - visible - offset.
    eq(keyboardHeight(800, 800, 0), 0, 'no keyboard, nothing to discount');
    eq(keyboardHeight(800, 500, 0), 300, 'the keyboard took 300');
    eq(keyboardHeight(800, 500, 60), 240, 'and a scrolled page discounts too');
    eq(keyboardHeight(0, 500, 0), 0, 'without a layout there is no math to do');
    // With no focused text field there is no keyboard, and the math is not even
    // done: the phone URL bar also shrinks the visual viewport, and the
    // difference came out as some 60px of "keyboard" pushing every panel up.
    eq(keyboardHeight(800, 500, 0, false), 0, 'no focused field, no keyboard');
    eq(keyboardHeight(800, 500, 0, true), 300, 'with a focused field, the math counts');

    // And the wiring. This is the case the defect produced: a browser where
    // `innerHeight` follows the VISUAL viewport. Reading innerHeight, the math
    // gave 500 - 500 - 0 = 0: --kb zero, the panel stuck to the bottom edge,
    // behind the keyboard. Whoever searched for an @ typed blind.
    simulateKeyboard({ layout: 800, visible: 500 });
    eq(currentKb(), '300px', 'the app read the wrong height and the panel does not go up');

    // The keyboard closing: back to zero, otherwise a gap would be left under
    // the panel.
    simulateKeyboard({ layout: 800, visible: 800 });
    eq(currentKb(), '0px', 'closing the keyboard gives the whole screen back');

    // The URL bar shrinking the viewport is NOT a keyboard. Without this
    // distinction, every panel went up a bit just because there was a URL bar
    // on screen.
    simulateKeyboard({ layout: 800, visible: 740, withField: false });
    eq(currentKb(), '0px', 'the URL bar was mistaken for a keyboard');
  }],

  ['linking an account picks the right seat, and refuses what is ambiguous', () => {
    // The "this is the same person" rule, on its own. It decides where to
    // write the handle across the whole history, so each refusal of it
    // prevents a different kind of damage - and none of the three is
    // hypothetical.
    const tableWith = (id, seats) => ({
      id,
      seats: seats.map((c, i) => ({ id: 's' + i, ...c })),
    });

    // The common case: a seat with the name, no account.
    const simple = tableWith('m1', [{ name: 'Alexandre' }, { name: 'Bruno' }]);
    const r1 = seatsToLink([simple], ['alexandre'], 'alienpls');
    eq(r1.targets, [{ matchId: 'm1', seatId: 's0' }], 'finds the seat');
    eq(r1.ambiguous, [], 'and there is nothing ambiguous');

    // A seat already tagged with ANOTHER account: the previous decision wins.
    // Without this, a repeated name would overwrite someone else's account.
    const alreadyTagged = tableWith('m2', [{ name: 'Alexandre', handle: 'outro' }]);
    eq(seatsToLink([alreadyTagged], ['alexandre'], 'alienpls').targets, [],
      'does not overwrite an account already tagged');

    // The @ is already at the table, in another seat. Writing again would put
    // the same person twice in the same match, and the statistics would add
    // up their damage against themselves.
    const alreadySeated = tableWith('m3', [
      { name: 'Alexandre' }, { name: 'Alex', handle: 'alienpls' },
    ]);
    eq(seatsToLink([alreadySeated], ['alexandre'], 'alienpls').targets, [],
      'does not seat the same person twice');

    // Two names of the set at the SAME table: either they are two people, or
    // an alias is wrong. Neither is solved by guessing.
    const twoCandidates = tableWith('m4', [{ name: 'Alexandre' }, { name: 'Alex' }]);
    const r4 = seatsToLink([twoCandidates], ['alexandre', 'alex'], 'alienpls');
    eq(r4.targets, [], 'does not pick one of the two by guessing');
    eq(r4.ambiguous, ['m4'], 'and reports the match to the caller');
  }],

  ['who is who is only learned from your own match or from a trusted host', () => {
    // Learning is what makes the link travel without a new table. The gate is
    // not a formality: without it, any host could seat a chair called
    // "Alexandre" with their @ and YOUR history of Alexandre would start adding
    // up on the wrong account.
    const matchOf = (id, owner) => ({
      id,
      owner,
      seats: [{ id: 's0', name: 'Alexandre', handle: 'alienpls' }],
    });

    eq(learnedAliases([matchOf('m1', 'eu')], 'eu', []),
      [{ name: 'Alexandre', handle: 'alienpls' }], 'from my own, it learns');

    eq(learnedAliases([matchOf('m2', 'amigo')], 'eu', ['amigo']),
      [{ name: 'Alexandre', handle: 'alienpls' }], 'from whoever I trust, it learns');

    eq(learnedAliases([matchOf('m3', 'estranho')], 'eu', ['amigo']), [],
      'from a stranger, it does not learn');

    eq(learnedAliases([matchOf('m4', null)], 'eu', ['amigo']), [],
      'with no owner there is nobody to vouch');

    // A seat with no @ teaches nothing - it is precisely the state of whoever
    // has not been linked yet.
    eq(learnedAliases([{ id: 'm5', owner: 'eu', seats: [{ id: 's0', name: 'Ana' }] }],
      'eu', []), [], 'a seat with no account teaches nothing');
  }],

  ['two devices, the same person: linking later joins the history', () => {
    // The whole scenario. Device A recorded the person as "Alexandre", B as
    // "Alex", and neither linked an account at the time - it was done later.
    store.wipe();

    const tableOf = (name, suffix) => {
      const m = createMatch([
        { id: 's0', name, commanders: [commander(0)] },
        { id: 's1', name: 'Bruno', commanders: [commander(1)] },
      ], 40);
      m.id = 'partida-' + suffix;
      push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
      return m;
    };

    store.mergeMatches([tableOf('Alexandre', 'a'), tableOf('Alex', 'b')]);
    // As the app does when picking each player while setting up the table.
    ['Alexandre', 'Alex', 'Bruno'].forEach(store.rememberPlayer);

    // Before: they are two strangers to each other, each with half the damage.
    const before = aggregate(store.matches(), store.knownHandles());
    eq(before.players.length, 3, 'before, "Alex" and "Alexandre" are strangers');
    eq(before.players.filter((x) => x.damageDealt === 7).length, 2,
      'and their damage comes out split in two halves');

    // The link, done later - once per name the table used. The second already
    // knows about the first: rememberHandle gathers the names of the same @.
    linkAccount('Alexandre', { handle: 'alienpls', id: 'u-1' });

    // A third match arrives from the other device AFTER the first link, and
    // comes with the old name. It is not hypothetical: it is what the sync does
    // every time the other device uploads what it had.
    store.mergeMatches([tableOf('Alexandre', 'c')]);

    // The second link gathers the names that already pointed to this @, so it
    // reaches the match that just arrived - and not only the one saying "Alex".
    linkAccount('Alex', { handle: 'alienpls', id: 'u-1' });

    const after = aggregate(store.matches(), store.knownHandles());
    const theirs = after.players.filter((x) => x.key === '@alienpls');
    eq(after.players.length, 2, 'after, only the person and Bruno');
    eq(theirs.length, 1, 'a single row');
    eq(theirs[0].games, 3, 'the three tables add up on the same person');
    eq(theirs[0].damageDealt, 21, 'and the damage of the three adds up together');
    eq(theirs[0].label, '@alienpls', 'the row is called by the @');
    eq(theirs[0].names.slice().sort(), ['Alex', 'Alexandre'],
      'without losing the names the table used');

    // The handle was WRITTEN into the matches, not only into this device's
    // map. That is what makes the link travel: the payload goes to the cloud,
    // the other device downloads it and learns.
    ok(store.matches().every((m) => m.seats[0].handle === 'alienpls'),
      'the handle did not get into the matches\' payload');

    // And what the other device would learn from these matches.
    const withOwner = store.matches().map((m) => ({ ...m, owner: 'eu' }));
    const learned = learnedAliases(withOwner, 'eu', []);
    // A set, not a list: the same person shows up at three tables, so the name
    // repeats - and learning the same alias twice does nothing.
    eq([...new Set(learned.map((x) => x.name))].sort(), ['Alex', 'Alexandre'],
      'both names travel along with the matches');

    // The picker list now shows the PERSON, not the two names.
    const people = store.knownPeople();
    eq(people.length, 2, 'two people on the list, not three names');
    const p = people.find((x) => x.key === '@alienpls');
    eq(p.label, '@alienpls', 'the list row is called by the @');
    eq(p.names.slice().sort(), ['Alex', 'Alexandre'], 'and remembers both names');

    // Forgetting is about the person, not one of the names: forgetting only
    // one would leave them half on the list, and they would come back through
    // the other name on the next open.
    store.forgetPerson('@alienpls');
    eq(store.knownPeople().map((x) => x.label), ['Bruno'],
      'forgetting the person takes both of their names');

    store.wipe();
  }],

  ['a learned alias never overwrites what this device decided', () => {
    // Two different people can have the same name at different groups'
    // tables. If what comes from the cloud could overwrite, a downloaded match
    // would rename YOUR Ana to another group's Ana.
    store.wipe();
    store.rememberHandle('Ana', 'ana_daqui');

    eq(store.learnAlias('Ana', 'ana_de_outro'), false,
      'a disagreement is not solved by guessing');
    eq(store.handleOf('Ana'), 'ana_daqui', 'the local decision still holds');

    // But a name this device never saw, yes - and it goes into the picker
    // list, because it is someone you played with.
    eq(store.learnAlias('Caio', 'caio99'), true, 'a new name, it learns');
    eq(store.handleOf('Caio'), 'caio99');
    ok(store.knownPeople().some((x) => x.key === '@caio99'),
      'and starts showing up in the player picker');

    store.wipe();
  }],

  ['damage by drag counts the target\'s life', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      // The main path: dragging from one panel to another, saying how much it
      // was, and the target's life moving when the screen closes.
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const lifeOf = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      // Moving beyond the threshold arms the attack right away, without
      // waiting for the tap time. Whoever is under the finger is the
      // opponent's panel.
      pointAt(tiles[1]);
      fire(center, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(center, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(center, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      pointAt(null);

      ok(findAll(root, 'pad-scrim').length === 1,
        'the drag did not open the damage pad');

      const seven = findAll(root, 'pad-chip').find((c) => textOf(c) === '7');
      ok(seven, 'the damage pad has no 7 shortcut');
      fire(seven, 'click');

      // The number does not jump: it is still the old one when the screen
      // closes.
      eq(lifeOf(1), '40', 'the target\'s life jumped instead of counting');

      advance(Math.round(COUNT_MS / 2));
      const middle = Number(lifeOf(1));
      ok(middle < 40 && middle > 33, 'the count did not last: it was at ' + middle);

      advance(COUNT_MS * 2);
      eq(lifeOf(1), '33', 'the target did not end at 33');
      eq(lifeOf(0), '40', 'the attacker lost life for no reason');

      // And the damage has a dealer: it came from the drag, not from the edge.
      const damage = m.events.filter((e) => e.type === 'life');
      eq(damage.length, 1, 'the drag did not record a life event');
      eq(damage[0].sourceId, 's0', 'the drag damage was left with no dealer');

      view.destroy();
      return undefined;
    });
  }],

  ['a drain counts the life of whoever got hit and of whoever healed', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const lifeOf = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      // A double tap in the center opens the area action.
      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tap = (id) => {
        fire(center, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(center, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tap(1);
      tap(2);

      // The area pad mounts its own backdrop inside the table, not a sliding
      // panel on the document body.
      ok(findAll(root, 'pad-scrim').length === 1, 'the area action did not open');

      const drain = findAll(root, 'pad-mode')
        .find((b) => textOf(b).includes('Dreno'));
      ok(drain, 'the area action does not offer drain');
      fire(drain, 'click');

      // Takes 7 from each opponent. The chip confirms on the same tap.
      const seven = findAll(root, 'pad-chip').find((c) => textOf(c) === '7');
      ok(seven, 'there is no 7 shortcut');
      fire(seven, 'click');

      // Here is the point: the number does NOT jump. At the moment of sending
      // it is still the old one, and only then starts moving.
      eq(lifeOf(1), '40', 'the opponent\'s life jumped instead of counting');
      eq(lifeOf(0), '40', 'the drainer\'s life jumped instead of counting');

      // Halfway the number has to be BETWEEN the two values. That is what
      // separates a 420ms count from a 1ms step, which ends in seven
      // milliseconds and nobody sees - and seeing is the point of the
      // improvement.
      advance(Math.round(COUNT_MS / 2));
      const middle = Number(lifeOf(1));
      ok(middle < 40 && middle > 33,
        'the count did not last: halfway it was already at ' + middle);

      // And it ends on the right value. The default `gain` is the total taken
      // (3 x 7).
      advance(COUNT_MS * 3);
      eq(lifeOf(1), '33', 'the opponent did not end at 33');
      eq(lifeOf(2), '33', 'the second opponent was left out');
      eq(lifeOf(3), '33', 'the third opponent was left out');
      eq(lifeOf(0), '61', 'the drainer did not end with the total healed');

      // The direction stays marked while counting, and leaves at the end.
      const number = findAll(tiles[1], 'tile-life')[0];
      ok(!number.classList.contains('is-falling'), 'the direction mark got stuck');

      view.destroy();
      return undefined;
    });
  }],

  ['damage to everyone counts, and the panel edge does not', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const lifeOf = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tap = (id) => {
        fire(center, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(center, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tap(1);
      tap(2);

      // "Damage to everyone" is the mode already chosen.
      const five = findAll(root, 'pad-chip').find((c) => textOf(c) === '5');
      ok(five, 'there is no 5 shortcut');
      fire(five, 'click');

      eq(lifeOf(1), '40', 'the life jumped instead of counting');
      advance(COUNT_MS * 3);
      eq(lifeOf(1), '35', 'the damage to everyone did not arrive');
      eq(lifeOf(0), '40', 'whoever dealt it lost life with no drain');

      // The edge does NOT count: there the number already moves on each tap,
      // and counting on top would fight "hold to repeat".
      const minus = findAll(tiles[2], 'tap-minus')[0];
      fire(minus, 'pointerdown', { pointerId: 9, clientX: 5, clientY: 5 });
      fire(minus, 'pointerup', { pointerId: 9, clientX: 5, clientY: 5 });
      eq(lifeOf(2), '34', 'the edge started counting, and should answer at once');

      view.destroy();
      return undefined;
    });
  }],

  ['whoever asks for less motion gets the number at once', () => {
    if (!simulated) return 'skip';
    // The global CSS rule for prefers-reduced-motion zeroes transitions and
    // animations, but does not reach a count done in JavaScript - that one has
    // to refuse on its own.
    const real = globalThis.matchMedia;
    globalThis.matchMedia = (q) => ({
      matches: String(q).includes('reduced-motion'),
      addEventListener() {}, removeEventListener() {},
    });
    try {
      return withFakeClock((advance) => {
        const m = makeMatch(4);
        const { root, tiles, view } = tableOnScreen(m);
        const lifeOf = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

        const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
        const tap = (id) => {
          fire(center, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
          fire(center, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
        };
        tap(1);
        tap(2);

        const five = findAll(root, 'pad-chip').find((c) => textOf(c) === '5');
        ok(five, 'there is no 5 shortcut');
        fire(five, 'click');

        // Without waiting at all: the number is already at the final value.
        eq(lifeOf(1), '35', 'it counted even with reduced motion requested');
        advance(COUNT_MS * 2);
        eq(lifeOf(1), '35', 'the number moved after already being right');

        view.destroy();
        return undefined;
      });
    } finally {
      globalThis.matchMedia = real;
    }
  }],

  ['with one left alive, the victory poster shows', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      // Two players, one dies: the match is over and the table has to say so.
      // That was the reported symptom - the match did not end by itself.
      const m = makeMatch(2);
      push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
      ok(replay(m).finished, 'the engine did not consider the match over');

      const { root, view } = tableOnScreen(m);

      // The poster comes in with a short delay, so the table does not vanish
      // in the same frame the last life point went out. It goes in `root`, not
      // the body: it covers the table, not the page.
      eq(findAll(root, 'victory').length, 0, 'the poster came with no wait');
      advance(500);

      const poster = findAll(root, 'victory');
      eq(poster.length, 1, 'the match ended and the poster did not show');
      ok(textOf(poster[0]).includes('P0'), 'the poster does not say who won');

      view.destroy();
      return undefined;
    });
  }],

  ['declaring a winner through the menu opens the choice', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      // The other symptom: the button did nothing. It did nothing because
      // `table.pickWinner` was undefined - the menu called a hole.
      const m = makeMatch(4);
      const { root, view } = tableOnScreen(m);

      const menu = findAll(root, 'hub-btn')
        .find((b) => b.attributes['aria-label'] === 'Menu');
      ok(menu, 'the table has no menu button');
      fire(menu, 'click');

      const activePane = () => {
        const p = findAll(document.body, 'flow-pane');
        return p[p.length - 1];
      };
      const declare = findAll(activePane(), 'menu-item')
        .find((x) => textOf(x).includes('vencedor'));
      ok(declare, 'the menu does not offer declaring a winner');

      // This is where the defect showed: the item existed, was enabled, and
      // tapping it did absolutely nothing.
      fire(declare, 'click');
      advance(400);

      const choices = findAll(activePane(), 'menu-label').map(textOf);
      ok(choices.includes('P0') && choices.includes('P3'),
        'the winner choice did not open with the table\'s players');

      view.destroy();
      return undefined;
    });
  }],

  ['holding -1 on the player panel repeats, and becomes a single event', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { tiles, view } = tableOnScreen(m);

      // A quick tap in the center opens the player panel - after the
      // double-tap window, which is what separates "open panel" from "area
      // action".
      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      fire(center, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(center, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });
      advance(DOUBLE_TAP_MS + 10);

      const buttonOf = (text) => findAll(document.body, 'step-btn')
        .find((b) => textOf(b) === text);
      const minus = buttonOf('-1');
      ok(minus, 'the player panel has no -1 button');

      // The number the panel shows. It has to move during the hold, and
      // without the panel being rebuilt - rebuilding would destroy the held
      // button.
      const onPanel = () => textOf(findAll(document.body, 'stepper-value')[0]);
      eq(onPanel(), '40', 'the panel did not open at 40');

      // Holding: one step on the tap, and the repetition after the delay.
      fire(minus, 'pointerdown', { pointerId: 2 });
      eq(onPanel(), '39', 'the tap was not worth one point right away');

      advance(HOLD_DELAY + REPEAT_MS * 2);
      eq(onPanel(), '37', 'the repetition did not move while the finger held');
      ok(minus.classList.contains('is-held'), 'the button does not show it repeats');

      // And the panel can NOT have been rebuilt on the way. In a browser the
      // held button would be destroyed, the finger's `pointerup` would go to
      // the NEW button, and the old one's interval would never stop: the life
      // would keep falling after letting go. The stub does not model that, so
      // the invariant is asserted directly.
      ok(buttonOf('-1') === minus, 'the panel was rebuilt during the hold');

      fire(minus, 'pointerup', { pointerId: 2 });
      ok(!minus.classList.contains('is-held'), 'letting go did not clear the highlight');

      // Nothing saved yet: coalescing is what makes undo bring back the whole
      // gesture in one tap, instead of point by point.
      eq(lifeEvents(m).length, 0, 'it saved before the coalescing closed');

      advance(COMMIT_MS + 10);
      const life = lifeEvents(m);
      eq(life.length, 1, 'the whole hold became a single event');
      eq(life[0].delta, -3, 'the event does not add up the three steps');
      eq(life[0].sourceId, null, 'an adjustment on your own panel has no dealer');
      eq(replay(m).players.s0.life, 37, 'and the life ended at 37');

      view.destroy();
      return undefined;
    });
  }],

  ['the step of 5 does not repeat when held', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { tiles, view } = tableOnScreen(m);

      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      fire(center, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(center, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });
      advance(DOUBLE_TAP_MS + 10);

      const five = findAll(document.body, 'step-btn')
        .find((b) => textOf(b) === '-5');
      ok(five, 'the panel has no -5 button');

      // At the fast cadence that would be ninety points per second: the target
      // would always be overshot. The step of five already is the quick tap
      // shortcut.
      fire(five, 'click');
      advance(HOLD_DELAY + REPEAT_MS * 8);
      advance(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 35, 'the step of 5 repeated when held');

      view.destroy();
      return undefined;
    });
  }],

  ['holding the edge does not arm an attack, and a short tap is still worth 1', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const plus = findAll(tiles[0], 'tap-plus')[0];
      const wrap = findAll(root, 'table-wrap')[0];
      ok(plus && wrap, 'the table did not mount the strips');

      // Holding long on the edge: this used to become an attack. Now it
      // repeats, and the table cannot go into drag mode - the gesture already
      // is a life adjustment.
      fire(plus, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
      advance(HOLD_DELAY + REPEAT_MS * 2);
      ok(!wrap.classList.contains('is-dragging'), 'holding the edge armed an attack');
      fire(plus, 'pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
      advance(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 43, 'three steps up');

      // A short tap is still one step, applied only on release.
      fire(plus, 'pointerdown', { pointerId: 2, clientX: 5, clientY: 5 });
      advance(SHORT_TAP);
      eq(replay(m).players.s0.life, 43, 'the short tap applied before release');
      fire(plus, 'pointerup', { pointerId: 2, clientX: 5, clientY: 5 });
      advance(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 44, 'the short tap was not worth 1');

      view.destroy();
      return undefined;
    });
  }],
  ['player 1 sits at the top left, at every table', () => {
    // Asked by players: with the device lying down, 1 is the top-left corner,
    // and the round goes on clockwise (the rotation test takes care of the
    // rest).
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const { name, shape } of shapesOf(v)) {
          const first = shape.seats[0];
          ok(first.r === 1 && first.c === 1,
            n + ' players / ' + v.id + ' / ' + name + ': 1 is at '
            + first.r + ':' + first.c);
        }
      }
    }

    // With 2, 3 and 5 the lying-down shape is the default: it is how the table
    // was designed.
    for (const n of [2, 3, 5]) {
      eq(layoutFor(n, null).orient, 'landscape', n + ' players: the default is not lying down');
    }
  }],

  ['a match opened before the change moves nobody', () => {
    // The app updates in the middle of a game. The match already on the table
    // does not have the `assentos` mark, and has to keep 1 at the bottom left.
    const fresh = makeMatch(4);
    eq(fresh.assentos, 'topo', 'a new match is not born marked');
    eq(layoutOfMatch(fresh).seats[0], { r: 1, c: 1, rot: 180 }, 'new: 1 at the top');

    const old = makeMatch(4);
    delete old.assentos;
    old.layoutId = 'padrao';
    eq(layoutOfMatch(old).seats.map((x) => x.r + ':' + x.c),
      ['2:1', '1:1', '1:2', '2:2'], 'an old 4-player match changed places');

    // And it holds for every variant: the old one has the same chairs, and
    // still turns clockwise - it just starts at another.
    const cells = (l) => l.seats
      .map((x) => x.r + ':' + x.c + ':' + (x.cs || 1) + ':' + x.rot).sort();
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const wide of [false, true]) {
          const legacy = makeMatch(n);
          delete legacy.assentos;
          legacy.layoutId = v.id;
          const shape = layoutOfMatch(legacy, wide);
          const current = layoutFor(n, v.id, wide);
          const where = n + '/' + v.id + (wide ? '/lying' : '');
          eq(shape.cols + 'x' + shape.rows, current.cols + 'x' + current.rows,
            where + ': the old shape changed grid');
          eq(cells(shape), cells(current), where + ': the chairs are not the same');
          const ang = shape.seats.map((x) => seatAngle(x, shape));
          let round = 0;
          for (let i = 0; i < n; i += 1) round += (ang[(i + 1) % n] - ang[i] + 360) % 360;
          ok(Math.abs(round - 360) < 0.001, where + ': the old order does not turn clockwise');
        }
      }
    }
  }],

  ['lifelink heals whoever dealt it, in the same event', () => {
    const m = makeMatch(4);
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0', gain: 5 });
    let st = replay(m);
    eq(st.players.s1.life, 35, 'the target did not lose');
    eq(st.players.s0.life, 45, 'the dealer did not gain');

    const k = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's2', sourceId: 's0', cmdKey: k, delta: 3, gain: 3 });
    st = replay(m);
    eq(st.players.s0.life, 48, 'lifelink on commander damage');
    eq(st.players.s2.cmd[k], 3, 'the commander damage keeps counting');

    // A single event: undo brings the healing back along.
    undo(m);
    eq(replay(m).players.s0.life, 45, 'undo left the healing behind');

    const { players } = aggregate([m]);
    eq(players.find((x) => x.label === 'P0').healed, 5, 'the healing did not get into the statistics');
  }],

  ['damage to every player hits the caster, without counting as damage dealt', () => {
    const m = makeMatch(3, 4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 4, gain: 0, targets: ['s0', 's1', 's2'] });
    const st = replay(m);
    eq(st.players.s0.life, 0, 'the caster was left out');
    ok(st.players.s0.dead, 'the caster did not die');
    eq(st.players.s0.elim.byId, null, 'dying from your own damage became eliminating yourself');
    eq(st.players.s1.elim.byId, 's0', 'the others are eliminated by the caster');

    const { players } = aggregate([m]);
    const p0 = players.find((x) => x.label === 'P0');
    eq(p0.damageDealt, 8, 'hitting yourself counted as damage dealt');
    eq(p0.damageTaken, 4, 'the damage taken by the caster vanished');
  }],

  ['the damage pad starts at 0, and confirming at 0 records nothing', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      pointAt(tiles[1]);
      fire(center, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(center, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(center, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      pointAt(null);

      eq(textOf(findAll(root, 'pad-amount')[0]), '0', 'the pad did not start at 0');
      const confirm = findAll(root, 'btn').find((b) => textOf(b) === 'Confirmar');
      fire(confirm, 'click');
      advance(COUNT_MS * 2);
      eq(m.events.length, 0, 'confirming at 0 recorded an event');

      // And the double tap starts at 0 too.
      advance(300);
      const tap = (id) => {
        fire(center, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(center, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tap(2);
      tap(3);
      const values = findAll(root, 'pad-amount').map(textOf);
      eq(values[values.length - 1], '0', 'the area action did not start at 0');

      view.destroy();
      return undefined;
    });
  }],

  ['lifelink on the damage pad heals the attacker', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      pointAt(tiles[1]);
      fire(center, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(center, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(center, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      pointAt(null);

      const mark = findAll(root, 'pad-tag')[0];
      ok(mark && textOf(mark).includes('Lifelink'), 'the pad has no lifelink mark');
      fire(mark, 'click');
      fire(findAll(root, 'pad-chip').find((c) => textOf(c) === '5'), 'click');
      advance(COUNT_MS * 3);

      const st = replay(m);
      eq(st.players.s1.life, 35, 'the target did not take the damage');
      eq(st.players.s0.life, 45, 'the attacker did not gain the life');
      eq(m.events.length, 1, 'lifelink became two events');
      eq(m.events[0].gain, 5, 'the event did not keep the healing');

      view.destroy();
      return undefined;
    });
  }],

  ['dragging from the + or the − attacks, and does not touch the life', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const wrap = findAll(root, 'table-wrap')[0];

      for (const strip of ['tap-plus', 'tap-minus']) {
        const edge = findAll(tiles[0], strip)[0];
        pointAt(tiles[1]);
        fire(edge, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
        advance(80); // well before the repetition starts
        fire(edge, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
        ok(wrap.classList.contains('is-dragging'), strip + ': dragging did not arm the attack');
        advance(HOLD_DELAY + REPEAT_MS * 4); // the repetition cannot wake up
        fire(edge, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
        pointAt(null);
        advance(COMMIT_MS + 10);

        eq(replay(m).players.s0.life, 40, strip + ': the dragger\'s life changed');
        eq(m.events.length, 0, strip + ': the drag recorded a life adjustment');
        ok(findAll(root, 'pad-scrim').length >= 1, strip + ': the damage pad did not open');
        fire(findAll(root, 'btn').find((b) => textOf(b) === 'Cancelar'), 'click');
        advance(300);
      }

      view.destroy();
      return undefined;
    });
  }],

  ['the area action offers everyone, opponents and drain', () => {
    if (!simulated) return 'skip';
    return withFakeClock((advance) => {
      const m = makeMatch(4);
      const { root, tiles, view } = tableOnScreen(m);
      const center = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tap = (id) => {
        fire(center, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(center, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tap(1);
      tap(2);

      const modes = () => findAll(root, 'pad-mode');
      eq(modes().map(textOf), ['Todos', 'Oponentes', 'Dreno'], 'the three modes');
      const on = modes().find((b) => b.classList.contains('is-on'));
      eq(textOf(on), 'Oponentes', 'the default is not opponents only');

      fire(modes().find((b) => textOf(b) === 'Todos'), 'click');
      eq(textOf(findAll(root, 'pad-to')[0]), '4 jogadores', 'the header does not say who gets hit');
      fire(findAll(root, 'pad-chip').find((c) => textOf(c) === '3'), 'click');
      advance(COUNT_MS * 3);

      const st = replay(m);
      for (const id of ['s0', 's1', 's2', 's3']) eq(st.players[id].life, 37, id + ' was left out');
      eq(m.events[0].targets, ['s0', 's1', 's2', 's3'], 'targets out of table order');

      view.destroy();
      return undefined;
    });
  }],

  ['on the iPhone, installing knows which browser it is in', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ';
    eq(iosBrowser(ios + 'Version/18.0 Mobile/15E148 Safari/604.1'), 'safari');
    eq(iosBrowser(ios + 'CriOS/129.0 Mobile/15E148 Safari/604.1'), 'other');
    eq(iosBrowser(ios + 'Mobile/15E148 Instagram 350.0'), 'in-app');
    eq(iosBrowser(ios + 'Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]'), 'in-app');
  }],
  ['keeping the screen on comes back on the first tap, as Safari requires', async () => {
    if (!simulated) return 'skip';
    // Safari only grants the lock right after a tap. Asking on returning to
    // the app is silently refused, and the screen started turning off in the
    // middle of the match. Here the browser refuses the first request and
    // accepts the next.
    const onRoute = () => document.body.dataset.route;
    const wasRoute = onRoute();
    const realNav = globalThis.navigator;
    const requests = [];
    let locks = 0;
    const listeners = [];
    const fake = {
      request: () => {
        requests.push(Date.now());
        if (requests.length === 1) return Promise.reject(new Error('NotAllowedError'));
        locks += 1;
        return Promise.resolve({
          addEventListener: (type, fn) => { if (type === 'release') listeners.push(fn); },
          release: () => Promise.resolve(),
        });
      },
    };
    const wait = () => new Promise((r) => setTimeout(r, 0));
    // Hung on the real navigator: an object in its place breaks the private
    // fields Node uses to answer userAgent.
    Object.defineProperty(realNav, 'wakeLock', { value: fake, configurable: true });
    store.wipe();
    try {
      store.setCurrent(makeMatch(4));
      // For the home screen to redraw with the open-match notice: a round trip
      // through the statistics, which is the path the router already knows.
      fire(statsButton(), 'click');
      fireWindow('popstate');
      const resume = findAll(document.getElementById('app'), 'invite-banner')[0];
      ok(resume, 'the home screen did not offer to resume the match');
      fire(resume, 'click');
      eq(onRoute(), 'table', 'did not get into the table');
      await wait();
      const beforeTap = requests.length;

      fire(document, 'pointerup', {});
      await wait();
      ok(requests.length > beforeTap, 'the tap on the table did not ask to keep the screen on');

      // Refused (the first one always is, here): the next tap tries again.
      while (locks === 0 && requests.length < 5) {
        fire(document, 'pointerup', {});
        await wait();
      }
      eq(locks, 1, 'after a refusal, the next tap did not ask again');

      // With the lock in hand, tapping does not ask for another.
      const withLock = requests.length;
      fire(document, 'pointerup', {});
      await wait();
      eq(requests.length, withLock, 'asked again while already holding the lock');

      // The system released it (locked the phone, switched apps): the tap
      // recovers it.
      listeners.forEach((fn) => fn());
      fire(document, 'pointerup', {});
      await wait();
      eq(locks, 2, 'the lock released by the system did not come back on the tap');
    } finally {
      delete realNav.wakeLock;
      closeSheet();
      if (onRoute() !== wasRoute) document.body.dataset.route = wasRoute;
      store.wipe();
    }
    return undefined;
  }],
  ['the table code is read the way the person types or pastes it', () => {
    eq(normalizeCode(' k7m-2qx '), 'K7M2QX');
    ok(isCodeValid('K7M 2QX'), 'the code as it shows on screen is not valid');
    ok(!isCodeValid('K7M2Q'), 'five characters were valid');
    ok(!isCodeValid('O0I1L2'), 'letters outside the alphabet were valid');
    eq(formatCode('k7m2qx'), 'K7M 2QX');

    // Pasting the whole message from the chat: the field finds the code in it.
    const message = t('pass.shareText', {
      code: 'K7M 2QX', link: 'https://x.github.io/hit-easy/beta/?mesa=K7M2QX',
    });
    eq(codeInText(message), 'K7M2QX', 'did not find the code in the message');
    eq(codeInText('Mesa do Hit Easy: K7M 2QX'), 'K7M2QX');
    eq(codeInText('abre aí https://a.b/?mesa=ABCDEF'), 'ABCDEF', 'did not read the link');
    eq(codeInText('oi tudo bem'), null, 'invented a code');

    // The link of whoever passed leads to the SAME channel: a beta code only
    // opens in beta.
    eq(tableLink('K7M2QX', { origin: 'https://x.github.io', pathname: '/hit-easy/beta/index.html' }),
      'https://x.github.io/hit-easy/beta/?mesa=K7M2QX');
    eq(codeFromLink('?mesa=k7m2qx'), 'K7M2QX', 'the startup did not read the link');
    eq(codeFromLink('?outra=1'), null);
  }],

  ['passing by code only releases the table after it goes up', () => {
    store.wipe();
    try {
      store.setCurrent(makeMatch(4));
      const envelope = store.tableToSend(1000);
      ok(envelope && envelope.partida, 'did not build the envelope');
      ok(store.getCurrent(), 'building the envelope already released the table');
      ok(!envelope.partida.passadaEm, 'the envelope came out stamped as handed off');

      eq(store.releaseTable('K7M2QX', 2000), true);
      eq(store.getCurrent(), null, 'the table still counts here');
      eq(store.storedTable().passadaCodigo, 'K7M2QX', 'the table does not remember the code');
      eq(store.tableToSend(), null, 'a table already handed off was sent again');

      // Whoever receives does not inherit the code; whoever takes back does
      // not either.
      const arrived = receiveTable(store.storedTable(), 3000);
      ok(!arrived.passadaCodigo, 'the code traveled to the other device');
      store.takeTableBack();
      ok(!store.getCurrent().passadaCodigo, 'taking back left the code behind');
    } finally {
      store.wipe();
    }
  }],

  ['passing the table by code, and falling back to the file without network', async () => {
    if (!simulated) return 'skip';
    const realFetch = globalThis.fetch;
    const requests = [];
    let network = true;
    globalThis.fetch = (u, o) => {
      requests.push({ url: String(u), body: JSON.parse((o && o.body) || 'null') });
      if (!network) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve('K7M2QX') });
    };
    const breathe = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    const confirm = () => {
      const actions = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(actions.childNodes[1], 'click');
    };
    store.wipe();
    try {
      store.setCurrent(makeMatch(4));
      let left = 0;
      const going = passTable(() => { left += 1; });
      await breathe();
      confirm();
      eq(await going, true, 'the handoff did not finish');

      const request = requests.find((p) => p.url.endsWith('/rpc/enviar_mesa'));
      ok(request, 'did not upload the table');
      eq(request.body.c, 'producao', 'uploaded without the channel');
      eq(request.body.mesa.partida.id, store.storedTable().id, 'uploaded another table');
      eq(left, 1, 'the caller did not learn that the table left');
      eq(store.storedTable().passadaCodigo, 'K7M2QX');
      const code = findAll(document.body, 'table-code').slice(-1)[0];
      ok(code && textOf(code) === 'K7M 2QX', 'the code did not show');
      closeSheet();

      // No network: the table does NOT leave here, and the screen offers the
      // file.
      store.wipe();
      store.setCurrent(makeMatch(4));
      network = false;
      const offline = passTable(() => { left += 1; });
      await breathe();
      confirm();
      await breathe();
      ok(store.getCurrent(), 'with no network, the table vanished from this device');
      const offer = findAll(document.body, 'btn').find((b) => textOf(b) === t('pass.sendFile'));
      ok(offer, 'with no network, it did not offer the file');
      closeSheet();
      await breathe();
      eq(await offline, false);
      eq(left, 1, 'with no network, the screen switched as if it had passed');
    } finally {
      globalThis.fetch = realFetch;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['receiving by code peeks, confirms and only then takes', async () => {
    if (!simulated) return 'skip';
    const realFetch = globalThis.fetch;
    const requests = [];
    const original = makeMatch(4);
    original.id = 'p-por-codigo';
    push(original, { type: 'life', targetId: 's1', sourceId: 's0', delta: -9 });
    const envelope = { formato: 'hit-easy/mesa', versao: 1, em: 1, partida: original };
    let taken = false;
    globalThis.fetch = (u, o) => {
      const url = String(u);
      requests.push({ url, body: JSON.parse((o && o.body) || 'null') });
      let answer = null;
      if (url.endsWith('/rpc/ver_mesa')) answer = taken ? null : envelope;
      if (url.endsWith('/rpc/pegar_mesa')) { answer = taken ? null : envelope; taken = true; }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(answer) });
    };
    const breathe = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    store.wipe();
    try {
      // The envelope the file uses: the format has to be the same in both.
      store.setCurrent(makeMatch(2));
      envelope.formato = JSON.parse(store.packTable(1)).formato;
      store.wipe();

      let opened = 0;
      openReceiveTable(() => { opened += 1; }, 'k7m2qx');
      const field = findAll(document.body, 'table-code-field').slice(-1)[0];
      eq(field.value, 'K7M 2QX', 'the link code did not come filled in');
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('pass.receive')).pop(), 'click');
      await breathe();

      ok(requests.some((p) => p.url.endsWith('/rpc/ver_mesa')), 'did not look for the table');
      ok(!requests.some((p) => p.url.endsWith('/rpc/pegar_mesa')), 'took it before the person confirmed');

      const actions = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(actions.childNodes[1], 'click');
      await breathe();

      const take = requests.find((p) => p.url.endsWith('/rpc/pegar_mesa'));
      ok(take, 'confirmed and did not take');
      eq(take.body.cod, 'K7M2QX');
      eq(store.getCurrent() && store.getCurrent().id, 'p-por-codigo', 'the table was not installed');
      eq(replay(store.getCurrent()).players.s1.life, 31, 'the table arrived without the events');
      eq(opened, 1, 'receiving did not lead to the table');

      // A second device with the same code takes nothing.
      store.wipe();
      openReceiveTable(() => { opened += 1; }, 'K7M2QX');
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('pass.receive')).pop(), 'click');
      await breathe();
      const error = findAll(document.body, 'table-code-error').slice(-1)[0];
      eq(textOf(error), t('pass.codeNotFound'), 'the used code was not refused');
      eq(store.getCurrent(), null);
      eq(opened, 1);
    } finally {
      globalThis.fetch = realFetch;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['taking back a table the other device already took asks for one more confirmation', async () => {
    if (!simulated) return 'skip';
    const realFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = (u) => {
      const url = String(u);
      requests.push(url);
      const answer = url.endsWith('/rpc/cancelar_mesa') || url.endsWith('/rpc/situacao_mesa')
        ? 'recebida' : null;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(answer) });
    };
    const breathe = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    const confirm = () => {
      const actions = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(actions.childNodes[1], 'click');
    };
    store.wipe();
    try {
      store.setCurrent(makeMatch(4));
      store.releaseTable('K7M2QX');
      let tookBack = 0;
      const box = handedOffBanner(() => {}, () => { tookBack += 1; });
      await breathe();
      ok(textOf(box).includes(t('pass.goneSubArrived', { code: 'K7M 2QX' })),
        'the notice did not say the other device already received it');

      const takeBack = findAll(box, 'btn').find((b) => textOf(b) === t('pass.takeBack'));
      fire(takeBack, 'click');
      await breathe();
      confirm();
      await breathe();
      ok(requests.some((u) => u.endsWith('/rpc/cancelar_mesa')), 'taking back did not cancel the code');
      eq(tookBack, 0, 'it took back without warning the other device already has the table');
      const title = findAll(document.body, 'sheet-title').slice(-1)[0];
      eq(textOf(title), t('pass.takeBackReceivedTitle'));
      confirm();
      await breathe();
      eq(tookBack, 1, 'confirming again did not take back');
      ok(store.getCurrent(), 'the table did not come back');
    } finally {
      globalThis.fetch = realFetch;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],
  ['the settings come in groups, in order of use', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');

    try {
      // Appearance, table, app: from what is touched most to what is touched
      // least. The account, when it exists, is a single row before everything.
      const titles = findAll(document.body, 'sheet-legend').map(textOf);
      eq(titles, [t('settings.appearance'), t('settings.onTable'), t('settings.app')],
        'groups out of order');
      eq(findAll(document.body, 'set-account').length, cloudEnabled() ? 1 : 0,
        'the account is not a single row');

      // Vibration and keep-screen-on with no caption: the label says it all.
      const toggles = findAll(document.body, 'is-toggle');
      ok(toggles.length >= 2, 'the table toggles are missing');
      for (const row of toggles.slice(0, 2)) {
        ok(findAll(row, 'set-sub').every((x) => x.hidden), textOf(row) + ': extra caption');
      }

      // The theme through the segments saves and lights the chosen one. The
      // stored value is the Portuguese 'escuro' (see store.js).
      const dark = findAll(document.body, 'set-segment').find((b) => textOf(b) === t('settings.themeDark'));
      fire(dark, 'click');
      eq(store.getDB().settings.theme, 'escuro', 'the theme was not saved');
      const lit = findAll(document.body, 'set-segment').filter((b) => b.classList.contains('is-on'));
      eq(lit.map(textOf), [t('settings.themeDark')], 'the chosen segment did not light up');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['the account screen does not enter a redraw loop', async () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    // The reported defect: after signing in, the buttons flickered as if the
    // mouse passed quickly and stopped accepting clicks. The account screen
    // redrew on every account notice, redrawing fetched the invites, and the
    // fetch notified again - forever, recreating the buttons under the mouse
    // on every network round.
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    let fetches = 0;
    let invites = [];
    globalThis.fetch = (u) => {
      if (String(u).includes('match_players')) fetches += 1;
      const body = String(u).includes('match_players') ? invites : [];
      // Answers on a separate tick, like the real network: answering right
      // away, the old loop never yielded and hung the whole suite.
      return new Promise((r) => setTimeout(() => r({
        ok: true, status: 200, json: () => Promise.resolve(body),
      }), 0));
    };
    account.session = {
      user: { id: 'eu', email: 'eu@exemplo.com' }, access_token: 'x',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const breathe = async (n = 30) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    document.body.childNodes.length = 0;
    try {
      const block = accountBlock(() => {});
      document.body.append(block);
      await breathe();
      const afterMount = fetches;
      ok(afterMount >= 1, 'the account screen did not fetch the invites');

      // Any account notice: the screen redraws ONCE, and stops.
      await pendingInvites();
      await breathe();
      ok(fetches - afterMount <= 3,
        'loop: ' + (fetches - afterMount) + ' invite fetches after a single notice');

      // With the screen closed, it stops listening: a real new invite
      // notifies, and the box nobody sees cannot go fetching again.
      block.remove();
      await breathe();
      invites = [{ match_id: 'm1', seat_id: 's1', status: 'pendente', handle: 'eu' }];
      await pendingInvites();
      await breathe();
      const before = fetches;
      invites = [];
      await pendingInvites();
      await breathe();
      eq(fetches - before, 1, 'the closed screen kept fetching invites');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
      account.invites = [];
      document.body.childNodes.length = 0;
    }
    return undefined;
  }],
  ['an @ is current, free or someone else\'s - and yours does not show as free', () => {
    // The search resolves an old @ to its current owner (sql/008). Finding an
    // account is not enough to say "taken", and finding yourself is not "free".
    eq(handleStatus('alex', null, 'eu'), 'free', 'nobody uses it');
    eq(handleStatus('alex', { id: 'eu', handle: 'alex' }, 'eu'), 'current', 'it is my current one');
    eq(handleStatus('@Alex', { id: 'eu', handle: 'alex' }, 'eu'), 'current', 'with @ and capitals too');
    eq(handleStatus('alex', { id: 'eu', handle: 'alexandre' }, 'eu'), 'free',
      'an old @ of mine: I can go back to it');
    eq(handleStatus('alex', { id: 'outra', handle: 'alex' }, 'eu'), 'taken');
    eq(handleStatus('alex', { id: 'outra', handle: 'alexandre' }, 'eu'), 'taken',
      'someone else\'s old @ is still theirs');
  }],

  ['the name in matches stays the way the person wrote it', () => {
    eq(normalizeName('  Alê   do   Rio  '), 'Alê do Rio', 'extra spaces');
    eq(normalizeName('Dr. Strange!'), 'Dr. Strange!', 'capitals and punctuation stay');
    eq(normalizeName('MARIA'), 'MARIA');
    eq(normalizeName('Ana\u0000\u0007'), 'Ana', 'a control character goes');
    eq(normalizeName('‮anA'), 'anA', 'what reverses the text goes');
    eq(normalizeName('👨‍👩‍👧 Família'), '👨‍👩‍👧 Família',
      'the composed emoji stays whole');
    eq([...normalizeName('a'.repeat(30))].length, NAME_MAX, 'cuts at the panel size');
    eq([...normalizeName('🐉'.repeat(30))].length, NAME_MAX, 'an emoji counts as one');
    eq(normalizeName('   '), '', 'only spaces is no name at all');
  }],

  ['changing the @ does not erase the name, and the name goes normalized', async () => {
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    const realProfile = account.profile;
    const requests = [];
    globalThis.fetch = (u, o) => {
      requests.push({ url: String(u), method: (o && o.method) || 'GET', body: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve([{ id: 'eu', handle: 'alexandre', display_name: 'Alê' }]),
      });
    };
    account.session = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    account.profile = { id: 'eu', handle: 'alex', display_name: 'Alê' };
    try {
      await saveHandle('alexandre', null);
      const upsert = requests.find((p) => p.method === 'POST' && p.url.includes('/profiles'));
      ok(upsert, 'did not save the @');
      ok(!('display_name' in upsert.body), 'changing the @ sent display_name and would erase the name');

      await saveName('  Dr.   Strange  ');
      const patch = requests.find((p) => p.method === 'PATCH');
      eq(patch.body, { display_name: 'Dr. Strange' }, 'the name was not normalized');
      eq(account.profile.display_name, 'Dr. Strange');

      await saveName('   ');
      eq(requests.filter((p) => p.method === 'PATCH').pop().body, { display_name: null },
        'an empty name has to go back to the @');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
      account.profile = realProfile;
    }
    return undefined;
  }],

  ['checking your own @ says it is already yours, and does not let you save', async () => {
    if (!simulated) return 'skip';
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    const realProfile = account.profile;
    globalThis.fetch = () => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve([{ id: 'eu', handle: 'alex', display_name: null }]),
    });
    account.session = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    account.profile = { id: 'eu', handle: 'alex', display_name: null };
    const breathe = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    try {
      fire(handleBlock(), 'click');
      const field = findAll(document.body, 'search-input').pop();
      field.value = 'alex';
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('handle.check')).pop(), 'click');
      await breathe();

      const message = findAll(document.body, 'handle-result').pop();
      eq(textOf(message), t('handle.yours', { handle: '@alex' }), 'your own @ showed as free');
      const use = findAll(document.body, 'btn').filter((b) => textOf(b) === t('handle.useThis')).pop();
      ok(use.disabled, 'it let you save the @ that is already yours');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
      account.profile = realProfile;
      closeSheet();
    }
    return undefined;
  }],
  ['the @ only changes every 15 days', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.parse('2026-10-09T12:00:00Z');
    const daysAgo = (days) => new Date(now - days * day).toISOString();

    eq(HANDLE_CHANGE_DAYS, 15);
    eq(nextHandleChange({ handle: 'alex', handle_trocado_em: null }, now), null,
      'whoever already had an @ before the rule can change');
    eq(nextHandleChange({ handle: 'alex', handle_trocado_em: daysAgo(3) }, now), now + 12 * day,
      'changed 3 days ago: unlocks in 12');
    eq(nextHandleChange({ handle: 'alex', handle_trocado_em: daysAgo(15) }, now), null,
      'on the 15th day it already can');
    eq(nextHandleChange({ handle: 'alex', handle_trocado_em: daysAgo(16) }, now), null);
    eq(nextHandleChange(null, now), null, 'no profile, nothing to wait for');
    eq(nextHandleChange({ handle: null, handle_trocado_em: daysAgo(1) }, now), null,
      'with no @, picking the first one does not wait');
  }],

  ['changing too early says when it unlocks', async () => {
    if (!simulated) return 'skip';
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    const realProfile = account.profile;
    const day = 24 * 60 * 60 * 1000;
    const changed = new Date(Date.now() - 2 * day).toISOString();
    const unlocks = new Date(Date.parse(changed) + 15 * day).toISOString();
    account.session = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    account.profile = { id: 'eu', handle: 'alex', display_name: null, handle_trocado_em: changed };
    globalThis.fetch = () => Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ code: 'HE015', message: 'handle troca cedo', details: unlocks }),
    });
    try {
      // The database refuses with HE015 and the date in details: the app reads
      // both.
      let error = null;
      try { await saveHandle('alexandre', null); } catch (e) { error = e; }
      ok(error, 'the refused change went through');
      eq(error.message, 'handle too soon');
      eq(error.unlockedAt, Date.parse(unlocks), 'the unlock date got lost');

      // The @ row already says when it unlocks, and tapping does not open the
      // change screen.
      document.body.childNodes.length = 0;
      const handleRow = handleBlock();
      ok(!handleRow._sub.hidden, 'the row does not say when it unlocks');
      ok(textOf(handleRow._sub).length > 0);
      eq(handleRow._value, null, 'it still offers "Change"');
      fire(handleRow, 'click');
      eq(findAll(document.body, 'search-input').length, 0, 'it opened the change screen within the waiting period');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
      account.profile = realProfile;
      closeSheet();
    }
    return undefined;
  }],
  ['whoever changes @ is still a single person in the statistics', () => {
    store.wipe();
    try {
      // Two matches, the same person: in the first they were @alex, in the
      // second they had already become @alexandre. The history is not
      // rewritten.
      const withSeats = (handle0) => {
        const m = makeMatch(2);
        m.seats[0].handle = handle0;
        m.seats[1].handle = 'bia';
        push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
        return m;
      };
      const old = withSeats('alex');
      const fresh = withSeats('alexandre');
      fresh.startedAt = old.startedAt + 1000;

      // Without knowing about the change, they are two people - that was the
      // defect.
      const noMap = aggregate([old, fresh], store.knownHandles()).players;
      ok(noMap.some((p) => p.key === '@alex') && noMap.some((p) => p.key === '@alexandre'),
        'the test scenario does not split the person');

      eq(store.learnCurrentHandles({ alex: 'alexandre' }), 1);
      const aliases = store.knownHandles();

      const players = aggregate([old, fresh], aliases).players;
      const alex = players.filter((p) => p.key.startsWith('@alex'));
      eq(alex.length, 1, 'the @ change split the person into two rows');
      eq(alex[0].key, '@alexandre', 'the row does not use the current @');
      eq(alex[0].label, '@alexandre');
      eq(alex[0].games, 2, 'the matches with the old @ were left out');
      eq(alex[0].wins, 2);

      const pairs = rivalries([old, fresh], aliases);
      eq(pairs.length, 1, 'the rivalry with Bia became two');
      eq(pairs[0].games, 2);

      const colors = playerColorOrder([old, fresh], aliases);
      ok(!colors.has('@alex'), 'the old @ got its own color');

      // The history still says what happened that day.
      eq(old.seats[0].handle, 'alex', 'the old match was rewritten');
    } finally {
      store.wipe();
    }
  }],

  ['the @ map follows chained changes, accepts going back and does not hang on a cycle', () => {
    const withMap = (map) => ({ [CURRENT_HANDLES]: map });
    eq(currentHandle('a', withMap({ a: 'b', b: 'c' })), 'c', 'changed twice');
    eq(currentHandle('x', withMap({ a: 'b' })), 'x', 'whoever never changed');
    eq(currentHandle('a', withMap({ a: 'b', b: 'a' })).length, 1, 'the cycle hung');
    eq(identityOf({ handle: 'A' }, withMap({ a: 'b' })), '@b', 'the seat with the old @');

    store.wipe();
    try {
      store.rememberHandle('Alex', 'alex');
      store.hidePlayer('@alex');
      store.learnCurrentHandles({ alex: 'alexandre' });
      // What the device STORES follows too: the remembered name and whoever
      // was hidden.
      eq(store.knownHandles().alex, 'alexandre', 'the remembered name kept the old @');
      ok(store.isPlayerHidden('@alexandre'), 'whoever was hidden reappeared after the change');

      // Changed again, and then went back to the first.
      store.learnCurrentHandles({ alexandre: 'alex_m' });
      eq(currentHandle('alex', store.knownHandles()), 'alex_m', 'the chain was not followed');
      store.learnCurrentHandles({ alex_m: 'alex' });
      eq(currentHandle('alex', store.knownHandles()), 'alex', 'going back to the old @ did not work');
      eq(currentHandle('alexandre', store.knownHandles()), 'alex');
    } finally {
      store.wipe();
    }
  }],

  ['the sync asks the server who changed @', async () => {
    const realFetch = globalThis.fetch;
    const realSession = account.session;
    const requests = [];
    globalThis.fetch = (u, o) => {
      requests.push({ url: String(u), body: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve([{ pedido: 'bia', atual: 'beatriz' }]),
      });
    };
    account.session = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    store.wipe();
    try {
      const m = makeMatch(2);
      m.seats[0].handle = 'eu_mesmo';
      m.seats[1].handle = 'bia';
      store.archive(m);

      eq(await refreshHandles(), 1, 'it did not learn Bia\'s change');
      const request = requests.find((p) => p.url.endsWith('/rpc/handles_atuais'));
      ok(request, 'it did not ask the server');
      eq(request.body.hs.sort(), ['bia', 'eu_mesmo'], 'it did not send the @s of the history');
      eq(identityOf(m.seats[1], store.knownHandles()), '@beatriz');
    } finally {
      globalThis.fetch = realFetch;
      account.session = realSession;
      store.wipe();
    }
    return undefined;
  }],
];

/**
 * Runs every case. Returns a PROMISE.
 *
 * A case may return a promise, and then it is awaited before the next one -
 * never in parallel, because the cases share `document`, `store` and the open
 * sheet, and two running together would step on each other.
 *
 * This exists because two defects reached the user through paths that go
 * through `await confirmAction`: the synchronous runner could not observe
 * anything after the await, so those lines were unreachable by any test.
 */
export async function runAll() {
  const results = [];
  for (const [name, fn] of cases) {
    results.push(await runOne(name, fn));
  }
  return results;
}

async function runOne(name, fn) {
  {
    try {
      // Each case starts from scratch.
      //
      // Without this the test inherits the SYSTEM language. On Windows, in
      // Portuguese, all hundred passed; on the CI Ubuntu, in English, six broke
      // comparing "Número secreto" with "Secret number". Passing by accident is
      // worse than failing: the set looked green without proving anything
      // about the language.
      //
      // The open panel leaked too: a case that failed halfway left the sheet
      // standing and took down the next one, which reported an error that was
      // not its own.
      setLang('pt');
      if (typeof closeSheet === 'function') closeSheet();
      forgetSession();

      const r = await fn();
      if (r === 'skip') return { name, ok: true, skipped: true };
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, why: err.message };
    }
  }
}
