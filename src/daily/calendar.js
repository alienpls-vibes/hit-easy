/**
 * THE DAILY CHALLENGE CALENDAR - edit this list freely.
 *
 * One line per day:
 *
 *   ['YYYY-MM-DD', "Card name in English"],
 *
 * - The name must be the card's English name exactly as Scryfall writes it
 *   (copy it from scryfall.com). The translated text comes from Scryfall on
 *   its own, in the language the player picks.
 * - Double quotes around the name, so names with an apostrophe need no
 *   escaping: "Sigarda's Vanguard".
 * - The comment after each line (color, EDHREC rank, type) is only there to
 *   help keep the mix balanced. The game ignores it - the answer always comes
 *   from Scryfall, so a wrong comment cannot make a wrong answer.
 * - Swapping a card: change the name on that day's line. Adding days: add
 *   lines at the end, keeping the dates in order with no gaps.
 * - Optional third item, for a card that calls itself something the game
 *   does not hide on its own: ['2026-12-01', "Some Card", ['Nickname']].
 * - After the last line the list starts over from the top, so the game never
 *   runs dry. `npm test` warns when fewer than 14 days are left.
 *
 * Check the list against Scryfall (needs internet) - it confirms every name
 * exists and shows the colors, the EDHREC rank and which languages have a
 * print:
 *
 *   node tools/daily-calendar.js
 *
 * The starting list (Oct 16, 2026 to Jan 15, 2027) was picked from cards
 * ranked roughly 4,000 to 18,000 on EDHREC - played, but not staples - with
 * a Portuguese print, rules text that does not name its own color or basic
 * land type, and each week holding the five colors plus multicolor and
 * colorless days.
 */

