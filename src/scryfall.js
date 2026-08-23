import { chave } from './canal.js';
/**
 * Busca de comandantes na Scryfall.
 *
 * Regras da casa (documentadas pela Scryfall): no maximo ~10 req/s e um
 * User-Agent identificavel. O debounce da UI ja segura isso com folga, e todo
 * resultado vai pro cache local - decks ja usados continuam funcionando offline.
 */

const API = 'https://api.scryfall.com';
const CACHE_KEY = chave('mtglc.scryfallCache.v1');
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias
const MIN_INTERVAL = 120; // ms entre chamadas

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
    // Mantem o cache enxuto: as 200 buscas mais recentes bastam.
    const entries = Object.entries(cache).sort((a, b) => b[1].ts - a[1].ts).slice(0, 200);
    cache = Object.fromEntries(entries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* cota estourada: seguir sem cache e melhor que quebrar a busca */
  }
}

/** Reduz o card da Scryfall ao minimo que o app precisa guardar. */
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
 * Procura comandantes legais por nome.
 * Retorna [] quando nao ha resultado (a Scryfall responde 404 nesse caso).
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

  // order=edhrec + dir=asc: rank menor = mais jogado, entao o comandante que a
  // pessoa provavelmente quer aparece na primeira linha. Com dir=desc a lista
  // vem exatamente ao contrario.
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
  if (!res.ok) throw new Error('Scryfall respondeu ' + res.status);

  const data = await res.json();
  const results = (data.data || []).slice(0, 24).map(toCommander);
  cache[key] = { ts: Date.now(), results };
  persist();
  return results;
}

/** Falha silenciosa: sem rede, a UI cai nos decks ja salvos. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
