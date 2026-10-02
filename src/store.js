/**
 * Persistencia local (localStorage) + notificacao de mudanca.
 *
 * Guardamos a partida em andamento separada do historico: fechar o navegador
 * no meio de um jogo nao pode custar a mesa. Toda gravacao e sincrona e barata
 * porque o volume e pequeno (algumas centenas de eventos por partida).
 */

import { chave } from './canal.js';
import { identityOf } from './stats.js';
import { partidaValida, juntarDecks } from './engine.js';

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
  // @ -> decks que seguem aquela conta, vindos do perfil no servidor.
  //
  // So a propria conta escreve a propria lista (ver sql/004-decks-da-conta),
  // entao isto e cache de uma coisa so: os decks de quem esta logado. Serve ao
  // aparelho novo, onde o historico local esta vazio.
  decksDeConta: {},
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
    versaoVista: null,
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
      // Ocultos passam a ser chaveados por IDENTIDADE (ver migrarOcultos).
      hiddenPlayers: migrarOcultos(parsed.hiddenPlayers, parsed.playerHandles),
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

/**
 * Ocultos passam a ser chaveados por identidade, e nao pelo nome mostrado.
 *
 * A tela ocultava o rotulo, que era o nome digitado. Quando a pessoa ganhava
 * conta a identidade dela virava `@handle`, a chave deixava de casar e a linha
 * reaparecia - o "ocultar" se desfazia sozinho, sem ninguem pedir.
 *
 * Reescreve uma vez, na leitura. Para quem nao tem conta a identidade JA e o
 * nome em minusculas, entao a esmagadora maioria das entradas antigas
 * atravessa sem mudar.
 */
function migrarOcultos(ocultos, apelidos) {
  const vistos = new Set();
  for (const entrada of ocultos || []) {
    const nome = String(entrada || '').trim().toLowerCase();
    if (!nome) continue;
    if (nome.startsWith('@')) { vistos.add(nome); continue; }
    const handle = apelidos && apelidos[nome];
    vistos.add(handle ? '@' + String(handle).toLowerCase() : nome);
  }
  return [...vistos];
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

/**
 * Grava de volta uma partida do historico, sem mexer na partida em andamento.
 *
 * archive() serve para ENCERRAR - ele zera `current` como parte do trabalho.
 * Usar archive para editar um registro antigo apagaria a mesa que esta
 * acontecendo agora, o que seria um estrago silencioso e absurdo.
 */
export function atualizarPartida(match) {
  if (!partidaValida(match)) return false;
  const onde = db.history.findIndex((m) => m.id === match.id);
  if (onde < 0) return false;
  db.history[onde] = match;
  save();
  return true;
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
/**
 * Guarda os decks que vieram do perfil daquela conta.
 *
 * Por handle, e nao numa lista so: entrar com outra conta no mesmo aparelho
 * nao pode misturar os decks de duas pessoas.
 */
export function guardarDecksDaConta(handle, decks) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!h || !Array.isArray(decks)) return;
  if (!db.decksDeConta) db.decksDeConta = {};
  db.decksDeConta[h] = decks
    .filter((d) => d && Array.isArray(d.commanders) && d.commanders.length)
    .slice(0, 200);
  save();
}

/** Os decks que seguem aquela conta, do que este aparelho ja baixou. */
export function decksDaConta(handle) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  return (db.decksDeConta && db.decksDeConta[h]) || [];
}

/** Nome (minusculo) -> handle, do que este aparelho ja viu. */
export function knownHandles() {
  return { ...(db.playerHandles || {}) };
}

/**
 * Guarda um apelido APRENDIDO, sem sobrescrever o que este aparelho decidiu.
 *
 * Diferente de rememberHandle, que e a pessoa marcando na mao. Este entra pelo
 * que chega da nuvem, e ai a regra e outra: uma partida baixada pode dizer que
 * "Alexandre" e @alex, mas se este aparelho ja tem "Alexandre" apontando para
 * outra conta, quem decide e quem esta aqui. Divergencia nao se resolve
 * adivinhando - fica como esta, e a pessoa marca na mao se quiser.
 *
 * Devolve se, no fim, o nome aponta para esse handle.
 */
