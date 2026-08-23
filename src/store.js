/**
 * Persistencia local (localStorage) + notificacao de mudanca.
 *
 * Guardamos a partida em andamento separada do historico: fechar o navegador
 * no meio de um jogo nao pode custar a mesa. Toda gravacao e sincrona e barata
 * porque o volume e pequeno (algumas centenas de eventos por partida).
 */

const KEY = 'mtglc.db.v1';

const EMPTY = {
  version: 1,
  current: null,
  history: [],
  commanders: {}, // oracleId -> commander (reuso offline)
  playerNames: [],
  // Escondidos das estatisticas, e so delas: as partidas continuam
  // inteiras, com todos os eventos e a linha do tempo completa.
  hiddenDecks: [],
  hiddenPlayers: [],
  settings: {
    startingLife: 40,
    lang: null,           // null = seguir o navegador
    theme: 'sistema',     // 'sistema' | 'claro' | 'escuro'
    haptics: true,
    keepAwake: true,
    autoRotate: true,     // tenta tela cheia + travar deitado na partida
    dragHintSeen: false,
  },
};

let db = read();
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    // settings entra por merge raso, e nao por substituicao: quem ja usava o
    // app antes de uma preferencia existir precisa herdar o padrao dela.
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Falha ao gravar dados locais', err);
  }
  listeners.forEach((fn) => fn(db));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getDB() {
  return db;
}

export function getCurrent() {
  return db.current;
}

export function setCurrent(match) {
  db.current = match;
  save();
}

export function clearCurrent() {
  db.current = null;
  save();
}

/** Move a partida para o historico e libera o slot da mesa. */
export function archive(match) {
  const already = db.history.findIndex((m) => m.id === match.id);
  const record = { ...match, redo: [] };
  if (already >= 0) db.history[already] = record;
  else db.history.unshift(record);
  db.current = null;
  save();
}

export function deleteMatch(matchId) {
  db.history = db.history.filter((m) => m.id !== matchId);
  save();
}

export function rememberCommander(commander) {
  if (!commander || !commander.oracleId) return;
  db.commanders[commander.oracleId] = { ...commander, lastUsed: Date.now() };
  save();
}

/** Comandantes ja usados, do mais recente para o mais antigo. */
export function recentCommanders(limit = 24) {
  return Object.values(db.commanders)
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    .slice(0, limit);
}

export function rememberPlayer(name) {
  const clean = String(name || '').trim();
  if (!clean) return;
  db.playerNames = [clean, ...db.playerNames.filter((n) => n !== clean)].slice(0, 30);
  save();
}

export function knownPlayers() {
  return db.playerNames;
}

export function forgetPlayer(name) {
  const clean = String(name || '').trim();
  db.playerNames = db.playerNames.filter((n) => n !== clean);
  save();
}

/**
 * Decks que este jogador ja levou, do mais recente para o mais antigo.
 *
 * Derivado do historico em vez de guardado a parte: o que ele jogou ja esta
 * escrito nas partidas salvas, e duplicar isso so criaria uma segunda verdade
 * para sair de sincronia depois.
 */
export function decksOfPlayer(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return [];

  const seen = new Map();
  for (const match of db.history) { // historico ja vem do mais recente
    for (const seat of match.seats || []) {
      if ((seat.name || '').trim().toLowerCase() !== key) continue;
      const deckKey = (seat.commanders || []).map((c) => c.oracleId).sort().join('+');
      if (!deckKey || seen.has(deckKey)) continue;
      seen.set(deckKey, { commanders: seat.commanders, lastUsed: match.startedAt });
    }
  }
  return [...seen.values()];
}

/**
 * Some com um deck ou jogador das estatisticas.
 *
 * NAO apaga partida nenhuma: o historico continua igual, a linha do tempo
 * continua contando o que aconteceu, e o dano que essa pessoa causou continua
 * somando nas estatisticas de quem levou. So a LINHA dela deixa de aparecer -
 * e da para trazer de volta a qualquer momento.
 *
 * E por isso que isto vive aqui, e nao em deleteMatch: sao coisas diferentes.
 */
export function hideDeck(deckKey) {
  if (!deckKey || db.hiddenDecks.includes(deckKey)) return;
  db.hiddenDecks.push(deckKey);
  save();
}

export function hidePlayer(name) {
  const chave = String(name || '').trim().toLowerCase();
  if (!chave || db.hiddenPlayers.includes(chave)) return;
  db.hiddenPlayers.push(chave);
  save();
}

export function unhideDeck(deckKey) {
  db.hiddenDecks = db.hiddenDecks.filter((k) => k !== deckKey);
  save();
}

export function unhidePlayer(name) {
  const chave = String(name || '').trim().toLowerCase();
  db.hiddenPlayers = db.hiddenPlayers.filter((k) => k !== chave);
  save();
}

export function isDeckHidden(deckKey) {
  return db.hiddenDecks.includes(deckKey);
}

export function isPlayerHidden(name) {
  return db.hiddenPlayers.includes(String(name || '').trim().toLowerCase());
}

export function hiddenCount() {
  return db.hiddenDecks.length + db.hiddenPlayers.length;
}

export function setSetting(key, value) {
  db.settings[key] = value;
  save();
}

export function exportJSON() {
  return JSON.stringify(db, null, 2);
}

/** Importa um backup. Faz merge do historico por id, sem duplicar partidas. */
export function importJSON(text) {
  const incoming = JSON.parse(text);
  if (!incoming || typeof incoming !== 'object') throw new Error('Arquivo invalido');

  const byId = new Map();
  for (const m of [...(db.history || []), ...(incoming.history || [])]) {
    if (m && m.id) byId.set(m.id, m);
  }
  db = {
    ...structuredClone(EMPTY),
    ...db,
    ...incoming,
    history: [...byId.values()].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)),
    commanders: { ...(db.commanders || {}), ...(incoming.commanders || {}) },
    current: db.current || incoming.current || null,
  };
  save();
  return db;
}

export function wipe() {
  db = structuredClone(EMPTY);
  save();
}
