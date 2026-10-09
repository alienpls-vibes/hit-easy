/**
 * Casos de teste do motor - fonte unica.
 *
 * Nao toca no DOM de proposito: os mesmos casos rodam no Node
 * (`npm test`) e no navegador (`tests.html`). Um teste que so passa num
 * dos dois nao vale muito.
 */

// Primeiro de todos: instala o DOM simulado antes que ui.js seja avaliado.
import {
  simulated, flushFrames, findAll, fire, textOf, simularTeclado, kbAtual,
  apontarPara, fireWindow, historico,
} from './dom-stub.js';
import {
  createMatch, replay, push, undo, standings, elapsedOf, pessoaRepetida, partidaValida,
  sairDaMesa, voltarAMesa, ausenteEntre, juntarDecks, deckKeyOf,
  passarAMesa, retomarAMesa, mesaPassada, receberAMesa, agoraDaMesa,
  cmdKeyOf, CMD_LETHAL, POISON_LETHAL,
} from '../src/engine.js';
import {
  ORDENACOES, ordenacaoPorId, ordenarLinhas,
  aggregate, rivalries, tituloDaVotacao, totalDamage, summarize,
  playerColorOrder, playerColor,
  identityOf, labelOf, nomeRegistrado,
  chaveDaVotacao, rotuloDaVotacao, orientarRival,
  categoriaDaVotacao, rotuloDaCategoria,
} from '../src/stats.js';
import {
  LAYOUTS, variantsFor, layoutFor, shapesOf, seatAngle, orientOf, layoutDaPartida,
} from '../src/seating.js';
import { createSession, cast, tally, pending, isComplete, describe } from '../src/vote.js';
import {
  openFlow, closeSheet, dismissOnBackdrop, el, isSheetOpen, onSheetChange,
  alturaDoTeclado,
} from '../src/ui.js';
import { DICTS, LANGS, t, tn, setLang, currentLang, ordinal } from '../src/i18n.js';
import { fromRow as linhaParaPartida } from '../src/cloud.js';
import {
  accountState, assinaturaAtiva, sessaoValida, toRow, fromRow, pendentes,
  state as accountNow, provedores, pedidoDeLink, urlDeRetorno,
  capturarRetorno, esquecerSessao, precisaRenovar, sessaoAproveitavel, senhaValida,
  podeVerEstatisticas, assinaturaConhecida,
  jaTinhaConta,
  sessaoGuardada,
  normalizarHandle, handleValido, exibirHandle, participantesDe, montarConvites,
  colunaDeDecks, baixarPartidas, idsRemotos,
  enviarPartida, enviarParticipantes, salvarMeusDecks, conta,
  confiarEm, deixarDeConfiar, convitesPendentes,
  situacaoDoHandle, normalizarNome, NOME_MAX, salvarHandle, salvarNome,
} from '../src/cloud.js';
import { handleBlock } from '../src/views/setup/handle.js';
import { accountBlock } from '../src/views/setup/conta.js';
import { cloudEnabled } from '../src/config.js';
import { canalDe, canalDoCache } from '../src/canal.js';
import { NOVIDADES, novidadesDesde, novidadesDe } from '../src/novidades.js';
import { abrirNovidades } from '../src/views/setup.js';
// Direto da peca: o bloco de instalacao e detalhe das configuracoes, e
// exporta-lo na porta o anunciaria como API publica da tela.
import { installBlock } from '../src/views/setup/instalar.js';
import { navegadorDoIOS } from '../src/install.js';
import { APP_VERSION } from '../src/version.js';
import {
  aSubir, aBaixar, aApagar, podeSincronizar,
  cadeirasParaAssociar, apelidosAprendidos, associarConta, decksMudaram,
} from '../src/sync.js';
import { giraComOAssento, grausNaMesa, rotatesToSeat } from '../src/orientation.js';
import { renderTable } from '../src/views/table.js';
// Direto da peca, e nao pela porta: a cadencia do "segurar repete" e detalhe
// interno da mesa, e exporta-la no barril a anunciaria como API publica.
import { repetirSegurando } from '../src/views/table/pecas.js';
import {
  COMMIT_MS, CONTAGEM_MS, CONTAGEM_PASSO_MIN, DOUBLE_TAP_MS, HOLD_DELAY,
  REPEAT_ACCEL_AFTER, REPEAT_FAST_MS, REPEAT_MS,
} from '../src/views/table/constantes.js';
import {
  renderSetup, seedDraftFrom, continuarMesaBanner, nomeDoArquivo,
  mesaPassadaBanner, passarMesa, abrirReceberMesa, linkDaMesa,
} from '../src/views/setup.js';
import {
  normalizarCodigo, codigoValido, formatarCodigo, codigoNoTexto,
} from '../src/cloud.js';
import { renderStats, renderPaywall } from '../src/views/stats.js';
import { brandMark } from '../src/ui.js';
import * as store from '../src/store.js';
// Importar app.js JA e o teste: ele sobe sozinho ao ser avaliado.
import { anunciarVersao, codigoDoLink } from '../src/app.js';

function eq(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((what || 'valor') + ': esperado ' + e + ', veio ' + a);
}

function ok(cond, what) {
  if (!cond) throw new Error(what || 'condicao falsa');
}

/**
 * Relogio controlado, para medir gesto que depende de tempo.
 *
 * runAll() e sincrono (nao ha `await` aqui), entao esperar de verdade nao e
 * opcao: dormir dois segundos por caso multiplicaria a suite, e medir
 * "quantos passos sairam de uma seguradinha" exigiria adivinhar. Trocando os
 * temporizadores, o teste ANDA o relogio e conta exatamente.
 *
 * Devolve o que `fn(avancar)` devolver, e restaura os temporizadores de
 * verdade mesmo se o caso falhar no meio - senao o proximo caso rodaria com o
 * relogio parado e acusaria um erro que nao e dele.
 */
/**
 * Ids de temporizador NUNCA se repetem, nem entre chamadas.
 *
 * Reiniciar em 1 a cada relógio novo produziu um defeito difícil: módulos do
 * app guardam id em variável de módulo (`toastTimer` em ui.js, por exemplo) e
 * chamam `clearTimeout` nela. Esse id sobrevive ao fim do caso; no caso
 * seguinte, o relógio novo entregava o MESMO número a outro temporizador, e o
 * `clearTimeout` do toast cancelava uma animação que nada tinha a ver com ele.
 *
 * O sintoma era perfeito para enganar: um dos quatro números parava de contar,
 * sempre o mesmo, e só dentro da suíte - rodando isolado funcionava.
 */
let proximoIdFalso = 1000000;

function comRelogioFalso(fn) {
  const reais = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  };

  let agora = 0;
  const agendados = new Map();

  globalThis.setTimeout = (f, ms = 0) => {
    const id = proximoIdFalso; proximoIdFalso += 1;
    agendados.set(id, { quando: agora + ms, cada: null, fn: f });
    return id;
  };
  globalThis.setInterval = (f, ms = 0) => {
    const id = proximoIdFalso; proximoIdFalso += 1;
    agendados.set(id, { quando: agora + ms, cada: ms, fn: f });
    return id;
  };
  globalThis.clearTimeout = (id) => { agendados.delete(id); };
  globalThis.clearInterval = (id) => { agendados.delete(id); };

  /** Anda o relogio, rodando o que vencer no caminho, em ordem de tempo. */
  const avancar = (ms) => {
    const fim = agora + ms;
    // Teto de seguranca: um intervalo de 0ms que se reagenda sozinho travaria
    // a suite em vez de falhar.
    for (let volta = 0; volta < 20000; volta += 1) {
      let alvo = null;
      for (const [id, tarefa] of agendados) {
        if (tarefa.quando <= fim && (!alvo || tarefa.quando < alvo.tarefa.quando)) {
          alvo = { id, tarefa };
        }
      }
      if (!alvo) break;
      agora = alvo.tarefa.quando;
      if (alvo.tarefa.cada === null) agendados.delete(alvo.id);
      else alvo.tarefa.quando = agora + alvo.tarefa.cada;
      alvo.tarefa.fn();
    }
    agora = fim;
  };

  try {
    return fn(avancar);
  } finally {
    Object.assign(globalThis, reais);
  }
}

/** Monta a mesa no DOM simulado e devolve o que os casos de gesto precisam. */
function mesaNaTela(m) {
  document.body.childNodes.length = 0;
  const root = document.createElement('div');
  const view = renderTable(root, {
    match: m, onChange() {}, onStats() {}, onFinish() {}, onDiscard() {},
  });
  return { root, view, tiles: findAll(root, 'tile') };
}

const eventosDeVida = (m) => m.events.filter((e) => e.type === 'life');

/**
 * O botão de estatísticas da home, em qualquer idioma.
 *
 * A home é desenhada no ARRANQUE do app.js, com o idioma que o sistema
 * informa - antes de o runAll trocar para português. Comparar com um texto
 * fixo passava no Windows em português e quebrava no Ubuntu do CI, em inglês.
 */
function botaoDeEstatisticas() {
  const rotulos = LANGS.map(([codigo]) => DICTS[codigo]['common.stats']);
  return findAll(document.getElementById('app'), 'icon-btn')
    .find((b) => rotulos.includes(b.attributes['aria-label']));
}