export function aprenderApelido(name, handle) {
  const nome = String(name || '').trim().toLowerCase();
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!nome || !h) return false;
  if (!db.playerHandles) db.playerHandles = {};

  const atual = db.playerHandles[nome];
  if (atual) return atual === h;

  db.playerHandles[nome] = h;
  // Aprender a conta de alguem que este aparelho nunca digitou tambem o
  // acrescenta a lista de selecao: e uma pessoa que a mesa ja conhece.
  if (!db.playerNames.some((n) => String(n).trim().toLowerCase() === nome)) {
    db.playerNames = [...db.playerNames, name].slice(0, 30);
  }
  save();
  return true;
}

/**
 * As PESSOAS que este aparelho conhece - uma linha por pessoa, nao por nome.
 *
 * A lista de selecao mostrava `playerNames` cru, entao quem foi digitado como
 * "Alex" numa quinta e "Alexandre" na outra aparecia duas vezes, cada uma com
 * metade dos decks. Aqui os nomes que apontam para a mesma conta se juntam, e
 * a linha passa a se chamar pelo @.
 *
 * A ordem de `playerNames` (mais recente primeiro) e preservada: a pessoa
 * herda a posicao do nome mais recente dela.
 */
export function pessoasConhecidas() {
  const apelidos = db.playerHandles || {};
  const porChave = new Map();

  for (const nome of db.playerNames) {
    const limpo = String(nome || '').trim();
    if (!limpo) continue;
    // Mesma regra de chave da estatistica, e de proposito: se as duas
    // divergirem, a lista de selecao e a lista de jogadores falam de pessoas
    // diferentes com o mesmo nome na tela.
    const chave = identityOf({ name: limpo }, apelidos);
    if (!porChave.has(chave)) {
      const handle = chave.startsWith('@') ? chave.slice(1) : '';
      porChave.set(chave, {
        chave,
        handle,
        label: handle ? '@' + handle : limpo,
        nomes: [],
      });
    }
    porChave.get(chave).nomes.push(limpo);
  }

  return [...porChave.values()];
}

/** Os nomes que este aparelho ja ligou a esta conta. */
export function nomesDaPessoa(handle) {
  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (!h) return [];
  const apelidos = db.playerHandles || {};
  return Object.keys(apelidos).filter((nome) => apelidos[nome] === h);
}

/**
 * Esquece a PESSOA, e nao um dos nomes dela.
 *
 * Esquecer so um nome deixaria a mesma pessoa meio na lista: o @ continuaria
 * conhecido pelos outros nomes, e a linha voltaria na proxima abertura.
 */
export function esquecerPessoa(chave) {
  const alvo = String(chave || '').trim().toLowerCase();
  const pessoa = pessoasConhecidas().find((x) => x.chave === alvo);
  for (const nome of (pessoa ? pessoa.nomes : [alvo])) forgetPlayer(nome);
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

  const locais = [];
  for (const match of db.history) { // historico ja vem do mais recente
    for (const seat of match.seats || []) {
      if (identityOf(seat, apelidos) !== key) continue;
      if (!(seat.commanders || []).length) continue;
      locais.push({ commanders: seat.commanders, lastUsed: match.startedAt });
    }
  }

  // Com conta, os decks que seguem a conta entram junto. Num aparelho novo o
  // historico local esta vazio, e sem isto a pessoa nao acha o proprio deck -
  // tendo de buscar na Scryfall o comandante que o app ja conhece.
  const daConta = key.startsWith('@') ? decksDaConta(key.slice(1)) : [];
  return juntarDecks(locais, daConta);
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

/**
 * Oculta uma pessoa das listas. Recebe a IDENTIDADE, nao o rotulo.
 *
 * Com o rotulo, ocultar se desfazia sozinho: a pessoa ganhava conta, o rotulo
 * virava @alex, a chave guardada continuava "alexandre" e a linha reaparecia.
 */
export function hidePlayer(identidade) {
  const chave = String(identidade || '').trim().toLowerCase();
  if (!chave || db.hiddenPlayers.includes(chave)) return;
  db.hiddenPlayers.push(chave);
  save();
}

export function unhideDeck(deckKey) {
  db.hiddenDecks = db.hiddenDecks.filter((k) => k !== deckKey);
  save();
}

export function unhidePlayer(identidade) {
  const chave = String(identidade || '').trim().toLowerCase();
  db.hiddenPlayers = db.hiddenPlayers.filter((k) => k !== chave);
  save();
}

export function isDeckHidden(deckKey) {
  return db.hiddenDecks.includes(deckKey);
}

export function isPlayerHidden(identidade) {
  return db.hiddenPlayers.includes(String(identidade || '').trim().toLowerCase());
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
