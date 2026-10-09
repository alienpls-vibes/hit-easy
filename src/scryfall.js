import { storageKey } from './channel.js';
/**
 * Commander search on Scryfall.
 *
 * House rules (documented by Scryfall): at most ~10 req/s and an identifiable
 * User-Agent. The UI debounce already keeps well within that, and every
 * result goes to the local cache - decks already used keep working offline.
 */

const API = 'https://api.scryfall.com';
const CACHE_KEY = storageKey('mtglc.scryfallCache.v1');
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days
const MIN_INTERVAL = 120; // ms between calls

let lastCall = 0;
let cache = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    // Keeps the cache lean: the 200 most recent searches are enough.
    const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 200);
    cache = Object.fromEntries(entries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded: carrying on without a cache beats breaking the search */
  }
}

/** Reduces the Scryfall card to the minimum the app needs to keep. */
function toCommander(card) {
  const face = card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris
    ? card.card_faces[0]
    : card;
  const imgs = face.image_uris || {};
  return {
    oracleId: card.oracle_id,
    scryfallId: card.id,
    name: card.name,
    typeLine: card.type_line || '',
    colors: card.color_identity || [],
    art: imgs.art_crop || imgs.normal || null,
    thumb: imgs.art_crop || imgs.small || null,
  };
}

/**
 * Searches legal commanders by name.
 * Returns [] when there is no result (Scryfall answers 404 in that case).
 */
export async function searchCommanders(query, { signal } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const key = q.toLowerCase();
  const hit = cache[key];
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.results;

  const wait = MIN_INTERVAL - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  // order=edhrec + dir=asc: a lower rank = more played, so the commander the
  // person probably wants shows up on the first row. With dir=desc the list
  // comes exactly the other way around.
  const url =
    API +
    '/cards/search?q=' +
    encodeURIComponent(q + ' is:commander') +
    '&unique=cards&order=edhrec&dir=asc';

  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (res.status === 404) {
    cache[key] = { ts: Date.now(), results: [] };
    persist();
    return [];
  }
  if (!res.ok) throw new Error('Scryfall responded ' + res.status);

  const data = await res.json();
  const results = (data.data || []).slice(0, 24).map(toCommander);
  cache[key] = { ts: Date.now(), results };
  persist();
  return results;
}

/** Silent failure: with no network, the UI falls back to the saved decks. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
