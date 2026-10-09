/**
 * Levar as partidas para a nuvem, e trazer de volta.
 *
 * O desenho em uma frase: o aparelho continua tendo tudo, e a nuvem passa a ter
 * tudo tambem. Nao apagamos o historico local depois de subir.
 *
 * Poderiamos apagar - a paywall ja bloqueia a leitura das estatisticas mesmo
 * offline, entao guardar a copia local nao abre porta nenhuma. Mas apagar dados
 * de alguem para provar um ponto que ja esta provado troca risco por nada: um
 * defeito na sincronizacao viraria perda permanente, e nao ha desfazer.
 *
 * A fila de reenvio nao existe como estrutura separada. Ela e derivada: partida
 * que esta aqui e nao esta marcada como enviada e, por definicao, partida que
 * falta subir. Uma fila de verdade poderia divergir do historico; esta nao tem
 * como.
 *
 * Quem NAO assina consegue subir (o banco permite inserir sem assinatura, de
 * proposito) mas nao consegue baixar - a leitura devolve lista vazia. Por isso
 * o que ja subiu e anotado no aparelho: sem essa anotacao, quem nao assina
 * reenviaria o historico inteiro a cada abertura, para sempre.
 */

import * as store from './store.js';
import * as cloud from './cloud.js';
import { cloudEnabled } from './config.js';
import { canal } from './canal.js';
import { deckKeyOf } from './engine.js';

/* ------------------------------------------------------------------ */
/* Decisoes puras                                                      */
/* ------------------------------------------------------------------ */

/**
 * O que falta subir.
 *
 * Descarta o que ja foi enviado por este aparelho E o que o servidor ja tem -
 * a segunda parte cobre o aparelho novo que baixou tudo e nao precisa devolver
 * nada.
 */
export function aSubir(locais, enviadas, idsRemotos) {
  const ja = new Set([...(enviadas || []), ...(idsRemotos || [])]);
  return (locais || []).filter((m) => m && m.id && !ja.has(m.id));
}

/** O que a nuvem tem e este aparelho ainda nao. */
export function aBaixar(locais, remotas) {
  const aqui = new Set((locais || []).map((m) => m && m.id).filter(Boolean));
  return (remotas || []).filter((m) => m && m.id && !aqui.has(m.id));
}

/**
 * O que apagar daqui porque sumiu de la.
 *
 * So entra na conta o que este aparelho SABE que subiu: partida que nunca foi
 * para a nuvem nao pode ser julgada pela ausencia dela na nuvem.
 *
 * `podeConfiar` e a trava que impede um desastre. A leitura da nuvem devolve
 * lista vazia para quem nao assina - identico ao que devolveria se tudo tivesse
 * sido apagado. Confundir os dois casos apagaria o historico inteiro de alguem
 * que so deixou de pagar, e nao ha desfazer.
 *
 * A segunda trava: lista remota vazia com coisas marcadas como enviadas e
 * suspeito demais para agir. Pode ser assinatura vencida na tolerancia de um
 * dia, pode ser resposta truncada. Na duvida, nao apaga - o pior que acontece
 * e uma partida sobrando num aparelho, e sobrar e recuperavel.
 */
export function aApagar(enviadas, idsRemotos, podeConfiar) {
  if (!podeConfiar) return [];
  const marcadas = enviadas || [];
  const remotos = new Set(idsRemotos || []);
  if (!marcadas.length) return [];
  if (!remotos.size) return []; // vazio total: suspeito demais
  return marcadas.filter((id) => !remotos.has(id));
}

