/**
 * O que o app lembra de quem entrou.
 *
 * Tudo num objeto so, de proposito. Sao cinco valores que nascem e morrem
 * juntos - entrar preenche, sair limpa - e cinco `let` soltos nao diziam isso.
 * Tambem e o que permite as outras pecas de src/cloud/ escreverem aqui:
 * atribuir a propriedade de um binding importado e legal, enquanto atribuir ao
 * binding em si e TypeError.
 *
 * Quem observa mudanca de conta se inscreve em onAccountChange e recebe o
 * state() novo - a interface inteira se redesenha a partir dele.
 */

import { chave } from '../canal.js';
import { cloudEnabled } from '../config.js';
import { accountState, sessaoGuardada } from './regras.js';

const SESSAO = chave('mtglc.session.v1');

export const conta = {
  /** Sessao do GoTrue: access_token, refresh_token, expires_at, user. */
  sessao: lerSessao(),
  /** Assinatura carregada do servidor, ou null se ainda nao se sabe. */
  assinatura: null,
  /** Diferente de `assinatura: null`: distingue "nao assina" de "nao li". */
  assinaturaLida: false,
  /** Perfil publico (nome e @), carregado sob demanda. */
  perfil: null,
  /** Convites abertos enderecados a mim. */
  convites: [],
};

const ouvintes = new Set();

function lerSessao() {
  try {
    return sessaoGuardada(localStorage.getItem(SESSAO));
  } catch {
    return null; // modo privado: nem ler o disco e permitido
  }
}

export function gravarSessao(s) {
  conta.sessao = s;
  try {
    if (s) localStorage.setItem(SESSAO, JSON.stringify(s));
    else localStorage.removeItem(SESSAO);
  } catch {
    /* modo privado: a sessao vale so enquanto a aba estiver aberta */
  }
  avisar();
}

export function avisar() {
  ouvintes.forEach((fn) => fn(state()));
}

export function onAccountChange(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function state() {
  return accountState({
    ligado: cloudEnabled(),
    sessao: conta.sessao,
    assinatura: conta.assinatura,
  });
}

export function currentUser() {
  return conta.sessao && conta.sessao.user ? conta.sessao.user : null;
}

export function subscription() {
  return conta.assinatura;
}

/**
 * Apaga a sessao daqui, sem falar com o servidor.
 *
 * Separado de sair() porque ha casos em que nao HA com quem falar: token
 * recusado, servidor fora do ar, ou um teste montando o proximo caso. Sair de
 * verdade e isto mais um aviso ao servidor - e o aviso nunca pode ser condicao
 * para a pessoa conseguir sair.
 */
export function esquecerSessao() {
  conta.assinatura = null;
  conta.assinaturaLida = false;
  conta.convites = [];
  conta.perfil = null;
  gravarSessao(null);
}
