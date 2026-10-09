/**
 * Account and cloud storage (Supabase) - the entry point of the subsystem.
 *
 * No SDK: these are direct REST calls. The Supabase SDK brings more than 100 KB
 * to do what fits here in a few hundred lines, and the whole app has not a
 * single dependency - not worth starting now.
 *
 * What this module does NOT do: decide who can read what. That belongs to the
 * database (see sql/schema.sql). If someone deletes the gate here through
 * devtools, Postgres keeps returning an empty list. The client only asks; the
 * server answers.
 *
 * The pieces live in src/cloud/, in layers that only look down:
 *
 *   rules.js           pure functions - the part the tests reach without a network
 *   account.js         what is remembered about whoever signed in
 *   http.js            one request, with token renewal around it
 *   auth.js            signing in and out
 *   subscription.js    whether the subscription is valid
 *   matches.js         uploading, downloading and deleting matches
 *   profile.js         the name and the @
 *   invites.js         matches in which someone says you were present
 *   table-by-code.js   passing the table to another device with a short code
 *   boot.js            the startup, in order
 *
 * Whoever imports from here does not need to know about this split, on
 * purpose: changing the split tomorrow does not touch any of the modules that
 * depend on this one.
 */

export {
  HANDLE_RE,
  MIN_PASSWORD_LENGTH,
  accountState,
  isSubscriptionActive,
  displayHandle,
  fromRow,
  isHandleValid,
  buildInvites,
  normalizeHandle,
  normalizeName,
  NAME_MAX,
  HANDLE_CHANGE_DAYS,
  nextHandleChange,
  handleStatus,
  participantsOf,
  pendingUploads,
  canSeeStats,
  needsRefresh,
  isPasswordValid,
  isSessionUsable,
  sessionFromStorage,
  isSessionValid,
  toRow,
} from './cloud/rules.js';

export {
  account,
  currentUser,
  forgetSession,
  onAccountChange,
  watchAccountWhile,
  state,
  subscription,
} from './cloud/account.js';

export {
  refreshSession,
} from './cloud/http.js';

export {
  captureReturn,
  loadConfig,
  loadUser,
  createAccount,
  setPassword,
  signInWith,
  signInWithPassword,
  sendMagicLink,
  accountAlreadyExisted,
  magicLinkRequest,
  requestPasswordReset,
  providers,
  signOut,
  hasPassword,
  returnUrl,
} from './cloud/auth.js';

export {
  isSubscriptionKnown,
  loadSubscription,
} from './cloud/subscription.js';

export {
  deleteRemoteMatch,
  downloadMatches,
  uploadMatch,
  remoteIds,
} from './cloud/matches.js';

export {
  findHandle,
  loadProfile,
  saveName,
  handleStatusNow,
  currentHandles,
  myProfile,
  saveMyDecks,
  decksColumn,
  saveHandle,
} from './cloud/profile.js';

export {
  inviteHost,
  trustedHosts,
  refusedHosts,
  trustHost,
  openInvites,
  pendingInvites,
  untrustHost,
  sendParticipants,
  answerInvite,
} from './cloud/invites.js';

export {
  boot,
} from './cloud/boot.js';

export {
  CODE_ALPHABET,
  CODE_LENGTH,
  cancelTable,
  codeInText,
  isCodeValid,
  sendTable,
  formatCode,
  normalizeCode,
  takeTable,
  tableStatus,
  peekTable,
} from './cloud/table-by-code.js';
