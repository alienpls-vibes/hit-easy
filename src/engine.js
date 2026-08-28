/**
 * Motor da partida - event sourcing puro.
 *
 * Nada de estado mutavel espalhado: a partida E a lista de eventos, e o estado
 * visivel e sempre `replay(match)`. Isso da tres coisas de graca:
 *   1. desfazer/refazer = tirar/por o ultimo evento e reprocessar;
 *   2. estatisticas exatas, porque o historico e a fonte da verdade;
 *   3. nenhuma chance de o placar divergir do log.
 *
 * `sourceId` nunca e adivinhado: ou o gesto declarou a direcao (arrastar do
 * causador ate o alvo), ou fica null. Vida perdida sem origem e vida paga pelo
 * proprio jogador - fetchland, Necropotence, custo de habilidade -, que e coisa
 * diferente de dano levado e conta separado nas estatisticas.
 *
 * Eventos (todos com id, ts, turn, activeSeatId):
 *   life    { targetId, delta, sourceId }          delta negativo = perda
 *   cmd     { targetId, sourceId, cmdKey, delta }  dano de comandante (tambem tira vida)
 *   poison  { targetId, delta, sourceId }
 *   sweep   { sourceId, amount, gain, targets }    atinge varios de uma vez
 *   turn    {}                                     passa a vez
 *   pause   {} / resume {}                         relogio parado
 *   vote    { question, kind, options, ballots }  votacao secreta (so registro)
 *   concede { targetId }
 *   win     { targetId, reason }                   vitoria declarada na mao
 *
 * `sweep` guarda a lista de alvos em vez de recalcular "quem estava vivo": o
 * evento descreve exatamente o que fez, entao desfazer e um evento so, as
 * estatisticas nao precisam reconstruir estado, e o historico continua legivel
 * anos depois.
 */

import { t } from './i18n.js';

export const DEFAULT_LIFE = 40;
export const POISON_LETHAL = 10;
export const CMD_LETHAL = 21;

let seq = 0;
export function uid(prefix = 'id') {
  seq += 1;
  return prefix + '_' + Date.now().toString(36) + '_' + seq.toString(36);
}

/** Chave estavel de um comandante - parceiros contam separado no dano de comandante. */
export function cmdKeyOf(seatId, commander) {
  return seatId + ':' + commander.oracleId;
}

/** Chave do deck: combinacao de comandantes, independente da ordem. */
export function deckKeyOf(commanders) {
  return (commanders || []).map((c) => c.oracleId).sort().join('+');
}

export function deckNameOf(commanders) {
  return (commanders || []).map((c) => c.name).join(' // ') || t('tl.noCommander');
}

export function createMatch(seats, startingLife = DEFAULT_LIFE, options = {}) {
  const built = seats.map((s) => ({
    id: s.id || uid('seat'),
    name: s.name,
    commanders: s.commanders.map((c) => ({ ...c })),
    // A conta vinculada faz parte do assento, nao da tela de montagem.
    //
    // Sem estes dois campos aqui, o @ escolhido na mesa morria no rascunho: a
    // partida gravada nao sabia de conta nenhuma, participantesDe() nunca
    // achava uma cadeira para convidar, e a estatistica so tinha o nome
    // digitado - que e exatamente o que nao identifica ninguem.
    handle: s.handle || null,
    userId: s.userId || null,
  }));
  const first = built.find((s) => s.id === options.firstSeatId);

  return {
    id: uid('match'),
    startedAt: Date.now(),
    endedAt: null,
    startingLife,
    seats: built,
    // Quem abre a partida. Nao e necessariamente o primeiro assento: a mesa
    // fisica e uma coisa, quem ganhou o dado e outra.
    firstSeatId: first ? first.id : built[0] && built[0].id,
    layoutId: options.layoutId || null,
    events: [],
    redo: [],
  };
}

