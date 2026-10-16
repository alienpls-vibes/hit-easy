/**
 * Every journey, in the order they run. The cheapest and most fundamental
 * first: if a phone cannot play a match, the rest is noise.
 */

import firstMatch from './first-match.js';
import cloudAccount from './cloud-account.js';
import offline from './offline.js';
import upgrade from './upgrade.js';
import crashScreen from './crash-screen.js';
import legacyData from './legacy-data.js';
import channels from './channels.js';
import screens from './screens.js';

export const JOURNEYS = [
  firstMatch,
  offline,
  upgrade,
  legacyData,
  crashScreen,
  channels,
  screens,
  cloudAccount,
];