/** Vale a pena sincronizar agora? */
/**
 * Quais cadeiras recebem o handle, ao associar uma pessoa a uma conta.
 *
 * Pura de proposito: e a regra que decide "isto e a mesma pessoa", e uma regra
 * dessas precisa ser conferivel sem localStorage e sem rede.
 *
 * `nomes` sao os nomes (minusculos) que se sabe serem dessa pessoa: o que
 * acabou de ser marcado, mais os que o aparelho ja ligava a esse @.
 *
 * Tres recusas, e cada uma evita um estrago diferente:
 *
 *   ja tem outro @    A cadeira foi marcada antes, com outra conta. Nao se
 *                     sobrescreve decisao anterior por causa de um nome igual.
 *
 *   o @ ja esta na mesa  Outra cadeira daquela partida ja e essa pessoa.
 *                     Gravar de novo poria a mesma pessoa duas vezes na mesma
 *                     mesa, e a estatistica somaria dano dela contra si.
 *
 *   duas candidatas   Dois nomes do conjunto sentados na MESMA mesa. Ou sao
 *                     duas pessoas diferentes, ou um apelido esta errado - e
 *                     nenhum dos dois se resolve adivinhando. A partida fica
 *                     de fora e e reportada.
 */
export function cadeirasParaAssociar(partidas, nomes, handle) {
  const alvo = String(handle || '').trim().replace(/^@+/, '').toLowerCase();
  const conjunto = new Set(
    [...(nomes || [])].map((n) => String(n || '').trim().toLowerCase()).filter(Boolean),
  );
  const alvos = [];
  const ambiguas = [];
  if (!alvo || !conjunto.size) return { alvos, ambiguas };

  for (const match of partidas || []) {
    const cadeiras = (match && match.seats) || [];
    const jaNaMesa = cadeiras.some(
      (s) => String(s.handle || '').trim().replace(/^@+/, '').toLowerCase() === alvo,
    );
    if (jaNaMesa) continue;

    const candidatas = cadeiras.filter((s) => {
      if (String(s.handle || '').trim()) return false; // decisao anterior manda
      return conjunto.has(String(s.name || '').trim().toLowerCase());
    });

    if (candidatas.length > 1) { ambiguas.push(match.id); continue; }
    if (candidatas.length === 1) {
      alvos.push({ matchId: match.id, seatId: candidatas[0].id });
    }
  }

  return { alvos, ambiguas };
}

/**
 * Apelidos (nome -> @) que da para aprender do que veio da nuvem.
 *
 * Uma cadeira com nome E handle e, por si, a informacao de que aquele nome e
 * aquela conta. Lendo isso, o aparelho que nunca marcou nada descobre a
 * associacao que o outro fez, e as partidas PROPRIAS dele convergem.
 *
 * O gate e de confianca, e nao e formalidade. Aprender de qualquer partida
 * deixaria um anfitriao qualquer batizar gente no seu aparelho: bastaria
 * sentar uma cadeira chamada "Alexandre" com o @ dele para o seu historico do
 * Alexandre passar a somar na conta errada. Entao: partida sua, ou de
 * anfitriao que voce confiou - a mesma lista que decide o aceite automatico.
 *
 * Quem aplica e store.aprenderApelido, que nunca sobrescreve o que este
 * aparelho ja decidiu na mao.
 */
export function apelidosAprendidos(partidas, meuId, confiaveis) {
  const confio = new Set((confiaveis || []).filter(Boolean));
  const achados = [];

  for (const match of partidas || []) {
    const dono = match && match.owner;
    if (!dono) continue; // partida sem dono: ninguem por quem responder
    if (dono !== meuId && !confio.has(dono)) continue;

    for (const cadeira of (match.seats || [])) {
      const nome = String(cadeira.name || '').trim();
      const handle = String(cadeira.handle || '')
        .trim().replace(/^@+/, '').toLowerCase();
      if (nome && handle) achados.push({ nome, handle });
    }
  }

  return achados;
}

/**
 * Vale a pena escrever os decks no perfil?
 *
 * So quando o CONJUNTO mudou. `lastUsed` muda a cada partida, entao comparar
 * as listas inteiras faria toda sincronizacao escrever no perfil para dizer a
 * mesma coisa.
 */
export function decksMudaram(meus, noPerfil) {
  const chaves = (lista) => (lista || [])
    .map((d) => deckKeyOf(d && d.commanders))
    .filter(Boolean)
    .sort()
    .join('|');
  return chaves(meus) !== chaves(noPerfil);
}

export function podeSincronizar(ligado, estado) {
  return Boolean(ligado) && estado !== 'desligado' && estado !== 'deslogado';
}

/* ------------------------------------------------------------------ */
/* Rede                                                                */
/* ------------------------------------------------------------------ */