export const CALENDAR = [
  // October 2026
  ['2026-10-15', "Boros Fury-Shield"],               // W     EDHREC 16871  Instant
  ['2026-10-16', "The Ever-Changing 'Dane"],               // 
  ['2026-10-17', "Venser, the Sojourner"],           // UW    EDHREC 6384   Legendary Planeswalker
  ['2026-10-18', "Boon of Boseiju"],                 // G     EDHREC 12342  Instant
  ['2026-10-19', "Kraum, Violent Cacophony"],        // RU    EDHREC 9281   Legendary Creature
  ['2026-10-20', "Gigadrowse"],                      // U     EDHREC 10885  Instant
  ['2026-10-21', "Wildfire Devils"],                 // R     EDHREC 6929   Creature
  ['2026-10-22', "Body Launderer"],                  // B     EDHREC 7561   Creature
  ['2026-10-23', "Wayward Servant"],                 // BW    EDHREC 4953   Creature
  ['2026-10-24', "Soul Swallower"],                  // G     EDHREC 17278  Creature
  ['2026-10-25', "Boggart Shenanigans"],             // R     EDHREC 6554   Kindred Enchantment
  ['2026-10-26', "Vendetta"],                        // B     EDHREC 11434  Instant
  ['2026-10-27', "Blustersquall"],                   // U     EDHREC 6802   Instant
  ['2026-10-28', "Zilortha, Strength Incarnate"],    // GR    EDHREC 8922   Legendary Creature
  ['2026-10-29', "Discerning Financier"],            // W     EDHREC 7645   Creature
  ['2026-10-30', "Lim-Dûl's Hex"],                   // B     EDHREC 17435  Enchantment
  ['2026-10-31', "Bitter Chill"],                    // U     EDHREC 13304  Enchantment

  // November 2026
  ['2026-11-01', "Benefactor's Draught"],            // G     EDHREC 7633   Instant
  ['2026-11-02', "Mirrorwing Dragon"],               // R     EDHREC 8178   Creature
  ['2026-11-03', "Scytheclaw"],                      // C     EDHREC 7404   Artifact
  ['2026-11-04', "Ancestral Katana"],                // W     EDHREC 13583  Artifact
  ['2026-11-05', "Dragonlord Ojutai"],               // UW    EDHREC 7242   Legendary Creature
  ['2026-11-06', "Malleable Impostor"],              // U     EDHREC 4589   Creature
  ['2026-11-07', "Blood Speaker"],                   // B     EDHREC 13616  Creature
  ['2026-11-08', "Honor the God-Pharaoh", ['God-Pharaoh', 'Faraó-Deus', 'Faraón']], // R     EDHREC 14383  Sorcery
  ['2026-11-09', "Bag of Tricks"],                   // G     EDHREC 16579  Artifact
  ['2026-11-10', "Ride the Avalanche"],              // GU    EDHREC 16866  Instant
  ['2026-11-11', "Ashes of the Abhorrent"],          // W     EDHREC 8298   Enchantment
  ['2026-11-12', "Mobile Homestead"],                // C     EDHREC 12459  Artifact
  ['2026-11-13', "Vanishing"],                       // U     EDHREC 8281   Enchantment
  ['2026-11-14', "Michiko Konda, Truth Seeker"],     // W     EDHREC 5968   Legendary Creature
  ['2026-11-15', "Tasigur's Cruelty"],               // B     EDHREC 14946  Sorcery
  ['2026-11-16', "Reroute"],                         // R     EDHREC 16446  Instant
  ['2026-11-17', "Adventuring Gear"],                // C     EDHREC 6427   Artifact
  ['2026-11-18', "Fracturing Gust"],                 // GW    EDHREC 15460  Instant
  ['2026-11-19', "Cloakwood Swarmkeeper"],           // G     EDHREC 14480  Creature
  ['2026-11-20', "Reverse the Sands"],               // W     EDHREC 12323  Sorcery
  ['2026-11-21', "Blast of Genius"],                 // RU    EDHREC 17156  Sorcery
  ['2026-11-22', "Timber Protector"],                // G     EDHREC 7898   Creature
  ['2026-11-23', "Phoenix Chick"],                   // R     EDHREC 6099   Creature
  ['2026-11-24', "Angrath's Rampage"],               // BR    EDHREC 15115  Sorcery
  ['2026-11-25', "Anticipate"],                      // U     EDHREC 6489   Instant
  ['2026-11-26', "Bake into a Pie"],                 // B     EDHREC 6136   Instant
  ['2026-11-27', "Enigma Thief"],                    // U     EDHREC 11329  Creature
  ['2026-11-28', "Otherworld Atlas"],                // C     EDHREC 7059   Artifact
  ['2026-11-29', "Urban Utopia"],                    // G     EDHREC 17071  Enchantment
  ['2026-11-30', "Gideon's Sacrifice"],              // W     EDHREC 5251   Instant

  // December 2026
  ['2026-12-01', "Shessra, Death's Whisper"],        // BG    EDHREC 17363  Legendary Creature
  ['2026-12-02', "Asmodeus the Archfiend"],          // B     EDHREC 6443   Legendary Creature
  ['2026-12-03', "Grab the Reins"],                  // R     EDHREC 12399  Instant
  ['2026-12-04', "Wrath of the Skies"],              // W     EDHREC 9532   Sorcery
  ['2026-12-05', "Dynaheir, Invoker Adept"],         // RUW   EDHREC 13566  Legendary Creature
  ['2026-12-06', "Kumena's Awakening"],              // U     EDHREC 12503  Enchantment
  ['2026-12-07', "Danitha, New Benalia's Light"],    // GW    EDHREC 5163   Legendary Creature
  ['2026-12-08', "Tectonic Reformation"],            // R     EDHREC 6723   Enchantment
  ['2026-12-09', "Meriadoc Brandybuck"],             // G     EDHREC 6104   Legendary Creature
  ['2026-12-10', "Reaper's Talisman"],               // B     EDHREC 13203  Artifact
  ['2026-12-11', "Persistent Petitioners"],          // U     EDHREC 10020  Creature
  ['2026-12-12', "Wulfgar of Icewind Dale"],         // GR    EDHREC 4796   Legendary Creature
  ['2026-12-13', "Brutal Hordechief"],               // B     EDHREC 6836   Creature
  ['2026-12-14', "Intrepid Stablemaster"],           // G     EDHREC 10465  Creature
  ['2026-12-15', "Sagu Mauler"],                     // GU    EDHREC 15111  Creature
  ['2026-12-16', "Dragonspark Reactor"],             // R     EDHREC 8995   Artifact
  ['2026-12-17', "Darksteel Splicer"],               // W     EDHREC 6782   Creature
  ['2026-12-18', "Brinelin, the Moon Kraken"],       // U     EDHREC 5506   Legendary Creature
  ['2026-12-19', "Skorpekh Lord"],                   // B     EDHREC 7777   Artifact Creature
  ['2026-12-20', "Satsuki, the Living Lore"],        // GW    EDHREC 4664   Legendary Creature
  ['2026-12-21', "Fireblade Charger"],               // R     EDHREC 16459  Creature
  ['2026-12-22', "Master Warcraft"],                 // RW    EDHREC 5496   Instant
  ['2026-12-23', "Sigarda's Vanguard"],              // W     EDHREC 8780   Creature
  ['2026-12-24', "Gift of Paradise"],                // G     EDHREC 6858   Enchantment
  ['2026-12-25', "Final Payment"],                   // BW    EDHREC 14918  Instant
  ['2026-12-26', "That Which Was Taken"],            // C     EDHREC 15348  Legendary Artifact
  ['2026-12-27', "Archangel's Light"],               // W     EDHREC 16725  Sorcery
  ['2026-12-28', "Skyshroud Ranger", ['Skyshroud', 'Veloceleste']], // G     EDHREC 6479   Creature
  ['2026-12-29', "Shakedown Heavy"],                 // B     EDHREC 6812   Creature
  ['2026-12-30', "Rift Elemental"],                  // R     EDHREC 11809  Creature
  ['2026-12-31', "Consign to Memory"],               // U     EDHREC 7268   Instant

  // January 2027
  ['2027-01-01', "Gold Pan"],                        // C     EDHREC 10282  Artifact
  ['2027-01-02', "Ringwraiths"],                     // B     EDHREC 6709   Creature
  ['2027-01-03', "Mark of Mutiny"],                  // R     EDHREC 9840   Sorcery
  ['2027-01-04', "Yisan, the Wanderer Bard"],        // G     EDHREC 8148   Legendary Creature
  ['2027-01-05', "Forbidden Alchemy"],               // U     EDHREC 5233   Instant
  ['2027-01-06', "Acrobatic Maneuver"],              // W     EDHREC 5550   Instant
  ['2027-01-07', "Tyvar the Bellicose"],             // BG    EDHREC 6128   Legendary Creature
  ['2027-01-08', "Rhystic Tutor"],                   // B     EDHREC 13575  Sorcery
  ['2027-01-09', "Ring of Xathrid"],                 // C     EDHREC 6948   Artifact
  ['2027-01-10', "Mass Diminish"],                   // U     EDHREC 9100   Sorcery
  ['2027-01-11', "The Royal Scions"],                // RU    EDHREC 11504  Legendary Planeswalker
  ['2027-01-12', "Yidaro, Wandering Monster"],       // R     EDHREC 8028   Legendary Creature
  ['2027-01-13', "Praetor's Counsel"],               // G     EDHREC 5464   Sorcery
  ['2027-01-14', "Against All Odds"],                // W     EDHREC 9912   Sorcery
  ['2027-01-15', "Minthara, Merciless Soul"],        // BW    EDHREC 5236   Legendary Creature
];