/**
 * Reconstroi o estado completo a partir do log.
 * Funcao pura: mesmo match, mesmo resultado, sempre.
 */
export function replay(match) {
  const order = match.seats.map((s) => s.id);
  const players = {};
  for (const seat of match.seats) {
    players[seat.id] = {
      id: seat.id,
      name: seat.name,
      commanders: seat.commanders,
      life: match.startingLife,
      poison: 0,
      cmd: {}, // dano de comandante RECEBIDO, por cmdKey de origem
      conceded: false,
      dead: false,
      elim: null, // { turn, ts, byId, place }
      turnsTaken: 0,
      timeOnTurn: 0,
    };
  }

  const firstIdx = Math.max(0, order.indexOf(match.firstSeatId));
  let turn = 1;
  // `turn` conta VOLTAS da mesa; este conta turnos de JOGADOR.
  //
  // Para a classificacao a diferenca importa: morrer no meu turno e morrer no
  // turno do vizinho sao coisas distintas, e a volta e grossa demais para
  // separa-las. Serve so para saber quem caiu junto com quem.
  let turnoAtual = 0;
  let activeIdx = firstIdx;
  let turnStart = match.startedAt;
  const elimOrder = [];
  let declaredWinner = null;

  // Relogio parado: o tempo entre pause e resume nao conta em lugar nenhum.
  let paused = false;
  let pauseStart = 0;
  let pausedTotal = 0;  // da partida inteira
  let pausedInTurn = 0; // desde o inicio do turno atual

  /** Fecha a conta da pausa em aberto ate `ts`, sem encerra-la. */
  const settlePause = (ts) => {
    if (!paused) return;
    const d = Math.max(0, ts - pauseStart);
    pausedTotal += d;
    pausedInTurn += d;
    pauseStart = ts;
  };

  const settleDeaths = (ev) => {
    for (const id of order) {
      const p = players[id];
      const cmdValues = Object.values(p.cmd);
      const worstCmd = cmdValues.length ? Math.max.apply(null, cmdValues) : 0;
      const shouldBeDead =
        p.conceded || p.life <= 0 || p.poison >= POISON_LETHAL || worstCmd >= CMD_LETHAL;

      if (shouldBeDead && !p.dead) {
        p.dead = true;
        // So creditamos a morte a quem causou o evento que a provocou - e um
        // sweep mata todos os seus alvos em nome de quem o disparou.
        const atingido = ev
          && (ev.targetId === id || (ev.targets && ev.targets.includes(id)));
        const byId = atingido ? ev.sourceId || null : null;
        p.elim = { turn, seq: turnoAtual, ts: ev ? ev.ts : Date.now(), byId, place: 0 };
        elimOrder.push(id);
      } else if (!shouldBeDead && p.dead) {
        p.dead = false;
        p.elim = null;
        const at = elimOrder.indexOf(id);
        if (at >= 0) elimOrder.splice(at, 1);
      }
    }
    elimOrder.forEach((id, i) => {
      if (players[id].elim) players[id].elim.place = i + 1;
    });
  };

  const advanceTurn = (ev) => {
    const current = players[order[activeIdx]];
    if (current) {
      // Tempo do turno desconta o que a mesa passou pausada dentro dele.
      current.timeOnTurn += Math.max(0, ev.ts - turnStart - pausedInTurn);
      current.turnsTaken += 1;
    }
    pausedInTurn = 0;
    turnStart = ev.ts;

    const aliveNow = order.filter((id) => !players[id].dead);
    if (aliveNow.length === 0) return;

    // Anda ate o proximo assento vivo. A volta da mesa fecha quando o caminho
    // CRUZA o assento que abriu a partida - inclusive se ele ja morreu, senao
    // a contagem de turnos escorregaria com o primeiro jogador eliminado.
    let next = activeIdx;
    let novaVolta = false;
    for (let i = 1; i <= order.length; i += 1) {
      const cand = (activeIdx + i) % order.length;
      if (cand === firstIdx) novaVolta = true;
      if (!players[order[cand]].dead) {
        next = cand;
        break;
      }
    }
    if (novaVolta) turn += 1;
    turnoAtual += 1;
    activeIdx = next;
  };

  for (const ev of match.events) {
    settlePause(ev.ts); // qualquer evento fecha a conta da pausa ate aqui
    const p = players[ev.targetId];
    switch (ev.type) {
      case 'life':
        if (p) p.life += ev.delta;
        break;
      case 'sweep':
        for (const id of ev.targets || []) {
          if (players[id]) players[id].life -= ev.amount;
        }
        if (ev.gain && players[ev.sourceId]) players[ev.sourceId].life += ev.gain;
        break;
      case 'pause':
        if (!paused) { paused = true; pauseStart = ev.ts; }
        break;
      case 'resume':
        paused = false;
        break;
      case 'cmd':
        if (p) {
          p.cmd[ev.cmdKey] = Math.max(0, (p.cmd[ev.cmdKey] || 0) + ev.delta);
          p.life -= ev.delta; // dano de comandante tambem sai da vida
        }
        break;
      case 'poison':
        if (p) p.poison = Math.max(0, p.poison + ev.delta);
        break;
      case 'turn':
        advanceTurn(ev);
        break;
      case 'concede':
        if (p) p.conceded = true;
        break;
      case 'win':
        declaredWinner = ev.targetId;
        break;
      default:
        break;
    }
    settleDeaths(ev);
  }

  // Se o assento ativo morreu, a vez pertence ao proximo vivo.
  if (players[order[activeIdx]] && players[order[activeIdx]].dead) {
    let nextAlive = -1;
    for (let i = activeIdx + 1; i < order.length; i += 1) {
      if (!players[order[i]].dead) { nextAlive = i; break; }
    }
    if (nextAlive < 0) nextAlive = order.findIndex((id) => !players[id].dead);
    activeIdx = nextAlive < 0 ? 0 : nextAlive;
  }

  const alive = order.filter((id) => !players[id].dead);
  let winnerId = declaredWinner;
  if (!winnerId && order.length > 1 && alive.length === 1) winnerId = alive[0];

  const lastTs = match.events.length ? match.events[match.events.length - 1].ts : match.startedAt;
  settlePause(lastTs); // pausa ainda aberta conta ate o ultimo evento do log

  return {
    players,
    order,
    turn,
    activeIdx,
    activeSeatId: order[activeIdx],
    turnStart,
    elimOrder,
    alive,
    finished: Boolean(winnerId) || (order.length > 1 && alive.length === 0),
    winnerId: winnerId || null,
    endedAt: winnerId ? lastTs : null,
    startedAt: match.startedAt,
    paused,
    // `pausedSince` deixa a UI mostrar a pausa correndo sem que replay deixe de
    // ser puro: o relogio de agora e conta de quem desenha, nao do motor.
    pausedSince: paused ? pauseStart : null,
    pausedTotal,
  };
}

