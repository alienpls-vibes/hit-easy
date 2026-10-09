/**
 * Convites: partidas que alguem registrou dizendo que voce estava na mesa.
 *
 * Cadeira marcada com @ vira convite para o dono daquele @. Aceitar traz a
 * partida para o historico de quem aceitou; confiar num anfitriao faz o que
 * vier dele entrar sozinho.
 */

import { canal } from '../canal.js';
import { avisar, conta, currentUser } from './estado.js';
import { pedir } from './http.js';
import { participantesDe } from './regras.js';

/**
 * Registra quem sentou em cada cadeira marcada.
 *
 * Roda depois da partida ja estar no banco - ha chave estrangeira, e sem a
 * partida nao existe cadeira. Falhar aqui nao perde a partida: ela ja subiu, e
 * so os convites ficam para a proxima tentativa.
 */
export async function enviarParticipantes(match) {
  const linhas = participantesDe(match, canal());
  if (!linhas.length) return 0;
  await pedir('/rest/v1/match_players', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(linhas),
  });
  return linhas.length;
}

/**
 * Convites em aberto, como este aparelho os conhece.
 *
 * Fica guardado porque a home precisa saber se ha algo esperando sem pedir a
 * rede a cada desenho - e a home se redesenha o tempo todo.
 */
export function convitesAbertos() {
  return conta.convites;
}

/** Convites enderecados a mim que ainda nao respondi. */
export async function convitesPendentes() {
  const dono = currentUser();
  if (!dono) { conta.convites = []; return []; }
  // Pelo canal: um convite nascido numa mesa de teste nao pode aparecer no
  // app de verdade, nem para quem registrou nem para quem foi marcado.
  const linhas = (await pedir(
    '/rest/v1/match_players?select=*&status=eq.pendente'
    + '&canal=eq.' + canal()
    + '&user_id=eq.' + encodeURIComponent(dono.id),
  )) || [];
  // So avisa se a lista MUDOU. Avisar sempre fechava um laco: a tela da conta
  // se redesenha a cada aviso, redesenhar monta o bloco de convites, o bloco
  // busca os convites, e a busca avisava de novo - para sempre, uma ida a rede
  // por volta. Os botoes eram recriados sem parar debaixo do mouse: piscavam,
  // e o clique caia num botao que ja nao existia.
  const mudou = assinaturaDosConvites(linhas) !== assinaturaDosConvites(conta.convites);
  conta.convites = linhas;
  if (mudou) avisar();
  return linhas;
}

function assinaturaDosConvites(lista) {
  return (lista || []).map((c) => c.match_id + ':' + c.seat_id + ':' + c.status).sort().join('|');
}

/** Quem registrou a partida a que este convite se refere. */
export async function anfitriaoDoConvite(matchId) {
  const linhas = await pedir('/rest/v1/rpc/anfitriao_do_convite', {
    method: 'POST',
    body: JSON.stringify({ mid: matchId }),
  });
  return Array.isArray(linhas) && linhas.length ? linhas[0] : null;
}

export async function responderConvite(matchId, seatId, aceitar) {
  await pedir(
    '/rest/v1/match_players?match_id=eq.' + encodeURIComponent(matchId)
    + '&seat_id=eq.' + encodeURIComponent(seatId),
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: aceitar ? 'aceito' : 'recusado' }),
    },
  );
}

/** Passa a aceitar sozinho o que vier deste anfitriao. */
/**
 * Os anfitrioes que eu confio.
 *
 * A policy so devolve as proprias linhas, entao isto nunca revela a lista de
 * ninguem. Serve a dois usos: o aceite automatico de convite (que o servidor
 * resolve sozinho) e o aprendizado de quem e quem ao baixar partida.
 */
export async function anfitrioesConfiaveis() {
  const dono = currentUser();
  if (!dono) return [];
  const linhas = await pedir(
    '/rest/v1/trusted_hosts?select=host_id&confia=is.true&user_id=eq.'
    + encodeURIComponent(dono.id),
  );
  return (linhas || []).map((l) => l.host_id).filter(Boolean);
}

/**
 * Quem esta pessoa recusou explicitamente.
 *
 * Existe porque o aceite automatico agora nasce do historico: jogar junto uma
 * vez basta. Sem uma forma de dizer nao, uma mesa com um estranho num torneio
 * valeria para sempre - e a lista de recusados e o que a tela precisa para
 * mostrar essa decisao e permitir desfaze-la.
 */
export async function anfitrioesRecusados() {
  const dono = currentUser();
  if (!dono) return [];
  const linhas = await pedir(
    '/rest/v1/trusted_hosts?select=host_id&confia=is.false&user_id=eq.'
    + encodeURIComponent(dono.id),
  );
  return (linhas || []).map((l) => l.host_id).filter(Boolean);
}

/**
 * Decide sobre um anfitriao: aceitar sozinho, ou nunca mais.
 *
 * `merge-duplicates` e nao `ignore-duplicates`: a linha pode ja existir com a
 * decisao contraria, e ignorar o conflito deixaria a pessoa tocando um botao
 * que nao faz nada. Trocar de ideia tem de valer.
 */
async function decidirSobre(hostId, confia) {
  const dono = currentUser();
  if (!dono || !hostId) throw new Error('sem sessao');
  await pedir('/rest/v1/trusted_hosts', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: dono.id, host_id: hostId, confia }),
  });
}

export function confiarEm(hostId) {
  return decidirSobre(hostId, true);
}

/**
 * Nunca mais aceitar sozinho o que vier desta pessoa.
 *
 * Grava `confia = false` em vez de apagar a linha. Apagar nao desfaz nada: o
 * gatilho refaz o aceite a partir das partidas que as duas ja jogaram juntas,
 * e a pessoa tocaria o botao de novo todo mes sem entender por que ele nao
 * tem efeito.
 */
export function deixarDeConfiar(hostId) {
  return decidirSobre(hostId, false);
}