let rodando = null;

/**
 * Uma passada completa: sobe o que falta, baixa o que nao tem.
 *
 * Sobe ANTES de baixar. Num aparelho que acabou de entrar numa conta, a ordem
 * inversa poderia trazer o historico da nuvem, mesclar, e so entao subir - e um
 * erro no meio deixaria o aparelho parecendo sincronizado sem estar.
 *
 * Erro em uma partida nao interrompe as outras: rede de mesa de bar cai no meio
 * de qualquer coisa, e uma partida que falhou hoje sobe amanha sozinha, porque
 * continua sem a marca de enviada.
 *
 * Uma execucao por vez. O app chama isto no arranque, ao arquivar uma partida e
 * pelo botao das configuracoes - duas ao mesmo tempo subiriam a mesma partida
 * duas vezes e disputariam a escrita do disco.
 */
/** Pergunta quais @ do historico mudaram, e ensina o aparelho. */
export async function atualizarHandles() {
  const conhecidos = store.handlesConhecidos();
  if (!conhecidos.length) return 0;
  return store.lembrarHandlesAtuais(await cloud.handlesAtuais(conhecidos));
}

export async function sincronizar({ aoProgresso } = {}) {
  if (!podeSincronizar(cloudEnabled(), cloud.state())) {
    return { subiu: 0, baixou: 0, apagou: 0, falhou: 0, pulou: true };
  }
  if (rodando) return rodando;

  rodando = (async () => {
    const resumo = { subiu: 0, baixou: 0, apagou: 0, falhou: 0, pulou: false };
    const avisar = () => { if (aoProgresso) aoProgresso({ ...resumo }); };

    // 1. Subir. Sem ids remotos ainda: a lista local de enviadas ja evita o
    //    reenvio, e quem nao assina nem receberia os ids.
    const pendentes = aSubir(store.getDB().history, store.enviadas(), []);
    for (const partida of pendentes) {
      try {
        await cloud.enviarPartida(partida);
        store.marcarEnviada(partida.id);
        resumo.subiu += 1;
      } catch {
        resumo.falhou += 1; // fica sem marca: tenta de novo na proxima
      }
      avisar();
    }

    // 2. Baixar. Sem assinatura o servidor devolve lista vazia - nao e erro, e
    //    o portao funcionando, e nada aqui precisa saber a diferenca.
    try {
      const remotas = await cloud.baixarPartidas();
      const novas = aBaixar(store.getDB().history, remotas);
      if (novas.length) {
        store.mesclarPartidas(novas);
        resumo.baixou = novas.length;
      }
      // O que veio de la ja esta la: marcar evita devolver na proxima passada.
      for (const m of remotas) store.marcarEnviada(m.id);

      // Os decks da propria conta, nos dois sentidos.
      await sincronizarMeusDecks();

      // Aprender quem e quem com o que veio.
      //
      // Roda sobre TODAS as remotas, e nao so as novas: uma partida que este
      // aparelho ja tinha pode ter sido marcada no outro DEPOIS, e e
      // justamente essa a informacao que se quer.
      await aprenderQuemEQuem(remotas);
    } catch {
      resumo.falhou += 1;
    }

    // 2b. Quem trocou de @. As partidas guardam o @ que a cadeira tinha no
    //     dia; o servidor diz qual e o de hoje, e as estatisticas passam a
    //     ver uma pessoa so. Falhar aqui (sem rede, banco sem sql/010) so
    //     adia a consolidacao para a proxima passada.
    try {
      await atualizarHandles();
    } catch {
      /* fica para a proxima */
    }

    // 3. Reconciliar exclusoes: o que sumiu da nuvem sai daqui tambem.
    //
    // So para quem consegue LER de verdade. Para quem nao assina o servidor
    // devolve lista vazia, que e indistinguivel de "apagaram tudo" - e agir
    // sobre essa ambiguidade destruiria o historico de quem so deixou de pagar.
    if (cloud.state() === 'assinante') {
      try {
        const { ids, completo } = await cloud.idsRemotos();
        for (const id of aApagar(store.enviadas(), ids, completo)) {
          store.deleteMatch(id);
          store.esquecerEnviada(id);
          resumo.apagou += 1;
        }
      } catch {
        resumo.falhou += 1;
      }
    }

    avisar();
    return resumo;
  })();

  try {
    return await rodando;
  } finally {
    rodando = null;
  }
}