/** Tempo de partida ja descontado o que ficou pausado, inclusive agora. */
export function elapsedOf(match, state, now = Date.now()) {
  const st = state || replay(match);
  const fim = st.endedAt || now;
  const pausaCorrendo = st.paused && !st.endedAt ? Math.max(0, now - st.pausedSince) : 0;
  return Math.max(0, fim - match.startedAt - st.pausedTotal - pausaCorrendo);
}

/** Anexa um evento, carimbando turno/assento ativo do momento. */
export function push(match, partial) {
  const state = replay(match);
  const ev = {
    id: uid('ev'),
    ts: Date.now(),
    turn: state.turn,
    activeSeatId: state.activeSeatId,
    sourceId: null,
    ...partial,
  };
  match.events.push(ev);
  match.redo = [];
  return ev;
}

export function undo(match) {
  if (!match.events.length) return null;
  const ev = match.events.pop();
  match.redo = match.redo || [];
  match.redo.push(ev);
  return ev;
}

export function redo(match) {
  if (!match.redo || !match.redo.length) return null;
  const ev = match.redo.pop();
  match.events.push(ev);
  return ev;
}

export function canUndo(match) {
  return match.events.length > 0;
}

export function canRedo(match) {
  return Boolean(match.redo && match.redo.length);
}

