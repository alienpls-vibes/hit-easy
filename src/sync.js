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
    } catch {
      resumo.falhou += 1;
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
export async function marcarJogador(match, seatId, perfil) {
  if (!match || !perfil || !perfil.handle) return { ok: false };
  const cadeira = (match.seats || []).find((s) => s.id === seatId);
  if (!cadeira) return { ok: false };

  const pessoaRepetidaAqui = (match.seats || []).some(
    (s) => s !== cadeira
      && String(s.handle || '').toLowerCase() === String(perfil.handle).toLowerCase(),
  );
  if (pessoaRepetidaAqui) return { ok: false, motivo: 'repetida' };

  cadeira.handle = perfil.handle;
  cadeira.userId = perfil.id || null;
  store.atualizarPartida(match);
  store.rememberHandle(cadeira.name, perfil.handle);

  if (!podeSincronizar(cloudEnabled(), cloud.state())) return { ok: true, convidou: false };
  try {
    // enviarPartida cobre os dois casos: a partida ja estar la (ignorada como
    // duplicata) e ainda nao estar. Sem ela existindo, nao ha a que prender o
    // convite - ha chave estrangeira.
    await cloud.enviarPartida(match);
    store.marcarEnviada(match.id);
    return { ok: true, convidou: true };
  } catch {
    return { ok: true, convidou: false };
  }
}
