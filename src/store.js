/**
 * Persistencia local (localStorage) + notificacao de mudanca.
 *
 * Guardamos a partida em andamento separada do historico: fechar o navegador
 * no meio de um jogo nao pode custar a mesa. Toda gravacao e sincrona e barata
 * porque o volume e pequeno (algumas centenas de eventos por partida).
 */

import { chave } from './canal.js';
import { identityOf } from './stats.js';
import { partidaValida } from './engine.js';

const KEY = chave('mtglc.db.v1');

const EMPTY = {
  version: 1,
  current: null,
  history: [],
  // Ids de partidas que ja foram para a nuvem.
  //
  // Existe porque quem nao assina CONSEGUE subir mas nao consegue baixar: sem
  // esta anotacao, a cada abertura o aparelho acharia que a nuvem esta vazia e
  // reenviaria o historico inteiro, para sempre.
  enviadas: [],
  commanders: {}, // oracleId -> commander (reuso offline)
  playerNames: [],
  // Nome de jogador -> @ da conta dele. Grupo de Commander joga toda
  // semana com a mesma gente: digitar o @ de novo a cada mesa seria o
  // tipo de atrito que faz o recurso nao ser usado.
  playerHandles: {},
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
      // Cura o que ja entrou.
      //
      // Filtrar a porta de entrada protege daqui para a frente, mas nao limpa o
      // aparelho de quem ja sincronizou antes do conserto - e um registro sem
      // seats derruba a tela toda vez que ela abre. Descartar aqui e seguro
      // porque uma partida sem assentos nem eventos nao tem nada a perder: ela
      // ja nao pode ser lida por ninguem.
      history: (parsed.history || []).filter(partidaValida),
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

/**
 * O historico, so com o que tem forma de partida.
 *
 * A porta de ENTRADA ja filtra e a leitura do disco tambem cura o que passou
 * antes. Esta e a terceira camada, e ela existe porque as duas primeiras cobrem
 * caminhos conhecidos: um registro quebrado por um caminho que ainda nao existe
 * derrubaria a tela inteira, e tela preta nao diz nada a ninguem. Quem LE o
 * historico para desenhar deve usar isto.
 */
export function partidas() {
  return (db.history || []).filter(partidaValida);
}

/** Ids ja enviados para a nuvem. */
export function enviadas() {
  return [...(db.enviadas || [])];
}

export function marcarEnviada(matchId) {
  if (!matchId) return;
  if (!db.enviadas) db.enviadas = [];
  if (!db.enviadas.includes(matchId)) {
    db.enviadas.push(matchId);
    save();
  }
}

/** Apagou a partida: a marca tambem sai, senao ela nunca mais subiria. */
export function esquecerEnviada(matchId) {
  if (!db.enviadas || !db.enviadas.includes(matchId)) return;
  db.enviadas = db.enviadas.filter((x) => x !== matchId);
  save();
}

/**
 * Junta partidas vindas da nuvem ao historico daqui.
 *
 * Por id, e sem sobrescrever o que ja existe: partida encerrada e imutavel, e
 * a copia local pode ter algo que a remota nao tem se algum envio falhou pela
 * metade. Na duvida, o que ja esta aqui manda.
 */
export function mesclarPartidas(lista) {
  const aqui = new Set(db.history.map((m) => m && m.id));
  // Descarta o que nao tem forma de partida. O historico e lido por replay() e
  // pelas estatisticas, que assumem seats e events - uma linha quebrada aqui
  // dentro nao fica quieta, derruba a tela.
  const novas = (lista || []).filter((m) => partidaValida(m) && !aqui.has(m.id));
  if (!novas.length) return 0;
  db.history = [...db.history, ...novas]
    .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  save();
  return novas.length;
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

/** Guarda a que conta um nome de jogador corresponde. */
export function rememberHandle(name, handle) {
  const nome = String(name || '').trim();
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!nome) return;
  if (!db.playerHandles) db.playerHandles = {};
  if (h) db.playerHandles[nome.toLowerCase()] = h;
  else delete db.playerHandles[nome.toLowerCase()];
  save();
}

/** O @ ja conhecido deste jogador, se houver. */
export function handleOf(name) {
  const nome = String(name || '').trim().toLowerCase();
  return (db.playerHandles && db.playerHandles[nome]) || '';
}

export function knownPlayers() {
  return db.playerNames;
}

export function forgetPlayer(name) {
  // O @ acompanha o nome: esquecer pela metade deixaria a conta de outra
  // pessoa presa a um jogador que ja nao existe mais na lista.
  if (db.playerHandles) delete db.playerHandles[String(name || '').trim().toLowerCase()];
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
/** Nome (minusculo) -> handle, do que este aparelho ja viu. */
export function knownHandles() {
  return { ...(db.playerHandles || {}) };
}

/**
 * Os decks desta PESSOA, nao deste nome.
 *
 * Com conta vinculada, os comandantes seguem a conta: quem foi cadastrado como
 * "Alex" numa quinta e "Alexandre" na outra continua vendo os proprios decks,
 * porque a busca e pela identidade e nao pelo texto que alguem digitou.
 */
export function decksOfPlayer(name, handle) {
  const apelidos = db.playerHandles || {};
  const key = identityOf({ name, handle }, apelidos);
  if (!key || key === '?') return [];

  const seen = new Map();
  for (const match of db.history) { // historico ja vem do mais recente
    for (const seat of match.seats || []) {
      if (identityOf(seat, apelidos) !== key) continue;
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
    if (partidaValida(m)) byId.set(m.id, m);
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
