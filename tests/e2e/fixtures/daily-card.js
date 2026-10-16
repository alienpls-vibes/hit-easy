/**
 * Scryfall's answers for the daily challenge, in Scryfall's own shape.
 *
 * The journey cannot know which card the real calendar puts on the day it
 * runs, so the fake answers ANY name with the same green card built around
 * that name - the name in the rules and flavor text, a {G} in a cost - which
 * is exactly what the masking has to hide. Portuguese and Spanish have a
 * print; any other language does not, so the English fallback is exercised.
 */

export const DAILY_COLORS = ['G'];
export const PRINTED_NAME = 'Guardiã do Bosque Secreto';

const IMAGE = 'https://cards.scryfall.io/normal/front/d/a/daily.jpg?1';

function englishCard(name) {
  return {
    object: 'card',
    lang: 'en',
    name,
    type_line: 'Creature — Elf Druid',
    oracle_text: `Reach\n{1}{G}, {T}: ${name} deals 2 damage to target creature with flying.`,
    flavor_text: `"${name} never misses."`,
    cmc: 3,
    power: '2',
    toughness: '3',
    colors: DAILY_COLORS,
    artist: 'Test Artist',
    scryfall_uri: 'https://scryfall.com/card/tst/1/daily',
    image_uris: { normal: IMAGE },
  };
}

function printOf(name, lang) {
  return {
    ...englishCard(name),
    lang,
    printed_name: PRINTED_NAME,
    printed_type_line: 'Criatura — Elfo Druida',
    printed_text: `Alcance\n{1}{G}, {T}: ${PRINTED_NAME} causa 2 pontos de dano à criatura alvo com voar.`,
  };
}

/**
 * The answer for a Scryfall URL, or null when it is not a daily request.
 * `{ status, body }` like the fake cloud.
 */
export function dailyResponse(url) {
  if (url.pathname === '/cards/named') {
    return { status: 200, body: englishCard(url.searchParams.get('exact') || '') };
  }
  const q = url.searchParams.get('q') || '';
  const m = /^!"(.+)" lang:(\w+)$/.exec(q);
  if (url.pathname !== '/cards/search' || !m) return null;
  const [, name, lang] = m;
  if (lang !== 'pt' && lang !== 'es') return { status: 404, body: { object: 'error', code: 'not_found' } };
  return { status: 200, body: { object: 'list', total_cards: 1, has_more: false, data: [printOf(name, lang)] } };
}
