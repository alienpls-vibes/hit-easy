/**
 * Convites: partidas que alguem registrou dizendo que voce estava na mesa.
 *
 * Cadeira marcada com @ vira convite para o dono daquele @. Aceitar traz a
 * partida para o historico de quem aceitou; confiar num anfitriao faz o que
 * vier dele entrar sozinho.
 */

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
  const linhas = participantesDe(match);
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
  const linhas = (await pedir(
    '/rest/v1/match_players?select=*&status=eq.pendente'
    + '&user_id=eq.' + encodeURIComponent(dono.id),
  )) || [];
  conta.convites = linhas;
  avisar();
  return linhas;
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
    '/rest/v1/trusted_hosts?select=host_id&user_id=eq.'
    + encodeURIComponent(dono.id),
  );
  return (linhas || []).map((l) => l.host_id).filter(Boolean);
}

export async function confiarEm(hostId) {
  const dono = currentUser();
  if (!dono || !hostId) throw new Error('sem sessao');
  await pedir('/rest/v1/trusted_hosts', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: dono.id, host_id: hostId }),
  });
}

export async function deixarDeConfiar(hostId) {
  const dono = currentUser();
  if (!dono || !hostId) return;
  await pedir(
    '/rest/v1/trusted_hosts?user_id=eq.' + encodeURIComponent(dono.id)
    + '&host_id=eq.' + encodeURIComponent(hostId),
    { method: 'DELETE' },
  );
}