/**
 * Apagar uma partida daqui E de la.
 *
 * A politica de privacidade promete que apagar nao depende de assinatura, e o
 * banco permite - mas a promessa so vale se o aplicativo de fato pedir. Apagar
 * so no aparelho deixaria a copia da nuvem viva, contradizendo o texto.
 *
 * O local sai primeiro: se a rede falhar, a pessoa ve o resultado que pediu, e
 * a linha da nuvem fica para a proxima tentativa em vez de travar a acao.
 */
/**
 * Aplica os apelidos aprendidos do que veio da nuvem.
 *
 * Falhar ao ler a lista de confianca nao pode derrubar a sincronizacao: sem
 * ela, ainda da para aprender das partidas proprias - que e o caso de quem usa
 * dois aparelhos com a mesma conta, o cenario mais comum de todos.
 */
/**
 * Meus decks seguem a minha conta.
 *
 * Desce primeiro: num aparelho novo e a unica fonte, porque o historico local
 * esta vazio. Depois sobe o que este aparelho viu, ja junto com o que desceu -
 * a uniao e o que fica no perfil.
 *
 * Falhar aqui nao derruba a sincronizacao. O caso mais provavel de falha e a
 * coluna nao existir (sql/004-decks-da-conta.sql nao rodado), e nesse caso o
 * app segue como antes: decks do historico local.
 */
async function sincronizarMeusDecks() {
  const perfil = cloud.meuPerfil();
  if (!perfil || !perfil.handle) return;

  // A coluna do canal deste app: `decks` em producao, `decks_beta` no teste.
  // Ler a coluna errada misturaria as duas listas no seletor de deck, que e
  // exatamente o que separar os canais existe para impedir.
  const coluna = cloud.colunaDeDecks(canal());
  const noPerfil = perfil[coluna];

  if (Array.isArray(noPerfil)) {
    store.guardarDecksDaConta(perfil.handle, noPerfil);
  }

  const meus = store.decksOfPlayer(null, perfil.handle);
  if (!meus.length) return;
  if (!decksMudaram(meus, noPerfil)) return;

  try {
    await cloud.salvarMeusDecks(meus);
  } catch { /* coluna ausente ou rede: fica para a proxima passada */ }
}

async function aprenderQuemEQuem(remotas) {
  const eu = cloud.currentUser();
  let confiaveis = [];
  try {
    confiaveis = await cloud.anfitrioesConfiaveis();
  } catch { /* segue so com as proprias */ }

  const aprendidos = apelidosAprendidos(remotas, eu && eu.id, confiaveis);
  for (const { nome, handle } of aprendidos) {
    store.aprenderApelido(nome, handle);
  }
}

