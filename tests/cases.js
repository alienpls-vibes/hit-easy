/**
 * Casos de teste do motor - fonte unica.
 *
 * Nao toca no DOM de proposito: os mesmos casos rodam no Node
 * (`npm test`) e no navegador (`tests.html`). Um teste que so passa num
 * dos dois nao vale muito.
 */

// Primeiro de todos: instala o DOM simulado antes que ui.js seja avaliado.
import { simulated, flushFrames, findAll, fire, textOf } from './dom-stub.js';
import {
  createMatch, replay, push, undo, standings, elapsedOf,
  cmdKeyOf, CMD_LETHAL, POISON_LETHAL,
} from '../src/engine.js';
import {
  aggregate, rivalries, tituloDaVotacao, totalDamage, summarize,
  playerColorOrder, playerColor,
} from '../src/stats.js';
import { LAYOUTS, variantsFor, layoutFor, shapesOf, seatAngle } from '../src/seating.js';
import { createSession, cast, tally, pending, isComplete, describe } from '../src/vote.js';
import { openFlow, closeSheet, dismissOnBackdrop, el, isSheetOpen, onSheetChange } from '../src/ui.js';
import { DICTS, LANGS, t, tn, setLang, currentLang } from '../src/i18n.js';
import {
  accountState, assinaturaAtiva, sessaoValida, toRow, fromRow, pendentes,
} from '../src/cloud.js';
import { renderTable } from '../src/views/table.js';
import { renderSetup, seedDraftFrom } from '../src/views/setup.js';
import { brandMark } from '../src/ui.js';
import * as store from '../src/store.js';
// Importar app.js JA e o teste: ele sobe sozinho ao ser avaliado.
import '../src/app.js';

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((what || 'valor') + ': esperado ' + e + ', veio ' + a);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'condicao falsa');
}

const commander = (n) => ({
  oracleId: 'o' + n, name: 'Cmd ' + n, colors: ['U'], art: null, thumb: null,
});

/** Mesa de apoio com comandantes ficticios. */
function mesa(n = 4, life = 40, options = {}) {
  return createMatch(
    Array.from({ length: n }, (_, i) => ({
      id: 's' + i, name: 'P' + i, commanders: [commander(i)],
    })),
    life,
    options,
  );
}

/**
 * Abre um painel num corpo limpo.
 *
 * closeSheet() adia a remocao do nó em 200ms para deixar a animacao terminar,
 * entao sem esta limpeza o painel de um caso ainda esta no corpo durante o
 * seguinte - e a busca por telas pega a sobra do vizinho.
 */
function abrirPainel(step) {
  document.body.childNodes.length = 0;
  const api = openFlow(step);
  flushFrames();
  return api;
}

/** As telas do painel aberto agora, na ordem em que foram empilhadas. */
function telas() {
  const scrims = findAll(document.body, 'sheet-scrim');
  return findAll(scrims[scrims.length - 1], 'flow-pane');
}

