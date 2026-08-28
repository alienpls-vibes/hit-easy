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
  createMatch, replay, push, undo, standings, elapsedOf, pessoaRepetida,
  cmdKeyOf, CMD_LETHAL, POISON_LETHAL,
} from '../src/engine.js';
import {
  aggregate, rivalries, tituloDaVotacao, totalDamage, summarize,
  playerColorOrder, playerColor,
  identityOf, labelOf,
  chaveDaVotacao, rotuloDaVotacao, orientarRival,
} from '../src/stats.js';
import { LAYOUTS, variantsFor, layoutFor, shapesOf, seatAngle, orientOf } from '../src/seating.js';
import { createSession, cast, tally, pending, isComplete, describe } from '../src/vote.js';
import { openFlow, closeSheet, dismissOnBackdrop, el, isSheetOpen, onSheetChange } from '../src/ui.js';
import { DICTS, LANGS, t, tn, setLang, currentLang } from '../src/i18n.js';
import {
  accountState, assinaturaAtiva, sessaoValida, toRow, fromRow, pendentes,
  state as accountNow, provedores, pedidoDeLink, urlDeRetorno,
  capturarRetorno, esquecerSessao, precisaRenovar, sessaoAproveitavel, senhaValida,
  jaTinhaConta,
  sessaoGuardada,
  normalizarHandle, handleValido, exibirHandle, participantesDe, montarConvites,
} from '../src/cloud.js';
import { cloudEnabled } from '../src/config.js';
import { canalDe, canalDoCache } from '../src/canal.js';
import { giraComOAssento, grausNaMesa, rotatesToSeat } from '../src/orientation.js';
import { renderTable } from '../src/views/table.js';
import { renderSetup, seedDraftFrom } from '../src/views/setup.js';
import { renderStats } from '../src/views/stats.js';
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

  ['a mesma pessoa não pode ocupar duas cadeiras', () => {
    const mesa4 = [
      { id: 's0', name: 'Alexandre', handle: 'alienpls' },
      { id: 's1', name: 'Bruno' },
      { id: 's2', name: 'Carla', handle: 'carlinha' },
    ];
    const nova = { id: 's3', name: '' };

    eq(pessoaRepetida(mesa4, nova, { name: 'Davi' }), null, 'gente nova entra');
    eq(pessoaRepetida(mesa4, nova, { name: 'Bruno' }), 'nome', 'nome repetido barra');
    eq(pessoaRepetida(mesa4, nova, { name: ' bruno ' }), 'nome', 'espaço e caixa não driblam');

    // O outro caminho para a mesma pessoa: a conta. Era o que não tinha trava
    // nenhuma - dava para vincular @alienpls em duas cadeiras.
    eq(pessoaRepetida(mesa4, nova, { handle: 'alienpls' }), 'conta', 'conta repetida barra');
    eq(pessoaRepetida(mesa4, nova, { handle: '@AlienPls' }), 'conta', 'arroba e caixa não driblam');
    eq(pessoaRepetida(mesa4, nova, { handle: 'outro' }), null, 'outra conta entra');

    // A própria cadeira nunca conflita consigo mesma: editar quem já está
    // sentado não pode ser recusado por ele próprio já estar ali.
    eq(pessoaRepetida(mesa4, mesa4[1], { name: 'Bruno' }), null, 'a própria cadeira não conta');
    eq(pessoaRepetida(mesa4, mesa4[0], { handle: 'alienpls' }), null);

    eq(pessoaRepetida(mesa4, nova, {}), null, 'sem nada declarado, nada a barrar');
    eq(pessoaRepetida(null, nova, { name: 'Bruno' }), null, 'sem mesa, sem conflito');
  }],

  ['colocação: vencedor em 1º, quem saiu por último vem antes', () => {
    const m = mesa();
    // Um por turno: aqui há de fato quem sobreviveu a quem.
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    eq(standings(m).map((x) => x.seatId), ['s0', 's3', 's2', 's1'], 'ordem final');
    eq(standings(m).map((x) => x.place), [1, 2, 3, 4], 'sem empate, colocações distintas');
  }],

  ['quem morre no mesmo turno divide a colocação', () => {
    // O caso que a mesa reconhece: alguém estoura a mesa inteira de uma vez.
    // Não há nada que separe os três - eles não se sobreviveram, e a ordem em
    // que o motor processou os eventos é detalhe interno que não significa
    // nada. Desempatar por ali seria inventar um resultado.
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    const lugar = new Map(standings(m).map((x) => [x.seatId, x.place]));
    eq(lugar.get('s0'), 1, 'quem sobrou é o primeiro');
    // O grupo leva a PIOR colocação que ocupa. Dizer que dois deles foram 2º e
    // 3º daria a eles um lugar que ninguém conquistou.
    eq(lugar.get('s1'), 4, 'os três caíram juntos');
    eq(lugar.get('s2'), 4);
    eq(lugar.get('s3'), 4);
  }],

  ['empate parcial: só quem caiu junto divide o lugar', () => {
    const m = mesa();
    push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    push(m, { type: 'turn' });
    // Estes dois caem no mesmo turno, depois do s1.
    push(m, { type: 'life', targetId: 's2', delta: -40, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's3', delta: -40, sourceId: 's0' });

    const lugar = new Map(standings(m).map((x) => [x.seatId, x.place]));
    eq(lugar.get('s0'), 1, 'o vencedor');
    eq(lugar.get('s2'), 3, 'os dois do último turno ocupam 2º e 3º, e levam o 3º');
    eq(lugar.get('s3'), 3);
    eq(lugar.get('s1'), 4, 'quem caiu antes fica atrás dos dois');
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

  ['a conta vinculada sobrevive da mesa até o convite', () => {
    // Este é o caminho inteiro, e ele estava rompido no primeiro elo:
    // createMatch montava o assento com id, nome e comandantes, e descartava
    // handle e userId. A escolha do @ morria no rascunho. A partida gravada não
    // sabia de conta nenhuma, participantesDe() nunca achava cadeira para
    // convidar, e a estatística voltava a ter só o nome digitado.
    //
    // Nada falhava com estardalhaço: o convite simplesmente nunca chegava.
    const m = createMatch([
      { id: 's0', name: 'Alexandre', handle: 'alienpls', userId: 'uid-1', commanders: [commander(0)] },
      { id: 's1', name: 'Bruno', commanders: [commander(1)] },
    ], 40);

    eq(m.seats[0].handle, 'alienpls', 'o assento guarda o @');
    eq(m.seats[0].userId, 'uid-1', 'e a conta');
    eq(m.seats[1].handle, null, 'cadeira sem conta continua sem conta');

    // E a partida gravada gera o convite de verdade.
    const linhas = participantesDe(m);
    eq(linhas.length, 1, 'uma cadeira reivindicável');
    eq(linhas[0].handle, 'alienpls');
    eq(linhas[0].user_id, 'uid-1');
    eq(linhas[0].seat_id, 's0');

    // E a estatística identifica a pessoa, não o texto.
    eq(identityOf(m.seats[0]), '@alienpls', 'a estatística vê a conta');
  }],

  ['a mesma conta com nomes diferentes é uma pessoa só', () => {
    // O ponto do recurso inteiro: o nome é como a mesa chama alguém NAQUELE
    // dia. Cadastrar "Alex" numa quinta e "Alexandre" na outra não pode
    // produzir duas linhas, duas cores e duas histórias - nem transformar a
    // rivalidade dessa pessoa com o Bruno em duas rivalidades pela metade.
    const comConta = (nome) => {
      const m = createMatch([
        { id: 's0', name: nome, handle: 'alienpls', commanders: [commander(0)] },
        { id: 's1', name: 'Bruno', commanders: [commander(1)] },
      ], 40);
      push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
      return m;
    };

    const partidas = [comConta('Alexandre'), comConta('Alex')];
    const { players } = aggregate(partidas);

    const dele = players.filter((p) => p.key === '@alienpls');
    eq(dele.length, 1, 'uma linha só para a conta');
    eq(dele[0].games, 2, 'as duas partidas somam na mesma pessoa');
    eq(dele[0].damageDealt, 14, 'o dano das duas mesas soma junto');
    eq(dele[0].label, 'Alexandre', 'o rótulo é o nome mais recente');
    eq(players.length, 2, 'só existem duas pessoas: a conta e o Bruno');

    // A cor acompanha a conta, não o texto digitado.
    const ordem = playerColorOrder(partidas);
    eq(playerColor(ordem, '@alienpls'), playerColor(ordem, '@alienpls'), 'cor estável');

    const rivais = rivalries(partidas);
    eq(rivais.length, 1, 'uma rivalidade, não duas metades');
    eq(rivais[0].games, 2, 'as duas mesas contam para o mesmo par');
  }],

  ['identidade cai no nome quando não há conta, e nunca colide com uma', () => {
    eq(identityOf({ id: 's0', name: 'Ana' }), 'ana', 'sem conta, o nome serve');
    eq(identityOf({ id: 's0', name: ' ANA ' }), 'ana', 'espaço e caixa não criam outra pessoa');
    eq(identityOf({ id: 's0', name: 'Ana', handle: '@Ana' }), '@ana', 'com conta, a conta manda');

    // O prefixo existe para isto: quem digitou "ana" sem conta nenhuma não é a
    // dona da conta @ana até que alguém diga que é.
    ok(identityOf({ id: 's0', name: 'ana' }) !== identityOf({ id: 's1', handle: 'ana' }),
      'nome solto não vira dono da conta de mesmo texto');

    // Partida antiga, gravada antes de existir @: o aparelho lembra a quem
    // aquele nome pertence, e ela se junta à conta em vez de ficar órfã.
    eq(identityOf({ id: 's0', name: 'Alex' }, { alex: 'alienpls' }), '@alienpls',
      'o que o aparelho lembra reconcilia o histórico antigo');

    eq(identityOf({ id: 's9' }), 's9', 'sem nome e sem conta, resta o assento');
    eq(labelOf({ id: 's0', handle: 'alienpls' }), '@alienpls', 'sem nome, mostra o @');
    eq(labelOf({ id: 's0', name: 'Ana', handle: 'alienpls' }), 'Ana', 'com nome, mostra o nome');
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
        // O rótulo era texto fixo em português dentro do seating.js, então a
        // escolha de mesa aparecia em português para quem usava o app em
        // inglês, espanhol ou alemão. Agora é chave, e a chave tem de existir
        // nos quatro - senão a tela mostra o nome cru da chave.
        ok(v.labelKey, n + '/' + v.id + ': variante sem rótulo para mostrar ao usuário');
        for (const [codigo] of LANGS) {
          ok(DICTS[codigo][v.labelKey],
            n + '/' + v.id + ': falta ' + v.labelKey + ' em ' + codigo);
        }

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
    eq(layoutFor(3, 'paisagem').id, 'paisagem', 'variante válida é respeitada');

    // 4 e 6 não têm o que escolher, e seguem se adaptando pela tela.
    eq(layoutFor(6, 'padrao', false).cols, 2, 'em pé: duas colunas');
    eq(layoutFor(6, 'padrao', true).cols, 3, 'deitado: três colunas');
    eq(layoutFor(4, 'padrao', true).cols, 2, 'sem forma deitada, mantém a mesma');
  }],

  ['partida antiga não troca as pessoas de lugar ao atualizar o app', () => {
    // Uma partida em andamento guarda o id de variante de quando começou.
    // Renomear as variantes sem tratar isso jogaria a mesa no padrão no meio
    // do jogo, movendo todo mundo de lugar sem aviso.
    const mesmo = (n, velho, novo) => {
      const a = layoutFor(n, velho);
      const b = layoutFor(n, novo);
      eq(JSON.stringify(a.seats), JSON.stringify(b.seats),
        n + '/' + velho + ' precisa cair exatamente em ' + novo);
    };
    mesmo(3, '2-1', 'retrato');
    mesmo(3, '1-2', 'paisagem');
    mesmo(5, 'volta', 'retrato');

    // Este não tem equivalente exato; o que importa é que vá para a deitada em
    // vez de cair no padrão em pé, que seria a mudança mais brusca.
    eq(layoutFor(5, '3-2').id, 'paisagem', 'sem equivalente exato, vai para a mais parecida');

    // E id inventado ainda cai no padrão, como sempre.
    eq(layoutFor(3, 'nao-existe').id, variantsFor(3)[0].id, 'id desconhecido cai no padrão');
  }],

  ['com 2, 3 e 5 a escolha é como o aparelho fica na mesa', () => {
    // A pergunta que a pessoa responde passa a ser concreta: em pé ou deitado
    // no meio da mesa. "2 embaixo, 1 em cima" descrevia a consequência de uma
    // escolha que ninguém tinha feito ainda.
    for (const n of [2, 3, 5]) {
      const vs = variantsFor(n);
      eq(vs.length, 2, n + ' jogadores: exatamente duas opções');
      eq(vs.map((v) => v.orient).sort().join(','), 'landscape,portrait',
        n + ' jogadores: uma em pé e uma deitada');
      eq(orientOf(n, 'retrato'), 'portrait');
      eq(orientOf(n, 'paisagem'), 'landscape');
    }

    // 4 e 6 não pedem orientação nenhuma: travar a tela ali só tiraria
    // liberdade de quem joga, sem resolver ambiguidade alguma.
    eq(orientOf(4, 'padrao'), null, 'quatro é simétrico');
    eq(orientOf(6, 'padrao'), null, 'seis é três de cada lado');
  }],

  ['a orientação escolhida não é desmentida pela tela', () => {
    // O que garante isto é o DADO, não o `if`: variante que declara orientação
    // não tem forma alternativa para trocar. Vale prender a invariante, porque
    // é ela que sustenta o comportamento - a guarda em layoutFor é só cinto e
    // suspensório para o dia em que alguém acrescentar as duas coisas juntas.
    for (const [n, variantes] of Object.entries(LAYOUTS)) {
      for (const v of variantes) {
        ok(!(v.orient && v.land),
          n + '/' + v.id + ': declara orientação E forma alternativa - uma das '
          + 'duas vai ser ignorada, e ninguém vai saber qual');
      }
    }

    for (const wide of [false, true]) {
      eq(layoutFor(5, 'retrato', wide).cols, 2, 'em pé continua 2 colunas (wide=' + wide + ')');
      eq(layoutFor(5, 'retrato', wide).rows, 3, 'em pé continua 3 linhas (wide=' + wide + ')');
      eq(layoutFor(5, 'paisagem', wide).cols, 3, 'deitado continua 3 colunas (wide=' + wide + ')');
      eq(layoutFor(5, 'paisagem', wide).rows, 2, 'deitado continua 2 linhas (wide=' + wide + ')');
    }
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

  ['no computador nenhum painel da mesa fica invertido', () => {
    if (!simulated) return 'skip';
    // O que a pessoa via: no monitor, os jogadores "de cima" apareciam com
    // nome, vida e comandante de cabeça para baixo. Na mesa isso é o certo -
    // cada painel aponta para o dono. Num monitor de pé não há ninguém do
    // outro lado, e metade da tela ficava ilegível.
    const girosDaMesa = () => {
      const root = document.createElement('div');
      const view = renderTable(root, {
        match: mesa(4),
        onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
      });
      const giros = findAll(root, 'tile').map((n) => String(n.style.transform || ''));
      view.destroy();
      return giros;
    };

    const antes = globalThis.matchMedia;
    try {
      // Sem ponteiro preciso: aparelho deitado na mesa, os painéis giram.
      globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      ok(girosDaMesa().some((g) => g.includes('180deg')), 'na mesa, os de frente giram');

      // Com mouse ou trackpad: monitor de pé, ninguém do outro lado.
      globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
      const noPc = girosDaMesa();
      eq(noPc.length, 4, 'os quatro painéis foram desenhados');
      ok(!noPc.some((g) => g.includes('180deg')), 'no computador, nenhum de cabeça para baixo');
      ok(noPc.every((g) => g.includes('0deg')), 'e todos com unidade, senão o CSS descarta a regra');
    } finally {
      globalThis.matchMedia = antes;
    }
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

  ['trocar de modelo de votação não deixa o título antigo grudado', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    // O bug relatado: tocar em "Prisoner's Dilemma" - que se auto-intitula - e
    // depois trocar para "Jogador" deixava a pergunta antiga no campo. A
    // votação ia para a estatística dizendo que a mesa jogou um dilema que
    // nunca aconteceu.
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    const view = renderTable(root, {
      match: mesa(4), onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
    });

    const telaAtiva = () => {
      const p = findAll(document.body, 'flow-pane');
      return p[p.length - 1];
    };
    const acharTexto = (cls, txt) =>
      findAll(telaAtiva(), cls).find((n) => textOf(n).includes(txt));
    const campo = () => findAll(telaAtiva(), 'search-input')[0];
    const modelo = (txt) => findAll(telaAtiva(), 'pad-mode').find((b) => textOf(b).includes(txt));

    fire(findAll(root, 'hub-btn').find((b) => b.attributes['aria-label'] === 'Menu'), 'click');
    fire(acharTexto('menu-item', 'Votação secreta'), 'click');

    eq(campo().value, '', 'começa sem título');

    fire(modelo('Prisoner'), 'click');
    eq(campo().value, "Prisoner's Dilemma", 'o modelo preenche o título sozinho');

    fire(modelo(t('vote.preset.player')), 'click');
    eq(campo().value, '', 'trocar de modelo limpa o título que o próprio app pôs');

    // O que a pessoa digitou é intocável: só o app apaga o que o app escreveu.
    fire(modelo('Prisoner'), 'click');
    const c = campo();
    c.value = 'Quem leva o combo?';
    fire(c, 'input');
    fire(modelo(t('vote.preset.player')), 'click');
    eq(campo().value, 'Quem leva o combo?', 'título digitado sobrevive à troca');

    // E apagar tudo devolve o campo ao app: quem esvaziou não tem opinião.
    const c2 = campo();
    c2.value = '';
    fire(c2, 'input');
    fire(modelo('Prisoner'), 'click');
    eq(campo().value, "Prisoner's Dilemma", 'campo vazio volta a aceitar o modelo');

    closeSheet();
    view.destroy();
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
      ['#numero', 'Carnage ou homage?', "Prisoner's Dilemma"], 'cada pergunta na sua linha');

    // O agrupamento NÃO pode depender do idioma. Antes a chave era o texto da
    // tela, então trocar de língua partia o histórico de votações da pessoa em
    // dois montes sem que nada tivesse mudado na mesa.
    const chavesEm = (lang) => {
      setLang(lang);
      return Object.keys(aggregate([m]).players.find((p) => p.label === 'P0').voteChoices).sort();
    };
    eq(chavesEm('en'), chavesEm('pt'), 'as mesmas votações em qualquer idioma');
    eq(chavesEm('de'), chavesEm('pt'));

    // E a tradução acontece só na hora de mostrar.
    setLang('pt');
    eq(rotuloDaVotacao('#numero'), t('vote.preset.number'), 'a chave interna vira texto');
    setLang('en');
    eq(rotuloDaVotacao('#numero'), t('vote.preset.number'), 'e acompanha o idioma');
    setLang('pt');
    eq(rotuloDaVotacao('Carnage ou homage?'), 'Carnage ou homage?',
      'pergunta digitada é mostrada como foi escrita');

    // A chave interna começa com # para nunca colidir com o que alguém digitou.
    eq(chaveDaVotacao({ question: '  ', kind: 'numero' }), '#numero');
    eq(chaveDaVotacao({ question: 'Número secreto', kind: 'numero' }), 'Número secreto',
      'quem digitou esse texto continua com ele');
    eq(chaveDaVotacao({ kind: 'opcoes', options: ['Sim', 'Não'] }), 'Sim / Não',
      'sem título, as opções nomeiam a votação');
    eq(chaveDaVotacao({ kind: 'opcoes', options: [] }), '#semtitulo');
    eq(p0.voteChoices['#numero'], { 7: 1 }, 'número secreto guarda o valor');
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

  ['a aba de rivalidades compara um par por vez', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    // Antes a aba despejava TODAS as duplas: cinco jogadores dão dez cartões, e
    // a comparação que interessa fica perdida no meio de nove que ninguém
    // pediu. Rivalidade é uma pergunta sobre duas pessoas - a tela pergunta
    // quais.
    store.wipe();
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -9, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's2', delta: -5, sourceId: 's0' });
    push(m, { type: 'life', targetId: 's0', delta: -4, sourceId: 's3' });
    store.archive(m);

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderStats(root, { onBack() {} });

    const aba = findAll(root, 'tab').find((b) => textOf(b) === t('stats.rivals'));
    ok(aba, 'a aba de rivalidades existe');
    fire(aba, 'click');

    // Três pares de fato (s0-s1, s0-s2, s0-s3), mas um gráfico só.
    eq(findAll(root, 'rival-select').length, 2, 'dois campos de filtro');
    eq(findAll(root, 'rival-card').length, 1, 'um gráfico por vez, não todos');

    // E os filtros oferecem só quem tem rivalidade registrada: oferecer alguém
    // que nunca cruzou com ninguém só produziria combinações vazias.
    const opcoes = findAll(root, 'rival-select')[0].childNodes.length;
    eq(opcoes, 4, 'os quatro que se enfrentaram');

    // O campo da esquerda manda no lado esquerdo do gráfico. Sem isso o desenho
    // contradiz o controle logo acima dele.
    const nomeEsquerda = () => textOf(findAll(root, 'rival-name')[0]);
    const seletor = (i) => findAll(root, 'rival-select')[i];
    const trocar = (i, valor) => {
      const sel = seletor(i);
      sel.value = valor;
      fire(sel, 'change', { target: { value: valor } });
    };

    eq(nomeEsquerda(), 'P0', 'começa com quem está no campo da esquerda');
    trocar(0, 'p1');          // esquerda = P1 (aqui os dois campos coincidem)
    trocar(1, 'p0');          // direita = P0
    eq(nomeEsquerda(), 'P1', 'trocar o campo da esquerda vira o gráfico');
    eq(findAll(root, 'rival-card').length, 1, 'continua sendo um gráfico só');
  }],

  ['virar o gráfico troca os dois lados inteiros', () => {
    // Trocar só o nome inverteria a leitura do dano - pior que não trocar.
    const par = {
      a: 'Ana', keyA: 'ana', aToB: { damage: 9, kills: 1 },
      b: 'Bruno', keyB: 'bruno', bToA: { damage: 4, kills: 0 },
      games: 2, total: 13,
    };

    eq(orientarRival(par, 'ana'), par, 'já está do jeito pedido');

    const virado = orientarRival(par, 'bruno');
    eq(virado.a, 'Bruno', 'nome trocou');
    eq(virado.keyA, 'bruno', 'chave trocou junto - é ela que dá a cor');
    eq(virado.aToB.damage, 4, 'e o dano acompanha quem passou para a esquerda');
    eq(virado.b, 'Ana');
    eq(virado.bToA.damage, 9);
    eq(virado.games, 2, 'o que é do par não muda');
    eq(virado.total, 13);

    eq(orientarRival(par, 'carla'), par, 'chave de fora do par não vira nada');
    eq(orientarRival(null, 'ana'), null, 'sem par, sem gráfico');
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

  ['o nome padrão do jogador é singular em todo idioma', () => {
    // Usava a chave do TÍTULO da seção, que é plural: em inglês saía
    // "Players 1". Título de seção e nome de pessoa são textos diferentes.
    const esperado = { pt: 'Jogador 1', en: 'Player 1', es: 'Jugador 1', de: 'Spieler 1' };
    for (const [codigo] of LANGS) {
      setLang(codigo);
      eq(t('setup.playerN', { n: 1 }), esperado[codigo], codigo);
      ok(!t('setup.playerN', { n: 1 }).includes('{'), codigo + ': variável não interpolada');
      ok(t('setup.playerN', { n: 2 }) !== t('setup.players'),
        codigo + ': nome de jogador não pode ser o título da seção');
    }
    setLang('pt');
  }],

  ['a tela de conta aparece nas configurações quando há nuvem', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');

    const conta = findAll(document.body, 'account')[0];
    if (!cloudEnabled()) {
      ok(!conta, 'sem nuvem configurada, nada de conta na tela');
      closeSheet();
      return;
    }

    ok(conta, 'com nuvem, a seção de conta precisa existir');
    eq(accountNow(), 'deslogado', 'ninguém entrou ainda');

    // E-mail e senha: entrar num aparelho novo não pode depender de abrir a
    // caixa de entrada. O link por e-mail continua ali, como recuperação.
    const campos = findAll(conta, 'search-input');
    eq(campos.length, 2, 'e-mail e senha');
    eq(campos[1].attributes.type, 'password', 'o segundo campo é senha');
    eq(campos[1].attributes.autocomplete, 'current-password',
      'o gerenciador de senhas do aparelho precisa reconhecer o campo');
    ok(findAll(conta, 'account-link').length === 1, 'o link por e-mail segue disponível');

    // Botão de provedor social só existe se o servidor disser que está ligado.
    const rotulos = findAll(conta, 'btn').map(textOf);
    const temGoogle = rotulos.some((x) => x.includes('Google'));
    eq(temGoogle, provedores().includes('google'),
      'botão do Google precisa acompanhar o que o servidor aceita');
    closeSheet();
  }],

  ['sessão vencida com refresh não é sessão perdida', () => {
    // Este era o bug: guardava-se o refresh_token e nunca se usava, então a
    // sessão morria em uma hora e a pessoa tinha de pedir e-mail de novo. Para
    // sempre. Descartar a sessão vencida aqui era o que fechava a porta.
    const agora = 1000000000000;
    const hora = 3600 * 1000;

    const viva = { access_token: 'a', expires_at: (agora + hora) / 1000 };
    const vencidaComRefresh = { access_token: 'a', refresh_token: 'r', expires_at: (agora - hora) / 1000 };
    const vencidaSemRefresh = { access_token: 'a', expires_at: (agora - hora) / 1000 };

    ok(sessaoAproveitavel(viva, agora), 'sessão no prazo serve');
    ok(sessaoAproveitavel(vencidaComRefresh, agora), 'vencida com refresh se renova');
    ok(!sessaoAproveitavel(vencidaSemRefresh, agora), 'vencida sem refresh acabou');
    ok(!sessaoAproveitavel(null, agora), 'nenhuma sessão');

    // A margem evita o caso em que o token vence ENTRE decidir e o pedido
    // chegar ao servidor - rede lenta e relógio de aparelho fora de hora.
    ok(!precisaRenovar(viva, agora), 'faltando uma hora, não mexe');
    ok(precisaRenovar({ ...vencidaComRefresh, expires_at: (agora + 30000) / 1000 }, agora),
      'faltando 30s, renova antes de usar');
    ok(!precisaRenovar(viva, agora), 'sem refresh_token não há o que renovar, mesmo no prazo');
    ok(precisaRenovar(vencidaComRefresh, agora), 'já vencida, renova');
    ok(!precisaRenovar(vencidaSemRefresh, agora), 'sem refresh não há o que renovar');
    ok(!precisaRenovar({ access_token: 'a', refresh_token: 'r' }, agora),
      'sem prazo declarado, não fica renovando à toa');

    // E a decisão de verdade: o que sai do disco. Uma regra correta guardada
    // num lugar que ninguém consulta não conserta nada - era exatamente aqui
    // que a sessão morria, e o teste da regra solta não perceberia.
    ok(sessaoGuardada(JSON.stringify(vencidaComRefresh), agora), 'volta do disco para ser renovada');
    ok(!sessaoGuardada(JSON.stringify(vencidaSemRefresh), agora), 'essa não volta');
    ok(!sessaoGuardada(null, agora), 'disco vazio');
    ok(!sessaoGuardada('{quebrado', agora), 'lixo no disco não derruba o app');
  }],

  ['cadastro não promete e-mail para quem já tem conta', () => {
    // Com confirmação de e-mail ligada, o GoTrue NÃO diz "esse e-mail já
    // existe" - responder isso transformaria o cadastro num verificador de
    // endereços para qualquer um. Ele devolve um usuário de fachada com
    // `identities` vazio, e esse array vazio é o único sinal.
    //
    // Sem lê-lo, o app dizia "confira sua caixa de entrada" para quem já tinha
    // conta, e a pessoa ficava esperando um e-mail que não ia resolver nada.
    ok(jaTinhaConta({ id: 'x', identities: [] }), 'array vazio: a conta já existia');
    ok(!jaTinhaConta({ id: 'x', identities: [{ provider: 'email' }] }), 'conta nova de verdade');
    ok(!jaTinhaConta({ access_token: 'a', identities: [] }),
      'se veio sessão, entrou - não importa o resto');
    ok(!jaTinhaConta(null), 'resposta vazia não é conta existente');
    ok(!jaTinhaConta({ id: 'x' }), 'sem o campo, não dá para afirmar nada');
  }],

  ['senha curta nem sai do aparelho', () => {
    ok(!senhaValida(''), 'vazia');
    ok(!senhaValida('1234567'), 'sete não bastam');
    ok(senhaValida('12345678'), 'oito bastam');
    ok(!senhaValida(null), 'nulo não explode');
  }],

  ['no computador nada da mesa vira de cabeça para baixo', () => {
    // Deitado na mesa, o teclado gira para o assento de quem age - é assim que
    // a pessoa lê o próprio ataque. Num monitor de pé, de frente para uma
    // pessoa só, o mesmo giro entregava a tela invertida.
    //
    // O sinal é o ponteiro, não o tamanho: tablet grande em paisagem tem a
    // largura de um notebook, e chutar por pixels erraria nos dois sentidos.
    ok(giraComOAssento(false), 'sem mouse: está na mesa, gira');
    ok(!giraComOAssento(true), 'com mouse ou trackpad: está de pé, não gira');

    // O valor que chega ao CSS, com unidade. Sem o sufixo, `rotate(0)` é
    // inválido e o navegador descarta a regra inteira em silêncio.
    eq(grausNaMesa(180, false), '180deg', 'na mesa, acompanha o assento');
    eq(grausNaMesa(180, true), '0deg', 'no computador, sempre de pé');
    eq(grausNaMesa(undefined, false), '0deg', 'assento sem giro declarado');

    // E que a leitura do ponteiro realmente chegue até a decisão.
    if (simulated) {
      const antes = globalThis.matchMedia;
      try {
        globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
        eq(rotatesToSeat(), false, 'ponteiro preciso: não gira');
        globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
        eq(rotatesToSeat(), true, 'sem ponteiro preciso: gira');
      } finally {
        globalThis.matchMedia = antes;
      }
    }
  }],

  ['escolher jogador oferece criar OU procurar conta', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');

    const abrirEscolha = () => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
      fire(findAll(root, 'seat-name')[0], 'click');
      flushFrames();
      const t2 = telas();
      return t2[t2.length - 1];
    };

    // Deslogado: só dá para digitar um nome. Procurar conta exigiria conta.
    eq(accountNow(), 'deslogado', 'cada caso começa sem sessão');
    ok(findAll(abrirEscolha(), 'search-input').length >= 1, 'sempre dá para digitar');
    eq(findAll(abrirEscolha(), 'is-find').length, 0, 'sem conta, não há o que procurar');
    closeSheet();

    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(capturarRetorno(), 'sessão capturada');

    const pane = abrirEscolha();
    ok(findAll(pane, 'search-input').length >= 1, 'caminho 1: digitar um nome');
    eq(findAll(pane, 'is-find').length, 1, 'caminho 2: procurar a conta');
    closeSheet();
    esquecerSessao();
  }],

  ['digitar o nome de quem já está na mesa é recusado', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });

    // A lista de salvos já desabilitava quem estava sentado, mas digitar o
    // mesmo nome na mão passava direto.
    // Os nomes vêm da tela, não do padrão: o rascunho é compartilhado entre
    // casos e pode ter sido mexido antes.
    const nomes = () => findAll(root, 'seat-name-text').map(textOf);
    const primeiro = nomes()[0];
    const jaSentado = nomes()[1];
    ok(primeiro !== jaSentado, 'as duas cadeiras começam com nomes distintos');

    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();
    const pane = telas()[telas().length - 1];
    const campo = findAll(pane, 'search-input')[0];
    const usar = findAll(pane, 'btn').find((b) => textOf(b) === t('player.use'));

    campo.value = jaSentado;
    fire(campo, 'input', { target: { value: jaSentado } });
    fire(usar, 'click');
    flushFrames();

    // Não avançou para o deck, e a cadeira não virou a segunda pessoa.
    const titulo = findAll(document.body, 'sheet-title').map(textOf).join(' ');
    ok(titulo !== t('commander.title'), 'não pode seguir para o deck com nome repetido');
    eq(nomes()[0], primeiro, 'a primeira cadeira continua sendo ela mesma');

    closeSheet();
  }],

  ['digitar um nome vai direto ao deck', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'seat-name')[0], 'click');
    flushFrames();

    const pane = telas()[telas().length - 1];
    findAll(pane, 'search-input')[0].value = 'Zé da Mesa';
    const usar = findAll(pane, 'btn').find((b) => textOf(b) === t('player.use'));
    ok(usar, 'o botão de usar o nome digitado');
    fire(usar, 'click');
    flushFrames();

    // Antes havia uma pergunta de @ no meio do caminho. Ela virou uma escolha
    // no INÍCIO - quem digitou um nome já decidiu que não vai vincular conta,
    // e perguntar de novo logo depois era refazer a pergunta já respondida.
    const titulo = findAll(document.body, 'sheet-title').map(textOf).join(' ');
    eq(titulo, t('commander.title'), 'o passo seguinte é o deck');
    closeSheet();
  }],

  ['o @ fica sob o nome, e some para quem não entrou', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');

    const desenhar = () => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
      return root;
    };

    // Deslogado: a regra que não pode quebrar. Quem nunca vai criar conta não
    // ganha um controle a mais na tela por causa de um recurso que não usa.
    eq(accountNow(), 'deslogado', 'cada caso começa sem sessão');
    eq(findAll(desenhar(), 'seat-handle').length, 0, 'sem conta, nada de @ na cadeira');

    // Agora com sessão. Entrar pelo fragmento é o mesmo caminho do link
    // mágico, então o teste usa a porta de entrada real e não um atalho.
    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(capturarRetorno(), 'a sessão foi capturada da URL');
    ok(accountNow() !== 'deslogado', 'agora há sessão');

    const root = desenhar();
    const cartoes = findAll(root, 'seat-card');
    const linhas = findAll(root, 'seat-handle');
    ok(cartoes.length >= 2, 'a home desenha as cadeiras');
    eq(linhas.length, cartoes.length, 'uma linha de @ por cadeira');

    // Sob o NOME, não solto no canto do cartão: tem de estar no mesmo bloco de
    // texto que o nome e o deck. Antes era um chip na borda, longe daquilo que
    // descrevia e disputando espaço com a alça de arrastar.
    const info = linhas[0].closest('.seat-info');
    ok(info, 'a linha do @ mora dentro de .seat-info');

    const irmaos = info.childNodes.filter((n) => n && n.classList);
    const iNome = irmaos.findIndex((n) => n.classList.contains('seat-name'));
    const iArroba = irmaos.findIndex((n) => n.classList.contains('seat-handle'));
    ok(iNome >= 0 && iArroba >= 0, 'nome e @ estão os dois na coluna');
    ok(iArroba > iNome, 'o @ vem DEPOIS do nome, não antes');

    esquecerSessao();
  }],

  ['o @ é normalizado antes de qualquer coisa', () => {
    eq(normalizarHandle('  @AlienPls '), 'alienpls', 'tira arroba, espaço e caixa');
    eq(normalizarHandle('@@alex'), 'alex', 'arroba repetida');
    eq(normalizarHandle(null), '', 'nulo não explode');
    eq(exibirHandle('AlienPls'), '@alienpls', 'na tela volta com arroba');
    eq(exibirHandle(''), '', 'sem @ não inventa arroba');

    ok(handleValido('@AlienPls'), 'o que a pessoa digita costuma ter arroba e maiúscula');
    ok(handleValido('abc'), 'mínimo de 3');
    ok(!handleValido('ab'), 'curto demais');
    ok(!handleValido('a'.repeat(21)), 'longo demais');
    ok(!handleValido('alex parma'), 'espaço no meio não vale');
    ok(!handleValido('alex@exemplo.com'), 'e-mail não é @ público');
    ok(!handleValido('alex-parma'), 'só letra, número e sublinhado');
  }],

  ['só cadeira marcada com @ vira convite', () => {
    // A regra que não pode quebrar: quem nunca vai criar conta continua usando
    // o app exatamente como antes. Cadeira é texto livre, e assim segue.
    const match = {
      id: 'p1',
      seats: [
        { id: 's1', name: 'Alexandre', handle: '@AlienPls' },
        { id: 's2', name: 'Bruno' },
        { id: 's3', name: 'Carla', handle: '   ' },
        { id: 's4', name: 'Davi', handle: 'nome invalido!' },
      ],
    };

    const linhas = participantesDe(match);
    eq(linhas.length, 1, 'três das quatro cadeiras não viram convite nenhum');
    eq(linhas[0].seat_id, 's1');
    eq(linhas[0].handle, 'alienpls', 'vai normalizado para o banco');
    eq(linhas[0].match_id, 'p1');
    eq(linhas[0].user_id, null, 'sem @ resolvido ainda, a cadeira fica sem dono');

    eq(participantesDe(null).length, 0, 'sem partida, sem convite');
    eq(participantesDe({ seats: [{ id: 's1', handle: 'alex' }] }).length, 0,
      'partida sem id não gera linha órfã');
  }],

  ['convite aparece mesmo quando a partida não vem junto', () => {
    // É o portão funcionando, não um erro. Quem não assina precisa VER que há
    // partidas esperando - senão nunca aceita e nunca soube que existiam. O
    // convite é livre; ler o conteúdo é que é pago.
    const linhas = [
      { match_id: 'p1', seat_id: 's1', status: 'pendente', handle: 'alienpls' },
      { match_id: 'p2', seat_id: 's3', status: 'pendente', handle: 'alienpls' },
    ];
    const semAssinar = montarConvites(linhas, []);
    eq(semAssinar.length, 2, 'os dois convites aparecem');
    ok(semAssinar.every((c) => c.match === null), 'sem assinatura, nada do conteúdo');
    eq(semAssinar[0].matchId, 'p1');

    const assinando = montarConvites(linhas, [{ id: 'p2', seats: [] }]);
    eq(assinando[0].match, null, 'esta ainda não veio');
    ok(assinando[1].match, 'esta veio e pode ser mostrada');

    eq(montarConvites(null, null).length, 0, 'listas vazias não explodem');
  }],

  ['o canal sai do caminho da URL', () => {
    eq(canalDe('/hit-easy/'), 'producao', 'raiz publicada');
    eq(canalDe('/hit-easy/beta/'), 'beta', 'canal de teste');
    eq(canalDe('/hit-easy/beta/index.html'), 'beta', 'arquivo dentro do beta');
    eq(canalDe('/'), 'producao', 'servidor local');
    // 'beta' tem de ser um trecho inteiro do caminho, não pedaço de palavra.
    eq(canalDe('/hit-easy/betamax/'), 'producao', 'não é o canal beta');
    eq(canalDe('/beta-teste/'), 'producao', 'nem esse');
  }],

  ['produção não pode mudar de chave ao ganhar um canal de teste', () => {
    // localStorage é por ORIGEM. Separar beta de produção é obrigatório - mas
    // se a separação mexesse também no nome usado em produção, todo mundo que
    // já usa o app abriria o histórico vazio. O beta ganha sufixo; produção não
    // muda um byte. Este teste existe para que ninguém "arrume" isso depois.
    const chaveDe = (canal, base) => (canal === 'beta' ? base + '.beta' : base);
    eq(chaveDe('producao', 'mtglc.db.v1'), 'mtglc.db.v1', 'histórico de produção intocado');
    eq(chaveDe('producao', 'mtglc.session.v1'), 'mtglc.session.v1', 'sessão intocada');
    ok(chaveDe('beta', 'mtglc.db.v1') !== 'mtglc.db.v1', 'beta escreve em outro lugar');
  }],

  ['o service worker só apaga cache do próprio canal', () => {
    // O activate antes apagava todo cache que não fosse o atual. Com dois canais
    // na mesma origem, quem ativasse por último derrubaria o app offline do
    // outro - e ainda o de qualquer outra página hospedada no mesmo domínio.
    eq(canalDoCache('hiteasy-shell-v26'), 'producao', 'nome antigo continua sendo de produção');
    eq(canalDoCache('hiteasy-art-v27'), 'producao');
    eq(canalDoCache('hiteasy-beta-shell-v27'), 'beta');
    eq(canalDoCache('workbox-precache-de-outro-app'), null, 'cache alheio não se toca');
    eq(canalDoCache(''), null);

    const CANAL = 'producao', SHELL = 'hiteasy-shell-v27', ART = 'hiteasy-art-v27';
    const apagar = (nomes) => nomes.filter(
      (k) => canalDoCache(k) === CANAL && k !== SHELL && k !== ART);

    eq(apagar([SHELL, ART, 'hiteasy-shell-v26', 'hiteasy-beta-shell-v27', 'outro-app-v1']),
      ['hiteasy-shell-v26'], 'só a versão velha do próprio canal');
  }],

  ['o pedido de link mágico leva redirect_to na query', () => {
    // O primeiro login real caiu em localhost:3000 porque o destino ia no CORPO,
    // como `options.email_redirect_to` - forma do SDK, não da API REST. O GoTrue
    // ignora campo que não conhece sem reclamar e usa o Site URL do projeto.
    // Um erro mudo assim só aparece com e-mail de verdade na mão; por isso o
    // formato do pedido virou função pura, para o teste olhar antes.
    const alvo = 'https://alienpls-vibes.github.io/hit-easy/';
    const { caminho, corpo } = pedidoDeLink(' Alex@Exemplo.com ', alvo);

    ok(caminho.startsWith('/auth/v1/otp?'), 'endpoint do OTP');
    const query = new URLSearchParams(caminho.slice(caminho.indexOf('?') + 1));
    eq(query.get('redirect_to'), alvo, 'destino precisa viajar na query');

    eq(corpo.email, 'Alex@Exemplo.com', 'espaços em volta não vão para o servidor');
    eq(corpo.create_user, true, 'primeiro acesso cria a conta');
    ok(!('options' in corpo), 'options é campo do SDK; a API REST o descarta calada');
    ok(!JSON.stringify(corpo).includes('redirect'), 'destino não pode ir só no corpo');
  }],

  ['o endereço de retorno não carrega fragmento nem query', () => {
    // Dois motivos. Um: pedir um segundo link estando com `#access_token=...` na
    // barra mandaria esse token dentro do e-mail. Dois: o endereço tem de bater
    // com a lista de Redirect URLs do Supabase, e sobra faz o servidor recusar.
    const sujo = {
      origin: 'https://alienpls-vibes.github.io',
      pathname: '/hit-easy/',
      search: '?x=1',
      hash: '#access_token=eyJhbGciOi',
    };
    const limpo = urlDeRetorno(sujo);
    eq(limpo, 'https://alienpls-vibes.github.io/hit-easy/', 'só origem e caminho');
    ok(!limpo.includes('access_token'), 'token jamais entra no pedido de link');
    ok(!limpo.includes('?'), 'sem query');
  }],

  ['senha errada mostra um erro visível no login', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    setLang('pt');
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');

    const conta = findAll(document.body, 'account')[0];
    ok(conta, 'a seção de conta');

    const aviso = findAll(conta, 'account-erro')[0];
    ok(aviso, 'existe um lugar para o erro aparecer');
    ok(!aviso.classList.contains('is-on'), 'sem erro, ele não ocupa espaço');

    // Erra o e-mail e aperta entrar: antes isso era um parágrafo cinza depois
    // dos dois botões, fora do campo de visão de quem acabou de errar.
    const entrar = findAll(conta, 'btn').find((b) => textOf(b) === t('account.signIn'));
    ok(entrar, 'o botão de entrar');
    fire(entrar, 'click');

    ok(aviso.classList.contains('is-on'), 'o erro aparece');
    eq(textOf(aviso), t('account.invalidEmail'), 'e diz o que houve');

    // Mexer no campo apaga: a mensagem falava do que estava ali antes.
    const campos = findAll(conta, 'search-input');
    fire(campos[0], 'input', { target: { value: 'a@b.co' } });
    ok(!aviso.classList.contains('is-on'), 'corrigir o campo limpa o aviso');

    closeSheet();
  }],

  ['e-mail inválido não dispara pedido de link', () => {
    if (!simulated) return 'skip';
    // Sem isto, cada dedo errado vira uma chamada à rede e um e-mail perdido.
    const valido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
    ok(valido('a@b.co'), 'mínimo aceitável');
    ok(valido(' alex@exemplo.com '), 'espaços em volta não invalidam');
    ok(!valido('alex@exemplo'), 'sem domínio de topo');
    ok(!valido('alex exemplo.com'), 'sem arroba');
    ok(!valido(''), 'vazio');
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
      // Cada caso comeca do zero.
      //
      // Sem isto o teste herda o idioma do SISTEMA. No Windows, em portugues,
      // os cem passavam; no Ubuntu do CI, em ingles, seis quebravam comparando
      // "Numero secreto" com "Secret number". Passar por acidente e pior que
      // falhar: o conjunto parecia verde sem provar nada sobre o idioma.
      //
      // O painel aberto vazava junto: um caso que falhava no meio deixava a
      // folha de pe e derrubava o seguinte, que acusava um erro que nao era
      // dele.
      setLang('pt');
      if (typeof closeSheet === 'function') closeSheet();
      esquecerSessao();

      const r = fn();
      if (r === 'skip') return { name, ok: true, skipped: true };
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, why: err.message };
    }
  });
}
