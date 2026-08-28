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
    return { subiu: 0, baixou: 0, falhou: 0, pulou: true };
  }
  if (rodando) return rodando;

  rodando = (async () => {
    const resumo = { subiu: 0, baixou: 0, falhou: 0, pulou: false };
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