export const cases = [
  ['mesa nova começa com todos na vida inicial', () => {
    const s = replay(mesa());
    eq(Object.values(s.players).map((p) => p.life), [40, 40, 40, 40], 'vidas');
    eq(s.turn, 1, 'turno');
    eq(s.activeSeatId, 's0', 'assento ativo');
    eq(s.finished, false, 'finalizada');
  }],

  ['dano tira vida e é creditado à origem declarada no arraste', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    eq(replay(m).players.s1.life, 33, 'vida do alvo');
    eq(m.events[0].sourceId, 's0', 'origem');
  }],

  ['desfazer volta exatamente ao estado anterior', () => {
    const m = mesa();
    const antes = JSON.stringify(replay(m).players);
    push(m, { type: 'life', targetId: 's2', delta: -12, sourceId: 's0' });
    eq(replay(m).players.s2.life, 28, 'vida após dano');
    undo(m);
    eq(JSON.stringify(replay(m).players), antes, 'estado após desfazer');
  }],

  ['dano de comandante também sai da vida', () => {
    const m = mesa();
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 9 });
    const s = replay(m);
    eq(s.players.s1.life, 31, 'vida');
    eq(s.players.s1.cmd[key], 9, 'contador de comandante');
  }],

  ['21 de dano de comandante elimina mesmo com vida sobrando', () => {
    const m = mesa(4, 100);
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: CMD_LETHAL });
    const s = replay(m);
    ok(s.players.s1.life > 0, 'ainda tem vida');
    eq(s.players.s1.dead, true, 'eliminado');
    eq(s.players.s1.elim.byId, 's0', 'crédito da eliminação');
  }],

  ['dano de comandantes diferentes não soma para os 21', () => {
    const m = mesa(4, 100);
    const k0 = cmdKeyOf('s0', m.seats[0].commanders[0]);
    const k2 = cmdKeyOf('s2', m.seats[2].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: k0, delta: 15 });
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's2', cmdKey: k2, delta: 15 });
    const p = replay(m).players.s1;
    eq(p.dead, false, 'segue vivo: 15 e 15 são contadores separados');
    eq(p.life, 70, 'mas a vida levou os 30');
  }],

  ['10 de veneno elimina', () => {
    const m = mesa();
    push(m, { type: 'poison', targetId: 's2', delta: POISON_LETHAL, sourceId: 's0' });
    eq(replay(m).players.s2.dead, true, 'eliminado por veneno');
  }],

  ['turno fecha a volta e pula quem morreu', () => {
    const m = mesa();
    push(m, { type: 'turn' });
    push(m, { type: 'turn' });
    eq(replay(m).activeSeatId, 's2', 'assento ativo');
    eq(replay(m).turn, 1, 'ainda na primeira volta');
    push(m, { type: 'turn' });
    push(m, { type: 'turn' });
    const s = replay(m);
    eq(s.activeSeatId, 's0', 'voltou ao primeiro');
    eq(s.turn, 2, 'turno 2');
  }],

  ['assento eliminado é pulado na ordem de turno', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    eq(replay(m).activeSeatId, 's2', 'pulou o eliminado');
  }],

  ['último vivo vence e a partida encerra', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });
    const s = replay(m);
    eq(s.winnerId, 's0', 'vencedor');
    eq(s.finished, true, 'finalizada');
  }],

  ['colocação: vencedor em 1º, quem saiu por último vem antes', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });
    eq(standings(m).map((x) => x.seatId), ['s0', 's3', 's2', 's1'], 'ordem final');
  }],

  ['desistir tira o jogador da mesa', () => {
    const m = mesa();
    push(m, { type: 'concede', targetId: 's3' });
    const s = replay(m);
    eq(s.players.s3.dead, true, 'fora da mesa');
    eq(s.alive.length, 3, 'restantes');
  }],

  ['reviver por desfazer devolve a colocação', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    eq(replay(m).players.s1.dead, true, 'morreu');
    undo(m);
    const s = replay(m);
    eq(s.players.s1.dead, false, 'voltou');
    eq(s.elimOrder.length, 0, 'fila de eliminação limpa');
  }],

  ['estatísticas somam dano causado e recebido pela origem certa', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -10, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -6, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: +4, sourceId: null });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P0').damageDealt, 16, 'dano causado por P0');
    eq(players.find((p) => p.label === 'P1').damageTaken, 10, 'dano recebido por P1');
    eq(players.find((p) => p.label === 'P1').healed, 4, 'cura de P1');
  }],

  ['vida perdida sem autor conta como paga, não como dano levado', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's0', delta: -3, sourceId: null });
    push(m, { type: 'life', targetId: 's0', delta: -8, sourceId: 's1' });
    const p0 = aggregate([m]).players.find((p) => p.label === 'P0');
    eq(p0.lifePaid, 3, 'vida paga');
    eq(p0.damageTaken, 8, 'dano levado');
    eq(replay(m).players.s0.life, 29, 'vida final soma os dois');
  }],

  ['ninguém leva crédito por dano sem origem declarada', () => {
    const m = mesa();
    push(m, { type: 'turn' }); // P1 esta no turno...
    push(m, { type: 'life', targetId: 's2', delta: -9, sourceId: null });
    const { players } = aggregate([m]);
    // ...e mesmo assim nao herda o dano: sem arraste, nao ha autor.
    eq(players.find((p) => p.label === 'P1').damageDealt, 0, 'dano creditado a P1');
    eq(players.find((p) => p.label === 'P2').lifePaid, 9, 'vida paga por P2');
  }],

  ['veneno arrastado credita quem aplicou', () => {
    const m = mesa();
    push(m, { type: 'poison', targetId: 's1', delta: 4, sourceId: 's0' });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P0').poisonDealt, 4, 'veneno aplicado por P0');
    eq(players.find((p) => p.label === 'P1').poisonTaken, 4, 'veneno recebido por P1');
  }],

  ['dano de comandante entra no dano total dos dois lados', () => {
    const m = mesa();
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 6 });
    const { players } = aggregate([m]);
    const p0 = players.find((p) => p.label === 'P0');
    eq(p0.cmdDealt, 6, 'dano de comandante causado');
    eq(p0.damageDealt, 6, 'e também conta no dano total');
    eq(players.find((p) => p.label === 'P1').damageTaken, 6, 'dano levado por P1');
  }],

  ['estatísticas contam vitória e eliminação', () => {
    const m = mesa(2);
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const p0 = aggregate([m]).players.find((p) => p.label === 'P0');
    eq(p0.wins, 1, 'vitórias');
    eq(p0.kills, 1, 'eliminações');
    eq(p0.winrate, 1, 'winrate');
  }],

  ['estatísticas agregam o mesmo deck em várias partidas', () => {
    const a = mesa(2);
    push(a, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const b = mesa(2);
    push(b, { type: 'life', targetId: 's0', delta: -40, sourceId: 's1' });
    const { decks } = aggregate([a, b]);
    const d0 = decks.find((d) => d.label === 'Cmd 0');
    eq(d0.games, 2, 'partidas do deck');
    eq(d0.wins, 1, 'vitórias');
    eq(d0.winrate, 0.5, 'winrate');
  }],

  ['toda variante gira no horário, em pé e deitada', () => {
    // A ordem dos assentos é a ordem dos turnos. Andando de um assento ao
    // próximo, o ângulo em relação ao centro tem que sempre CRESCER (Y da tela
    // aponta para baixo, então ângulo crescente = sentido horário), e a volta
    // completa tem que somar exatamente 360°. Uma mesa anti-horária daria
    // passos negativos; uma que vai e volta não fecharia em 360.
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const { nome, shape } of shapesOf(v)) {
          const onde = n + ' jogadores / ' + v.id + ' / ' + nome;
          const angles = shape.seats.map((s) => seatAngle(s, shape));
          let volta = 0;
          for (let i = 0; i < n; i += 1) {
            const passo = (angles[(i + 1) % n] - angles[i] + 360) % 360;
            ok(passo > 0, onde + ': assento ' + i + ' não avança no horário');
            volta += passo;
          }
          ok(Math.abs(volta - 360) < 0.001, onde + ': a volta somou ' + volta + '°, não 360°');
        }
      }
    }
  }],

  ['toda forma preenche a grade sem sobrepor assentos', () => {
    for (const [n, variantes] of Object.entries(LAYOUTS)) {
      const ids = new Set();
      for (const v of variantes) {
        ok(!ids.has(v.id), n + ': id de variante repetido');
        ids.add(v.id);
        ok(v.label, n + '/' + v.id + ': variante sem rótulo para mostrar ao usuário');

        for (const { nome, shape } of shapesOf(v)) {
          const onde = n + ' jogadores / ' + v.id + ' / ' + nome;
          ok(shape.seats.length === Number(n), onde + ': tem ' + shape.seats.length + ' assentos');

          const ocupadas = new Set();
          for (const s of shape.seats) {
            // Só 0 e 180: painel de lado deixaria nome e número deitados.
            ok(s.rot === 0 || s.rot === 180, onde + ': rotação inválida ' + s.rot);
            for (let c = s.c; c < s.c + (s.cs || 1); c += 1) {
              const cell = s.r + ':' + c;
              ok(!ocupadas.has(cell), onde + ': célula ' + cell + ' usada duas vezes');
              ocupadas.add(cell);
              ok(s.r <= shape.rows && c <= shape.cols, onde + ': assento fora da grade');
            }
          }
        }
      }
    }
  }],

  ['a forma deitada é mais larga que alta onde existe', () => {
    for (const n of [5, 6]) {
      for (const v of variantsFor(n)) {
        if (!v.land) continue;
        ok(v.land.cols > v.land.rows, n + '/' + v.id + ': forma deitada não é larga');
        ok(v.cols <= v.rows, n + '/' + v.id + ': forma em pé não é alta');
      }
    }
  }],

  ['layoutFor escolhe variante e orientação', () => {
    eq(layoutFor(5, 'inventado').id, variantsFor(5)[0].id, 'cai no padrão');
    eq(layoutFor(3, '1-2').id, '1-2', 'variante válida é respeitada');
    eq(layoutFor(6, 'padrao', false).cols, 2, 'em pé: duas colunas');
    eq(layoutFor(6, 'padrao', true).cols, 3, 'deitado: três colunas');
    eq(layoutFor(4, 'padrao', true).cols, 2, 'sem forma deitada, mantém a mesma');
  }],

  ['a partida pode começar por qualquer jogador', () => {
    const m = mesa(4, 40, { firstSeatId: 's2' });
    eq(replay(m).activeSeatId, 's2', 'quem abre');
    eq(replay(m).turn, 1, 'turno inicial');
  }],

  ['a volta fecha em quem começou, não no primeiro assento', () => {
    const m = mesa(4, 40, { firstSeatId: 's2' });
    push(m, { type: 'turn' }); // s2 -> s3
    push(m, { type: 'turn' }); // s3 -> s0 (dá a volta no array, mas não na mesa)
    eq(replay(m).turn, 1, 'ainda na primeira volta');
    eq(replay(m).activeSeatId, 's0', 'assento ativo');
    push(m, { type: 'turn' }); // s0 -> s1
    push(m, { type: 'turn' }); // s1 -> s2, aí sim fecha
    const s = replay(m);
    eq(s.activeSeatId, 's2', 'voltou a quem abriu');
    eq(s.turn, 2, 'turno 2');
  }],

  ['a contagem de turnos não escorrega quando quem começou morre', () => {
    const m = mesa(4, 40, { firstSeatId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -40, sourceId: 's1' });
    push(m, { type: 'turn' }); // s0 (morto) sai de cena -> s1
    const inicio = replay(m).turn;
    push(m, { type: 'turn' }); // s1 -> s2
    push(m, { type: 'turn' }); // s2 -> s3
    push(m, { type: 'turn' }); // s3 -> pula s0 morto -> s1: uma volta dos vivos
    const s = replay(m);
    eq(s.activeSeatId, 's1', 'voltou ao primeiro vivo');
    eq(s.turn, inicio + 1, 'exatamente uma volta contada');
  }],

  ['painel: a primeira tela entra visível e clicável', () => {
    if (!simulated) return 'skip';
    // A regressão que motivou este teste: a tela nascia com `is-next`
    // (opacity:0 + pointer-events:none) e ninguém tirava. O painel abria
    // vazio e nada respondia ao toque.
    abrirPainel({ title: 'A', build: (pane) => pane.append(document.createElement('p')) });

    const panes = telas();
    eq(panes.length, 1, 'telas montadas');
    ok(!panes[0].classList.contains('is-next'), 'primeira tela ficou escondida à direita');
    ok(!panes[0].classList.contains('is-past'), 'primeira tela ficou marcada como anterior');
    closeSheet();
  }],

  ['painel: avançar empilha e voltar restaura a tela anterior', () => {
    if (!simulated) return 'skip';
    const api = abrirPainel({ title: 'A', build: () => {} });

    api.next({ title: 'B', build: () => {} });
    flushFrames();
    let [a, b] = telas();
    eq(telas().length, 2, 'telas empilhadas');
    ok(a.classList.contains('is-past'), 'a anterior deveria recuar');
    ok(!b.classList.contains('is-next'), 'a nova deveria estar à vista');

    api.back();
    flushFrames();
    [a, b] = telas();
    ok(!a.classList.contains('is-past'), 'ao voltar, a primeira volta à vista');
    ok(b.classList.contains('is-next'), 'a que saiu deveria sair pela direita');
    closeSheet();
  }],

  ['ação em área atinge todos os alvos listados de uma vez', () => {
    const m = mesa();
    push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 0, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq([s.players.s1.life, s.players.s2.life, s.players.s3.life], [37, 37, 37], 'oponentes');
    eq(s.players.s0.life, 40, 'quem disparou não se atinge');
    eq(m.events.length, 1, 'um evento só, não um por alvo');
  }],

  ['dreno tira de todos e devolve para quem drenou', () => {
    const m = mesa();
    push(m, { type: 'sweep', sourceId: 's0', amount: 2, gain: 6, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq(s.players.s1.life, 38, 'oponente');
    eq(s.players.s0.life, 46, 'quem drenou');
  }],

  ['desfazer um dreno reverte tudo num passo', () => {
    const m = mesa();
    const antes = JSON.stringify(replay(m).players);
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 15, targets: ['s1', 's2', 's3'] });
    undo(m);
    eq(JSON.stringify(replay(m).players), antes, 'estado após desfazer');
  }],

  ['ação em área credita as eliminações a quem disparou', () => {
    const m = mesa(4, 5);
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 0, targets: ['s1', 's2', 's3'] });
    const s = replay(m);
    eq(s.winnerId, 's0', 'vencedor');
    eq(s.players.s1.elim.byId, 's0', 'crédito da eliminação');
    eq(aggregate([m]).players.find((p) => p.label === 'P0').kills, 3, 'eliminações contadas');
  }],

  ['ação em área entra nas estatísticas dos dois lados', () => {
    const m = mesa();
    push(m, { type: 'sweep', sourceId: 's0', amount: 4, gain: 12, targets: ['s1', 's2', 's3'] });
    const { players } = aggregate([m]);
    const p0 = players.find((p) => p.label === 'P0');
    eq(p0.damageDealt, 12, 'dano causado (4 × 3)');
    eq(p0.healed, 12, 'vida ganha no dreno');
    eq(players.find((p) => p.label === 'P1').damageTaken, 4, 'dano levado por alvo');
  }],

  ['o tempo pausado não conta na duração da partida', () => {
    const m = mesa();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 1000, turn: 1, type: 'pause' });
    m.events.push({ id: 'b', ts: t0 + 61000, turn: 1, type: 'resume' });
    m.events.push({ id: 'c', ts: t0 + 71000, turn: 1, type: 'life', targetId: 's1', delta: -1, sourceId: 's0' });
    const s = replay(m);
    eq(s.pausedTotal, 60000, 'total pausado');
    eq(elapsedOf(m, s, t0 + 71000), 11000, 'duração já sem a pausa');
  }],

  ['o tempo pausado também sai do tempo de turno do jogador', () => {
    const m = mesa();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 2000, turn: 1, type: 'pause' });
    m.events.push({ id: 'b', ts: t0 + 32000, turn: 1, type: 'resume' });
    m.events.push({ id: 'c', ts: t0 + 40000, turn: 1, type: 'turn' });
    eq(replay(m).players.s0.timeOnTurn, 10000, 'turno de P0 sem os 30s parados');
  }],

  ['pausa ainda aberta conta até o último evento, e não além', () => {
    const m = mesa();
    const t0 = m.startedAt;
    m.events.push({ id: 'a', ts: t0 + 5000, turn: 1, type: 'pause' });
    const s = replay(m);
    eq(s.paused, true, 'segue pausada');
    eq(s.pausedSince, t0 + 5000, 'início da pausa');
    eq(s.pausedTotal, 0, 'nada fechado ainda');
    // Com a pausa correndo, o relógio da partida trava nos 5s de antes dela.
    eq(elapsedOf(m, s, t0 + 90000), 5000, 'duração congelada');
  }],

  ['a mesa monta sem explodir', () => {
    if (!simulated) return 'skip';
    // Fumaça pura, e vale o preço: um `let` declarado depois do primeiro uso
    // derrubava renderTable inteiro e deixava a tela preta. Sintaxe válida,
    // imports certos, 38 testes verdes - e nada na tela.
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(4),
      onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    ok(root.childNodes.length > 0, 'a mesa não desenhou nada');
    ok(findAll(root, 'tile').length === 4, 'painéis desenhados');
    ok(findAll(root, 'hub').length === 1, 'núcleo central desenhado');
    view.destroy();
  }],

  ['a tela de montagem monta sem explodir', () => {
    if (!simulated) return 'skip';
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    ok(root.childNodes.length > 0, 'a home não desenhou nada');
    ok(findAll(root, 'seat-card').length >= 2, 'cartões de jogador desenhados');
  }],

  ['tocar fora fecha, mas o clique fantasma do celular não', () => {
    if (!simulated) return 'skip';
    // No celular, o toque que ABRE o painel dispara um `click` logo depois, e
    // ele cai na cobertura recém-montada. Sem esta regra, o painel de ação em
    // área abria e fechava no mesmo gesto - e só no aparelho.
    const scrim = el('div', {});
    let fechou = 0;
    dismissOnBackdrop(scrim, () => { fechou += 1; });

    fire(scrim, 'click');                    // clique fantasma: sem pointerdown
    eq(fechou, 0, 'o clique fantasma não pode fechar');

    fire(scrim, 'pointerdown');              // toque de verdade na cobertura
    fire(scrim, 'click');
    eq(fechou, 1, 'tocar fora precisa fechar');

    fire(scrim, 'click');                    // clique solto de novo
    eq(fechou, 1, 'não fecha duas vezes pelo mesmo toque');
  }],

  ['o app inteiro sobe e desenha a primeira tela', () => {
    if (!simulated) return 'skip';
    // O caso mais completo que dá para rodar sem navegador: importa app.js de
    // verdade, que aplica tema, liga orientação, monta a rota inicial e
    // registra os observadores. Os testes anteriores montavam as views
    // isoladas - este pega o que só quebra na costura entre elas.
    const app = document.getElementById('app');
    ok(app, 'o stub precisa oferecer #app');
    ok(app.childNodes.length > 0, 'o app não desenhou nada ao subir');
    ok(document.body.dataset.route, 'nenhuma rota foi definida');
    eq(document.documentElement.dataset.theme, 'dark', 'tema aplicado na carga');
  }],

  ['votação conta os votos e diz quem votou em quê', () => {
    const v = createSession({
      question: 'Carnage ou homage?',
      options: ['Carnage', 'Homage'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }, { id: 'c', name: 'Caio' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [1]); cast(v, 'c', [0]);
    const r = tally(v);
    eq(r.rows[0].label, 'Carnage', 'mais votada');
    eq(r.rows[0].votes, 2, 'votos da vencedora');
    eq(r.rows[0].voters, ['Ana', 'Caio'], 'quem votou nela');
    eq(r.tie, false, 'não houve empate');
    eq(r.total, 3, 'total de votos');
  }],

  ['votação detecta empate no topo', () => {
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [1]);
    const r = tally(v);
    eq(r.tie, true, 'empate');
    eq(r.top.length, 2, 'duas opções no topo');
  }],

  ["unanimidade é reconhecida — é o que Prisoner's Dilemma pergunta", () => {
    const v = createSession({
      options: ['Silence', 'Snitch'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0]); cast(v, 'b', [0]);
    eq(tally(v).unanimous, true, 'todos escolheram o mesmo');

    cast(v, 'b', [1]);
    eq(tally(v).unanimous, false, 'com escolhas diferentes, não é unânime');
  }],

  ['votos extras contam, e podem ir em opções diferentes', () => {
    // Brago's Representative: "you get an additional vote. (The votes can be
    // for different choices or for the same choice.)"
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana', votes: 2 }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [0, 1]); cast(v, 'b', [1]);
    const r = tally(v);
    eq(r.total, 3, 'três votos com dois votantes');
    eq(r.rows[0].label, 'B', 'B ganhou com dois');
    eq(r.rows[0].votes, 2, 'votos de B');
  }],

  ['número secreto acha o maior e o menor, com empates', () => {
    const v = createSession({
      kind: 'numero',
      voters: [
        { id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' },
        { id: 'c', name: 'Caio' }, { id: 'd', name: 'Duda' },
      ],
    });
    cast(v, 'a', [7]); cast(v, 'b', [7]); cast(v, 'c', [3]); cast(v, 'd', [0]);
    const r = tally(v);
    eq(r.maior, 7, 'maior número');
    eq(r.menor, 0, 'menor número');
    eq(r.highest, ['a', 'b'], 'empate no topo entra inteiro');
    eq(r.lowest, ['d'], 'menor sozinho');
    eq(r.rows[0].name, 'Ana', 'ordenado do maior para o menor');
  }],

  ['todo mundo no mesmo número não tem maior nem menor', () => {
    const v = createSession({
      kind: 'numero',
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    cast(v, 'a', [5]); cast(v, 'b', [5]);
    eq(tally(v).allEqual, true, 'empate geral');
  }],

  ['a votação sabe de quem ainda falta o voto', () => {
    const v = createSession({
      options: ['A', 'B'],
      voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }],
    });
    eq(pending(v).map((x) => x.name), ['Ana', 'Bruno'], 'ninguém votou');
    cast(v, 'a', [0]);
    eq(pending(v).map((x) => x.name), ['Bruno'], 'falta o Bruno');
    eq(isComplete(v), false, 'ainda incompleta');
    cast(v, 'b', [1]);
    eq(isComplete(v), true, 'completa');
    eq(describe(v), 'A 1 × B 1', 'resumo para o histórico');
  }],

  ['a votação vai do menu até a revelação sem travar', () => {
    if (!simulated) return 'skip';
    // Nasceu de um bug real: renderTable já tinha um `pending` local (o Map dos
    // toques), que sombreava a função `pending` importada de vote.js. O botão
    // "Começar a votação" existia, estava habilitado, e não fazia nada.
    // Sintaxe válida, imports corretos, 49 testes verdes.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    // As telas anteriores continuam montadas atrás (é assim que voltar funciona
    // sem refazer nada), então procurar no corpo inteiro acharia botões velhos.
    const telaAtiva = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const acharTexto = (cls, txt) =>
      findAll(telaAtiva(), cls).find((n) => textOf(n).includes(txt));

    const menu = findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu');
    fire(menu, 'click');
    const abrir = acharTexto('menu-item', 'Votação secreta');
    ok(abrir, 'o menu não oferece a votação');
    fire(abrir, 'click');

    const comecar = acharTexto('btn', 'Começar');
    ok(comecar, 'sem botão de começar');
    ok(!comecar.disabled, 'o botão nasceu desabilitado');
    fire(comecar, 'click');

    // Cada votante passa por entrega + cédula, e no fim vem a revelação.
    for (let i = 0; i < 4; i += 1) {
      const sou = acharTexto('btn', 'Sou ');
      ok(sou, 'faltou a tela de entrega do votante ' + (i + 1));
      fire(sou, 'click');
      const escolha = findAll(telaAtiva(), 'vote-choice')[i % 2];
      ok(escolha, 'faltaram as opções para o votante ' + (i + 1));
      fire(escolha, 'click');
    }

    const revelar = acharTexto('btn', 'Revelar');
    ok(revelar, 'não chegou na revelação');
    fire(revelar, 'click');
    eq(findAll(telaAtiva(), 'vote-result-row').length, 2, 'linhas do resultado');
    ok(acharTexto('btn', 'Guardar'), 'sem o botão de guardar no histórico');

    closeSheet();
    view.destroy();
  }],

  ['o app sabe quando há painel aberto, e avisa quem redesenha por baixo', () => {
    if (!simulated) return 'skip';
    // Girar o aparelho remonta a mesa, e remontar chama destroy(), que fecha o
    // painel. Como a votação pede retrato JUSTAMENTE enquanto está aberta, sem
    // este aviso ela mandaria girar a tela e se fecharia sozinha em seguida.
    document.body.childNodes.length = 0;
    const vistos = [];
    const parar = onSheetChange((aberto) => vistos.push(aberto));

    eq(isSheetOpen(), false, 'começa sem painel');
    openFlow({ title: 'X', build: () => {} });
    flushFrames();
    eq(isSheetOpen(), true, 'painel aberto');
    closeSheet();
    eq(isSheetOpen(), false, 'painel fechado');
    eq(vistos, [true, false], 'avisos na ordem certa');
    parar();
  }],

  ['a votação abre centralizada e volta a pedir paisagem ao sair', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    let restaurou = false;
    openFlow({ title: 'Votação', build: () => {} }, {
      centered: true,
      onClose: () => { restaurou = true; },
    });
    flushFrames();
    const scrim = findAll(document.body, 'sheet-scrim')[0];
    ok(scrim.classList.contains('is-centered'), 'sem a classe de centralizado');
    closeSheet();
    ok(restaurou, 'não restaurou a orientação ao fechar');
  }],

  ['quem já está na mesa aparece por último na escolha de jogador', () => {
    if (!simulated) return 'skip';
    // A lista serve para achar quem AINDA não sentou. Nomes inclicáveis no
    // meio do caminho atrapalham a mira, então vão para o fim.
    ['Ana', 'Bruno', 'Caio', 'Duda'].forEach(store.rememberPlayer);

    const commander = (n) => ({ oracleId: 'o' + n, name: 'Cmd ' + n, colors: ['U'] });
    seedDraftFrom(createMatch([
      { id: 'x0', name: 'Ana', commanders: [commander(0)] },
      { id: 'x1', name: 'Bruno', commanders: [commander(1)] },
    ], 40));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    // Abre o seletor do assento da Ana: só o Bruno está ocupado.
    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();

    const linhas = findAll(document.body, 'player-row');
    const nomes = linhas.map((n) => textOf(findAll(n, 'player-name')[0]));
    const ocupadas = linhas.map((n) => n.classList.contains('is-busy'));

    ok(linhas.length === 4, 'esperava as quatro pessoas salvas, veio ' + linhas.length);
    eq(nomes[nomes.length - 1], 'Bruno', 'quem está na mesa deveria ser o último');
    ok(ocupadas[ocupadas.length - 1], 'a última linha deveria estar marcada como ocupada');

    // Nenhuma linha disponível pode vir depois de uma ocupada.
    const primeiraOcupada = ocupadas.indexOf(true);
    ok(
      ocupadas.slice(primeiraOcupada).every(Boolean),
      'sobrou alguém selecionável depois de quem já está na mesa',
    );
    closeSheet();
  }],

  ['a mana marcada zera ao passar o turno, e não vira evento', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const match = mesa(4);
    const view = renderTable(root, {
      match, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const abrirMenu = () => fire(
      findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click',
    );
    const noCorpo = (cls, txt) =>
      findAll(document.body, cls).find((n) => textOf(n).includes(txt));

    abrirMenu();
    fire(noCorpo('menu-item', 'Marcador de mana'), 'click');

    // Três toques no "+" da primeira cor (branco) e dois na segunda (azul).
    const tiles = findAll(document.body, 'mana-tile');
    eq(tiles.length, 6, 'as seis cores');
    for (let i = 0; i < 3; i += 1) fire(findAll(tiles[0], 'mana-plus')[0], 'pointerdown');
    for (let i = 0; i < 2; i += 1) fire(findAll(tiles[1], 'mana-plus')[0], 'pointerdown');
    eq(match.mana.W, 3, 'branco marcado');
    eq(match.mana.U, 2, 'azul marcado');

    // Tirar também funciona.
    fire(findAll(tiles[0], 'mana-minus')[0], 'pointerdown');
    eq(match.mana.W, 2, 'branco depois de tirar um');
    // E não passa de zero.
    for (let i = 0; i < 5; i += 1) fire(findAll(tiles[1], 'mana-minus')[0], 'pointerdown');
    eq(match.mana.U, 0, 'azul não fica negativo');

    const eventosAntes = match.events.length;
    closeSheet();

    // Passar a vez limpa o pote.
    fire(findAll(root, 'hub-ring')[0], 'click');
    eq(match.mana, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, 'mana zerada na virada');
    eq(match.events.length, eventosAntes + 1, 'só o evento de turno entrou no log');
    eq(match.events[match.events.length - 1].type, 'turn', 'e é o de turno');

    view.destroy();
  }],

  ['votação por número secreto vai até a revelação', () => {
    if (!simulated) return 'skip';
    // O caminho onde o teclado do celular entra em cena. Aqui garantimos ao
    // menos que o fluxo fecha; a sobreposição do teclado é CSS e só o aparelho
    // confirma.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(3), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    const telaAtiva = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const achar = (cls, txt) =>
      findAll(telaAtiva(), cls).find((n) => textOf(n).includes(txt));

    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes('Votação')), 'click');

    fire(achar('pad-mode', 'Número'), 'click');
    fire(achar('btn', 'Começar'), 'click');

    const numeros = [7, 7, 2];
    for (let i = 0; i < 3; i += 1) {
      fire(achar('btn', 'Sou '), 'click');
      const campo = findAll(telaAtiva(), 'vote-number')[0];
      ok(campo, 'faltou o campo de número do votante ' + (i + 1));
      campo.value = String(numeros[i]);
      fire(achar('btn', 'Confirmar'), 'click');
    }

    fire(achar('btn', 'Revelar'), 'click');
    const linhas = findAll(telaAtiva(), 'vote-result-row');
    eq(linhas.length, 3, 'uma linha por jogador');
    // 7 e 7 empatam no topo; o 2 fica sozinho embaixo.
    eq(linhas.filter((l) => l.classList.contains('is-high')).length, 2, 'empate no maior');
    eq(linhas.filter((l) => l.classList.contains('is-low')).length, 1, 'um menor só');

    closeSheet();
    view.destroy();
  }],

  ['a identidade de cor do deck chega mesmo ao CSS', () => {
    if (!simulated) return 'skip';
    // Custom property exige setProperty: `style['--accent'] = cor` não registra
    // nada no navegador. O app passa a cor do deck assim em 17 lugares, e por
    // muito tempo tudo caiu no --accent branco da raiz - painéis, cartões e as
    // bolinhas de mana ficaram todos sem cor, em silêncio.
    const n = el('div', { style: { '--accent': '#5C9FD6', width: '10px' } });
    eq(n.style.getPropertyValue('--accent'), '#5C9FD6', 'custom property registrada');
    eq(n.style.width, '10px', 'propriedade normal continua funcionando');

    // E de ponta a ponta: o painel de um deck azul carrega a cor dele.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    const painel = findAll(root, 'tile')[0];
    ok(painel.style.getPropertyValue('--accent'), 'o painel ficou sem cor de deck');
    view.destroy();
  }],

  ['as bolinhas de mana saem cada uma na sua cor', () => {
    if (!simulated) return 'skip';
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });
    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes('mana')), 'click');

    const cores = findAll(document.body, 'mana-tile')
      .map((t) => t.style.getPropertyValue('--accent'));
    eq(cores.length, 6, 'seis cores');
    ok(cores.every(Boolean), 'alguma bolinha ficou sem cor');
    eq(new Set(cores).size, 6, 'as seis precisam ser cores distintas');

    closeSheet();
    view.destroy();
  }],

  ["as estatísticas guardam o que cada um escolheu no Prisoner's Dilemma", () => {
    const m = mesa(4);
    const votar = (escolhas) => push(m, {
      type: 'vote',
      question: "Prisoner's Dilemma",
      kind: 'opcoes',
      options: ['Silence', 'Snitch'],
      ballots: [
        { seatId: 's1', name: 'P1', choices: [escolhas[0]] },
        { seatId: 's2', name: 'P2', choices: [escolhas[1]] },
        { seatId: 's3', name: 'P3', choices: [escolhas[2]] },
      ],
    });
    votar([0, 0, 1]); // P1 e P2 calados, P3 delatou
    votar([0, 1, 1]); // P1 calado de novo

    const { players } = aggregate([m]);
    const p1 = players.find((p) => p.label === 'P1');
    const p3 = players.find((p) => p.label === 'P3');

    eq(p1.votes, 2, 'P1 participou de duas');
    eq(p1.voteChoices["Prisoner's Dilemma"], { Silence: 2 }, 'P1 escolheu Silence nas duas');
    eq(p3.voteChoices["Prisoner's Dilemma"], { Snitch: 2 }, 'P3 delatou nas duas');
    eq(players.find((p) => p.label === 'P2').voteChoices["Prisoner's Dilemma"],
      { Silence: 1, Snitch: 1 }, 'P2 fez uma de cada');
  }],

  ['quem nunca votou não ganha estatística de votação', () => {
    const m = mesa(4);
    push(m, {
      type: 'vote',
      question: "Prisoner's Dilemma",
      kind: 'opcoes',
      options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's1', name: 'P1', choices: [0] }],
    });
    const { players } = aggregate([m]);
    eq(players.find((p) => p.label === 'P1').votes, 1, 'quem votou tem');
    eq(players.find((p) => p.label === 'P0').votes, 0, 'quem não votou fica zerado');
    eq(players.find((p) => p.label === 'P0').voteChoices, {}, 'e sem escolhas nenhuma');
  }],

  ['votações diferentes não misturam as escolhas', () => {
    const m = mesa(4);
    push(m, {
      type: 'vote', question: "Prisoner's Dilemma", kind: 'opcoes',
      options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [1] }],
    });
    push(m, {
      type: 'vote', question: 'Carnage ou homage?', kind: 'opcoes',
      options: ['Carnage', 'Homage'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    push(m, {
      type: 'vote', question: '', kind: 'numero',
      options: [],
      ballots: [{ seatId: 's0', name: 'P0', choices: [7] }],
    });
    const p0 = aggregate([m]).players.find((p) => p.label === 'P0');
    eq(p0.votes, 3, 'três votações');
    eq(Object.keys(p0.voteChoices).sort(),
      ['Carnage ou homage?', 'Número secreto', "Prisoner's Dilemma"], 'cada pergunta na sua linha');
    eq(p0.voteChoices['Número secreto'], { 7: 1 }, 'número secreto guarda o valor');
  }],

  ['votação sem título é nomeada pelas próprias opções', () => {
    // "Votação sem título" não diz nada e enche a estatística de linhas iguais.
    // Separador neutro: " ou " seria português no meio do alemão.
    eq(tituloDaVotacao({ kind: 'opcoes', options: ['Silence', 'Snitch'] }),
      'Silence / Snitch', 'nome vem das opções');
    eq(tituloDaVotacao({ kind: 'opcoes', options: ['A'], question: '  ' }),
      'A', 'espaço em branco não conta como título');
    eq(tituloDaVotacao({ kind: 'numero', options: [] }),
      'Número secreto', 'número tem nome próprio');
    eq(tituloDaVotacao({ kind: 'opcoes', options: [], question: 'Carnage?' }),
      'Carnage?', 'título dado ganha da derivação');

    // E chega assim na estatística.
    const m = mesa(2);
    push(m, {
      type: 'vote', kind: 'opcoes', options: ['Silence', 'Snitch'], question: '',
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(Object.keys(p0.voteChoices), ['Silence / Snitch'], 'agrupado pelo nome derivado');
  }],

  ['rivalidades somam o dano de cada um contra o outro', () => {
    const m = mesa(3);
    push(m, { type: 'life', targetId: 's1', delta: -10, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: -4, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -6, sourceId: 's1' });
    push(m, { type: 'life', targetId: 's2', delta: -3, sourceId: 's0' });

    const pares = rivalries([m]);
    const p01 = pares.find((r) => (r.a === 'P0' && r.b === 'P1') || (r.a === 'P1' && r.b === 'P0'));
    ok(p01, 'o par P0-P1 precisa existir');
    const deP0 = p01.a === 'P0' ? p01.aToB : p01.bToA;
    const deP1 = p01.a === 'P0' ? p01.bToA : p01.aToB;
    eq(deP0.damage, 14, 'P0 bateu 14 no P1');
    eq(deP1.damage, 6, 'P1 devolveu 6');
    eq(p01.total, 20, 'dano trocado');
    eq(pares[0], p01, 'o par mais violento vem primeiro');
    eq(pares.length, 2, 'P0-P1 e P0-P2, mas não P1-P2');
  }],

  ['rivalidades contam eliminação, comandante e veneno', () => {
    const m = mesa(2, 30);
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's1', sourceId: 's0', cmdKey: key, delta: 5 });
    push(m, { type: 'poison', targetId: 's1', delta: 2, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's1', delta: -30, sourceId: 's0' });

    const r = rivalries([m])[0];
    const deP0 = r.a === 'P0' ? r.aToB : r.bToA;
    eq(deP0.cmdDamage, 5, 'dano de comandante');
    eq(deP0.poison, 2, 'veneno');
    eq(deP0.kills, 1, 'eliminação creditada');
    eq(deP0.damage, 35, 'comandante entra no dano total');
    eq(r.games, 1, 'uma partida juntos');
  }],

  ['dano sem autor não cria rivalidade', () => {
    const m = mesa(2);
    push(m, { type: 'life', targetId: 's1', delta: -8, sourceId: null });
    eq(rivalries([m]).length, 0, 'vida paga não é rivalidade com ninguém');
  }],

  ['ação em área conta para todos os alvos como rivalidade', () => {
    const m = mesa(4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 0, targets: ['s1', 's2', 's3'] });
    const pares = rivalries([m]);
    eq(pares.length, 3, 'três pares, um por alvo');
    ok(pares.every((r) => r.total === 3), 'três de dano em cada');
  }],

  ['ocultar tira da lista sem tocar nas partidas', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = mesa(3);
    push(m, { type: 'life', targetId: 's1', delta: -12, sourceId: 's0' });
    store.archive(m);

    eq(aggregate(store.getDB().history).players.length, 3, 'três jogadores no começo');

    store.hidePlayer('P1');
    eq(store.isPlayerHidden('p1'), true, 'a chave ignora maiúsculas');
    eq(store.getDB().history.length, 1, 'a partida continua salva');
    eq(store.getDB().history[0].events.length, 1, 'com os eventos intactos');

    // O dano que P0 causou em P1 continua contando para P0.
    const p0 = aggregate(store.getDB().history).players.find((x) => x.label === 'P0');
    eq(p0.damageDealt, 12, 'o dano não some junto com a linha');

    store.unhidePlayer('P1');
    eq(store.isPlayerHidden('P1'), false, 'restaurado');
    store.wipe();
  }],

  ['o dano total inclui dreno e ação em área', () => {
    // Existiam duas somas de dano - uma nas estatísticas, outra no cartaz de
    // vitória - e a do cartaz não conhecia `sweep`: um dreno de 5 em três
    // oponentes aparecia como zero no fim da partida.
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    push(m, { type: 'sweep', sourceId: 's0', amount: 5, gain: 15, targets: ['s1', 's2', 's3'] });
    const key = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's2', sourceId: 's0', cmdKey: key, delta: 4 });

    eq(totalDamage(m), 26, '7 + (5 × 3) + 4');
    eq(summarize(m).totalDamage, 26, 'o resumo usa a mesma conta');
  }],

  ['a vida ganha no dreno não conta como dano', () => {
    const m = mesa(4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 2, gain: 6, targets: ['s1', 's2', 's3'] });
    eq(totalDamage(m), 6, 'só os 2 × 3 que saíram, não os 6 que entraram');
  }],

  ['os quatro idiomas têm exatamente as mesmas chaves', () => {
    // Sem isto, uma tradução esquecida só aparece quando alguém troca de
    // idioma e encontra uma frase em português no meio do alemão.
    const base = Object.keys(DICTS.pt).sort();
    for (const [codigo] of LANGS) {
      const chaves = Object.keys(DICTS[codigo]).sort();
      const faltando = base.filter((k) => !chaves.includes(k));
      const sobrando = chaves.filter((k) => !base.includes(k));
      ok(!faltando.length, codigo + ' não traduziu: ' + faltando.slice(0, 5).join(', '));
      ok(!sobrando.length, codigo + ' tem chave a mais: ' + sobrando.slice(0, 5).join(', '));
    }
  }],

  ['nenhuma tradução perde uma variável de interpolação', () => {
    // "{name} venceu" sem o {name} no alemão viraria uma frase sem sujeito.
    const vars = (txt) => (String(txt).match(/\{\w+\}/g) || []).sort().join(',');
    for (const chave of Object.keys(DICTS.pt)) {
      const esperado = vars(DICTS.pt[chave]);
      for (const [codigo] of LANGS) {
        eq(vars(DICTS[codigo][chave]), esperado,
          codigo + ' / ' + chave + ': variáveis diferentes do português');
      }
    }
  }],

  ['nenhum texto ficou vazio em nenhum idioma', () => {
    for (const [codigo] of LANGS) {
      for (const [chave, texto] of Object.entries(DICTS[codigo])) {
        ok(typeof texto === 'string' && texto.trim().length > 0,
          codigo + ' / ' + chave + ' está vazio');
      }
    }
  }],

  ['traduzir interpola, pluraliza e volta ao português quando falta', () => {
    setLang('en');
    eq(currentLang(), 'en', 'idioma trocado');
    eq(t('pregame.startsToast', { name: 'Ana' }), 'Ana goes first', 'interpolação');
    eq(tn(1, 'player.deckSaved', 'player.decksSaved'), '1 saved deck', 'singular');
    eq(tn(3, 'player.deckSaved', 'player.decksSaved'), '3 saved decks', 'plural');
    eq(t('chave.que.nao.existe'), 'chave.que.nao.existe', 'chave desconhecida volta como está');

    setLang('zz'); // idioma inexistente
    eq(currentLang(), 'pt', 'cai no português');
    setLang('pt');
  }],

  ['as telas sobem inteiras nos quatro idiomas', () => {
    if (!simulated) return 'skip';
    // Uma chave faltando ou uma variável errada só aparece ao desenhar de
    // verdade — o teste dos dicionários não pega um t() escrito errado na view.
    for (const [codigo] of LANGS) {
      setLang(codigo);
      const m = mesa(3);
      push(m, { type: 'sweep', sourceId: 's0', amount: 3, gain: 6, targets: ['s1', 's2'] });

      const home = document.createElement('div');
      renderSetup(home, { onStart() {}, onStats() {}, onRefresh() {} });
      ok(findAll(home, 'seat-card').length >= 2, codigo + ': home não desenhou');

      const mesa2 = document.createElement('div');
      const v = renderTable(mesa2, {
        match: m, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
      });
      ok(findAll(mesa2, 'tile').length === 3, codigo + ': mesa não desenhou');
      v.destroy();

      // Nenhum texto pode sair como a própria chave.
      const rotulo = textOf(findAll(mesa2, 'hub-label')[0]);
      ok(rotulo && !rotulo.includes('.'), codigo + ': rótulo saiu como chave crua');
    }
    setLang('pt');
  }],

  ['o motivo da vitória declarada entra na estatística', () => {
    const m = mesa(3);
    push(m, { type: 'win', targetId: 's0', reason: 'combo' });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.wins, 1, 'vitória contada');
    eq(p0.winReasons, { combo: 1 }, 'motivo guardado');
    eq(aggregate([m]).players.find((x) => x.label === 'P1').winReasons, {},
      'quem não venceu não ganha motivo');
  }],

  ['vitória por último vivo não inventa motivo', () => {
    const m = mesa(2);
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.wins, 1, 'venceu');
    eq(p0.winReasons, {}, 'sem motivo declarado');
  }],

  ['declarar sem escolher motivo continua valendo como vitória', () => {
    const m = mesa(3);
    push(m, { type: 'win', targetId: 's2', reason: null });
    const s2 = aggregate([m]).players.find((x) => x.label === 'P2');
    eq(s2.wins, 1, 'a vitória vale');
    eq(s2.winReasons, {}, 'mas sem motivo');
  }],

  ['motivos somam ao longo de várias partidas', () => {
    const fazer = (motivo) => {
      const m = mesa(2);
      push(m, { type: 'win', targetId: 's0', reason: motivo });
      return m;
    };
    const p0 = aggregate([fazer('combo'), fazer('combo'), fazer('combate')])
      .players.find((x) => x.label === 'P0');
    eq(p0.winReasons, { combo: 2, combate: 1 }, 'contagem por motivo');
    eq(p0.wins, 3, 'total de vitórias');
  }],

  ['cada assento da home mostra a própria cadeira na mini-mesa', () => {
    if (!simulated) return 'skip';
    // A ordem da lista já diz a ordem dos turnos; a miniatura diz o LUGAR, que
    // é o que falta quando são 5 ou 6 pessoas em volta.
    setLang('pt');
    seedDraftFrom(createMatch([0, 1, 2, 3].map((i) => ({
      id: 'z' + i, name: 'J' + i,
      commanders: [{ oracleId: 'o' + i, name: 'Cmd ' + i, colors: ['U'] }],
    })), 40));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    const spots = findAll(root, 'seat-spot');
    eq(spots.length, 4, 'uma miniatura por assento');
    spots.forEach((spot, i) => {
      const acesas = findAll(spot, 'is-here');
      eq(acesas.length, 1, 'assento ' + i + ': exatamente uma cadeira acesa');
      eq(textOf(acesas[0]), String(i + 1), 'assento ' + i + ': número da posição');
      eq(findAll(spot, 'layout-cell').length, 4, 'a mesa inteira aparece');
    });
  }],

  ['a marca desenha os cinco pips, cada um na sua cor e dentro da caixa', () => {
    if (!simulated) return 'skip';
    // Era um quadradinho com degradê que virava mancha em 14px. Agora são
    // círculos separados — e todos precisam caber no viewBox 24×24, senão o
    // de cima aparece cortado.
    setLang('pt');
    const m = brandMark();
    eq(m.childNodes.length, 5, 'cinco pips');

    const cores = m.childNodes.map((c) => c.attributes.fill);
    eq(new Set(cores).size, 5, 'cinco cores distintas');

    m.childNodes.forEach((c, i) => {
      const cx = Number(c.attributes.cx);
      const cy = Number(c.attributes.cy);
      const r = Number(c.attributes.r);
      ok(cx - r >= 0 && cx + r <= 24, 'pip ' + i + ' sai da caixa na horizontal');
      ok(cy - r >= 0 && cy + r <= 24, 'pip ' + i + ' sai da caixa na vertical');
    });
  }],

  ['trocar o idioma pela tela de configurações funciona de verdade', () => {
    if (!simulated) return 'skip';
    // O teste dos dicionários passava e o seletor não funcionava: eu esquecia
    // de repintar, e a escolha não saía do lugar. Só exercitando o controle.
    setLang('pt');
    store.wipe();
    document.body.childNodes.length = 0;

    let redesenhos = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() { redesenhos += 1; } });

    const engrenagem = findAll(root, 'icon-btn')
      .find((b) => b.attributes['aria-label'] === t('common.settings'));
    ok(engrenagem, 'sem botão de configurações');
    fire(engrenagem, 'click');

    const campo = findAll(document.body, 'select-input')[0];
    ok(campo, 'o idioma deveria ser um campo de seleção');
    eq(campo.value, 'pt', 'começa no idioma atual');
    eq(campo.childNodes.length, 4, 'os quatro idiomas na lista');

    campo.value = 'de';
    fire(campo, 'change');

    eq(currentLang(), 'de', 'o idioma mudou');
    eq(store.getDB().settings.lang, 'de', 'e ficou salvo');
    ok(redesenhos > 0, 'a tela de trás precisa ser redesenhada');

    // O painel reabre traduzido, senão ficaria em português até fechar na mão.
    const legendas = findAll(document.body, 'sheet-legend').map(textOf);
    ok(legendas.includes('Sprache'), 'o painel não reabriu em alemão: ' + legendas.join(' | '));

    closeSheet();
    setLang('pt');
    store.wipe();
  }],

  ['o atalho da mana aparece com mana, abre o contador e some ao zerar', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const match = mesa(4);
    const view = renderTable(root, {
      match, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const atalho = () => findAll(root, 'is-mana')[0];
    const abrirMenu = () => fire(
      findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === t('common.menu')), 'click',
    );

    ok(atalho(), 'o botão precisa existir no hub');
    eq(atalho().hidden, true, 'sem mana, fica escondido');

    // Marca mana pelo caminho normal (menu → contador).
    abrirMenu();
    fire(findAll(document.body, 'menu-item').find((n) => textOf(n).includes(t('mana.marker'))), 'click');
    const tiles = findAll(document.body, 'mana-tile');
    for (let i = 0; i < 2; i += 1) fire(findAll(tiles[0], 'mana-plus')[0], 'pointerdown');
    fire(findAll(tiles[3], 'mana-plus')[0], 'pointerdown');
    closeSheet();

    eq(atalho().hidden, false, 'com mana, o atalho aparece');
    eq(textOf(atalho()), '3', 'e mostra o total');

    // O atalho abre o contador direto, sem passar pelo menu.
    document.body.childNodes.length = 0;
    fire(atalho(), 'click');
    eq(findAll(document.body, 'mana-tile').length, 6, 'o toque no atalho abre o contador');

    // Gastar tudo faz o atalho sumir.
    const t2 = findAll(document.body, 'mana-tile');
    for (let i = 0; i < 2; i += 1) fire(findAll(t2[0], 'mana-minus')[0], 'pointerdown');
    fire(findAll(t2[3], 'mana-minus')[0], 'pointerdown');
    eq(atalho().hidden, true, 'pote vazio, atalho some');
    closeSheet();

    // E passar a vez também limpa.
    fire(findAll(root, 'mana-plus')[0] || findAll(root, 'hub-ring')[0], 'click');
    view.destroy();
  }],

  ['a cor de um jogador é a mesma em todas as partidas dele', () => {
    // Era o problema: a cor vinha do comandante, então trocar de deck trocava
    // a cor da pessoa, e a aba de partidas ficava impossível de ler.
    const partida = (t0, nomes) => {
      const m = createMatch(nomes.map((n, i) => ({
        id: 's' + i, name: n,
        commanders: [{ oracleId: 'o' + t0 + i, name: 'Cmd', colors: ['U'] }],
      })), 40);
      m.startedAt = t0;
      return m;
    };
    const historico = [
      partida(1000, ['Ana', 'Bruno', 'Caio']),
      partida(2000, ['Ana', 'Duda']),
    ];
    const ordem = playerColorOrder(historico);
    eq(playerColor(ordem, 'Ana'), playerColor(ordem, 'Ana'), 'mesma pessoa, mesma cor');
    ok(playerColor(ordem, 'Ana') !== playerColor(ordem, 'Bruno'), 'pessoas diferentes, cores diferentes');
    eq(playerColor(ordem, ' ana '), playerColor(ordem, 'Ana'), 'espaço e caixa não criam outra pessoa');
  }],

  ['entrar um jogador novo não muda a cor de ninguém', () => {
    // Por isso a ordem é por primeira aparição, e não alfabética: uma "Ana"
    // cadastrada depois empurraria todo mundo e trocaria as cores já vistas.
    const partida = (t0, nomes) => {
      const m = createMatch(nomes.map((n, i) => ({
        id: 's' + i, name: n, commanders: [{ oracleId: 'o' + i, name: 'C', colors: ['U'] }],
      })), 40);
      m.startedAt = t0;
      return m;
    };
    const antes = [partida(1000, ['Zeca', 'Bruno'])];
    const ordemAntes = playerColorOrder(antes);
    const corZeca = playerColor(ordemAntes, 'Zeca');
    const corBruno = playerColor(ordemAntes, 'Bruno');

    const depois = [...antes, partida(2000, ['Ana', 'Zeca'])];
    const ordemDepois = playerColorOrder(depois);
    eq(playerColor(ordemDepois, 'Zeca'), corZeca, 'Zeca manteve a cor');
    eq(playerColor(ordemDepois, 'Bruno'), corBruno, 'Bruno manteve a cor');
    ok(playerColor(ordemDepois, 'Ana') !== corZeca, 'a nova ganhou cor própria');
  }],

  ['as cores de jogador se espalham em vez de se agrupar', () => {
    // Ângulo áureo: com qualquer quantidade, cada nova cor cai no maior vão que
    // sobrou. Duas pessoas seguidas nunca saem em tons quase iguais.
    const hue = (cor) => Number(String(cor).match(/hsl\(([\d.]+)/)[1]);
    const ordem = new Map(['a', 'b', 'c', 'd', 'e', 'f'].map((n, i) => [n, i]));
    const tons = ['a', 'b', 'c', 'd', 'e', 'f'].map((n) => hue(playerColor(ordem, n)));

    for (let i = 0; i < tons.length; i += 1) {
      for (let j = i + 1; j < tons.length; j += 1) {
        const bruto = Math.abs(tons[i] - tons[j]);
        const dist = Math.min(bruto, 360 - bruto);
        ok(dist > 25, 'tons ' + i + ' e ' + j + ' ficaram a ' + dist.toFixed(0) + '° um do outro');
      }
    }
  }],

  ['o estado da conta cobre os quatro casos', () => {
    // A interface inteira se desenha a partir daqui, então cada caso precisa
    // sair certo — inclusive o de sempre: sem nuvem configurada, o app é local.
    const s = { access_token: 'x' };
    eq(accountState({ ligado: false, sessao: s, assinatura: { status: 'active' } }),
      'desligado', 'sem nuvem, nada muda');
    eq(accountState({ ligado: true, sessao: null }), 'deslogado', 'nuvem ligada, sem sessão');
    eq(accountState({ ligado: true, sessao: s, assinatura: null }),
      'sem-assinatura', 'entrou mas não assina');
    eq(accountState({ ligado: true, sessao: s, assinatura: { status: 'active' } }),
      'assinante', 'entrou e assina');
  }],

  ['assinatura vencida perde o acesso, mas com um dia de tolerância', () => {
    // Cartão falha e o Stripe tenta de novo em algumas horas. Derrubar o acesso
    // nesse meio-tempo puniria quem está em dia por um problema do emissor.
    const agora = Date.parse('2026-08-23T12:00:00Z');
    const em = (h) => new Date(agora + h * 3600e3).toISOString();

    ok(assinaturaAtiva({ status: 'active', current_period_end: em(24) }, agora), 'em dia');
    ok(assinaturaAtiva({ status: 'active', current_period_end: em(-6) }, agora),
      'venceu há 6h: ainda dentro da tolerância');
    ok(!assinaturaAtiva({ status: 'active', current_period_end: em(-30) }, agora),
      'venceu há 30h: fora');
    ok(!assinaturaAtiva({ status: 'canceled', current_period_end: em(240) }, agora),
      'cancelada não vale, mesmo dentro do período');
    ok(!assinaturaAtiva(null, agora), 'sem assinatura');
    ok(assinaturaAtiva({ status: 'active' }, agora), 'sem data de fim, vale');
  }],

  ['sessão expirada não conta como sessão', () => {
    const agora = Date.parse('2026-08-23T12:00:00Z');
    ok(sessaoValida({ access_token: 'x', expires_at: agora / 1000 + 3600 }, agora), 'válida');
    ok(!sessaoValida({ access_token: 'x', expires_at: agora / 1000 - 10 }, agora), 'expirada');
    ok(!sessaoValida({ expires_at: agora / 1000 + 3600 }, agora), 'sem token');
    ok(!sessaoValida(null, agora), 'sem nada');
  }],

  ['a partida vai e volta do banco sem perder nada', () => {
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    push(m, { type: 'turn' });
    undo(m); // deixa algo em `redo`

    const linha = toRow(m, 'user-123');
    eq(linha.id, m.id, 'id preservado');
    eq(linha.owner, 'user-123', 'dono');
    eq(linha.payload.redo, [], 'refazer não sobe: é estado de tela, não histórico');

    const volta = fromRow(linha);
    eq(volta.events, m.events, 'o log volta inteiro');
    eq(JSON.stringify(replay(volta)), JSON.stringify(replay(m)), 'e o replay dá o mesmo estado');
  }],

  ['só sobe o que o servidor ainda não tem', () => {
    // Partida encerrada é imutável, então comparar por id basta: não há versão
    // nem conflito para resolver. É o que torna o sync tão simples.
    const locais = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    eq(pendentes(locais, ['b']).map((m) => m.id), ['a', 'c'], 'faltam duas');
    eq(pendentes(locais, ['a', 'b', 'c']).map((m) => m.id), [], 'nada a fazer');
    eq(pendentes(locais, []).map((m) => m.id), ['a', 'b', 'c'], 'servidor vazio');
    eq(pendentes([], ['a']).length, 0, 'nada local');
  }],

  ['replay é determinístico: mesmo log, mesmo estado', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'poison', targetId: 's2', delta: 3, sourceId: 's1' });
    eq(JSON.stringify(replay(m)), JSON.stringify(replay(m)), 'dois replays');
  }],
];

/** Roda tudo e devolve o resultado. Quem chama decide como mostrar. */
export function runAll() {
  return cases.map(([name, fn]) => {
    try {
      const r = fn();
      if (r === 'skip') return { name, ok: true, skipped: true };
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, why: err.message };
    }
  });
}
