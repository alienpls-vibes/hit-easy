/**
 * Passar a mesa por codigo: a partida sobe, um codigo curto desce.
 *
 * Por arquivo a mesa ia pelo WhatsApp e o celular de quem recebia nao
 * conseguia abrir o .json - a passagem falhava no meio do jogo. Um codigo de
 * seis letras atravessa qualquer conversa, se dita em voz alta ou se digita.
 *
 * Sem conta, de proposito: a bateria acaba no celular de quem estiver na mesa,
 * logado ou nao. Por isso os pedidos saem com os cabecalhos ANONIMOS - quem
 * protege e o banco (sql/007-mesa-por-codigo.sql): a tabela nao tem policy, e
 * so as funcoes respondem, e so a quem tem o codigo. Passar pelo `pedir()`
 * tambem nao serviria: um 401 ali derruba a sessao da pessoa, e nada aqui
 * depende de sessao.
 *
 * Preso ao canal, como as partidas: codigo gerado no beta nao abre em
 * producao.
 */

import { cabecalhosAnonimos, url } from './http.js';
import { canal } from '../canal.js';

/** O alfabeto do banco: sem 0/O e 1/I/L, que se confundem. */
export const ALFABETO_DO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TAMANHO_DO_CODIGO = 6;

/**
 * O que a pessoa digitou, do jeito que o banco guarda.
 *
 * Aceita o codigo como ele aparece na tela (`K7M 2QX`), com traco ou em
 * minusculas. Nao tenta adivinhar letra fora do alfabeto (um O, um 1): elas
 * nao existem em codigo nenhum, e codigoValido() recusa.
 */
export function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codigoValido(codigo) {
  const c = normalizarCodigo(codigo);
  return c.length === TAMANHO_DO_CODIGO
    && [...c].every((letra) => ALFABETO_DO_CODIGO.includes(letra));
}

/** `K7M2QX` -> `K7M 2QX`: dois blocos de tres se leem e se ditam melhor. */
export function formatarCodigo(codigo) {
  const c = normalizarCodigo(codigo);
  return c.length === TAMANHO_DO_CODIGO ? c.slice(0, 3) + ' ' + c.slice(3) : c;
}

/**
 * Acha o codigo no meio de um texto colado ou de um link.
 *
 * Quem recebe pela conversa costuma copiar a mensagem inteira; o campo tem de
 * achar o codigo ali dentro em vez de recusar. O `?mesa=` do link vem
 * primeiro, porque e o que o app escreveu.
 */
export function codigoNoTexto(texto) {
  const s = String(texto || '');
  const doLink = s.match(/[?&]mesa=([A-Za-z0-9]{6})\b/);
  if (doLink && codigoValido(doLink[1])) return normalizarCodigo(doLink[1]);
  const direto = normalizarCodigo(s);
  if (codigoValido(direto)) return direto;
  // Seis caracteres do alfabeto, sozinhos ou em dois blocos de tres.
  const solto = s.toUpperCase().match(/\b([A-Z0-9]{3})[\s-]?([A-Z0-9]{3})\b/g) || [];
  for (const pedaco of solto) {
    if (codigoValido(pedaco)) return normalizarCodigo(pedaco);
  }
  return null;
}

async function rpc(nome, corpo) {
  let res;
  try {
    res = await fetch(url('/rest/v1/rpc/' + nome), {
      method: 'POST',
      headers: cabecalhosAnonimos(),
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('sem-rede');
  }
  if (!res.ok) throw new Error('servidor');
  return res.status === 204 ? null : res.json();
}

/** Sobe a mesa (o mesmo envelope do arquivo) e devolve o codigo. */
export async function enviarMesa(envelope) {
  const codigo = await rpc('enviar_mesa', { mesa: envelope, c: canal() });
  if (!codigoValido(codigo)) throw new Error('servidor');
  return normalizarCodigo(codigo);
}

/** O envelope por tras do codigo, sem consumir. null se nao ha. */
export async function verMesa(codigo) {
  const dado = await rpc('ver_mesa', { cod: normalizarCodigo(codigo), c: canal() });
  return dado && typeof dado === 'object' ? dado : null;
}

/** Consome o codigo e devolve o envelope. null se alguem pegou antes. */
export async function pegarMesa(codigo) {
  const dado = await rpc('pegar_mesa', { cod: normalizarCodigo(codigo), c: canal() });
  return dado && typeof dado === 'object' ? dado : null;
}

/** 'esperando' | 'recebida' | 'inexistente'. */
export async function situacaoDaMesa(codigo) {
  return rpc('situacao_mesa', { cod: normalizarCodigo(codigo), c: canal() });
}

/** 'cancelada' | 'recebida' | 'inexistente'. */
export async function cancelarMesa(codigo) {
  return rpc('cancelar_mesa', { cod: normalizarCodigo(codigo), c: canal() });
}
