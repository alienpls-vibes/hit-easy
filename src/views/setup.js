/**
 * Table setup - the entry point of the screen.
 *
 * The pieces live in src/views/setup/, one per element of the home screen:
 *
 *   draft.js            the table being set up (life, seats, arrangement)
 *   home.js             the screen itself
 *   seat-card.js        a seat's card, and the drag that reorders
 *   pick-player.js      who sits here
 *   pick-deck.js        which deck they bring
 *   pre-game.js         who opens the match, and the table layout
 *   settings.js         the app preferences
 *   rows.js             the row and group pieces of the settings
 *   install.js          the install block
 *   account.js          signing in, creating an account, subscription
 *   handle.js           your own @
 *   invites.js          matches in which someone says you were present
 *   sync.js             what went up and what is missing
 *   release-notes.js    what changed in this version
 *   pass-table.js       passing the table to another device, and receiving one
 *
 * Only what app.js knows about the whole screen goes through this door.
 * Splitting the pieces differently tomorrow does not touch app.js.
 */

export { renderSetup } from './setup/home.js';
export { seedDraftFrom } from './setup/draft.js';
export { openReleaseNotes } from './setup/release-notes.js';
export { openIOSInstall } from './setup/install.js';
export {
  passTable, receiveTableFile, handedOffBanner, receiveTableButton,
  resumeTableBanner, tableFileName, openReceiveTable, showCode,
  tableLink,
} from './setup/pass-table.js';