/** Abaixo de HOLD_DELAY: um toque que nao chega a virar repeticao. */
const TOQUE_CURTO = HOLD_DELAY - 100;

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

  ['o convite sempre carrega o @, mesmo sem saber o id da conta', () => {
    // O defeito que isto guarda: quando o aparelho LEMBRA a que conta um nome
    // pertence, ele preenche o @ mas não o id - ele não tem, porque lembrar
    // existe justamente para não buscar de novo. A linha ia para o banco com
    // user_id nulo, e a política de resposta exige `user_id = auth.uid()`.
    // Em SQL null não é igual a nada: o convite nascia impossível de
    // reivindicar, sem erro e sem aviso.
    //
    // A correção é do servidor (sql/003), que resolve o @ ao inserir. O que o
    // cliente precisa garantir é a matéria-prima dessa resolução: nunca mandar
    // uma cadeira marcada sem o @.
    const match = createMatch([
      { id: 's0', name: 'Alexandre', handle: 'alienpls', userId: 'uid-1', commanders: [commander(0)] },
      { id: 's1', name: 'Bruno', handle: 'brunomtg', commanders: [commander(1)] },
      { id: 's2', name: 'Carla', commanders: [commander(2)] },
    ], 40);

    const linhas = participantesDe(match);
    eq(linhas.length, 2, 'só as cadeiras marcadas');
    ok(linhas.every((l) => l.handle && l.handle.length > 0),
      'toda linha leva o @: é por ele que o servidor descobre de quem é');

    const comId = linhas.find((l) => l.seat_id === 's0');
    const semId = linhas.find((l) => l.seat_id === 's1');
    eq(comId.user_id, 'uid-1', 'quando o cliente sabe o id, manda');
    eq(semId.user_id, null, 'quando não sabe, manda nulo - e o servidor resolve');
    eq(semId.handle, 'brunomtg', 'mas o @ vai sempre, senão não há como resolver');
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
    // O rótulo é o @, e não o nome mais recente. Enquanto era o nome, a mesma
    // pessoa aparecia como "Alexandre" neste aparelho e "Alex" no de quem
    // digitou diferente - com a identidade por baixo já unificada. O @ é o
    // único rótulo que significa a mesma coisa nos dois.
    eq(dele[0].label, '@alienpls', 'o rótulo de quem tem conta é o @');
    // Os nomes digitados não se perdem: viram o "registrado como".
    eq(dele[0].nomes, ['Alexandre', 'Alex'], 'os nomes que a mesa usou');
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
    // Com conta, o @ ganha do nome digitado: ver labelOf() em stats/agregar.js.
    eq(labelOf({ id: 's0', name: 'Ana', handle: 'alienpls' }), '@alienpls',
      'com conta, o rótulo é o @ mesmo havendo nome');
    eq(labelOf({ id: 's0', name: 'Ana' }), 'Ana', 'sem conta, o nome digitado');
    // E o apelido do aparelho também troca o rótulo, senão a mesma pessoa
    // voltaria a ter dois: o @ nas mesas marcadas e o nome nas antigas.
    eq(labelOf({ id: 's0', name: 'Alex' }, { alex: 'alienpls' }), '@alienpls',
      'apelido conhecido também mostra o @');
    eq(nomeRegistrado({ id: 's0', name: 'Ana', handle: 'alienpls' }), 'Ana',
      'o nome digitado fica disponível para o "registrado como"');
    eq(nomeRegistrado({ id: 's0', name: 'Ana' }), '',
      'sem conta o rótulo já é o nome, e repetir não informa nada');
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

  ['o arranque guarda de qual versão a pessoa veio', () => {
    // O recorte das notas depende disto, e era um IIFE rodando no import -
    // apagar a linha passava pela suite inteira sem uma falha.
    const vista = store.getDB().settings.versaoVista;
    const anterior = store.getDB().settings.versaoAnterior;
    try {
      ok(NOVIDADES.length > 1, 'o teste precisa de ao menos duas versões');
      const velha = NOVIDADES[1].versao;

      store.setSetting('versaoVista', velha);
      store.setSetting('versaoAnterior', null);
      const novas = anunciarVersao(APP_VERSION);

      eq(store.getDB().settings.versaoAnterior, velha,
        'não guardou de onde a pessoa veio');
      eq(store.getDB().settings.versaoVista, APP_VERSION,
        'não marcou a versão de agora como vista');
      eq(novas.map((n) => n.versao), [NOVIDADES[0].versao],
        'anunciou mais que a diferença');

      // Reabrir na mesma versão não pode zerar o recorte: zerado, as notas do
      // menu voltariam a ser o histórico inteiro.
      eq(anunciarVersao(APP_VERSION), [], 'anunciou sem ter mudado de versão');
      eq(store.getDB().settings.versaoAnterior, velha,
        'reabrir na mesma versão apagou de onde a pessoa veio');

      // Instalação nova: nada a anunciar, e nada a lembrar.
      store.setSetting('versaoVista', null);
      store.setSetting('versaoAnterior', null);
      eq(anunciarVersao(APP_VERSION), [], 'anunciou para quem instalou agora');
      eq(store.getDB().settings.versaoAnterior, null,
        'inventou uma versão anterior numa instalação nova');
    } finally {
      store.setSetting('versaoVista', vista || null);
      store.setSetting('versaoAnterior', anterior || null);
    }
    return undefined;
  }],

  ['as notas abrem no que entrou desde a versão anterior', () => {
    if (!simulated) return 'skip';
    // O recorte é o que torna a tela legível: com o histórico inteiro, as três
    // linhas novas ficam embaixo de nove versões já lidas e o que a pessoa
    // aprende é a fechar a tela sem ler.
    const antes = store.getDB().settings.versaoAnterior;
    try {
      ok(NOVIDADES.length > 2, 'o teste precisa de ao menos três versões');
      const penultima = NOVIDADES[1].versao;

      store.setSetting('versaoAnterior', penultima);
      abrirNovidades();
      // Na folha ABERTA, e nao em `document.body`: closeSheet remove o no
      // depois de 200ms, e num teste sincrono a folha anterior ainda esta no
      // documento - as duas somavam e a contagem dava 12 onde ha 11.
      const folha = () => findAll(document.body, 'sheet').slice(-1)[0];
      const versoes = () => findAll(folha(), 'news-version').map((n) => textOf(n));

      eq(versoes(), [NOVIDADES[0].versao],
        'veio mais que a diferença desde a versão anterior');

      // A saída para o histórico existe: esconder não pode virar apagar.
      const tudo = findAll(folha(), 'news-all')[0];
      ok(tudo, 'sem o caminho para ver todas as versões');
      fire(tudo, 'click');
      eq(versoes().length, NOVIDADES.length,
        '"ver todas" não mostrou o histórico inteiro');

      // E no histórico inteiro o botão não se repete: não há mais o que abrir.
      eq(findAll(folha(), 'news-all').length, 0,
        'o botão de ver todas apareceu na tela que já mostra todas');
      closeSheet();

      // Instalação nova: sem versão anterior, só as notas desta versão. O
      // histórico de mudanças de um app que a pessoa nunca usou é ruído antes
      // do primeiro uso.
      store.setSetting('versaoAnterior', null);
      abrirNovidades();
      eq(versoes(), [APP_VERSION],
        'instalação nova devia ver só as notas da versão instalada');
      closeSheet();

      // Uma lista explicita ainda manda: e o caminho do arranque, que ja sabe
      // exatamente o que a pessoa nao viu.
      abrirNovidades([NOVIDADES[1]]);
      eq(versoes(), [NOVIDADES[1].versao], 'a lista passada foi ignorada');
    } finally {
      closeSheet();
      store.setSetting('versaoAnterior', antes || null);
    }
    return undefined;
  }],

  ['o botão de atualizar mostra que está atualizando', () => {
    if (!simulated) return 'skip';
    // O botão espera até dez segundos em silêncio: consulta a rede e depois
    // aguarda o worker novo assumir. Apenas desabilitado, ele escurece e fica
    // parado - indistinguível de um botão que não funcionou.
    //
    // `navigator.standalone` é o que faz `state()` dizer 'instalado', que é a
    // única situação em que este botão existe.
    const tinha = Object.prototype.hasOwnProperty.call(navigator, 'standalone');
    Object.defineProperty(navigator, 'standalone', {
      value: true, configurable: true, writable: true,
    });
    try {
      const box = installBlock();
      const botao = findAll(box, 'set-row')[0];
      ok(botao, 'instalado, deveria haver o botão de atualizar');
      eq(findAll(botao, 'spinner').length, 0, 'girador antes de tocar');

      // O girador entra ANTES do await, então já está lá no instante do toque -
      // é o que o teste síncrono consegue provar, e é o que importa: o retorno
      // tem de ser imediato, não depois da rede.
      fire(botao, 'click');
      eq(findAll(botao, 'spinner').length, 1, 'tocou e não apareceu girador');
      ok(botao.disabled, 'o botão continuou clicável durante a espera');
      ok(botao.className.includes('is-updating'), 'sem a classe de espera');
      ok(textOf(botao).includes(t('settings.updating')),
        'o rótulo não disse que está atualizando');
    } finally {
      if (!tinha) delete navigator.standalone;
      else navigator.standalone = false;
    }
    return undefined;
  }],

  ['mesa passada não abre a tela de jogo', () => {
    if (!simulated) return 'skip';
    // O bastão cobrado onde é barato cobrar. Dentro da mesa seriam vinte
    // controles para desabilitar, e esquecer um basta para existirem duas
    // cópias vivas da mesma partida.
    store.wipe();
    try {
      const m = mesa(4);
      m.id = 'p-bastao';
      store.setCurrent(m);

      ok(store.getCurrent(), 'a mesa viva devia estar disponível');

      passarAMesa(m, 1234);
      store.setCurrent(m);

      // A invariante, e não um `if` no roteador: para o resto do app a mesa
      // passada simplesmente não existe. Assim todo caminho que já tratava
      // "não há mesa aberta" trata este caso de graça - e não há uma linha
      // de guarda que alguém possa apagar sem nada quebrar.
      eq(store.getCurrent(), null, 'a mesa passada ainda conta como a de agora');
      ok(store.mesaGuardada(), 'a mesa passada sumiu do aparelho');
      eq(store.mesaGuardada().id, 'p-bastao');

      // Redesenhar a home com a mesa passada: o aviso aparece, e é ele que
      // explica por que o jogo sumiu.
      const raiz = document.createElement('div');
      renderSetup(raiz, { onStart() {}, onStats() {}, onRefresh() {} });
      ok(findAll(raiz, 'passada').length === 1,
        'a home não avisou que a mesa foi passada');

      // E o botão de receber está lá para quem vai continuar.
      ok(findAll(raiz, 'receber-mesa').length === 1,
        'a home não oferece receber uma mesa');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['deixar de confiar grava a recusa, em vez de apagar a linha', () => {
    if (!simulated) return 'skip';
    // Com o aceite automatico vindo do historico, apagar a linha nao desfaz
    // nada: o gatilho a refaz a partir das partidas ja jogadas, e a pessoa
    // tocaria o botao todo mes sem entender por que ele nao tem efeito.
    const fetchReal = globalThis.fetch;
    const sessaoReal = conta.sessao;
    const pedidos = [];
    globalThis.fetch = (u, o) => {
      pedidos.push({ url: String(u), metodo: (o && o.method) || 'GET',
        corpo: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    };
    conta.sessao = { user: { id: 'eu' }, access_token: 'x' };

    try {
      deixarDeConfiar('aquele-anfitriao');
      const p1 = pedidos[pedidos.length - 1];
      eq(p1.metodo, 'POST', 'recusar ainda apaga a linha em vez de gravar');
      eq(p1.corpo.confia, false, 'a recusa não foi gravada como recusa');
      eq(p1.corpo.host_id, 'aquele-anfitriao');

      confiarEm('aquele-anfitriao');
      const p2 = pedidos[pedidos.length - 1];
      eq(p2.corpo.confia, true, 'confiar não gravou confiança');

      // Trocar de ideia precisa valer: com ignore-duplicates o segundo toque
      // seria engolido e o botão pareceria quebrado.
      ok(String(p2.url).includes('trusted_hosts'));
      ok(!/ignore-duplicates/.test(JSON.stringify(p2)), 'conflito ignorado');
    } finally {
      globalThis.fetch = fetchReal;
      conta.sessao = sessaoReal;
    }
    return undefined;
  }],

  ['retomar leva de volta para a mesa, e não para a home', async () => {
    if (!simulated) return 'skip';
    // O defeito relatado, agora alcançável: o caminho passa por
    // `await confirmAction`, e o runner síncrono não conseguia observar nada
    // depois do await. Onze mutações não o pegaram - não por falta de teste,
    // por impossibilidade de teste.
    store.wipe();
    try {
      const m = mesa(4);
      m.id = 'p-retomada';
      passarAMesa(m, 1000);
      store.setCurrent(m);

      let redesenhos = 0;
      let aberturas = 0;
      const banner = mesaPassadaBanner(() => { redesenhos += 1; },
        () => { aberturas += 1; });
      ok(banner, 'sem mesa passada não há o que testar');

      const retomar = findAll(banner, 'btn')[0];
      ok(retomar, 'o aviso não oferece retomar');
      fire(retomar, 'click');

      // A confirmação abre numa folha; confirmar é o que dispara o resto.
      await Promise.resolve();
      const acoes = findAll(document.body, 'sheet-actions').slice(-1)[0];
      ok(acoes, 'retomar não pediu confirmação');
      fire(acoes.childNodes[1], 'click');
      await Promise.resolve();
      await Promise.resolve();

      ok(store.getCurrent(), 'retomou e a mesa não voltou a valer');
      eq(mesaPassada(store.mesaGuardada()), false, 'o carimbo ficou');
      eq(aberturas, 1, 'retomar não levou de volta para a mesa');
      eq(redesenhos, 0, 'retomar só redesenhou a home, que é onde a pessoa '
        + 'ficava presa sem caminho para a partida');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['receber um arquivo instala a mesa e abre ela', async () => {
    if (!simulated) return 'skip';
    // O defeito relatado: a mesa era instalada e a tela continuava na home -
    // só recarregar a página a encontrava, porque a rota inicial é a única
    // que olha para `getCurrent()` sozinha. A causa era o callback errado
    // chegando ao botão, e provar isso exige percorrer o caminho inteiro: sem
    // arquivo escolhido, nenhum callback é chamado e os dois parecem iguais.
    store.wipe();
    try {
      // Uma mesa empacotada por "outro aparelho".
      const original = mesa(4);
      original.id = 'p-chegando';
      push(original, { type: 'life', targetId: 's1', sourceId: 's0', delta: -11 });
      store.setCurrent(original);
      const arquivo = store.empacotarMesa(1000);
      store.wipe();

      let redesenhos = 0;
      let aberturas = 0;
      const raiz = document.createElement('div');
      renderSetup(raiz, {
        onStart() {}, onStats() {},
        onRefresh: () => { redesenhos += 1; },
        onAbrirMesa: () => { aberturas += 1; },
      });

      const receber = findAll(raiz, 'receber-mesa')[0];
      ok(receber, 'a home não oferece receber uma mesa');
      fire(receber, 'click');

      // Com nuvem, receber abre o campo de código; o arquivo fica a um toque,
      // em "Tenho um arquivo", para quando não há internet.
      if (cloudEnabled()) {
        const tenho = findAll(document.body, 'btn')
          .find((b) => textOf(b) === t('pass.haveFile'));
        ok(tenho, 'receber por código não oferece o arquivo');
        fire(tenho, 'click');
      }

      const campo = document.body.childNodes[document.body.childNodes.length - 1];
      eq(campo.attributes.type, 'file', 'tocar em receber não abriu o seletor');

      // O arquivo que a pessoa escolheu.
      campo.files = [{ name: 'mesa.json', text: () => Promise.resolve(arquivo) }];
      fire(campo, 'change');
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      const acoes = findAll(document.body, 'sheet-actions').slice(-1)[0];
      ok(acoes, 'receber não pediu confirmação');
      fire(acoes.childNodes[1], 'click');
      for (let i = 0; i < 4; i += 1) await Promise.resolve();

      const chegou = store.getCurrent();
      ok(chegou, 'a mesa não foi instalada');
      eq(chegou.id, 'p-chegando');
      eq(replay(chegou).players.s1.life, 40 - 11, 'a partida não chegou inteira');

      eq(aberturas, 1, 'instalou a mesa e não abriu ela: era preciso '
        + 'recarregar a página para a partida aparecer');
      eq(redesenhos, 0, 'receber só redesenhou a home');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['o arquivo da mesa carrega o id da partida', () => {
    // Nome fixo fazia duas mesas na pasta de downloads virarem
    // `mesa-hit-easy (1).json`, e aí ninguém sabe qual é qual - nem quem
    // envia, nem quem recebe.
    const a1 = mesa(4);
    const b1 = mesa(4);
    ok(a1.id !== b1.id, 'o teste precisa de duas partidas diferentes');

    const n1 = nomeDoArquivo(a1);
    const n2 = nomeDoArquivo(b1);
    ok(n1.includes(a1.id), 'o nome não leva o id: ' + n1);
    ok(n1 !== n2, 'duas mesas geraram o mesmo nome de arquivo');
    ok(n1.endsWith('.json'), 'o arquivo perdeu a extensão: ' + n1);

    // Caracteres que não se salvam em arquivo não podem passar. O id de hoje
    // só tem letras, números e `_`, mas descobrir o contrário no celular de
    // outra pessoa seria tarde.
    const sujo = nomeDoArquivo({ id: 'a/b\\c:d*e?f"g<h>i|j' });
    ok(!/[\/\\:*?"<>|]/.test(sujo), 'o nome saiu com caractere proibido: ' + sujo);

    // Sem id ainda produz um nome válido, em vez de 'mesa-hit-easy-.json'.
    eq(nomeDoArquivo(null), 'mesa-hit-easy.json');
    eq(nomeDoArquivo({ id: '' }), 'mesa-hit-easy.json');
  }],

  ['com partida aberta, a home oferece entrar nela', () => {
    if (!simulated) return 'skip';
    // O defeito relatado: retomar devolvia a mesa e deixava a pessoa parada na
    // home, sem caminho de volta para a partida - e o menu da mesa, onde mora
    // passar, ficava inalcancável. Era isso o "botão de mover a partida
    // sumiu".
    //
    // Normalmente este estado nem existe: o app abre direto na mesa quando há
    // partida. Retomar criou um estado novo, e a saída tem de existir venha
    // ele de onde vier.
    store.wipe();
    try {
      eq(continuarMesaBanner(() => {}), null, 'ofereceu entrar sem partida');

      const m = mesa(4);
      m.id = 'p-aberta';
      store.setCurrent(m);

      let abriu = 0;
      const banner = continuarMesaBanner(() => { abriu += 1; });
      ok(banner, 'com partida aberta, a home não ofereceu entrar nela');
      fire(banner, 'click');
      eq(abriu, 1, 'tocar em continuar não abriu a mesa');

      // Mesa passada NÃO conta: para o resto do app ela não existe, e
      // oferecer "continuar" levaria a uma tela que o roteador recusa.
      passarAMesa(m, 1000);
      store.setCurrent(m);
      eq(continuarMesaBanner(() => {}), null,
        'ofereceu continuar uma mesa que foi passada adiante');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['passar a mesa tira o bastão deste aparelho', () => {
    // O ponto inteiro: depois da passagem existem duas cópias com o mesmo id,
    // e o envio usa ignore-duplicates - a primeira que subir vence e a outra
    // some calada. Se o aparelho antigo continuasse jogando, seria ele que
    // perderia ou faria perder a metade de alguém.
    const m = mesa(4);
    eq(mesaPassada(m), false, 'mesa nova já nasceu passada');

    eq(passarAMesa(m, 5000), true, 'não passou');
    eq(mesaPassada(m), true, 'passou e não ficou marcada');
    eq(m.passadaEm, 5000);

    // Passar duas vezes não remarca: a data do bastão é a da primeira vez,
    // e reescrevê-la apagaria quando a mesa saiu daqui.
    eq(passarAMesa(m, 9000), false, 'passou de novo');
    eq(m.passadaEm, 5000, 'a data da passagem foi reescrita');

    // Retomar é a única porta de volta, e é explícita.
    eq(retomarAMesa(m), true);
    eq(mesaPassada(m), false, 'retomou e continuou marcada');
    eq(retomarAMesa(m), false, 'retomou uma mesa que não estava passada');

    eq(passarAMesa(null), false, 'passou uma mesa que não existe');
  }],

  ['a mesa recebida acerta o relógio para frente', () => {
    // Os eventos carregam o `ts` do aparelho que os gravou. Se o relógio de
    // quem recebe estiver atrasado, o próximo evento nasce ANTES do anterior -
    // e `elapsedOf` e `advanceTurn` subtraem instantes, então tempo andando
    // para trás vira duração negativa em cima da mesa.
    const m = mesa(4);
    m.startedAt = 1000000;
    m.events.push({ id: 'e1', ts: 1000000 + 600000, type: 'life', targetId: 's0', delta: -3 });
    passarAMesa(m, 1000000 + 600000);

    // Aparelho atrasado dez minutos: precisa de desvio.
    const atrasado = receberAMesa(m, 1000000);
    ok(atrasado.desvioDeRelogio > 600000,
      'relógio atrasado recebeu desvio pequeno demais: ' + atrasado.desvioDeRelogio);
    ok(agoraDaMesa(atrasado, 1000000) > 1000000 + 600000,
      'o próximo evento nasceria antes do último que já aconteceu');

    // Aparelho adiantado: nada a corrigir. Empurrar o relógio para frente sem
    // precisão infl aria a duração da partida.
    const adiantado = receberAMesa(m, 1000000 + 9999999);
    eq(adiantado.desvioDeRelogio, 0, 'relógio adiantado não devia ganhar desvio');

    // E a mesa chega jogavel: sem o carimbo e sem refazer.
    eq(mesaPassada(adiantado), false, 'a mesa chegou ainda marcada como passada');
    eq(adiantado.redo, []);
    eq(adiantado.id, m.id, 'o id mudou: a partida deixaria de ser a mesma');

    eq(receberAMesa({ id: 'x' }), null, 'aceitou uma mesa quebrada');
  }],

  ['o arquivo da mesa leva uma mesa, e não o seu histórico', () => {
    // O exportador de backup manda o banco inteiro. Usá-lo aqui entregaria ao
    // amigo todas as partidas de quem passou, os @ que o aparelho conhece e as
    // preferências. É o erro mais fácil de cometer e o mais caro.
    store.wipe();
    try {
      const antiga = mesa(4);
      antiga.id = 'p-antiga';
      antiga.events.push({ id: 'w', ts: antiga.startedAt + 1, type: 'win', targetId: 's0' });
      store.mesclarPartidas([antiga]);
      store.rememberPlayer('Bruno');

      const atual = mesa(4);
      atual.id = 'p-atual';
      store.setCurrent(atual);

      const texto = store.empacotarMesa(7777);
      ok(texto, 'não empacotou');
      ok(!texto.includes('p-antiga'), 'o arquivo levou o histórico junto');
      ok(!texto.includes('Bruno'), 'o arquivo levou os nomes que o aparelho conhece');

      const dado = store.lerMesa(texto);
      eq(dado.partida.id, 'p-atual');
      eq(dado.versao, store.VERSAO_MESA);

      // Empacotar JÁ solta a mesa: empacotar sem soltar deixaria duas cópias
      // vivas, que é o único jeito de perder dados aqui.
      eq(store.getCurrent(), null,
        'empacotou e a mesa continuou valendo como a de agora');
      eq(mesaPassada(store.mesaGuardada()), true, 'empacotou e não soltou');
      eq(store.empacotarMesa(8888), null, 'empacotou uma mesa já passada');

      // E o arquivo é recusado com motivo, em vez de abrir pela metade.
      const recusa = (texto2, esperado) => {
        try { store.lerMesa(texto2); } catch (e) { eq(e.message, esperado); return; }
        throw new Error('aceitou o que devia recusar: ' + esperado);
      };
      recusa('{{{', 'ilegivel');
      recusa(JSON.stringify({ history: [] }), 'nao-e-mesa');
      recusa(JSON.stringify({ formato: store.FORMATO_MESA, versao: 99, partida: atual }), 'versao-nova');
      recusa(JSON.stringify({ formato: store.FORMATO_MESA, versao: 1, partida: { id: 'x' } }), 'mesa-invalida');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['receber instala a mesa e o jogo continua de onde parou', () => {
    store.wipe();
    try {
      const m = mesa(4);
      m.id = 'p-viajante';
      push(m, { type: 'life', targetId: 's1', sourceId: 's0', delta: -7 });
      const vidaAntes = replay(m).players.s1.life;

      store.setCurrent(m);
      const texto = store.empacotarMesa(1000);

      // Outro aparelho, do zero.
      store.wipe();
      eq(store.getCurrent(), null);

      store.instalarMesa(store.lerMesa(texto), 2000);
      const chegou = store.getCurrent();
      ok(chegou, 'a mesa não foi instalada');
      eq(chegou.id, 'p-viajante');
      eq(replay(chegou).players.s1.life, vidaAntes,
        'a vida não sobreviveu à viagem');
      eq(mesaPassada(chegou), false, 'chegou marcada como passada: não dá para jogar');

      // E continua rendendo eventos novos, depois dos antigos.
      const ultimoAntes = chegou.events[chegou.events.length - 1].ts;
      push(chegou, { type: 'life', targetId: 's2', sourceId: 's0', delta: -2 });
      const novo = chegou.events[chegou.events.length - 1];
      ok(novo.ts > ultimoAntes,
        'o evento novo nasceu antes do último antigo: ' + novo.ts + ' <= ' + ultimoAntes);
      eq(replay(chegou).players.s2.life, 40 - 2);

      // Retomar desfaz, para o caso de a passagem não ter dado certo.
      passarAMesa(chegou, 3000);
      store.setCurrent(chegou);
      eq(store.getCurrent(), null, 'passada e ainda jogável');
      eq(store.retomarMesa(), true);
      ok(store.getCurrent(), 'retomou e a mesa não voltou a valer');
      eq(mesaPassada(store.getCurrent()), false);
      eq(store.retomarMesa(), false, 'retomou o que não estava passado');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['o que sobe leva o carimbo do canal', () => {
    // Produção e beta moram na mesma origem e na mesma base. O disco já era
    // separado por `chave()`; a nuvem não sabia o que era canal, e uma mesa de
    // teste subia para a mesma tabela que o app de verdade lê.
    const m = createMatch([
      { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
      { id: 's1', name: 'Bruno', handle: 'bruno', commanders: [commander(2)] },
    ], 40);
    m.id = 'p-canal';

    eq(toRow(m, 'dono-1', 'beta').canal, 'beta', 'a partida subiu sem o canal');
    eq(toRow(m, 'dono-1', 'producao').canal, 'producao');

    // Sem canal, 'producao'. O banco também põe esse padrão, e é o certo para
    // as linhas antigas - mas aqui o valor explícito é o que impede o caso
    // perigoso: o beta subindo carimbado como real por omissão.
    eq(toRow(m, 'dono-1').canal, 'producao', 'sem canal devia virar produção');

    // As cadeiras também. Uma cadeira marcada numa mesa de teste viraria
    // convite visível no app de verdade - o canal de teste escrevendo na vida
    // de outra pessoa.
    const cadeiras = participantesDe(m, 'beta');
    eq(cadeiras.length, 2, 'as duas cadeiras marcadas deviam virar linha');
    cadeiras.forEach((c, i) => {
      eq(c.canal, 'beta', 'cadeira ' + i + ' subiu sem o canal');
      eq(c.match_id, 'p-canal');
    });
    eq(participantesDe(m)[0].canal, 'producao', 'sem canal devia virar produção');
  }],

  ['os decks do perfil têm uma coluna por canal', () => {
    // `decks` guarda os decks que seguem a conta. Sem separar, uma mesa de
    // teste com comandantes inventados entraria no seletor de deck do app de
    // verdade - e o recurso existe justamente para o seletor conhecer os
    // decks da pessoa.
    eq(colunaDeDecks('beta'), 'decks_beta');
    eq(colunaDeDecks('producao'), 'decks');
    eq(colunaDeDecks(undefined), 'decks', 'sem canal devia ser a coluna real');
    eq(colunaDeDecks('qualquer-outra-coisa'), 'decks',
      'canal desconhecido não pode virar a coluna de teste');
  }],

  ['o beta sobe carimbado como beta, de ponta a ponta', () => {
    if (!simulated) return 'skip';
    // Cobrir só `toRow` não bastava: ela é pura e recebe o canal pronto. O
    // ponto que importa é onde `canal()` é CHAMADO, e trocar essa chamada por
    // 'producao' passava pela suite inteira - a mutação que significa, em
    // uma linha, "o beta envenena a base de verdade".
    const fetchReal = globalThis.fetch;
    const caminhoReal = location.pathname;
    const sessaoReal = conta.sessao;
    const perfilReal = conta.perfil;
    const corpos = [];

    globalThis.fetch = (u, o) => {
      corpos.push({ url: String(u), corpo: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve([]),
      });
    };
    conta.sessao = { user: { id: 'dono-de-teste' }, access_token: 'x' };
    conta.perfil = { id: 'dono-de-teste', handle: 'alienpls' };

    try {
      const m = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
        { id: 's1', name: 'Bruno', handle: 'bruno', commanders: [commander(2)] },
      ], 40);
      m.id = 'p-subida';

      const deMesa = () => corpos.find((c) => c.url.includes('/matches'));
      const deCadeira = () => corpos.find((c) => c.url.includes('/match_players'));
      const dePerfil = () => corpos.find((c) => c.url.includes('/profiles'));

      location.pathname = '/hit-easy/beta/';
      // As duas chamadas separadas de propósito: dentro de `enviarPartida` as
      // cadeiras só saem DEPOIS do `await` da partida, e este runner é
      // síncrono - esperar por elas aqui seria esperar para sempre.
      enviarPartida(m);
      enviarParticipantes(m);
      salvarMeusDecks([{ commanders: [commander(1)], lastUsed: 10 }]);

      ok(deMesa(), 'a partida não chegou a ser enviada');
      eq(deMesa().corpo.canal, 'beta',
        'o beta subiu a partida carimbada como produção');

      ok(deCadeira(), 'as cadeiras marcadas não foram enviadas');
      deCadeira().corpo.forEach((linha, i) => {
        eq(linha.canal, 'beta', 'cadeira ' + i + ' subiu com o canal errado');
      });

      ok(dePerfil(), 'os decks não chegaram a ser enviados');
      ok('decks_beta' in dePerfil().corpo,
        'o beta escreveu os decks na coluna de verdade: '
        + Object.keys(dePerfil().corpo).join(', '));
      ok(!('decks' in dePerfil().corpo), 'o beta tocou a coluna de produção');

      // E produção continua escrevendo onde sempre escreveu.
      corpos.length = 0;
      location.pathname = '/hit-easy/';
      const m2 = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(1)] },
      ], 40);
      m2.id = 'p-subida-2';
      enviarPartida(m2);
      salvarMeusDecks([{ commanders: [commander(1)], lastUsed: 10 }]);

      eq(deMesa().corpo.canal, 'producao', 'produção subiu fora do seu canal');
      ok('decks' in dePerfil().corpo, 'produção deixou de escrever em decks');
      ok(!('decks_beta' in dePerfil().corpo),
        'produção escreveu na coluna de teste');
    } finally {
      globalThis.fetch = fetchReal;
      location.pathname = caminhoReal;
      conta.sessao = sessaoReal;
      conta.perfil = perfilReal;
    }
    return undefined;
  }],

  ['o que desce filtra pelo canal deste app', () => {
    if (!simulated) return 'skip';
    // Carimbar na subida e não filtrar na descida deixaria tudo como estava:
    // produção continuaria baixando as partidas de teste. As duas pontas
    // precisam valer, e aqui a prova é a URL que sai de verdade.
    const fetchReal = globalThis.fetch;
    const caminhoReal = location.pathname;
    const pedidos = [];
    globalThis.fetch = (u, o) => {
      pedidos.push(String(u));
      return Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve([]),
      });
    };

    try {
      const ultima = () => pedidos[pedidos.length - 1];

      location.pathname = '/hit-easy/beta/';
      baixarPartidas();
      ok(ultima().includes('canal=eq.beta'),
        'o beta baixou sem filtrar o canal: ' + ultima());
      idsRemotos();
      ok(ultima().includes('canal=eq.beta'),
        'a lista de ids do beta não filtrou: ' + ultima());

      location.pathname = '/hit-easy/';
      baixarPartidas();
      ok(ultima().includes('canal=eq.producao'),
        'produção baixou sem filtrar o canal: ' + ultima());
      ok(!ultima().includes('beta'), 'produção pediu partidas de teste');
      idsRemotos();
      ok(ultima().includes('canal=eq.producao'),
        'a lista de ids de produção não filtrou: ' + ultima());
    } finally {
      globalThis.fetch = fetchReal;
      location.pathname = caminhoReal;
    }
    return undefined;
  }],

  ['ordenar sobe pela colocação e desce por todo o resto', () => {
    // A colocação é a única que inverte: primeiro lugar é 1, então o melhor é o
    // MENOR. Errar a direção aqui daria uma lista encabeçada pelo pior jogador
    // sob o rótulo "melhor colocação" - e ninguém olha duas vezes para uma
    // lista ordenada, que é justamente o que a torna perigosa.
    const linha = (key, extra) => ({
      key, label: key, games: 0, wins: 0, winrate: 0,
      avgDamageDealt: 0, avgKills: 0, avgPlace: 0, ...extra,
    });

    const linhas = [
      linha('pouco', { games: 1, wins: 1, winrate: 1, avgPlace: 3, avgDamageDealt: 10 }),
      linha('muito', { games: 10, wins: 8, winrate: 0.8, avgPlace: 1.2, avgDamageDealt: 90 }),
      linha('meio', { games: 5, wins: 2, winrate: 0.4, avgPlace: 2.1, avgDamageDealt: 50 }),
    ];

    const chaves = (id) => ordenarLinhas(linhas, id).map((l) => l.key);

    eq(chaves('partidas'), ['muito', 'meio', 'pouco'], 'partidas não desceu');
    eq(chaves('vitorias'), ['muito', 'meio', 'pouco'], 'vitórias não desceu');
    eq(chaves('dano'), ['muito', 'meio', 'pouco'], 'dano não desceu');
    eq(chaves('colocacao'), ['muito', 'meio', 'pouco'],
      'colocação não subiu: o melhor colocado tem de vir primeiro');

    // Taxa tem a armadilha conhecida: uma partida ganha é 100%. É o que a
    // pessoa pediu ao escolher taxa, e o teste registra que é de propósito.
    eq(chaves('taxa'), ['pouco', 'muito', 'meio'], 'taxa não desceu');

    // O padrão continua o de sempre, e um id que não existe mais cai nele em
    // vez de devolver a lista na ordem do Map.
    eq(chaves('relevancia'), chaves('id-que-nao-existe'),
      'id desconhecido não caiu no padrão');
    eq(ordenacaoPorId('nada').id, ORDENACOES[0].id);

    // Não mexe na lista de quem chamou: a tela ordena a cada repintura, e
    // ordenar no lugar embaralharia o agg que as outras abas estão lendo.
    //
    // Depois de uma ordem que REORDENA. A assertiva vinha depois de ordenar
    // por relevância, que nesta fixture devolve a ordem original - passava
    // igual com a lista mutada, e o teste de mutação foi quem contou.
    ordenarLinhas(linhas, 'partidas');
    eq(linhas.map((l) => l.key), ['pouco', 'muito', 'meio'], 'a lista original mudou');
  }],

  ['empate em partidas desempata por relevância, sempre igual', () => {
    // Metade de um grupo empata em duas partidas. Sem desempate explícito a
    // ordem vinha da inserção do Map, que muda quando se apaga uma partida
    // antiga: a lista se reorganizava sozinha sem aquele número ter mudado.
    const linha = (key, winrate) => ({ key, label: key, games: 2, wins: 1, winrate });
    const a = [linha('x', 0.1), linha('y', 0.9), linha('z', 0.5)];
    const b = [linha('z', 0.5), linha('x', 0.1), linha('y', 0.9)];

    eq(ordenarLinhas(a, 'partidas').map((l) => l.key), ['y', 'z', 'x']);
    eq(ordenarLinhas(b, 'partidas').map((l) => l.key), ['y', 'z', 'x'],
      'a mesma lista em outra ordem de entrada saiu diferente');
  }],

  ['todas as ordenações têm rótulo nas quatro línguas', () => {
    // Uma opção sem tradução aparece como a própria chave no seletor - e só
    // em alemão, que é exatamente o tipo de defeito que ninguém vê.
    const antes = currentLang();
    try {
      for (const lang of LANGS) {
        setLang(lang);
        for (const o of ORDENACOES) {
          const texto = t(o.rotulo);
          ok(texto && texto !== o.rotulo,
            'sem tradução de ' + o.rotulo + ' em ' + lang);
        }
      }
    } finally {
      setLang(antes);
    }
    return undefined;
  }],

  ['o seletor de ordem reordena as duas abas', () => {
    if (!simulated) return 'skip';
    store.wipe();
    let raiz = null;
    try {
      // Três partidas entre os mesmos dois: Ana ganha uma, Bruno duas. Assim
      // "melhor colocação" e "mais vitórias" apontam para o Bruno, e a lista
      // tem um primeiro lugar que se pode afirmar.
      // Bruno vence mais, Ana causa mais dano. As duas ordens apontam para
      // pessoas diferentes, e e isso que prova que o seletor manda: com uma
      // ordem que coincide com o padrao da agregacao, nao ordenar daria o
      // mesmo resultado e o teste passaria sem nada estar ligado.
      const partida = (id, vencedor) => {
        const m = createMatch([
          { id: 's0', name: 'Ana', commanders: [commander(1)] },
          { id: 's1', name: 'Bruno', commanders: [commander(2)] },
        ], 40);
        m.id = 'p-' + id;
        m.events.push({
          type: 'life', ts: m.startedAt + 1, targetId: 's1', sourceId: 's0', delta: -9,
        });
        m.events.push({ type: 'win', ts: m.startedAt + 2, targetId: vencedor });
        return m;
      };
      store.mesclarPartidas([partida('a', 's0'), partida('b', 's1'), partida('c', 's1')]);

      const root = document.createElement('div');
      raiz = root;
      renderStats(root, { onBack() {} });
      const painel = () => findAll(root, 'stats-panel')[0];
      const nomes = () => findAll(painel(), 'card-name').map((n) => textOf(n));
      const seletor = () => findAll(root, 'select-input')
        .find((c) => c.getAttribute('aria-label') === t('stats.sortBy'));

      ok(seletor(), 'a aba de Decks não tem o seletor de ordem');
      eq(nomes().length, 2, 'os dois decks deviam estar na lista');

      // Colocação é a direção invertida, a que erra calada: o deck do Bruno
      // tem de encabeçar, porque ele venceu mais.
      fire(seletor(), 'change', { target: { value: 'colocacao' } });
      eq(nomes()[0], 'Cmd 2',
        'por melhor colocação o primeiro devia ser o deck de quem venceu mais');

      fire(seletor(), 'change', { target: { value: 'partidas' } });
      eq(nomes().length, 2, 'ordenar por partidas perdeu uma linha');

      // A aba de Jogadores também tem o seletor, e reordena de verdade.
      fire(findAll(root, 'tab')[1], 'click');
      ok(seletor(), 'a aba de Jogadores não tem o seletor de ordem');
      eq(nomes().length, 2, 'a aba de Jogadores não listou os dois');

      // Por relevância (o padrão) o Bruno encabeça, porque venceu mais.
      eq(nomes()[0], 'Bruno', 'o padrão devia começar por quem venceu mais');

      // Por dano a lista INVERTE: Ana causou todo o dano. É a única forma de
      // provar que a aba ordena, em vez de só repetir a ordem da agregação.
      fire(seletor(), 'change', { target: { value: 'dano' } });
      eq(nomes()[0], 'Ana', 'por dano causado o primeiro devia ser quem bateu');

      fire(seletor(), 'change', { target: { value: 'colocacao' } });
      eq(nomes()[0], 'Bruno',
        'por melhor colocação o primeiro devia ser quem venceu mais');
    } finally {
      // Aba ativa e ordem são estado de MÓDULO da tela e sobrevivem ao caso.
      // Deixar a aba de Jogadores ligada fez o teste do filtro contar cartões
      // de jogador achando que contava decks - e a mensagem de falha acusava o
      // filtro, que não tinha nada a ver. Desfazer na raiz que este caso
      // criou, porque ela nunca foi anexada ao document.
      if (raiz) {
        const campo = findAll(raiz, 'select-input')
          .find((c) => c.getAttribute('aria-label') === t('stats.sortBy'));
        if (campo) fire(campo, 'change', { target: { value: 'relevancia' } });
        const primeira = findAll(raiz, 'tab')[0];
        if (primeira) fire(primeira, 'click');
      }
      store.wipe();
    }
    return undefined;
  }],

  ['juntar decks não repete, e fica com a data mais nova', () => {
    const deck = (n, quando) => ({ commanders: [commander(n)], lastUsed: quando });

    // Mesmo deck nas duas listas: fica a data mais recente, porque é ela que
    // responde "qual deck ele anda jogando".
    const juntos = juntarDecks([deck(1, 100), deck(2, 300)], [deck(1, 500)]);
    eq(juntos.length, 2, 'o mesmo deck entrou duas vezes');
    eq(juntos[0].lastUsed, 500, 'a lista não veio do mais recente para o mais antigo');
    eq(juntos[1].lastUsed, 300);

    // Lixo não entra: deck sem comandante não tem chave, e viraria uma linha
    // vazia no seletor.
    eq(juntarDecks([{ commanders: [] }, null], [undefined]).length, 0,
      'deck sem comandante entrou na lista');
  }],

  ['os decks só sobem para o perfil quando o conjunto muda', () => {
    // `lastUsed` muda a cada partida. Sem comparar por conjunto, toda
    // sincronização escreveria no perfil para dizer a mesma coisa.
    const deck = (n, quando) => ({ commanders: [commander(n)], lastUsed: quando });

    eq(decksMudaram([deck(1, 100)], [deck(1, 999)]), false,
      'a mesma lista com data diferente foi tratada como mudança');
    eq(decksMudaram([deck(1, 100), deck(2, 100)], [deck(1, 100)]), true,
      'um deck novo não foi notado');
    eq(decksMudaram([], []), false, 'duas listas vazias diferem');
    eq(decksMudaram([deck(1, 100)], undefined), true,
      'perfil sem decks devia receber a primeira lista');

    // A ordem não conta: é conjunto, não sequência.
    eq(decksMudaram([deck(1, 1), deck(2, 2)], [deck(2, 9), deck(1, 9)]), false,
      'a ordem das listas virou diferença');
  }],

  ['num aparelho novo, os decks da conta aparecem sem histórico', () => {
    // É o caso inteiro: entrar na conta num aparelho onde nunca se jogou. O
    // histórico local está vazio, e sem os decks da conta a pessoa tem de
    // buscar na Scryfall o comandante que o app já conhece.
    store.wipe();
    try {
      eq(store.decksOfPlayer(null, 'alienpls').length, 0,
        'apareceu deck sem histórico e sem perfil');

      store.guardarDecksDaConta('alienpls', [
        { commanders: [commander(1)], lastUsed: 200 },
        { commanders: [commander(2)], lastUsed: 100 },
      ]);

      const semHistorico = store.decksOfPlayer(null, 'alienpls');
      eq(semHistorico.length, 2, 'os decks da conta não apareceram');
      eq(deckKeyOf(semHistorico[0].commanders), deckKeyOf([commander(1)]),
        'a lista não veio do mais recente para o mais antigo');

      // E com histórico local, as duas fontes se juntam sem repetir.
      const m = createMatch([
        { id: 's0', name: 'Alex', handle: 'alienpls', commanders: [commander(2)] },
        { id: 's1', name: 'Bruno', commanders: [commander(9)] },
      ], 40);
      m.startedAt = 900;
      store.mesclarPartidas([m]);

      const juntos = store.decksOfPlayer(null, 'alienpls');
      eq(juntos.length, 2, 'o deck repetido entrou duas vezes');
      eq(deckKeyOf(juntos[0].commanders), deckKeyOf([commander(2)]),
        'o deck jogado agora não foi para o topo');

      // Outra conta no mesmo aparelho não vê os decks da primeira.
      eq(store.decksOfPlayer(null, 'outra').length, 0,
        'os decks de uma conta vazaram para outra');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['a linha de deck sabe quem o levou', () => {
    // A linha agrega todo mundo que jogou aquele deck, e e assim que tem de
    // ser - em Commander o mesmo deck passa de mao em mao. Mas sem saber QUEM,
    // nao da para responder "quais decks o Bruno joga".
    const comDeck = (nome, qualDeck) => createMatch([
      { id: 's0', name: nome, commanders: [commander(qualDeck)] },
      { id: 's1', name: 'Bruno', commanders: [commander(9)] },
    ], 40);

    const { decks } = aggregate([comDeck('Ana', 1), comDeck('Caio', 1)]);
    const compartilhado = decks.find((d) => d.jogadores.length === 2);
    ok(compartilhado, 'nenhum deck registrou os dois jogadores');
    eq(compartilhado.jogadores.slice().sort(), ['ana', 'caio'],
      'o deck não guardou quem o levou');

    const doBruno = decks.find((d) => d.jogadores.includes('bruno'));
    eq(doBruno.jogadores, ['bruno'], 'o deck do Bruno ficou com gente a mais');
  }],

  ['o filtro da aba de Decks mostra só os decks daquele jogador', () => {
    if (!simulated) return 'skip';
    store.wipe();
    let raiz = null;
    try {
      // Ana joga dois decks, Bruno joga um. "Todos" mostra os três.
      const partida = (deckDaAna, id) => {
        const m = createMatch([
          { id: 's0', name: 'Ana', commanders: [commander(deckDaAna)] },
          { id: 's1', name: 'Bruno', commanders: [commander(9)] },
        ], 40);
        m.id = 'p-' + id;
        return m;
      };
      store.mesclarPartidas([partida(1, 'a'), partida(2, 'b')]);

      const root = document.createElement('div');
      raiz = root;
      renderStats(root, { onBack() {} });

      const painel = () => findAll(root, 'stats-panel')[0];
      const quantosDecks = () => findAll(painel(), 'card').length;
      eq(quantosDecks(), 3, '"Todos" não mostrou os três decks');

      // Pelo aria-label, e não pela posição: a aba passou a ter dois
      // `<select>`, e `[0]` pegaria o de ordem no dia em que a ordem viesse
      // primeiro - um teste que muda de assunto sozinho.
      const filtro = () => findAll(root, 'select-input')
        .find((c) => c.getAttribute('aria-label') === t('stats.filterByPlayer'));
      ok(filtro(), 'a aba de Decks não tem o filtro de jogador');

      // Filtrar pelo Bruno: só o deck dele.
      fire(filtro(), 'change', { target: { value: 'bruno' } });
      eq(quantosDecks(), 1, 'o filtro não reduziu a lista ao deck do Bruno');

      // E voltar para Todos devolve os três.
      fire(filtro(), 'change', { target: { value: 'todos' } });
      eq(quantosDecks(), 3, '"Todos" não devolveu a lista inteira');
    } finally {
      // O filtro é estado de MÓDULO da tela e sobrevive ao caso: deixá-lo
      // preso faria o teste seguinte ver uma lista filtrada sem motivo.
      //
      // Na raiz deste caso, e não em `document.body`: a raiz nunca foi
      // anexada ao documento, então a busca antiga não achava nada e a
      // limpeza era um no-op que passava por limpeza.
      if (raiz) {
        const campo = findAll(raiz, 'select-input')
          .find((c) => c.getAttribute('aria-label') === t('stats.filterByPlayer'));
        if (campo) fire(campo, 'change', { target: { value: 'todos' } });
      }
      store.wipe();
    }
    return undefined;
  }],

  ['nas estatísticas, o voltar do aparelho volta dentro do app', () => {
    if (!simulated) return 'skip';
    // Sem isto o voltar do Android FECHAVA o app: não havia entrada de
    // histórico para consumir, e PWA em tela cheia sai. Justamente na tela
    // onde o gesto é o mais natural.
    const naRota = () => document.body.dataset.route;
    const eraRota = naRota();
    try {
      const estatisticas = botaoDeEstatisticas();
      ok(estatisticas, 'a home não tem o botão de estatísticas');

      const antes = historico.empilhadas;
      fire(estatisticas, 'click');
      eq(naRota(), 'stats', 'não chegou nas estatísticas');
      eq(historico.empilhadas, antes + 1,
        'entrar nas estatísticas não empilhou entrada de histórico');

      // O gesto do sistema: volta dentro do app, não fecha.
      fireWindow('popstate');
      eq(naRota(), 'setup', 'o voltar não trouxe para a tela inicial');
    } finally {
      if (naRota() !== eraRota) document.body.dataset.route = eraRota;
    }
    return undefined;
  }],

  ['com painel aberto, o voltar fecha o painel e não navega', () => {
    if (!simulated) return 'skip';
    // O pior efeito possível do voltar que acabou de entrar: sair da tela
    // deixando a folha de pé sobre a tela nova.
    const naRota = () => document.body.dataset.route;
    const eraRota = naRota();
    try {
      const estatisticas = botaoDeEstatisticas();
      ok(estatisticas, 'a home não tem o botão de estatísticas');
      fire(estatisticas, 'click');
      eq(naRota(), 'stats', 'não chegou nas estatísticas');

      openFlow({ title: 'teste', build: (pane) => pane.append(el('p', { text: 'x' })) });
      ok(isSheetOpen(), 'o painel não abriu');

      const antes = historico.empilhadas;
      fireWindow('popstate');
      ok(!isSheetOpen(), 'o voltar não fechou o painel');
      eq(naRota(), 'stats', 'o voltar navegou com painel aberto');
      eq(historico.empilhadas, antes + 1,
        'fechar o painel não devolveu a entrada de histórico');

      fireWindow('popstate');
      eq(naRota(), 'setup', 'o voltar seguinte não saiu das estatísticas');
    } finally {
      closeSheet();
      if (naRota() !== eraRota) document.body.dataset.route = eraRota;
    }
    return undefined;
  }],

  ['esconder o app para o relógio da partida em andamento', () => {
    if (!simulated) return 'skip';
    // A fiação, e não a conta: prova que o ouvinte de visibilidade está
    // pendurado e chega ao motor. app.js sobe junto com a suíte (ver o import
    // no topo), então o ouvinte já está registrado aqui.
    store.wipe();
    try {
      const m = mesa();
      store.setCurrent(m);

      const antes = document.visibilityState;
      document.visibilityState = 'hidden';
      fire(document, 'visibilitychange');
      document.visibilityState = antes;

      ok(store.getCurrent().ausenteDesde,
        'esconder o app não parou o relógio');
    } finally {
      store.wipe();
    }
    return undefined;
  }],

  ['o tempo fora da mesa não conta na duração nem no turno', () => {
    // O defeito que isto conserta: a duração era tempo de PAREDE. Sair para as
    // estatísticas, bloquear o celular ou fechar o app somava tudo aquilo à
    // partida - e, ao passar a vez, ao turno de quem estava jogando. Meia hora
    // no banheiro virava "o turno mais longo da noite".
    const m = mesa();
    const t0 = m.startedAt;

    // Turno 1 de 0 a 100s, com 60s de ausência no meio dele.
    m.ausencias = [[t0 + 20000, t0 + 80000]];
    m.events.push({ id: 'a', ts: t0 + 100000, turn: 1, type: 'turn' });

    const s1 = replay(m);
    eq(elapsedOf(m, s1, t0 + 100000), 40000, 'a duração não descontou a ausência');
    eq(s1.players.s0.timeOnTurn, 40000, 'o turno não descontou a ausência');
  }],

  ['a ausência é descontada por sobreposição, e não no total', () => {
    // Por sobreposição porque o tempo de turno precisa descontar só o que caiu
    // DENTRO daquele turno - um total somado descontaria do turno errado.
    const m = mesa();
    const t0 = m.startedAt;
    m.ausencias = [[t0 + 100, t0 + 200], [t0 + 500, t0 + 900]];

    eq(ausenteEntre(m, t0, t0 + 1000), 500, 'as duas faixas somam');
    eq(ausenteEntre(m, t0, t0 + 150), 50, 'a faixa é recortada no fim');
    eq(ausenteEntre(m, t0 + 150, t0 + 1000), 450, 'e no começo');
    eq(ausenteEntre(m, t0 + 250, t0 + 450), 0, 'janela entre as faixas não desconta');

    // O período ainda ABERTO conta até o instante da pergunta: é o caso do app
    // fechado, em que ninguém escreveu o fim.
    m.ausenteDesde = t0 + 2000;
    eq(ausenteEntre(m, t0, t0 + 3000), 1500, 'o período aberto conta até agora');
  }],

  ['o relógio não para duas vezes, nem depois do fim', () => {
    // Com pausa manual em curso o tempo já não conta. Abrir uma ausência por
    // cima descontaria o mesmo período duas vezes, e a partida sairia mais
    // curta do que foi.
    const pausada = mesa();
    pausada.events.push({
      id: 'p', ts: pausada.startedAt + 1000, turn: 1, type: 'pause',
    });
    eq(sairDaMesa(pausada, pausada.startedAt + 2000), false,
      'abriu ausência com a mesa já pausada');
    eq(pausada.ausenteDesde, undefined, 'e sujou a partida');

    // Partida encerrada: o relógio parou de andar, não há o que descontar.
    const fim = mesa(2);
    push(fim, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
    ok(replay(fim).finished, 'a partida devia estar encerrada');
    eq(sairDaMesa(fim, Date.now()), false, 'abriu ausência com a partida encerrada');
  }],

  ['uma ausência que ficou aberta fecha ao voltar à mesa', () => {
    // É o caso do app fechado com a mesa aberta: `ausenteDesde` ficou gravado,
    // e todo o tempo em que o app esteve fora tem de sair da partida.
    const m = mesa();
    const t0 = m.startedAt;

    ok(sairDaMesa(m, t0 + 10000), 'não abriu a ausência');
    eq(m.ausenteDesde, t0 + 10000, 'não marcou desde quando');

    // Duas horas fora, e o app volta.
    ok(voltarAMesa(m, t0 + 7210000), 'não fechou a ausência');
    eq(m.ausenteDesde, null, 'deixou o período aberto');
    eq(m.ausencias, [[t0 + 10000, t0 + 7210000]], 'não guardou o período');

    m.events.push({ id: 'a', ts: t0 + 7215000, turn: 1, type: 'turn' });
    eq(elapsedOf(m, replay(m), t0 + 7215000), 15000,
      'as duas horas fora entraram na duração');

    // Voltar sem ter saído não faz nada.
    eq(voltarAMesa(m, t0 + 7220000), false, 'fechou um período que não existia');
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
      preset: 'dilema',
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
    eq(p1.voteChoices.dilema, { Silence: 2 }, 'P1 escolheu Silence nas duas');
    eq(p3.voteChoices.dilema, { Snitch: 2 }, 'P3 delatou nas duas');
    eq(players.find((p) => p.label === 'P2').voteChoices.dilema,
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

  ['a estatística agrupa por categoria, não pela pergunta escrita', () => {
    const m = mesa(2);
    const votar = (extra, escolha) => push(m, Object.assign({
      type: 'vote', kind: 'opcoes', options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [escolha] }],
    }, extra));

    // Duas noites, o mesmo modelo, perguntas escritas de jeitos diferentes.
    // Antes isso virava duas linhas - e a pergunta livre muda toda vez, então
    // a lista crescia sem nunca responder "essa pessoa costuma delatar?".
    votar({ preset: 'dilema', question: "Prisoner's Dilemma" }, 0);
    votar({ preset: 'dilema', question: 'Quem entrega quem?' }, 0);
    votar({ preset: 'jogador', question: 'Quem leva o combo?', options: ['P0', 'P1'] }, 1);
    push(m, {
      type: 'vote', preset: 'numero', kind: 'numero', question: '', options: [],
      ballots: [{ seatId: 's0', name: 'P0', choices: [7] }],
    });

    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(p0.votes, 4, 'quatro votações');
    eq(Object.keys(p0.voteChoices).sort(), ['dilema', 'jogador', 'numero'],
      'três categorias, não quatro perguntas');
    eq(p0.voteChoices.dilema, { Silence: 2 }, 'as duas noites de dilema somam junto');
    eq(p0.voteChoices.numero, { 7: 1 }, 'número secreto guarda o valor');

    // A chave é o modelo, e o modelo não é texto de tela: trocar o idioma não
    // pode partir o histórico em dois montes.
    const chavesEm = (lang) => {
      setLang(lang);
      return Object.keys(aggregate([m]).players.find((x) => x.label === 'P0').voteChoices).sort();
    };
    eq(chavesEm('en'), chavesEm('pt'), 'as mesmas categorias em qualquer idioma');
    setLang('pt');

    // Só a tela traduz. O nome da carta não se traduz nunca.
    eq(rotuloDaCategoria('numero'), t('vote.preset.number'));
    eq(rotuloDaCategoria('dilema'), "Prisoner's Dilemma", 'nome de carta fica como é');
    setLang('de');
    eq(rotuloDaCategoria('dilema'), "Prisoner's Dilemma", 'inclusive em alemão');
    eq(rotuloDaCategoria('numero'), t('vote.preset.number'), 'o resto acompanha o idioma');
    setLang('pt');
  }],

  ['votação antiga, sem categoria gravada, não é chutada', () => {
    // O campo `preset` não existia. Dá para recuperar o essencial pelo `kind`;
    // o resto vira categoria genérica. Inventar qual modelo foi usado seria
    // pior que admitir que não se sabe.
    eq(categoriaDaVotacao({ kind: 'numero' }), 'numero', 'número se reconhece sozinho');
    eq(categoriaDaVotacao({ kind: 'opcoes', options: ['Silence', 'Snitch'] }), 'opcoes',
      'parecer um dilema não prova que era');
    eq(categoriaDaVotacao({ preset: 'jogador', kind: 'opcoes' }), 'jogador',
      'gravada, a categoria manda');
    eq(categoriaDaVotacao(null), 'opcoes', 'sem evento, categoria genérica');
    eq(rotuloDaCategoria('opcoes'), t('vote.preset.other'));
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

    // Isso é o TÍTULO, usado na linha do tempo da partida - onde interessa
    // saber qual votação foi aquela. A estatística agrupa por categoria, que é
    // outra pergunta: o que essa pessoa costuma escolher.
    const m = mesa(2);
    push(m, {
      type: 'vote', preset: 'dilema', kind: 'opcoes',
      options: ['Silence', 'Snitch'], question: '',
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    const p0 = aggregate([m]).players.find((x) => x.label === 'P0');
    eq(Object.keys(p0.voteChoices), ['dilema'], 'a estatística agrupa pelo modelo');
    eq(chaveDaVotacao(m.events[0]), 'Silence / Snitch',
      'e o título continua saindo das opções quando ninguém escreveu um');
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

  ['partida malformada não entra no histórico', () => {
    if (!simulated) return 'skip';
    // Isto derrubou a tela de estatísticas de verdade: uma linha de teste com
    // `payload: {t:1}`, esquecida no banco, foi baixada pela sincronização e
    // entrou no histórico. replay() e as estatísticas assumem seats e events -
    // uma linha sem eles não fica quieta num canto, derruba a TELA INTEIRA.
    const boa = mesa(4);
    ok(partidaValida(boa), 'uma partida de verdade passa');

    ok(!partidaValida(null), 'nada');
    ok(!partidaValida({ id: 'x' }), 'só um id não é partida');
    ok(!partidaValida({ ...boa, seats: [] }), 'mesa vazia');
    ok(!partidaValida({ ...boa, seats: undefined }), 'sem assentos');
    ok(!partidaValida({ ...boa, events: undefined }), 'sem eventos');
    ok(!partidaValida({ ...boa, startedAt: undefined }), 'sem início');
    ok(!partidaValida({ ...boa, id: '' }), 'sem id');
    ok(partidaValida({ ...boa, events: [] }), 'partida sem lance nenhum ainda é partida');

    // E a porta de entrada recusa. Este é o caso exato que aconteceu.
    store.wipe();
    const lixo = linhaParaPartida({ id: 'rec-1', payload: { t: 1 } });
    eq(store.mesclarPartidas([lixo]), 0, 'não entra o que não é partida');
    eq(store.getDB().history.length, 0, 'e o histórico continua limpo');

    // O que é bom passa junto do que é ruim, sem contaminar.
    eq(store.mesclarPartidas([lixo, boa]), 1, 'a boa entra mesmo vindo com lixo');
    eq(store.getDB().history.length, 1);
  }],

  ['a tela de estatísticas sobrevive a lixo vindo da nuvem', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(mesa(3));
    // Mesmo que algo passe pela porta - localStorage editado, defeito futuro -
    // a tela não pode ficar preta. Preta não diz nada a quem usa nem a quem vai
    // consertar.
    store.getDB().history.push({ id: 'quebrada' });

    const root = document.createElement('div');
    let explodiu = null;
    try {
      renderStats(root, { onBack() {} });
    } catch (e) {
      explodiu = e.message;
    }
    ok(!explodiu, 'a tela não pode explodir com um registro ruim: ' + explodiu);
    ok(root.childNodes.length > 0, 'e não pode ficar vazia');
  }],

  ['quem não assina sobe uma vez, e não reenvia para sempre', () => {
    // O detalhe que define o desenho: o banco deixa INSERIR sem assinatura mas
    // não deixa LER. Quem não assina recebe lista vazia ao baixar - então, sem
    // anotar no aparelho o que já subiu, toda abertura pareceria "a nuvem está
    // vazia" e o histórico inteiro seria reenviado. Para sempre.
    const locais = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    // Primeira vez: nada anotado, nada visível do outro lado.
    eq(aSubir(locais, [], []).map((m) => m.id), ['a', 'b', 'c'], 'sobe tudo');

    // Depois de subir, mesmo sem conseguir ler a nuvem, não repete.
    eq(aSubir(locais, ['a', 'b', 'c'], []).length, 0, 'não reenvia o que já foi');
    eq(aSubir(locais, ['a'], []).map((m) => m.id), ['b', 'c'], 'só o que falta');

    // Aparelho novo que baixou tudo não precisa devolver nada.
    eq(aSubir(locais, [], ['a', 'b', 'c']).length, 0, 'o servidor já tem');

    // E uma partida que falhou continua na fila, porque a fila é derivada: sem
    // marca, ela é pendente por definição - não há estrutura separada que possa
    // divergir do histórico.
    eq(aSubir(locais, ['a', 'c'], []).map((m) => m.id), ['b'], 'a que falhou volta');
  }],

  ['marcar a conta numa partida já jogada', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0' });
    store.archive(m);
    store.setCurrent(mesa(2)); // há uma mesa acontecendo agora

    const guardada = store.getDB().history[0];
    eq(guardada.seats[0].handle, null, 'ninguém foi marcado na hora');

    // Marca a cadeira e grava de volta.
    guardada.seats[0].handle = 'alienpls';
    guardada.seats[0].userId = 'uid-1';
    ok(store.atualizarPartida(guardada), 'a partida é regravada');
    eq(store.getDB().history[0].seats[0].handle, 'alienpls', 'a marca ficou');

    // archive() zera a partida em andamento como parte de encerrar. Usar
    // archive para editar um registro antigo apagaria a mesa que está
    // acontecendo agora - um estrago silencioso e absurdo.
    ok(store.getCurrent(), 'a mesa em andamento continua de pé');

    // E o convite passa a existir para aquela cadeira.
    const linhas = participantesDe(store.getDB().history[0]);
    eq(linhas.length, 1);
    eq(linhas[0].seat_id, 's0');
    eq(linhas[0].handle, 'alienpls');

    // Partida que não está no histórico não é criada por engano.
    ok(!store.atualizarPartida({ ...mesa(3), id: 'nao-existe' }), 'não inventa registro');
    ok(!store.atualizarPartida({ id: 'x' }), 'nem aceita coisa malformada');
  }],

  ['apagar num aparelho apaga em todos - e nunca por engano', () => {
    // O aparelho B tinha a partida e a marcou como enviada ao baixá-la. O
    // aparelho A apagou. Sem reconciliar, ela ficava em B para sempre: nada
    // no fluxo de subir ou baixar a alcançava.
    eq(aApagar(['p1', 'p2'], ['p2'], true), ['p1'], 'some daqui o que sumiu de lá');
    eq(aApagar(['p1', 'p2'], ['p1', 'p2'], true), [], 'o que continua lá, fica');

    // Partida que nunca subiu não pode ser julgada pela ausência dela na nuvem.
    eq(aApagar([], ['p9'], true), [], 'nada marcado, nada a apagar');

    // As duas travas contra desastre. A leitura devolve lista vazia para quem
    // NÃO assina - idêntico ao que devolveria se tudo tivesse sido apagado.
    // Confundir os dois casos destruiria o histórico de quem só deixou de
    // pagar, e não há desfazer.
    eq(aApagar(['p1', 'p2'], [], false), [], 'sem poder ler de verdade, não apaga');
    eq(aApagar(['p1', 'p2'], [], true), [],
      'lista remota vazia com coisas enviadas é suspeito demais para agir');

    // Errar para o lado de sobrar é recuperável; errar para o lado de apagar não.
    eq(aApagar(['p1'], ['p1', 'p2', 'p3'], true), [], 'a nuvem ter mais não apaga nada aqui');
  }],

  ['baixar traz só o que este aparelho não tem', () => {
    const aqui = [{ id: 'a' }, { id: 'b' }];
    const la = [{ id: 'b' }, { id: 'c' }, { id: 'd' }];
    eq(aBaixar(aqui, la).map((m) => m.id), ['c', 'd'], 'nem duplica nem perde');
    eq(aBaixar([], la).length, 3, 'aparelho novo recebe tudo');
    eq(aBaixar(aqui, []).length, 0, 'sem assinatura o servidor devolve vazio');
    eq(aBaixar(null, null).length, 0, 'listas vazias não explodem');
  }],

  ['sincronizar só faz sentido com conta', () => {
    ok(!podeSincronizar(true, 'deslogado'), 'sem conta não há para onde subir');
    ok(!podeSincronizar(false, 'assinante'), 'sem nuvem configurada não há nuvem');
    ok(podeSincronizar(true, 'sem-assinatura'), 'sem assinar ainda se pode SUBIR');
    ok(podeSincronizar(true, 'assinante'));
  }],

  ['o histórico local não é apagado ao subir, e a mesclagem não sobrescreve', () => {
    if (!simulated) return 'skip';
    store.wipe();
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
    store.archive(m);

    eq(store.getDB().history.length, 1, 'a partida está aqui');
    store.marcarEnviada(m.id);
    eq(store.enviadas(), [m.id], 'anotada como enviada');
    eq(store.getDB().history.length, 1, 'e continua aqui: subir não apaga nada');

    // Partida encerrada é imutável, e a cópia local pode ter algo que a remota
    // não tem se um envio falhou pela metade. Na dúvida, o que já está aqui manda.
    const forjada = { ...m, seats: [] };
    eq(store.mesclarPartidas([forjada]), 0, 'não traz o que já existe');
    eq(store.getDB().history[0].seats.length, 4, 'e não sobrescreve o que estava aqui');

    const outra = mesa(3);
    eq(store.mesclarPartidas([outra]), 1, 'traz o que é novo');
    eq(store.getDB().history.length, 2);

    // Apagar tira a marca junto, senão a partida nunca mais poderia subir.
    store.deleteMatch(m.id);
    store.esquecerEnviada(m.id);
    eq(store.enviadas().includes(m.id), false, 'a marca sai com a partida');
  }],

  ['sem assinatura, o histórico fica fechado', () => {
    // Não existe caso de "deslogado vê o que é dele": bastaria sair da conta
    // para abrir a porta, e um portão que se abre ao ser evitado não é portão.
    ok(!podeVerEstatisticas(true, 'deslogado'), 'sem conta, fechado');
    ok(!podeVerEstatisticas(true, 'sem-assinatura'), 'com conta e sem assinar, fechado');
    ok(podeVerEstatisticas(true, 'assinante'), 'assinando, abre');

    // Sem nuvem configurada o app roda como sempre rodou. Trancar ali não
    // protegeria nada: os dados estão no aparelho de quem está olhando.
    ok(podeVerEstatisticas(false, 'desligado'), 'sem nuvem, nada muda');
    ok(podeVerEstatisticas(false, 'deslogado'), 'sem nuvem, nem o login importa');
  }],

  ['não se nega o que ainda não se sabe', () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    // O defeito relatado: a tela de bloqueio aparecia por alguns segundos e
    // depois liberava sozinha. Não era o status mudando - era o app tratando
    // "ainda não perguntei ao servidor" como "não tem". Para quem paga, ser
    // informado de que não pagou é o pior defeito possível.
    esquecerSessao();
    ok(assinaturaConhecida(), 'sem sessão a resposta é imediata: não há assinatura');

    location.hash = '#access_token=faz-de-conta&expires_at=99999999999';
    ok(capturarRetorno(), 'sessão capturada');
    ok(!assinaturaConhecida(), 'com sessão e sem ter perguntado, ainda não se sabe');

    esquecerSessao();
    ok(assinaturaConhecida(), 'sair fecha a pergunta de novo');
  }],

  ['enquanto verifica, a paywall não acusa ninguém', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(mesa(4));

    const desenhar = (verificando) => {
      document.body.childNodes.length = 0;
      const root = document.createElement('div');
      renderPaywall(root, { onBack() {}, onUnlock() {}, verificando });
      return root;
    };

    const checando = desenhar(true);
    eq(findAll(checando, 'paywall-title').length, 0, 'não diz que o histórico está fechado');
    eq(findAll(checando, 'btn').length, 0, 'nem oferece entrar ou conferir');
    ok(findAll(checando, 'paywall-body').map(textOf).join('').includes(t('paywall.checking')),
      'só avisa que está conferindo');

    // E quando a resposta chega, aí sim.
    const negado = desenhar(false);
    eq(findAll(negado, 'paywall-title').length, 1, 'com resposta, explica o bloqueio');
  }],

  ['a paywall diz quantas partidas estão esperando', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    store.archive(mesa(4));
    store.archive(mesa(3));

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderPaywall(root, { onBack() {}, onUnlock() {} });

    // O número não é enfeite: é a diferença entre "pague para usar" e "o que é
    // seu está aqui, esperando". Continuar jogando nunca foi bloqueado.
    const texto = findAll(root, 'paywall-count').map(textOf).join('');
    ok(texto.includes('2'), 'mostra as duas partidas guardadas');
    ok(findAll(root, 'paywall-title').length === 1, 'e explica por quê');

    // Deslogado, o caminho é entrar; a checagem de assinatura viria depois.
    eq(accountNow(), 'deslogado');
    const botoes = findAll(root, 'btn').map(textOf);
    ok(botoes.includes(t('paywall.signInFirst')), 'oferece entrar na conta');
    ok(!botoes.includes(t('paywall.recheck')), 'sem conta não há assinatura a conferir');
  }],

  ['a linha de votação mostra a categoria e o total', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    const m = mesa(2);
    const votar = (q) => push(m, {
      type: 'vote', preset: 'dilema', kind: 'opcoes', question: q,
      options: ['Silence', 'Snitch'],
      ballots: [{ seatId: 's0', name: 'P0', choices: [0] }],
    });
    votar("Prisoner's Dilemma");
    votar('Quem entrega quem?');   // outra pergunta, mesmo modelo
    store.archive(m);

    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderStats(root, { onBack() {} });
    fire(findAll(root, 'tab').find((b) => textOf(b) === t('stats.players')), 'click');

    const perguntas = findAll(root, 'vote-history-q').map(textOf);
    eq(perguntas.length, 1, 'as duas noites do mesmo modelo dão uma linha só');
    eq(perguntas[0], "Prisoner's Dilemma", 'à esquerda, o tipo da votação');

    const totais = findAll(root, 'vote-history-total').map(textOf);
    eq(totais[0], '2', 'à direita, quantos votos a pessoa deu nessa categoria');
    ok(findAll(root, 'vote-history-picks').map(textOf)[0].includes('Silence'),
      'e o que ela escolheu continua ali');
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

  ['a colocação é escrita como cada língua escreve', () => {
    // O `º` é indicador ordinal do português e do espanhol. Em inglês e alemão
    // ele não existe, e estava aparecendo assim mesmo.
    eq(ordinal(1, 'pt'), '1º');
    eq(ordinal(4, 'es'), '4º');
    eq(ordinal(1, 'de'), '1.', 'alemão usa ponto');
    eq(ordinal(4, 'de'), '4.');

    // O inglês era pior que um caractere errado: a tradução dizia "{n}th
    // place", que produz "1th place", "2th place", "3th place".
    eq(ordinal(1, 'en'), '1st');
    eq(ordinal(2, 'en'), '2nd');
    eq(ordinal(3, 'en'), '3rd');
    eq(ordinal(4, 'en'), '4th');

    // As exceções do inglês: 11, 12 e 13 levam "th" apesar de terminarem em 1,
    // 2 e 3. Numa mesa de Commander isso nunca acontece - mas a função não sabe
    // de onde é chamada, e regra pela metade é a que quebra quando alguém reusa.
    eq(ordinal(11, 'en'), '11th');
    eq(ordinal(12, 'en'), '12th');
    eq(ordinal(13, 'en'), '13th');
    eq(ordinal(21, 'en'), '21st');
    eq(ordinal(111, 'en'), '111th', 'a regra olha os dois últimos dígitos');
    eq(ordinal(101, 'en'), '101st');

    // E a frase inteira, montada, em cada idioma.
    setLang('pt'); eq(t('table.place', { n: ordinal(1) }), '1º lugar');
    setLang('en'); eq(t('table.place', { n: ordinal(1) }), '1st place');
    setLang('es'); eq(t('table.place', { n: ordinal(3) }), '3º puesto');
    setLang('de'); eq(t('table.place', { n: ordinal(2) }), '2. Platz');
    setLang('pt');

    eq(ordinal('abc', 'en'), 'abc', 'o que não é número passa direto');
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
    //
    // Já foi a silhueta da mesa do ícone, enquanto o ícone era a mesa. O ícone
    // voltou, e a marca voltou junto: são duas coisas separadas no código e uma
    // só para quem olha, e deixá-las diferentes foi defeito uma vez.
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
    const rotulos = findAll(document.body, 'set-label').map(textOf);
    ok(rotulos.includes('Sprache'), 'o painel não reabriu em alemão: ' + rotulos.join(' | '));

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

    // A conta é UMA linha na tela principal, e abre a própria tela. Na
    // principal ela não pode vir inteira: era o bloco que empurrava idioma e
    // tema para o fim da rolagem.
    const resumo = findAll(document.body, 'set-conta')[0];
    if (!cloudEnabled()) {
      ok(!resumo, 'sem nuvem configurada, nada de conta na tela');
      closeSheet();
      return;
    }
    ok(resumo, 'com nuvem, a linha da conta precisa existir');
    eq(findAll(document.body, 'account').length, 0, 'a conta inteira voltou para a tela principal');
    fire(resumo, 'click');

    const conta = findAll(document.body, 'account')[0];
    ok(conta, 'a linha da conta não abriu a tela da conta');
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

  ['as notas de versão descrevem a versão que está no ar', () => {
    ok(NOVIDADES.length, 'existe pelo menos uma versão anotada');
    ok(novidadesDe(APP_VERSION), 'a versão atual tem notas: ' + APP_VERSION);

    // Ordem importa: a tela mostra da mais nova para a mais antiga, e
    // novidadesDesde() corta pela posição.
    eq(NOVIDADES[0].versao, APP_VERSION, 'a mais recente vem primeiro');

    for (const v of NOVIDADES) {
      ok(/^\d+\.\d+\.\d+$/.test(v.versao), v.versao + ': número de versão malformado');
      ok(/^\d{4}-\d{2}-\d{2}$/.test(v.data), v.versao + ': data malformada');
      ok(v.itens && v.itens.length, v.versao + ': versão sem nenhuma mudança anotada');
      for (const item of v.itens) {
        ok(['novo', 'corrigido', 'mudou'].includes(item.tipo),
          v.versao + ': tipo desconhecido "' + item.tipo + '"');
        ok(item.texto && String(item.texto).length > 20,
          v.versao + ': nota curta demais para dizer alguma coisa');
      }
      // Cada tipo tem tradução nos quatro idiomas, senão a etiqueta sai crua.
      for (const [codigo] of LANGS) {
        for (const tipo of ['novo', 'corrigido', 'mudou']) {
          ok(DICTS[codigo]['news.' + tipo], 'falta news.' + tipo + ' em ' + codigo);
        }
      }
    }
  }],

  ['quem atualiza vê só o que ainda não viu', () => {
    // Ler de novo o que já se leu treina a ignorar a tela. E quem instala
    // agora não vê nada: o histórico inteiro de mudanças é ruído antes do
    // primeiro uso.
    const falso = [{ versao: '1.3.0' }, { versao: '1.2.0' }, { versao: '1.1.0' }];
    const desde = (vista) => {
      const onde = falso.findIndex((n) => n.versao === vista);
      return onde < 0 ? falso : falso.slice(0, onde);
    };
    eq(desde('1.2.0').map((n) => n.versao), ['1.3.0'], 'só o que veio depois');
    eq(desde('1.3.0').length, 0, 'já está na mais nova: nada a mostrar');
    eq(desde('1.1.0').map((n) => n.versao), ['1.3.0', '1.2.0'], 'pulou duas, vê as duas');

    // Versão desconhecida devolve tudo - é o caso de quem voltou de um app
    // muito antigo, e mostrar demais é melhor que mostrar nada.
    eq(novidadesDesde('0.0.1').length, NOVIDADES.length, 'versão que não existe: tudo');
    eq(novidadesDesde(null).length, NOVIDADES.length, 'sem referência: tudo');
    eq(novidadesDesde(APP_VERSION).length, 0, 'quem já está na atual não vê nada');
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
    fire(findAll(document.body, 'set-conta')[0], 'click');

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

  ['segurar repete e acelera, na cadência que os dois lugares compartilham', () => (
    comRelogioFalso((avancar) => {
      let passos = 0;
      const parar = repetirSegurando(() => { passos += 1; }, { passoInicial: true });

      avancar(HOLD_DELAY - 1);
      eq(passos, 0, 'antes do atraso não sai passo nenhum');

      avancar(1);
      eq(passos, 1, 'o primeiro passo sai ao completar o atraso');

      avancar(REPEAT_MS * 3);
      eq(passos, 4, 'na cadência lenta, um passo por REPEAT_MS');

      // Depois de REPEAT_ACCEL_AFTER passos lentos, a cadência troca.
      avancar(REPEAT_MS * (REPEAT_ACCEL_AFTER - 3));
      eq(passos, 1 + REPEAT_ACCEL_AFTER, 'os passos lentos antes de acelerar');

      avancar(REPEAT_FAST_MS * 4);
      eq(passos, 1 + REPEAT_ACCEL_AFTER + 4, 'acelerado, um passo por REPEAT_FAST_MS');

      parar();
      avancar(5000);
      eq(passos, 1 + REPEAT_ACCEL_AFTER + 4, 'soltar para de verdade');
      return undefined;
    })
  )],

  ['segurar na borda do painel tira vida acelerando, e vira um evento só', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { tiles, view } = mesaNaTela(m);
      const menos = findAll(tiles[0], 'tap-minus')[0];
      ok(menos, 'o painel não tem a faixa de tirar vida');

      // O número do painel, que é o que o jogador realmente vê: ele já traz o
      // pendente somado. Ler o log aqui seria ler o lugar errado - `nudge()`
      // acumula, e só `commit()` grava.
      const noPainel = () => textOf(findAll(tiles[0], 'tile-life')[0]);
      const pendente = () => textOf(findAll(tiles[0], 'tile-delta')[0]);

      eq(noPainel(), '40', 'a mesa não começou em 40');

      fire(menos, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });

      // Antes do atraso, segurar ainda não é repetição: nada foi aplicado.
      avancar(HOLD_DELAY - 1);
      eq(noPainel(), '40', 'a vida andou antes da hora');

      // O passo do atraso, mais três da cadência lenta.
      avancar(1 + REPEAT_MS * 3);
      eq(noPainel(), '36', 'quatro passos, quatro pontos de vida');
      eq(pendente(), '-4', 'o delta flutuante não mostra o que ainda não gravou');

      fire(menos, 'pointerup', { pointerId: 1, clientX: 5, clientY: 5 });

      // Soltar não pode cobrar um passo por cima do que a repetição aplicou.
      eq(noPainel(), '36', 'soltar cobrou um passo a mais');
      eq(eventosDeVida(m).length, 0, 'gravou antes da coalescência fechar');

      // E a seguradinha inteira entra como UM evento, senão "desfazer"
      // voltaria ponto por ponto - quarenta toques para desfazer um gesto.
      avancar(COMMIT_MS + 10);
      const vida = eventosDeVida(m);
      eq(vida.length, 1, 'a seguradinha inteira virou um evento só');
      eq(vida[0].delta, -4, 'o evento não soma os quatro passos');
      eq(vida[0].sourceId, null, 'borda do painel não tem autor: é vida paga');

      view.destroy();
      return undefined;
    });
  }],

  ['o painel sobe com o teclado, medindo o viewport de layout', () => {
    if (!simulated) return 'skip';

    // A conta: a região visível vai de `deslocamento` a
    // `deslocamento + visível`. Um elemento fixo com `bottom: B` tem a base em
    // `layout - B`, então B = layout - visível - deslocamento.
    eq(alturaDoTeclado(800, 800, 0), 0, 'sem teclado, nada a descontar');
    eq(alturaDoTeclado(800, 500, 0), 300, 'o teclado tomou 300');
    eq(alturaDoTeclado(800, 500, 60), 240, 'e a página rolada desconta junto');
    eq(alturaDoTeclado(0, 500, 0), 0, 'sem layout não há conta a fazer');
    // Sem campo de texto focado não há teclado, e a conta nem se faz: a barra
    // de URL do celular também encolhe o viewport visível, e a diferença saía
    // como uns 60px de "teclado" empurrando todo painel para cima.
    eq(alturaDoTeclado(800, 500, 0, false), 0, 'sem campo focado não há teclado');
    eq(alturaDoTeclado(800, 500, 0, true), 300, 'com campo focado, a conta vale');

    // E a fiação. Este é o caso que o defeito produzia: um navegador em que
    // `innerHeight` acompanha o viewport VISUAL. Lendo innerHeight, a conta
    // dava 500 - 500 - 0 = 0: --kb zero, painel colado na borda de baixo,
    // atrás do teclado. Quem procurava um @ digitava sem ver.
    simularTeclado({ layout: 800, visivel: 500 });
    eq(kbAtual(), '300px', 'o app leu a altura errada e o painel não sobe');

    // Teclado fechando: volta a zero, senão sobraria um vão embaixo do painel.
    simularTeclado({ layout: 800, visivel: 800 });
    eq(kbAtual(), '0px', 'fechar o teclado devolve a tela inteira');

    // A barra de URL encolhendo o viewport NÃO é teclado. Sem esta distinção,
    // todo painel subia um pedaço só por existir barra de URL na tela.
    simularTeclado({ layout: 800, visivel: 740, comCampo: false });
    eq(kbAtual(), '0px', 'a barra de URL foi confundida com teclado');
  }],

  ['associar uma conta escolhe a cadeira certa, e recusa o que é ambíguo', () => {
    // A regra de "isto é a mesma pessoa", sozinha. Ela decide onde gravar o
    // handle no histórico inteiro, então cada recusa dela evita um estrago
    // diferente - e nenhuma das três é hipotética.
    const mesaCom = (id, cadeiras) => ({
      id,
      seats: cadeiras.map((c, i) => ({ id: 's' + i, ...c })),
    });

    // O caso comum: uma cadeira com o nome, sem conta.
    const simples = mesaCom('m1', [{ name: 'Alexandre' }, { name: 'Bruno' }]);
    const r1 = cadeirasParaAssociar([simples], ['alexandre'], 'alienpls');
    eq(r1.alvos, [{ matchId: 'm1', seatId: 's0' }], 'acha a cadeira');
    eq(r1.ambiguas, [], 'e não há nada ambíguo');

    // Cadeira já marcada com OUTRA conta: decisão anterior manda. Sem isto, um
    // nome repetido reescreveria a conta de outra pessoa.
    const jaMarcada = mesaCom('m2', [{ name: 'Alexandre', handle: 'outro' }]);
    eq(cadeirasParaAssociar([jaMarcada], ['alexandre'], 'alienpls').alvos, [],
      'não sobrescreve conta já marcada');

    // O @ já está na mesa, em outra cadeira. Gravar de novo poria a mesma
    // pessoa duas vezes na mesma partida, e a estatística somaria dano dela
    // contra si mesma.
    const jaNaMesa = mesaCom('m3', [
      { name: 'Alexandre' }, { name: 'Alex', handle: 'alienpls' },
    ]);
    eq(cadeirasParaAssociar([jaNaMesa], ['alexandre'], 'alienpls').alvos, [],
      'não senta a mesma pessoa duas vezes');

    // Dois nomes do conjunto na MESMA mesa: ou são duas pessoas, ou um apelido
    // está errado. Nenhum dos dois se resolve adivinhando.
    const duasCandidatas = mesaCom('m4', [{ name: 'Alexandre' }, { name: 'Alex' }]);
    const r4 = cadeirasParaAssociar([duasCandidatas], ['alexandre', 'alex'], 'alienpls');
    eq(r4.alvos, [], 'não escolhe uma das duas no chute');
    eq(r4.ambiguas, ['m4'], 'e reporta a partida para quem chamou');
  }],

  ['só aprende quem é quem de partida própria ou de anfitrião confiável', () => {
    // O aprendizado é o que faz a associação viajar sem tabela nova. O gate não
    // é formalidade: sem ele, bastaria um anfitrião qualquer sentar uma cadeira
    // chamada "Alexandre" com o @ dele para o SEU histórico do Alexandre passar
    // a somar na conta errada.
    const partida = (id, dono) => ({
      id,
      owner: dono,
      seats: [{ id: 's0', name: 'Alexandre', handle: 'alienpls' }],
    });

    eq(apelidosAprendidos([partida('m1', 'eu')], 'eu', []),
      [{ nome: 'Alexandre', handle: 'alienpls' }], 'da minha própria, aprende');

    eq(apelidosAprendidos([partida('m2', 'amigo')], 'eu', ['amigo']),
      [{ nome: 'Alexandre', handle: 'alienpls' }], 'de quem eu confio, aprende');

    eq(apelidosAprendidos([partida('m3', 'estranho')], 'eu', ['amigo']), [],
      'de estranho, não aprende');

    eq(apelidosAprendidos([partida('m4', null)], 'eu', ['amigo']), [],
      'sem dono não há por quem responder');

    // Cadeira sem @ não ensina nada - é justamente o estado de quem ainda não
    // foi associado.
    eq(apelidosAprendidos([{ id: 'm5', owner: 'eu', seats: [{ id: 's0', name: 'Ana' }] }],
      'eu', []), [], 'cadeira sem conta não ensina');
  }],

  ['dois aparelhos, a mesma pessoa: associar depois junta o histórico', () => {
    // O cenário inteiro. O aparelho A registrou a pessoa como "Alexandre", o B
    // como "Alex", e nenhum dos dois associou conta na hora - foi feito depois.
    store.wipe();

    const mesaDe = (nome, sufixo) => {
      const m = createMatch([
        { id: 's0', name: nome, commanders: [commander(0)] },
        { id: 's1', name: 'Bruno', commanders: [commander(1)] },
      ], 40);
      m.id = 'partida-' + sufixo;
      push(m, { type: 'life', targetId: 's1', delta: -7, sourceId: 's0' });
      return m;
    };

    store.mesclarPartidas([mesaDe('Alexandre', 'a'), mesaDe('Alex', 'b')]);
    // Como o app faz ao escolher cada jogador na montagem da mesa.
    ['Alexandre', 'Alex', 'Bruno'].forEach(store.rememberPlayer);

    // Antes: são duas pessoas estranhas entre si, cada uma com metade do dano.
    const antes = aggregate(store.partidas(), store.knownHandles());
    eq(antes.players.length, 3, 'antes, "Alex" e "Alexandre" são estranhos');
    eq(antes.players.filter((x) => x.damageDealt === 7).length, 2,
      'e o dano dela sai partido em duas metades');

    // A associação, feita depois - uma vez por nome que a mesa usou. O segundo
    // já sabe do primeiro: rememberHandle junta os nomes do mesmo @.
    associarConta('Alexandre', { handle: 'alienpls', id: 'u-1' });

    // Uma terceira partida chega do outro aparelho DEPOIS da primeira
    // associação, e vem com o nome antigo. Não é hipótese: é o que a
    // sincronização faz toda vez que o outro aparelho sobe o que tinha.
    store.mesclarPartidas([mesaDe('Alexandre', 'c')]);

    // A segunda associação junta os nomes que já apontavam para este @, então
    // ela alcança a partida que acabou de chegar - e não só a que fala "Alex".
    associarConta('Alex', { handle: 'alienpls', id: 'u-1' });

    const depois = aggregate(store.partidas(), store.knownHandles());
    const dela = depois.players.filter((x) => x.key === '@alienpls');
    eq(depois.players.length, 2, 'depois, só a pessoa e o Bruno');
    eq(dela.length, 1, 'uma linha só');
    eq(dela[0].games, 3, 'as três mesas somam na mesma pessoa');
    eq(dela[0].damageDealt, 21, 'e o dano das três soma junto');
    eq(dela[0].label, '@alienpls', 'a linha se chama pelo @');
    eq(dela[0].nomes.slice().sort(), ['Alex', 'Alexandre'],
      'sem perder os nomes que a mesa usou');

    // O handle foi GRAVADO nas partidas, e não só no mapa deste aparelho. É
    // isto que faz a associação viajar: o payload vai para a nuvem, o outro
    // aparelho baixa e aprende.
    ok(store.partidas().every((m) => m.seats[0].handle === 'alienpls'),
      'o handle não entrou no payload das partidas');

    // E o que o outro aparelho aprenderia dessas partidas.
    const comDono = store.partidas().map((m) => ({ ...m, owner: 'eu' }));
    const aprendidos = apelidosAprendidos(comDono, 'eu', []);
    // Conjunto, e não lista: a mesma pessoa aparece em três mesas, então o
    // nome repete - e aprender duas vezes o mesmo apelido não faz nada.
    eq([...new Set(aprendidos.map((x) => x.nome))].sort(), ['Alex', 'Alexandre'],
      'os dois nomes viajam junto com as partidas');

    // A lista de seleção passa a mostrar a PESSOA, e não os dois nomes.
    const pessoas = store.pessoasConhecidas();
    eq(pessoas.length, 2, 'duas pessoas na lista, e não três nomes');
    const p = pessoas.find((x) => x.chave === '@alienpls');
    eq(p.label, '@alienpls', 'a linha da lista se chama pelo @');
    eq(p.nomes.slice().sort(), ['Alex', 'Alexandre'], 'e lembra os dois nomes');

    // Esquecer é da pessoa, não de um dos nomes: esquecer só um a deixaria meia
    // na lista, e ela voltaria pelo outro nome na próxima abertura.
    store.esquecerPessoa('@alienpls');
    eq(store.pessoasConhecidas().map((x) => x.label), ['Bruno'],
      'esquecer a pessoa leva os dois nomes dela');

    store.wipe();
  }],

  ['o apelido aprendido nunca sobrescreve o que este aparelho decidiu', () => {
    // Duas pessoas diferentes podem ter o mesmo nome na mesa de gente
    // diferente. Se o que vem da nuvem pudesse sobrescrever, uma partida
    // baixada renomearia a SUA Ana para a Ana de outro grupo.
    store.wipe();
    store.rememberHandle('Ana', 'ana_daqui');

    eq(store.aprenderApelido('Ana', 'ana_de_outro'), false,
      'divergência não se resolve adivinhando');
    eq(store.handleOf('Ana'), 'ana_daqui', 'a decisão local continua valendo');

    // Mas um nome que este aparelho nunca viu, sim - e ele entra na lista de
    // seleção, porque é gente com quem você jogou.
    eq(store.aprenderApelido('Caio', 'caio99'), true, 'nome novo, aprende');
    eq(store.handleOf('Caio'), 'caio99');
    ok(store.pessoasConhecidas().some((x) => x.chave === '@caio99'),
      'e passa a aparecer na seleção de jogador');

    store.wipe();
  }],

  ['o dano por arraste conta a vida do alvo', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      // O caminho principal: arrastar de um painel ao outro, dizer quanto foi,
      // e a vida do alvo andar quando a tela fecha.
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const vidaDe = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      // Mover além do limiar arma o ataque na hora, sem esperar o tempo de
      // toque. Quem está sob o dedo é o painel do oponente.
      apontarPara(tiles[1]);
      fire(centro, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(centro, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(centro, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      apontarPara(null);

      ok(findAll(root, 'pad-scrim').length === 1,
        'o arraste não abriu o teclado de dano');

      const sete = findAll(root, 'pad-chip').find((c) => textOf(c) === '7');
      ok(sete, 'o teclado de dano não tem o atalho de 7');
      fire(sete, 'click');

      // O número não salta: ainda é o antigo quando a tela fecha.
      eq(vidaDe(1), '40', 'a vida do alvo saltou em vez de contar');

      avancar(Math.round(CONTAGEM_MS / 2));
      const meio = Number(vidaDe(1));
      ok(meio < 40 && meio > 33, 'a contagem não durou: estava em ' + meio);

      avancar(CONTAGEM_MS * 2);
      eq(vidaDe(1), '33', 'o alvo não terminou em 33');
      eq(vidaDe(0), '40', 'quem atacou perdeu vida sem motivo');

      // E o dano tem autor: veio do arraste, não da borda.
      const dano = m.events.filter((e) => e.type === 'life');
      eq(dano.length, 1, 'o arraste não gravou um evento de vida');
      eq(dano[0].sourceId, 's0', 'o dano do arraste ficou sem autor');

      view.destroy();
      return undefined;
    });
  }],

  ['o dreno conta a vida de quem apanhou e de quem curou', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const vidaDe = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      // Duplo toque no centro abre a ação em área.
      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tocar = (id) => {
        fire(centro, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(centro, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tocar(1);
      tocar(2);

      // O painel de área monta a própria cobertura dentro da mesa, e não um
      // painel deslizante no corpo do documento.
      ok(findAll(root, 'pad-scrim').length === 1, 'a ação em área não abriu');

      const dreno = findAll(root, 'pad-mode')
        .find((b) => textOf(b).includes('Dreno'));
      ok(dreno, 'a ação em área não oferece dreno');
      fire(dreno, 'click');

      // Tira 7 de cada oponente. O chip confirma no mesmo toque.
      const sete = findAll(root, 'pad-chip').find((c) => textOf(c) === '7');
      ok(sete, 'não há atalho de 7');
      fire(sete, 'click');

      // Aqui está o ponto: o número NÃO salta. No instante do envio ele ainda
      // é o antigo, e só então começa a andar.
      eq(vidaDe(1), '40', 'a vida do oponente saltou em vez de contar');
      eq(vidaDe(0), '40', 'a vida de quem drenou saltou em vez de contar');

      // No meio do caminho o número tem de estar ENTRE os dois valores. É o
      // que separa uma contagem de 420ms de um passo de 1ms, que termina em
      // sete milissegundos e ninguém vê - e ver é o ponto da melhoria.
      avancar(Math.round(CONTAGEM_MS / 2));
      const meio = Number(vidaDe(1));
      ok(meio < 40 && meio > 33,
        'a contagem não durou: no meio do caminho já estava em ' + meio);

      // E termina no valor certo. `gain` padrão é o total tirado (3 x 7).
      avancar(CONTAGEM_MS * 3);
      eq(vidaDe(1), '33', 'o oponente não terminou em 33');
      eq(vidaDe(2), '33', 'o segundo oponente ficou de fora');
      eq(vidaDe(3), '33', 'o terceiro oponente ficou de fora');
      eq(vidaDe(0), '61', 'quem drenou não terminou com o total curado');

      // A direção fica marcada enquanto conta, e sai ao terminar.
      const numero = findAll(tiles[1], 'tile-life')[0];
      ok(!numero.classList.contains('is-caindo'), 'a marca de direção ficou presa');

      view.destroy();
      return undefined;
    });
  }],

  ['dano em todos conta, e a borda do painel não', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const vidaDe = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tocar = (id) => {
        fire(centro, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(centro, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tocar(1);
      tocar(2);

      // "Dano em todos" é o modo que já vem escolhido.
      const cinco = findAll(root, 'pad-chip').find((c) => textOf(c) === '5');
      ok(cinco, 'não há atalho de 5');
      fire(cinco, 'click');

      eq(vidaDe(1), '40', 'a vida saltou em vez de contar');
      avancar(CONTAGEM_MS * 3);
      eq(vidaDe(1), '35', 'o dano em todos não chegou');
      eq(vidaDe(0), '40', 'quem causou perdeu vida sem dreno');

      // A borda NÃO conta: ali o número já anda a cada toque, e contar por
      // cima brigaria com o "segurar repete".
      const menos = findAll(tiles[2], 'tap-minus')[0];
      fire(menos, 'pointerdown', { pointerId: 9, clientX: 5, clientY: 5 });
      fire(menos, 'pointerup', { pointerId: 9, clientX: 5, clientY: 5 });
      eq(vidaDe(2), '34', 'a borda passou a contar, e devia responder na hora');

      view.destroy();
      return undefined;
    });
  }],

  ['quem pede menos movimento recebe o número de uma vez', () => {
    if (!simulated) return 'skip';
    // A regra de CSS global de prefers-reduced-motion zera transição e
    // animação, mas não alcança uma contagem feita em JavaScript - ela tem de
    // se recusar sozinha.
    const real = globalThis.matchMedia;
    globalThis.matchMedia = (q) => ({
      matches: String(q).includes('reduced-motion'),
      addEventListener() {}, removeEventListener() {},
    });
    try {
      return comRelogioFalso((avancar) => {
        const m = mesa(4);
        const { root, tiles, view } = mesaNaTela(m);
        const vidaDe = (i) => textOf(findAll(tiles[i], 'tile-life')[0]);

        const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
        const tocar = (id) => {
          fire(centro, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
          fire(centro, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
        };
        tocar(1);
        tocar(2);

        const cinco = findAll(root, 'pad-chip').find((c) => textOf(c) === '5');
        ok(cinco, 'não há atalho de 5');
        fire(cinco, 'click');

        // Sem esperar nada: o número já está no valor final.
        eq(vidaDe(1), '35', 'contou mesmo com movimento reduzido pedido');
        avancar(CONTAGEM_MS * 2);
        eq(vidaDe(1), '35', 'o número andou depois de já estar certo');

        view.destroy();
        return undefined;
      });
    } finally {
      globalThis.matchMedia = real;
    }
  }],

  ['sobrando um vivo, o cartaz de vitória aparece', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      // Dois jogadores, um morre: a partida terminou e a mesa tem de dizer
      // isso. Era o sintoma relatado - a partida não encerrava sozinha.
      const m = mesa(2);
      push(m, { type: 'life', targetId: 's1', delta: -40, sourceId: 's0' });
      ok(replay(m).finished, 'o motor não considerou a partida encerrada');

      const { root, view } = mesaNaTela(m);

      // O cartaz entra com um atraso curto, para a mesa não sumir no mesmo
      // quadro em que o último ponto de vida saiu. Vai em `root`, e não no
      // corpo: ele cobre a mesa, não a página.
      eq(findAll(root, 'victory').length, 0, 'o cartaz veio sem espera');
      avancar(500);

      const cartaz = findAll(root, 'victory');
      eq(cartaz.length, 1, 'a partida terminou e o cartaz não apareceu');
      ok(textOf(cartaz[0]).includes('P0'), 'o cartaz não diz quem ganhou');

      view.destroy();
      return undefined;
    });
  }],

  ['declarar vencedor pelo menu abre a escolha', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      // O outro sintoma: o botão não fazia nada. Fazia-se nada porque
      // `mesa.pickWinner` era undefined - o menu chamava um buraco.
      const m = mesa(4);
      const { root, view } = mesaNaTela(m);

      const menu = findAll(root, 'hub-btn')
        .find((b) => b.attributes['aria-label'] === 'Menu');
      ok(menu, 'a mesa não tem o botão de menu');
      fire(menu, 'click');

      const telaAtiva = () => {
        const p = findAll(document.body, 'flow-pane');
        return p[p.length - 1];
      };
      const declarar = findAll(telaAtiva(), 'menu-item')
        .find((x) => textOf(x).includes('vencedor'));
      ok(declarar, 'o menu não oferece declarar vencedor');

      // Aqui é onde o defeito aparecia: o item existia, estava habilitado, e
      // tocar nele não fazia absolutamente nada.
      fire(declarar, 'click');
      avancar(400);

      const escolhas = findAll(telaAtiva(), 'menu-label').map(textOf);
      ok(escolhas.includes('P0') && escolhas.includes('P3'),
        'a escolha de vencedor não abriu com os jogadores da mesa');

      view.destroy();
      return undefined;
    });
  }],

  ['segurar -1 no painel do jogador repete, e vira um evento só', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { tiles, view } = mesaNaTela(m);

      // Toque rápido no centro abre o painel do jogador - depois da janela do
      // duplo toque, que é o que separa "abrir painel" de "ação em área".
      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      fire(centro, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(centro, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });
      avancar(DOUBLE_TAP_MS + 10);

      const botaoDe = (texto) => findAll(document.body, 'step-btn')
        .find((b) => textOf(b) === texto);
      const menos = botaoDe('-1');
      ok(menos, 'o painel do jogador não tem o botão de -1');

      // O número que o painel mostra. Ele tem de andar durante a seguradinha,
      // e sem o painel ser remontado - remontar destruiria o botão segurado.
      const noPainel = () => textOf(findAll(document.body, 'stepper-value')[0]);
      eq(noPainel(), '40', 'o painel não abriu em 40');

      // Segurar: um passo no toque, e a repetição depois do atraso.
      fire(menos, 'pointerdown', { pointerId: 2 });
      eq(noPainel(), '39', 'o toque não valeu um ponto na hora');

      avancar(HOLD_DELAY + REPEAT_MS * 2);
      eq(noPainel(), '37', 'a repetição não andou enquanto o dedo segurava');
      ok(menos.classList.contains('is-held'), 'o botão não mostra que repete');

      // E o painel NÃO pode ter sido remontado no caminho. Num navegador o
      // botão segurado seria destruído, o `pointerup` do dedo iria para o
      // botão NOVO, e o intervalo do antigo nunca pararia: a vida continuaria
      // caindo depois de soltar. O stub não modela isso, então a invariante
      // é afirmada direto.
      ok(botaoDe('-1') === menos, 'o painel foi remontado durante a seguradinha');

      fire(menos, 'pointerup', { pointerId: 2 });
      ok(!menos.classList.contains('is-held'), 'soltar não apagou o realce');

      // Nada gravado ainda: a coalescência é o que faz desfazer voltar o gesto
      // inteiro num toque, em vez de ponto por ponto.
      eq(eventosDeVida(m).length, 0, 'gravou antes da coalescência fechar');

      avancar(COMMIT_MS + 10);
      const vida = eventosDeVida(m);
      eq(vida.length, 1, 'a seguradinha inteira virou um evento só');
      eq(vida[0].delta, -3, 'o evento não soma os três passos');
      eq(vida[0].sourceId, null, 'ajuste no próprio painel não tem autor');
      eq(replay(m).players.s0.life, 37, 'e a vida terminou em 37');

      view.destroy();
      return undefined;
    });
  }],

  ['o passo de 5 não repete ao segurar', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { tiles, view } = mesaNaTela(m);

      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      fire(centro, 'pointerdown', { pointerId: 1, clientX: 50, clientY: 50 });
      fire(centro, 'pointerup', { pointerId: 1, clientX: 50, clientY: 50 });
      avancar(DOUBLE_TAP_MS + 10);

      const cinco = findAll(document.body, 'step-btn')
        .find((b) => textOf(b) === '-5');
      ok(cinco, 'o painel não tem o botão de -5');

      // Na cadência acelerada seriam noventa pontos por segundo: o alvo
      // passaria sempre. O passo de cinco já é o atalho rápido do toque.
      fire(cinco, 'click');
      avancar(HOLD_DELAY + REPEAT_MS * 8);
      avancar(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 35, 'o passo de 5 repetiu ao segurar');

      view.destroy();
      return undefined;
    });
  }],

  ['segurar na borda não arma ataque, e o toque curto ainda vale 1', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const mais = findAll(tiles[0], 'tap-plus')[0];
      const wrap = findAll(root, 'table-wrap')[0];
      ok(mais && wrap, 'a mesa não montou as faixas');

      // Segurar muito na borda: antes isso virava ataque. Agora repete, e a
      // mesa não pode entrar em modo arraste - o gesto já é ajuste de vida.
      fire(mais, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
      avancar(HOLD_DELAY + REPEAT_MS * 2);
      ok(!wrap.classList.contains('is-dragging'), 'segurar na borda armou ataque');
      fire(mais, 'pointerup', { pointerId: 1, clientX: 5, clientY: 5 });
      avancar(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 43, 'três passos para cima');

      // Toque curto continua sendo um passo, aplicado só ao soltar.
      fire(mais, 'pointerdown', { pointerId: 2, clientX: 5, clientY: 5 });
      avancar(TOQUE_CURTO);
      eq(replay(m).players.s0.life, 43, 'o toque curto aplicou antes de soltar');
      fire(mais, 'pointerup', { pointerId: 2, clientX: 5, clientY: 5 });
      avancar(COMMIT_MS + 10);
      eq(replay(m).players.s0.life, 44, 'o toque curto não valeu 1');

      view.destroy();
      return undefined;
    });
  }],
  ['o jogador 1 senta no alto à esquerda, em toda mesa', () => {
    // Pedido de quem joga: com o aparelho deitado, o 1 é o canto de cima à
    // esquerda, e a volta segue no horário (o teste do giro cuida do resto).
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const { nome, shape } of shapesOf(v)) {
          const primeiro = shape.seats[0];
          ok(primeiro.r === 1 && primeiro.c === 1,
            n + ' jogadores / ' + v.id + ' / ' + nome + ': o 1 está em '
            + primeiro.r + ':' + primeiro.c);
        }
      }
    }

    // Com 2, 3 e 5 a forma deitada é o padrão: é como a mesa foi pensada.
    for (const n of [2, 3, 5]) {
      eq(layoutFor(n, null).orient, 'landscape', n + ' jogadores: o padrão não é deitado');
    }
  }],

  ['partida aberta antes da troca não muda ninguém de lugar', () => {
    // O app atualiza no meio de um jogo. A partida que já estava na mesa não
    // tem a marca `assentos`, e tem de continuar com o 1 embaixo à esquerda.
    const nova = mesa(4);
    eq(nova.assentos, 'topo', 'partida nova não nasce marcada');
    eq(layoutDaPartida(nova).seats[0], { r: 1, c: 1, rot: 180 }, 'nova: o 1 no alto');

    const antiga = mesa(4);
    delete antiga.assentos;
    antiga.layoutId = 'padrao';
    eq(layoutDaPartida(antiga).seats.map((x) => x.r + ':' + x.c),
      ['2:1', '1:1', '1:2', '2:2'], 'antiga de 4 trocou de lugar');

    // E vale para toda variante: a antiga tem as mesmas cadeiras, e ainda gira
    // no horário - só começa em outra.
    const celulas = (l) => l.seats
      .map((x) => x.r + ':' + x.c + ':' + (x.cs || 1) + ':' + x.rot).sort();
    for (const n of [2, 3, 4, 5, 6]) {
      for (const v of variantsFor(n)) {
        for (const wide of [false, true]) {
          const velha = mesa(n);
          delete velha.assentos;
          velha.layoutId = v.id;
          const forma = layoutDaPartida(velha, wide);
          const atual = layoutFor(n, v.id, wide);
          const onde = n + '/' + v.id + (wide ? '/deitada' : '');
          eq(forma.cols + 'x' + forma.rows, atual.cols + 'x' + atual.rows,
            onde + ': a forma antiga mudou de grade');
          eq(celulas(forma), celulas(atual), onde + ': as cadeiras não são as mesmas');
          const ang = forma.seats.map((x) => seatAngle(x, forma));
          let volta = 0;
          for (let i = 0; i < n; i += 1) volta += (ang[(i + 1) % n] - ang[i] + 360) % 360;
          ok(Math.abs(volta - 360) < 0.001, onde + ': a ordem antiga não gira no horário');
        }
      }
    }
  }],

  ['lifelink cura quem causou, no mesmo evento', () => {
    const m = mesa(4);
    push(m, { type: 'life', targetId: 's1', delta: -5, sourceId: 's0', gain: 5 });
    let st = replay(m);
    eq(st.players.s1.life, 35, 'o alvo não perdeu');
    eq(st.players.s0.life, 45, 'quem causou não ganhou');

    const k = cmdKeyOf('s0', m.seats[0].commanders[0]);
    push(m, { type: 'cmd', targetId: 's2', sourceId: 's0', cmdKey: k, delta: 3, gain: 3 });
    st = replay(m);
    eq(st.players.s0.life, 48, 'lifelink no dano de comandante');
    eq(st.players.s2.cmd[k], 3, 'o dano de comandante continua contando');

    // Um evento só: desfazer volta a cura junto.
    undo(m);
    eq(replay(m).players.s0.life, 45, 'desfazer deixou a cura para trás');

    const { players } = aggregate([m]);
    eq(players.find((x) => x.label === 'P0').healed, 5, 'a cura não entrou na estatística');
  }],

  ['dano em todos os jogadores pega quem lançou, sem contar como dano causado', () => {
    const m = mesa(3, 4);
    push(m, { type: 'sweep', sourceId: 's0', amount: 4, gain: 0, targets: ['s0', 's1', 's2'] });
    const st = replay(m);
    eq(st.players.s0.life, 0, 'quem lançou ficou de fora');
    ok(st.players.s0.dead, 'quem lançou não morreu');
    eq(st.players.s0.elim.byId, null, 'morrer do próprio dano virou eliminação de si mesmo');
    eq(st.players.s1.elim.byId, 's0', 'os outros são eliminados por quem lançou');

    const { players } = aggregate([m]);
    const p0 = players.find((x) => x.label === 'P0');
    eq(p0.damageDealt, 8, 'bater em si mesmo contou como dano causado');
    eq(p0.damageTaken, 4, 'o dano levado por quem lançou sumiu');
  }],

  ['o teclado de dano começa no 0, e confirmar no 0 não grava nada', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      apontarPara(tiles[1]);
      fire(centro, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(centro, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(centro, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      apontarPara(null);

      eq(textOf(findAll(root, 'pad-amount')[0]), '0', 'o teclado não começou no 0');
      const confirmar = findAll(root, 'btn').find((b) => textOf(b) === 'Confirmar');
      fire(confirmar, 'click');
      avancar(CONTAGEM_MS * 2);
      eq(m.events.length, 0, 'confirmar no 0 gravou um evento');

      // E o duplo toque também começa no 0.
      avancar(300);
      const tocar = (id) => {
        fire(centro, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(centro, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tocar(2);
      tocar(3);
      const valores = findAll(root, 'pad-amount').map(textOf);
      eq(valores[valores.length - 1], '0', 'a ação em área não começou no 0');

      view.destroy();
      return undefined;
    });
  }],

  ['lifelink no teclado de dano cura quem atacou', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];

      apontarPara(tiles[1]);
      fire(centro, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
      fire(centro, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
      fire(centro, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
      apontarPara(null);

      const marca = findAll(root, 'pad-tag')[0];
      ok(marca && textOf(marca).includes('Lifelink'), 'o teclado não tem a marca de lifelink');
      fire(marca, 'click');
      fire(findAll(root, 'pad-chip').find((c) => textOf(c) === '5'), 'click');
      avancar(CONTAGEM_MS * 3);

      const st = replay(m);
      eq(st.players.s1.life, 35, 'o alvo não levou o dano');
      eq(st.players.s0.life, 45, 'quem atacou não ganhou a vida');
      eq(m.events.length, 1, 'lifelink virou dois eventos');
      eq(m.events[0].gain, 5, 'o evento não guardou a cura');

      view.destroy();
      return undefined;
    });
  }],

  ['arrastar a partir do + ou do − ataca, e não mexe na vida', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const wrap = findAll(root, 'table-wrap')[0];

      for (const faixa of ['tap-plus', 'tap-minus']) {
        const borda = findAll(tiles[0], faixa)[0];
        apontarPara(tiles[1]);
        fire(borda, 'pointerdown', { pointerId: 1, clientX: 5, clientY: 5 });
        avancar(80); // bem antes de a repetição começar
        fire(borda, 'pointermove', { pointerId: 1, clientX: 90, clientY: 90 });
        ok(wrap.classList.contains('is-dragging'), faixa + ': arrastar não armou o ataque');
        avancar(HOLD_DELAY + REPEAT_MS * 4); // a repetição não pode acordar
        fire(borda, 'pointerup', { pointerId: 1, clientX: 90, clientY: 90 });
        apontarPara(null);
        avancar(COMMIT_MS + 10);

        eq(replay(m).players.s0.life, 40, faixa + ': a vida de quem arrastou mudou');
        eq(m.events.length, 0, faixa + ': o arraste gravou ajuste de vida');
        ok(findAll(root, 'pad-scrim').length >= 1, faixa + ': o teclado de dano não abriu');
        fire(findAll(root, 'btn').find((b) => textOf(b) === 'Cancelar'), 'click');
        avancar(300);
      }

      view.destroy();
      return undefined;
    });
  }],

  ['a ação em área oferece todos, oponentes e dreno', () => {
    if (!simulated) return 'skip';
    return comRelogioFalso((avancar) => {
      const m = mesa(4);
      const { root, tiles, view } = mesaNaTela(m);
      const centro = findAll(tiles[0], 'tile-drag')[0] || tiles[0];
      const tocar = (id) => {
        fire(centro, 'pointerdown', { pointerId: id, clientX: 50, clientY: 50 });
        fire(centro, 'pointerup', { pointerId: id, clientX: 50, clientY: 50 });
      };
      tocar(1);
      tocar(2);

      const modos = () => findAll(root, 'pad-mode');
      eq(modos().map(textOf), ['Todos', 'Oponentes', 'Dreno'], 'os três modos');
      const ligado = modos().find((b) => b.classList.contains('is-on'));
      eq(textOf(ligado), 'Oponentes', 'o padrão não é só oponentes');

      fire(modos().find((b) => textOf(b) === 'Todos'), 'click');
      eq(textOf(findAll(root, 'pad-to')[0]), '4 jogadores', 'o cabeçalho não diz quem apanha');
      fire(findAll(root, 'pad-chip').find((c) => textOf(c) === '3'), 'click');
      avancar(CONTAGEM_MS * 3);

      const st = replay(m);
      for (const id of ['s0', 's1', 's2', 's3']) eq(st.players[id].life, 37, id + ' ficou de fora');
      eq(m.events[0].targets, ['s0', 's1', 's2', 's3'], 'alvos fora da ordem da mesa');

      view.destroy();
      return undefined;
    });
  }],

  ['no iPhone, a instalação sabe em que navegador está', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ';
    eq(navegadorDoIOS(ios + 'Version/18.0 Mobile/15E148 Safari/604.1'), 'safari');
    eq(navegadorDoIOS(ios + 'CriOS/129.0 Mobile/15E148 Safari/604.1'), 'outro');
    eq(navegadorDoIOS(ios + 'Mobile/15E148 Instagram 350.0'), 'embutido');
    eq(navegadorDoIOS(ios + 'Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]'), 'embutido');
  }],
  ['a tela acesa volta no primeiro toque, como o Safari exige', async () => {
    if (!simulated) return 'skip';
    // O Safari só concede a trava logo depois de um toque. Pedir ao voltar
    // para o app é recusado em silêncio, e a tela passava a apagar no meio da
    // partida. Aqui o navegador recusa o primeiro pedido e aceita o seguinte.
    const naRota = () => document.body.dataset.route;
    const eraRota = naRota();
    const navReal = globalThis.navigator;
    const pedidos = [];
    let travas = 0;
    const ouvintes = [];
    const falso = {
      request: () => {
        pedidos.push(Date.now());
        if (pedidos.length === 1) return Promise.reject(new Error('NotAllowedError'));
        travas += 1;
        return Promise.resolve({
          addEventListener: (tipo, fn) => { if (tipo === 'release') ouvintes.push(fn); },
          release: () => Promise.resolve(),
        });
      },
    };
    const esperar = () => new Promise((r) => setTimeout(r, 0));
    // Pendurado no navigator de verdade: um objeto no lugar dele quebra os
    // campos privados que o Node usa para responder userAgent.
    Object.defineProperty(navReal, 'wakeLock', { value: falso, configurable: true });
    store.wipe();
    try {
      store.setCurrent(mesa(4));
      // Para a home se redesenhar com o aviso de partida aberta: ida e volta
      // pelas estatísticas, que é o caminho que o roteador já sabe fazer.
      fire(botaoDeEstatisticas(), 'click');
      fireWindow('popstate');
      const continuar = findAll(document.getElementById('app'), 'invite-banner')[0];
      ok(continuar, 'a home não ofereceu continuar a partida');
      fire(continuar, 'click');
      eq(naRota(), 'table', 'não entrou na mesa');
      await esperar();
      const antesDoToque = pedidos.length;

      fire(document, 'pointerup', {});
      await esperar();
      ok(pedidos.length > antesDoToque, 'o toque na mesa não pediu a tela acesa');

      // Recusado (o primeiro sempre é, aqui): o toque seguinte tenta de novo.
      while (travas === 0 && pedidos.length < 5) {
        fire(document, 'pointerup', {});
        await esperar();
      }
      eq(travas, 1, 'depois de uma recusa, o toque seguinte não pediu de novo');

      // Com a trava na mão, tocar não pede outra.
      const comTrava = pedidos.length;
      fire(document, 'pointerup', {});
      await esperar();
      eq(pedidos.length, comTrava, 'pediu de novo já tendo a trava');

      // O sistema soltou (bloqueou o celular, trocou de app): o toque recupera.
      ouvintes.forEach((fn) => fn());
      fire(document, 'pointerup', {});
      await esperar();
      eq(travas, 2, 'a trava solta pelo sistema não voltou no toque');
    } finally {
      delete navReal.wakeLock;
      closeSheet();
      if (naRota() !== eraRota) document.body.dataset.route = eraRota;
      store.wipe();
    }
    return undefined;
  }],
  ['o código da mesa é lido do jeito que a pessoa digita ou cola', () => {
    eq(normalizarCodigo(' k7m-2qx '), 'K7M2QX');
    ok(codigoValido('K7M 2QX'), 'o código como aparece na tela não vale');
    ok(!codigoValido('K7M2Q'), 'cinco caracteres valeram');
    ok(!codigoValido('O0I1L2'), 'letras fora do alfabeto valeram');
    eq(formatarCodigo('k7m2qx'), 'K7M 2QX');

    // Colar a mensagem inteira da conversa: o campo acha o código lá dentro.
    const mensagem = t('pass.shareText', {
      codigo: 'K7M 2QX', link: 'https://x.github.io/hit-easy/beta/?mesa=K7M2QX',
    });
    eq(codigoNoTexto(mensagem), 'K7M2QX', 'não achou o código na mensagem');
    eq(codigoNoTexto('Mesa do Hit Easy: K7M 2QX'), 'K7M2QX');
    eq(codigoNoTexto('abre aí https://a.b/?mesa=ABCDEF'), 'ABCDEF', 'não leu o link');
    eq(codigoNoTexto('oi tudo bem'), null, 'inventou um código');

    // O link de quem passou leva ao MESMO canal: código do beta só abre no beta.
    eq(linkDaMesa('K7M2QX', { origin: 'https://x.github.io', pathname: '/hit-easy/beta/index.html' }),
      'https://x.github.io/hit-easy/beta/?mesa=K7M2QX');
    eq(codigoDoLink('?mesa=k7m2qx'), 'K7M2QX', 'o arranque não leu o link');
    eq(codigoDoLink('?outra=1'), null);
  }],

  ['passar por código só solta a mesa depois de subir', () => {
    store.wipe();
    try {
      store.setCurrent(mesa(4));
      const envelope = store.mesaParaEnviar(1000);
      ok(envelope && envelope.partida, 'não montou o envelope');
      ok(store.getCurrent(), 'montar o envelope já soltou a mesa');
      ok(!envelope.partida.passadaEm, 'o envelope saiu carimbado de passado');

      eq(store.soltarMesa('K7M2QX', 2000), true);
      eq(store.getCurrent(), null, 'a mesa continua valendo aqui');
      eq(store.mesaGuardada().passadaCodigo, 'K7M2QX', 'a mesa não lembra o código');
      eq(store.mesaParaEnviar(), null, 'mesa já passada foi enviada de novo');

      // Quem recebe não herda o código; quem retoma também não.
      const chegou = receberAMesa(store.mesaGuardada(), 3000);
      ok(!chegou.passadaCodigo, 'o código viajou para o outro aparelho');
      store.retomarMesa();
      ok(!store.getCurrent().passadaCodigo, 'retomar deixou o código para trás');
    } finally {
      store.wipe();
    }
  }],

  ['passar a mesa por código, e cair no arquivo sem rede', async () => {
    if (!simulated) return 'skip';
    const fetchReal = globalThis.fetch;
    const pedidos = [];
    let rede = true;
    globalThis.fetch = (u, o) => {
      pedidos.push({ url: String(u), corpo: JSON.parse((o && o.body) || 'null') });
      if (!rede) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve('K7M2QX') });
    };
    const respirar = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    const confirmar = () => {
      const acoes = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(acoes.childNodes[1], 'click');
    };
    store.wipe();
    try {
      store.setCurrent(mesa(4));
      let saiu = 0;
      const indo = passarMesa(() => { saiu += 1; });
      await respirar();
      confirmar();
      eq(await indo, true, 'a passagem não terminou');

      const pedido = pedidos.find((p) => p.url.endsWith('/rpc/enviar_mesa'));
      ok(pedido, 'não subiu a mesa');
      eq(pedido.corpo.c, 'producao', 'subiu sem o canal');
      eq(pedido.corpo.mesa.partida.id, store.mesaGuardada().id, 'subiu outra mesa');
      eq(saiu, 1, 'quem chamou não soube que a mesa saiu');
      eq(store.mesaGuardada().passadaCodigo, 'K7M2QX');
      const codigo = findAll(document.body, 'mesa-codigo').slice(-1)[0];
      ok(codigo && textOf(codigo) === 'K7M 2QX', 'o código não apareceu');
      closeSheet();

      // Sem rede: a mesa NÃO sai daqui, e a tela oferece o arquivo.
      store.wipe();
      store.setCurrent(mesa(4));
      rede = false;
      const semRede = passarMesa(() => { saiu += 1; });
      await respirar();
      confirmar();
      await respirar();
      ok(store.getCurrent(), 'sem rede, a mesa sumiu deste aparelho');
      const oferta = findAll(document.body, 'btn').find((b) => textOf(b) === t('pass.sendFile'));
      ok(oferta, 'sem rede, não ofereceu o arquivo');
      closeSheet();
      await respirar();
      eq(await semRede, false);
      eq(saiu, 1, 'sem rede, a tela trocou como se tivesse passado');
    } finally {
      globalThis.fetch = fetchReal;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['receber por código vê, confirma e só então pega', async () => {
    if (!simulated) return 'skip';
    const fetchReal = globalThis.fetch;
    const pedidos = [];
    const original = mesa(4);
    original.id = 'p-por-codigo';
    push(original, { type: 'life', targetId: 's1', sourceId: 's0', delta: -9 });
    const envelope = { formato: 'hit-easy/mesa', versao: 1, em: 1, partida: original };
    let pegaram = false;
    globalThis.fetch = (u, o) => {
      const url = String(u);
      pedidos.push({ url, corpo: JSON.parse((o && o.body) || 'null') });
      let resposta = null;
      if (url.endsWith('/rpc/ver_mesa')) resposta = pegaram ? null : envelope;
      if (url.endsWith('/rpc/pegar_mesa')) { resposta = pegaram ? null : envelope; pegaram = true; }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(resposta) });
    };
    const respirar = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    store.wipe();
    try {
      // O envelope que o arquivo usa: o formato tem de ser o mesmo nos dois.
      store.setCurrent(mesa(2));
      envelope.formato = JSON.parse(store.empacotarMesa(1)).formato;
      store.wipe();

      let abriu = 0;
      abrirReceberMesa(() => { abriu += 1; }, 'k7m2qx');
      const campo = findAll(document.body, 'mesa-codigo-campo').slice(-1)[0];
      eq(campo.value, 'K7M 2QX', 'o código do link não veio preenchido');
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('pass.receive')).pop(), 'click');
      await respirar();

      ok(pedidos.some((p) => p.url.endsWith('/rpc/ver_mesa')), 'não procurou a mesa');
      ok(!pedidos.some((p) => p.url.endsWith('/rpc/pegar_mesa')), 'pegou antes de a pessoa confirmar');

      const acoes = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(acoes.childNodes[1], 'click');
      await respirar();

      const pegar = pedidos.find((p) => p.url.endsWith('/rpc/pegar_mesa'));
      ok(pegar, 'confirmou e não pegou');
      eq(pegar.corpo.cod, 'K7M2QX');
      eq(store.getCurrent() && store.getCurrent().id, 'p-por-codigo', 'a mesa não foi instalada');
      eq(replay(store.getCurrent()).players.s1.life, 31, 'a mesa chegou sem os eventos');
      eq(abriu, 1, 'receber não levou para a mesa');

      // Um segundo aparelho com o mesmo código não leva nada.
      store.wipe();
      abrirReceberMesa(() => { abriu += 1; }, 'K7M2QX');
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('pass.receive')).pop(), 'click');
      await respirar();
      const erro = findAll(document.body, 'mesa-codigo-erro').slice(-1)[0];
      eq(textOf(erro), t('pass.codeNotFound'), 'o código usado não foi recusado');
      eq(store.getCurrent(), null);
      eq(abriu, 1);
    } finally {
      globalThis.fetch = fetchReal;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],

  ['retomar uma mesa que o outro aparelho já pegou pede confirmação a mais', async () => {
    if (!simulated) return 'skip';
    const fetchReal = globalThis.fetch;
    const pedidos = [];
    globalThis.fetch = (u) => {
      const url = String(u);
      pedidos.push(url);
      const resposta = url.endsWith('/rpc/cancelar_mesa') || url.endsWith('/rpc/situacao_mesa')
        ? 'recebida' : null;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(resposta) });
    };
    const respirar = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    const confirmar = () => {
      const acoes = findAll(document.body, 'sheet-actions').slice(-1)[0];
      fire(acoes.childNodes[1], 'click');
    };
    store.wipe();
    try {
      store.setCurrent(mesa(4));
      store.soltarMesa('K7M2QX');
      let retomou = 0;
      const caixa = mesaPassadaBanner(() => {}, () => { retomou += 1; });
      await respirar();
      ok(textOf(caixa).includes(t('pass.goneSubArrived', { codigo: 'K7M 2QX' })),
        'o aviso não disse que o outro aparelho já recebeu');

      const retomar = findAll(caixa, 'btn').find((b) => textOf(b) === t('pass.takeBack'));
      fire(retomar, 'click');
      await respirar();
      confirmar();
      await respirar();
      ok(pedidos.some((u) => u.endsWith('/rpc/cancelar_mesa')), 'retomar não cancelou o código');
      eq(retomou, 0, 'retomou sem avisar que o outro aparelho já tem a mesa');
      const titulo = findAll(document.body, 'sheet-title').slice(-1)[0];
      eq(textOf(titulo), t('pass.takeBackReceivedTitle'));
      confirmar();
      await respirar();
      eq(retomou, 1, 'confirmar de novo não retomou');
      ok(store.getCurrent(), 'a mesa não voltou');
    } finally {
      globalThis.fetch = fetchReal;
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],
  ['as configurações vêm em grupos, na ordem de uso', () => {
    if (!simulated) return 'skip';
    setLang('pt');
    store.wipe();
    document.body.childNodes.length = 0;
    const root = document.createElement('div');
    renderSetup(root, { onStart() {}, onStats() {}, onRefresh() {} });
    fire(findAll(root, 'icon-btn').find((b) => b.attributes['aria-label'] === t('common.settings')), 'click');

    try {
      // Aparência, mesa, aplicativo: do que se mexe mais para o que se mexe
      // menos. A conta, quando existe, é uma linha só antes de tudo.
      const titulos = findAll(document.body, 'sheet-legend').map(textOf);
      eq(titulos, [t('settings.appearance'), t('settings.onTable'), t('settings.app')],
        'grupos fora de ordem');
      eq(findAll(document.body, 'set-conta').length, cloudEnabled() ? 1 : 0,
        'a conta não é uma linha só');

      // Vibração e tela acesa sem legenda: o rótulo já diz tudo.
      const interruptores = findAll(document.body, 'is-toggle');
      ok(interruptores.length >= 2, 'faltam os interruptores da mesa');
      for (const linha of interruptores.slice(0, 2)) {
        ok(findAll(linha, 'set-sub').every((x) => x.hidden), textOf(linha) + ': legenda sobrando');
      }

      // O tema pelos segmentos grava e acende o escolhido.
      const escuro = findAll(document.body, 'set-segment').find((b) => textOf(b) === t('settings.themeDark'));
      fire(escuro, 'click');
      eq(store.getDB().settings.theme, 'escuro', 'o tema não foi gravado');
      const aceso = findAll(document.body, 'set-segment').filter((b) => b.classList.contains('is-on'));
      eq(aceso.map(textOf), [t('settings.themeDark')], 'o segmento escolhido não acendeu');
    } finally {
      closeSheet();
      store.wipe();
    }
    return undefined;
  }],
  ['a tela da conta não entra em laço de redesenho', async () => {
    if (!simulated || !cloudEnabled()) return 'skip';
    // O defeito relatado: depois de entrar na conta, os botões piscavam como se
    // o mouse passasse rápido e paravam de aceitar clique. A tela da conta se
    // redesenhava a cada aviso de conta, redesenhar buscava os convites, e a
    // busca avisava de novo - para sempre, recriando os botões debaixo do
    // mouse a cada volta da rede.
    const fetchReal = globalThis.fetch;
    const sessaoReal = conta.sessao;
    let buscas = 0;
    let convites = [];
    globalThis.fetch = (u) => {
      if (String(u).includes('match_players')) buscas += 1;
      const corpo = String(u).includes('match_players') ? convites : [];
      // Responde num tique à parte, como a rede de verdade: respondendo na
      // hora, o laço antigo nunca devolvia a vez e travava a suíte inteira.
      return new Promise((r) => setTimeout(() => r({
        ok: true, status: 200, json: () => Promise.resolve(corpo),
      }), 0));
    };
    conta.sessao = {
      user: { id: 'eu', email: 'eu@exemplo.com' }, access_token: 'x',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    const respirar = async (n = 30) => { for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    document.body.childNodes.length = 0;
    try {
      const bloco = accountBlock(() => {});
      document.body.append(bloco);
      await respirar();
      const depoisDeMontar = buscas;
      ok(depoisDeMontar >= 1, 'a tela da conta não buscou os convites');

      // Um aviso de conta qualquer: a tela redesenha UMA vez, e para.
      await convitesPendentes();
      await respirar();
      ok(buscas - depoisDeMontar <= 3,
        'laço: ' + (buscas - depoisDeMontar) + ' buscas de convite depois de um aviso só');

      // Fechada a tela, ela para de ouvir: um convite novo de verdade avisa,
      // e a caixa que ninguém vê não pode sair buscando de novo.
      bloco.remove();
      await respirar();
      convites = [{ match_id: 'm1', seat_id: 's1', status: 'pendente', handle: 'eu' }];
      await convitesPendentes();
      await respirar();
      const antes = buscas;
      convites = [];
      await convitesPendentes();
      await respirar();
      eq(buscas - antes, 1, 'a tela fechada continuou buscando convites');
    } finally {
      globalThis.fetch = fetchReal;
      conta.sessao = sessaoReal;
      conta.convites = [];
      document.body.childNodes.length = 0;
    }
    return undefined;
  }],
  ['o @ é atual, livre ou de outra pessoa - e o seu não aparece como livre', () => {
    // A busca resolve @ antigo para o dono atual (sql/008). Achar uma conta
    // não basta para dizer "ocupado", e achar a si mesmo não é "livre".
    eq(situacaoDoHandle('alex', null, 'eu'), 'livre', 'ninguém usa');
    eq(situacaoDoHandle('alex', { id: 'eu', handle: 'alex' }, 'eu'), 'atual', 'é o meu de agora');
    eq(situacaoDoHandle('@Alex', { id: 'eu', handle: 'alex' }, 'eu'), 'atual', 'com @ e maiúscula também');
    eq(situacaoDoHandle('alex', { id: 'eu', handle: 'alexandre' }, 'eu'), 'livre',
      'um @ antigo meu: posso voltar a ele');
    eq(situacaoDoHandle('alex', { id: 'outra', handle: 'alex' }, 'eu'), 'ocupado');
    eq(situacaoDoHandle('alex', { id: 'outra', handle: 'alexandre' }, 'eu'), 'ocupado',
      'o @ antigo de outra pessoa continua dela');
  }],

  ['o nome nas partidas fica do jeito que a pessoa escreveu', () => {
    eq(normalizarNome('  Alê   do   Rio  '), 'Alê do Rio', 'espaços sobrando');
    eq(normalizarNome('Dr. Strange!'), 'Dr. Strange!', 'maiúscula e pontuação ficam');
    eq(normalizarNome('MARIA'), 'MARIA');
    eq(normalizarNome('Ana\u0000\u0007'), 'Ana', 'caractere de controle sai');
    eq(normalizarNome('‮anA'), 'anA', 'o que inverte o texto sai');
    eq(normalizarNome('👨‍👩‍👧 Família'), '👨‍👩‍👧 Família',
      'o emoji composto continua inteiro');
    eq([...normalizarNome('a'.repeat(30))].length, NOME_MAX, 'corta no tamanho do painel');
    eq([...normalizarNome('🐉'.repeat(30))].length, NOME_MAX, 'emoji conta como um');
    eq(normalizarNome('   '), '', 'só espaço é nome nenhum');
  }],

  ['trocar o @ não apaga o nome, e o nome vai normalizado', async () => {
    const fetchReal = globalThis.fetch;
    const sessaoReal = conta.sessao;
    const perfilReal = conta.perfil;
    const pedidos = [];
    globalThis.fetch = (u, o) => {
      pedidos.push({ url: String(u), metodo: (o && o.method) || 'GET', corpo: JSON.parse((o && o.body) || 'null') });
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve([{ id: 'eu', handle: 'alexandre', display_name: 'Alê' }]),
      });
    };
    conta.sessao = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    conta.perfil = { id: 'eu', handle: 'alex', display_name: 'Alê' };
    try {
      await salvarHandle('alexandre', null);
      const upsert = pedidos.find((p) => p.metodo === 'POST' && p.url.includes('/profiles'));
      ok(upsert, 'não gravou o @');
      ok(!('display_name' in upsert.corpo), 'trocar o @ mandou display_name e apagaria o nome');

      await salvarNome('  Dr.   Strange  ');
      const patch = pedidos.find((p) => p.metodo === 'PATCH');
      eq(patch.corpo, { display_name: 'Dr. Strange' }, 'o nome não foi normalizado');
      eq(conta.perfil.display_name, 'Dr. Strange');

      await salvarNome('   ');
      eq(pedidos.filter((p) => p.metodo === 'PATCH').pop().corpo, { display_name: null },
        'nome vazio tem de voltar para o @');
    } finally {
      globalThis.fetch = fetchReal;
      conta.sessao = sessaoReal;
      conta.perfil = perfilReal;
    }
    return undefined;
  }],

  ['conferir o próprio @ diz que já é seu, e não deixa salvar', async () => {
    if (!simulated) return 'skip';
    const fetchReal = globalThis.fetch;
    const sessaoReal = conta.sessao;
    const perfilReal = conta.perfil;
    globalThis.fetch = () => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve([{ id: 'eu', handle: 'alex', display_name: null }]),
    });
    conta.sessao = { user: { id: 'eu', email: 'eu@x.com' }, access_token: 'x', expires_at: Math.floor(Date.now() / 1000) + 3600 };
    conta.perfil = { id: 'eu', handle: 'alex', display_name: null };
    const respirar = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); };
    try {
      fire(handleBlock(), 'click');
      const campo = findAll(document.body, 'search-input').pop();
      campo.value = 'alex';
      fire(findAll(document.body, 'btn').filter((b) => textOf(b) === t('handle.check')).pop(), 'click');
      await respirar();

      const recado = findAll(document.body, 'handle-result').pop();
      eq(textOf(recado), t('handle.yours', { handle: '@alex' }), 'o próprio @ apareceu como livre');
      const usar = findAll(document.body, 'btn').filter((b) => textOf(b) === t('handle.useThis')).pop();
      ok(usar.disabled, 'deixou salvar o @ que já é seu');
    } finally {
      globalThis.fetch = fetchReal;
      conta.sessao = sessaoReal;
      conta.perfil = perfilReal;
      closeSheet();
    }
    return undefined;
  }],
];

/** Roda tudo e devolve o resultado. Quem chama decide como mostrar. */
/**
 * Roda todos os casos. Devolve uma PROMESSA.
 *
 * Um caso pode devolver promessa, e entao ele e esperado antes do proximo -
 * nunca em paralelo, porque os casos compartilham `document`, `store` e a
 * folha aberta, e dois correndo juntos se pisariam.
 *
 * Isto existe porque dois defeitos chegaram ao usuario por caminhos que
 * passam por `await confirmAction`: o runner sincrono nao conseguia observar
 * nada depois do await, entao aquelas linhas eram inalcancaveis por teste.
 */
export async function runAll() {
  const resultados = [];
  for (const [name, fn] of cases) {
    resultados.push(await rodarUm(name, fn));
  }
  return resultados;
}

async function rodarUm(name, fn) {
  {
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

      const r = await fn();
      if (r === 'skip') return { name, ok: true, skipped: true };
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, why: err.message };
    }
  }
}
