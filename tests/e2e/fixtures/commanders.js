/**
 * A fixed slice of the Scryfall catalog, in Scryfall's own response shape.
 *
 * Only the fields src/scryfall.js reads (toCommander), plus `object` and
 * `card_faces` where a real card has them - a double-faced commander is the
 * case that once broke the art, so it stays in the catalog on purpose.
 */

const art = (id) => ({
  small: `https://cards.scryfall.io/small/front/${id[0]}/${id[1]}/${id}.jpg?1`,
  normal: `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg?1`,
  art_crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg?1`,
});

const CARDS = [
  {
    object: 'card', id: 'd0d33d52-3d28-4635-b985-51e126289259', oracle_id: 'oracle-atraxa',
    name: "Atraxa, Praetors' Voice", type_line: 'Legendary Creature — Phyrexian Angel Horror',
    color_identity: ['W', 'U', 'B', 'G'], image_uris: art('d0d33d52-3d28-4635-b985-51e126289259'),
  },
  {
    object: 'card', id: 'a1b2c3d4-0000-4000-8000-000000000001', oracle_id: 'oracle-krenko',
    name: 'Krenko, Mob Boss', type_line: 'Legendary Creature — Goblin Warrior',
    color_identity: ['R'], image_uris: art('a1b2c3d4-0000-4000-8000-000000000001'),
  },
  {
    object: 'card', id: 'a1b2c3d4-0000-4000-8000-000000000002', oracle_id: 'oracle-edgar',
    name: 'Edgar Markov', type_line: 'Legendary Creature — Vampire Knight',
    color_identity: ['W', 'B', 'R'], image_uris: art('a1b2c3d4-0000-4000-8000-000000000002'),
  },
  {
    object: 'card', id: 'a1b2c3d4-0000-4000-8000-000000000003', oracle_id: 'oracle-kenrith',
    name: 'Kenrith, the Returned King', type_line: 'Legendary Creature — Human Noble',
    color_identity: ['W', 'U', 'B', 'R', 'G'], image_uris: art('a1b2c3d4-0000-4000-8000-000000000003'),
  },
  {
    // Double-faced: the images live on the faces, not on the card.
    object: 'card', id: 'a1b2c3d4-0000-4000-8000-000000000004', oracle_id: 'oracle-esika',
    name: 'Esika, God of the Tree // The Prismatic Bridge', type_line: 'Legendary Creature — God // Legendary Enchantment',
    color_identity: ['W', 'U', 'B', 'R', 'G'],
    card_faces: [
      { name: 'Esika, God of the Tree', image_uris: art('a1b2c3d4-0000-4000-8000-000000000004') },
      { name: 'The Prismatic Bridge', image_uris: art('a1b2c3d4-0000-4000-8000-000000000005') },
    ],
  },
];

/** What /cards/search answers for a query (by name, like Scryfall). */
export function searchResponse(query) {
  const q = String(query || '').trim().toLowerCase();
  const data = CARDS.filter((c) => c.name.toLowerCase().includes(q));
  return { object: 'list', total_cards: data.length, has_more: false, data };
}

/** The names, for journeys that pick a commander per seat. */
export const SEARCHES = ['atraxa', 'krenko', 'edgar', 'kenrith', 'esika'];
