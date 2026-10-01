/**
 * A conversa com o servidor: um pedido, e a renovacao de token em volta dele.
 *
 * Toda chamada do app passa por `pedir()`, e e ele que resolve token vencido
 * sem a pessoa perceber - renovando antes quando falta pouco, e uma vez mais
 * ao levar 401. Quem chama nunca trata token.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { conta, esquecerSessao, gravarSessao } from './estado.js';
import { precisaRenovar } from './regras.js';

export function url(caminho) {
  return SUPABASE_URL.replace(/\/+$/, '') + caminho;
}

export function cabecalhos(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer '
      + ((conta.sessao && conta.sessao.access_token) || SUPABASE_ANON_KEY),
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Cabecalhos de quem ainda nao tem sessao (ou cuja sessao venceu). */
export function cabecalhosAnonimos() {
  return { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}

export async function pedir(caminho, opcoes = {}, jaRenovou = false) {
  // Renova ANTES quando o token esta para vencer: e mais barato que descobrir
  // pelo 401 e refazer o pedido.
  if (!jaRenovou && precisaRenovar(conta.sessao)) {
    try { await renovarSessao(); } catch { /* o 401 abaixo resolve */ }
  }

  const res = await fetch(url(caminho), { ...opcoes, headers: cabecalhos(opcoes.headers) });

  if (res.status === 401 || res.status === 403) {
    // Uma tentativa de renovar e refazer. Sem isto, um token vencido no meio
    // de uma sincronizacao derrubava a sessao inteira - e a pessoa voltava a
    // pedir e-mail por causa de um segundo de atraso.
    if (!jaRenovou && conta.sessao && conta.sessao.refresh_token) {
      try {
        await renovarSessao();
        return await pedir(caminho, opcoes, true);
      } catch { /* o refresh tambem morreu: cai fora abaixo */ }
    }
    esquecerSessao(); // agora sim: nao ha como continuar sem login
    throw new Error('nao autorizado');
  }

  if (!res.ok) throw new Error('servidor respondeu ' + res.status);
  return res.status === 204 ? null : res.json();
}

/** Guarda o que o GoTrue devolve num login ou numa renovacao. */
export function guardarDoServidor(d) {
  gravarSessao({
    access_token: d.access_token,
    // O Supabase gira o refresh_token a cada uso; perder o novo seria perder
    // a sessao na renovacao seguinte.
    refresh_token: d.refresh_token
      || (conta.sessao && conta.sessao.refresh_token) || null,
    expires_at: d.expires_at
      || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600),
    user: d.user || (conta.sessao && conta.sessao.user) || null,
  });
  return conta.sessao;
}

let renovando = null;

/**
 * Troca o refresh_token por um access_token novo.
 *
 * Uma renovacao por vez: varias chamadas simultaneas (o app carrega perfil,
 * assinatura e convites juntos) usariam o mesmo refresh_token, e como o
 * Supabase o gira a cada uso, a segunda chegaria com um token ja gasto e
 * derrubaria a sessao. Todas esperam a mesma promessa.
 *
 * Vai com cabecalho anonimo de proposito: mandar o Bearer vencido aqui e
 * pedir para o servidor recusar antes de olhar o refresh_token.
 */
export async function renovarSessao() {
  if (!conta.sessao || !conta.sessao.refresh_token) {
    throw new Error('sem refresh');
  }
  if (renovando) return renovando;

  renovando = (async () => {
    const res = await fetch(url('/auth/v1/token?grant_type=refresh_token'), {
      method: 'POST',
      headers: cabecalhosAnonimos(),
      body: JSON.stringify({ refresh_token: conta.sessao.refresh_token }),
    });
    if (!res.ok) {
      esquecerSessao();
      throw new Error('sessao expirada');
    }
    return guardarDoServidor(await res.json());
  })();

  try {
    return await renovando;
  } finally {
    renovando = null;
  }
}
