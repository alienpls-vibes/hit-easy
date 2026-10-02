/**
 * As partidas no servidor: subir, baixar, listar ids e apagar.
 *
 * Nao decide quem pode ler o que - isso e do banco (sql/schema.sql). Aqui so
 * se pergunta; quem responde e o Postgres com as policies dele.
 */

import { enviarParticipantes } from './convites.js';
import { currentUser } from './estado.js';
import { pedir } from './http.js';
import { canal } from '../canal.js';
import { fromRow, toRow } from './regras.js';

/**
 * Sobe uma partida. Repetir a mesma nao duplica: o id ja e chave primaria, e
 * `resolution=ignore-duplicates` transforma o conflito em silencio - que e o
 * que se quer quando a rede cai no meio de um envio e o app tenta de novo.
 */
export async function enviarPartida(match) {
  const dono = currentUser();
  if (!dono) throw new Error('sem sessao');
  await pedir('/rest/v1/matches', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(toRow(match, dono.id, canal())),
  });
  // Partida sem seus participantes e convite perdido: quem jogou no aparelho
  // de outra pessoa nunca ficaria sabendo. Falhar aqui nao desfaz o envio
  // acima - a partida ja esta salva, e os convites voltam na proxima.
  try {
    await enviarParticipantes(match);
  } catch {
    /* tenta de novo na proxima sincronizacao */
  }
}

/**
 * Traz o historico. Sem assinatura, o banco devolve lista vazia - e nao um
 * erro. Do ponto de vista do RLS, aquelas linhas simplesmente nao existem
 * para quem nao assina.
 */
export async function baixarPartidas() {
  // So o canal deste app. Sem o filtro, producao baixava as partidas de
  // teste e as somava nas estatisticas de verdade.
  const linhas = await pedir('/rest/v1/matches?select=*&canal=eq.'
    + canal() + '&order=started_at.desc');
  return (linhas || []).map(fromRow);
}

/**
 * Quantos ids o servidor devolve de uma vez antes de virar suspeito.
 *
 * Nao e paginacao: e um detector de resposta incompleta. Se vier o limite
 * cheio, provavelmente ha mais - e uma lista incompleta usada para decidir o
 * que APAGAR seria desastrosa.
 */
const LIMITE_IDS = 5000;

/**
 * So os ids das partidas que estao na nuvem.
 *
 * Serve para descobrir o que foi apagado em outro aparelho. Traz so os ids
 * porque a decisao nao precisa do conteudo, e porque a lista precisa caber
 * inteira - meia lista aqui vira exclusao indevida ali.
 */
export async function idsRemotos() {
  // Filtra pelo canal tambem aqui. A lista local de enviadas e por canal
  // (localStorage com sufixo), entao comparar com os ids dos DOIS canais
  // gastaria o limite de 5000 com linhas que nunca serao comparadas - e o
  // limite e o detector de resposta incompleta, que decide o que APAGAR.
  const linhas = await pedir('/rest/v1/matches?select=id&canal=eq.'
    + canal() + '&limit=' + LIMITE_IDS);
  const ids = (linhas || []).map((l) => l && l.id).filter(Boolean);
  return { ids, completo: ids.length < LIMITE_IDS };
}

export async function apagarPartida(id) {
  await pedir('/rest/v1/matches?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
}