/** Colocacao final: 1o e o vencedor, depois a ordem inversa de eliminacao. */
/**
 * A classificacao da mesa, com empate por turno.
 *
 * Quem morre no MESMO turno cai junto. Se alguem elimina os tres oponentes de
 * uma vez, nao ha nada que separe esses tres - eles nao se sobreviveram, e a
 * ordem em que o motor processou os eventos e um detalhe interno que nao
 * significa nada na mesa. Desempatar por ali seria inventar um resultado.
 *
 * O grupo empatado recebe a PIOR colocacao que ele ocupa: tres mortos juntos
 * numa mesa de quatro ficam todos em 4o, e nao em 2o. E o que a mesa entende
 * por "ficamos todos em ultimo" - dizer que dois deles foram 2o e 3o daria a
 * eles um lugar que ninguem conquistou.
 *
 * A ordem geral: vencedor, depois quem ficou vivo sem vencer, depois os mortos
 * do turno mais recente para o mais antigo.
 */
export function standings(match, state) {
  const st = state || replay(match);

  // Quanto mais alto, melhor colocado.
  const peso = (id) => {
    if (id === st.winnerId) return Infinity;
    const e = st.players[id] && st.players[id].elim;
    return e ? (e.seq || 0) : Number.MAX_SAFE_INTEGER; // vivo fica acima de morto
  };

  // Quem empata com quem. Vencedor nunca empata; vivos sem vitoria empatam
  // entre si; mortos empatam com quem caiu no mesmo turno de jogador.
  const grupo = (id) => {
    if (id === st.winnerId) return 'vencedor';
    const e = st.players[id] && st.players[id].elim;
    return e ? 'turno:' + (e.seq || 0) : 'vivo';
  };

  const ranked = [...st.order].sort((a, b) => peso(b) - peso(a));

  const out = [];
  let i = 0;
  while (i < ranked.length) {
    const g = grupo(ranked[i]);
    let j = i;
    while (j < ranked.length && grupo(ranked[j]) === g) j += 1;
    // Posicoes i+1 ate j; o grupo inteiro leva a ultima delas.
    for (let k = i; k < j; k += 1) out.push({ seatId: ranked[k], place: j });
    i = j;
  }
  return out;
}

/**
 * Esta pessoa ja esta em outra cadeira?
 *
 * Regra da partida, nao da tela: uma mesa com alguem duplicado estraga tudo que
 * vem depois - dano contra si mesma, rivalidade consigo, e uma classificacao
 * que nao corresponde ao que aconteceu.
 *
 * Confere as duas identidades, porque sao dois caminhos diferentes de chegar na
 * mesma pessoa: o nome digitado e a conta vinculada. Havia so meia trava - a
 * lista de jogadores salvos desabilitava quem ja estava sentado, mas digitar o
 * mesmo nome na mao passava, e a mesma CONTA em duas cadeiras nao era conferida
 * em lugar nenhum.
 */
export function pessoaRepetida(seats, cadeira, { name, handle } = {}) {
  const outros = (seats || []).filter((s) => s && s !== cadeira);

  const h = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  if (h && outros.some((s) => String(s.handle || '').trim().replace(/^@+/, '').toLowerCase() === h)) {
    return 'conta';
  }

  const n = String(name || '').trim().toLowerCase();
  if (n && outros.some((s) => String(s.name || '').trim().toLowerCase() === n)) {
    return 'nome';
  }

  return null;
}