export async function apagarPartida(matchId) {
  store.deleteMatch(matchId);
  store.esquecerEnviada(matchId);
  if (!podeSincronizar(cloudEnabled(), cloud.state())) return false;
  try {
    await cloud.apagarPartida(matchId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Marcar a conta de alguem numa partida que ja aconteceu.
 *
 * Esquecer de marcar na hora e o caso comum: a mesa esta jogando, ninguem quer
 * mexer em configuracao. Sem isto, a partida ficava perdida para aquela pessoa
 * para sempre, e a unica saida era nao esquecer - o que nao e saida.
 *
 * Duas coisas acontecem, e vale saber qual e qual:
 *
 *   - o convite E enviado. Essa e a parte que importa: a pessoa recebe a
 *     partida e decide se aceita. Vale mesmo para partidas antigas;
 *   - a marca no CORPO da partida fica so neste aparelho. A tabela de partidas
 *     nao tem politica de update, de proposito - partida encerrada nao se
 *     reescreve, e e isso que faz a estatistica ser confiavel. Abrir excecao
 *     para uma etiqueta abriria para o resto.
 */
/**
 * Associa um NOME a uma conta, e reescreve o historico inteiro.
 *
 * E o coracao da atribuicao. Antes, marcar a conta gravava o handle em uma
 * cadeira de uma partida e o resto do historico se apoiava no mapa de apelidos
 * do aparelho - o que resolvia a estatistica aqui e nao viajava: no outro
 * aparelho aquelas partidas seguiam orfas, porque o mapa e local e o payload
 * delas nunca ganhou o handle.
 *
 * Agora o handle e gravado em TODA partida local onde a pessoa aparece, e as que
 * ja estavam na nuvem sao reenviadas. A associacao passa a estar no dado, e o
 * dado viaja - e o outro aparelho a aprende ao baixar (ver apelidosAprendidos).
 *
 * Pega tambem os outros nomes que este aparelho ja ligava a esse @: quem marcou
 * "Alexandre" ontem e marca "Alex" hoje ve as duas metades se juntarem agora, e
 * nao so daqui para a frente.
 */
export async function associarConta(nome, perfil) {
  if (!perfil || !perfil.handle) return { ok: false };
  const limpo = String(nome || '').trim();
  if (!limpo) return { ok: false };

  // O aparelho passa a saber que este nome e esta conta. Vem ANTES do backfill
  // porque e ele que junta os outros nomes que ja apontavam para o mesmo @.
  store.rememberHandle(limpo, perfil.handle);

  const nomes = new Set([
    limpo.toLowerCase(),
    ...store.nomesDaPessoa(perfil.handle),
  ]);

  // A partida em andamento entra junto: deixa-la de fora gravaria a mesa de
  // hoje com a identidade velha, e seria a primeira a divergir.
  const emAndamento = store.getCurrent();
  const historico = store.partidas();
  const todas = emAndamento ? [emAndamento, ...historico] : historico;

  const { alvos, ambiguas } = cadeirasParaAssociar(todas, nomes, perfil.handle);

  const alteradas = [];
  for (const { matchId, seatId } of alvos) {
    const m = todas.find((x) => x.id === matchId);
    const cadeira = m && (m.seats || []).find((x) => x.id === seatId);
    if (!cadeira) continue;
    cadeira.handle = perfil.handle;
    cadeira.userId = perfil.id || null;
    if (emAndamento && m.id === emAndamento.id) store.setCurrent(m);
    else store.atualizarPartida(m);
    alteradas.push(m);
  }

  const resultado = {
    ok: true,
    convidou: false,
    alteradas: alteradas.length,
    ambiguas: ambiguas.length,
  };
  if (!podeSincronizar(cloudEnabled(), cloud.state())) return resultado;

  // Reenvia o que mudou. `enviarPartida` cobre os dois casos: a partida ja
  // estar la (ignorada como duplicata) e ainda nao estar. Sem ela existindo,
  // nao ha a que prender o convite - ha chave estrangeira.
  //
  // Uma falha por partida nao pode derrubar as outras: o que nao subir agora
  // continua sem a marca de enviada, e a proxima sincronizacao o pega.
  let convidou = false;
  for (const m of alteradas) {
    if (emAndamento && m.id === emAndamento.id) continue; // mesa nao terminada
    try {
      await cloud.enviarPartida(m);
      store.marcarEnviada(m.id);
      convidou = true;
    } catch { /* fica para a proxima sincronizacao */ }
  }

  return { ...resultado, convidou };
}

/**
 * Marcar a conta de uma cadeira, a partir do detalhe de uma partida.
 *
 * Confere o que so faz sentido no contexto daquela mesa - a mesma conta nao
 * pode ocupar duas cadeiras - e delega o resto a associarConta, que trata a
 * pessoa e nao a cadeira.
 */
export async function marcarJogador(match, seatId, perfil) {
  if (!match || !perfil || !perfil.handle) return { ok: false };
  const cadeira = (match.seats || []).find((s) => s.id === seatId);
  if (!cadeira) return { ok: false };

  const pessoaRepetidaAqui = (match.seats || []).some(
    (s) => s !== cadeira
      && String(s.handle || '').toLowerCase() === String(perfil.handle).toLowerCase(),
  );
  if (pessoaRepetidaAqui) return { ok: false, motivo: 'repetida' };

  return associarConta(cadeira.name, perfil);
}
