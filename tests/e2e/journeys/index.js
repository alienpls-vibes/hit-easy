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
import updateButton from './update-button.js';
import dailyChallenge from './daily-challenge.js';
import dailyLost from './daily-lost.js';
import dailyAccount from './daily-account.js';
import tour from './tour.js';
import seatMap from './seat-map.js';

export const JOURNEYS = [
  firstMatch,
  seatMap,
  tour,
  offline,
  upgrade,
  updateButton,
  legacyData,
  crashScreen,
  channels,
  screens,
  dailyChallenge,
  dailyLost,
  cloudAccount,
  dailyAccount,
];
