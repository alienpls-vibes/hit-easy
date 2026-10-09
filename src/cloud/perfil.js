/**
 * O perfil publico: o nome e o @ com que os amigos marcam voce na mesa deles.
 *
 * A busca por @ e igualdade exata, do lado do servidor: da para confirmar um @
 * que voce ja conhece, nunca para descobrir quem tem conta no app.
 */

import { canal } from '../canal.js';
import { avisar, conta, currentUser } from './estado.js';
import { cabecalhos, pedir, url } from './http.js';
import {
  handleValido, normalizarHandle, normalizarNome, situacaoDoHandle,
} from './regras.js';

export function meuPerfil() {
  return conta.perfil;
}

export async function carregarPerfil() {
  if (!conta.sessao) { conta.perfil = null; return null; }
  const linhas = await pedir('/rest/v1/profiles?select=*&limit=1');
  const novo = Array.isArray(linhas) && linhas.length ? linhas[0] : null;
  // Como os convites: avisar sem mudanca faz quem redesenha ao ouvir buscar
  // de novo, e buscar de novo avisar de novo.
  const mudou = JSON.stringify(novo) !== JSON.stringify(conta.perfil);
  conta.perfil = novo;
  if (mudou) avisar();
  return conta.perfil;
}

/**
 * Escolhe ou troca o proprio @.
 *
 * O 409 do Postgres (chave unica) e a unica resposta confiavel sobre @ ocupado:
 * perguntar antes e agir depois deixa uma janela entre as duas coisas em que
 * outra pessoa pega o mesmo nome. Deixa o banco decidir e trata o conflito.
 */
export async function salvarHandle(handle, nome) {
  const dono = currentUser();
  if (!dono) throw new Error('sem sessao');
  const h = normalizarHandle(handle);
  if (!handleValido(h)) throw new Error('handle invalido');

  const res = await fetch(url('/rest/v1/profiles'), {
    method: 'POST',
    headers: cabecalhos({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    // Sem `display_name` quando nao veio nome: o upsert so atualiza as colunas
    // enviadas, e mandar null aqui apagava o nome nas partidas a cada troca
    // de @.
    body: JSON.stringify(nome
      ? { id: dono.id, handle: h, display_name: normalizarNome(nome) || null }
      : { id: dono.id, handle: h }),
  });
  if (res.status === 409) throw new Error('handle ocupado');
  if (!res.ok) throw new Error('servidor respondeu ' + res.status);
  const linhas = await res.json();
  conta.perfil = Array.isArray(linhas) && linhas.length
    ? linhas[0]
    : { id: dono.id, handle: h };
  avisar();
  return conta.perfil;
}

/** Procura um @. Igualdade exata: confirma quem voce ja conhece, nao explora. */
/**
 * Grava no meu perfil os decks que sigo jogando.
 *
 * So a propria conta: a policy "cuidar do proprio perfil" e
 * `using (auth.uid() = id)`, entao nao ha como escrever no perfil de outro -
 * e nem deveria. O anfitriao registra os decks dos amigos no aparelho dele,
 * mas quem decide o que vai no perfil de alguem e aquela pessoa.
 *
 * Exige a coluna de sql/004-decks-da-conta.sql. Sem ela o servidor recusa, e
 * quem chama trata como "fica para a proxima" - o app segue funcionando com os
 * decks do historico local, que e como era antes.
 */
export function colunaDeDecks(qualCanal) {
  return qualCanal === 'beta' ? 'decks_beta' : 'decks';
}

export async function salvarMeusDecks(decks) {
  const dono = currentUser();
  if (!dono) throw new Error('sem sessao');
  if (!Array.isArray(decks)) return null;

  // Coluna por canal. Sem isto, uma mesa de teste com comandantes inventados
  // entraria no seletor de deck do app de verdade - e o recurso existe
  // justamente para o seletor conhecer os decks da pessoa.
  const coluna = colunaDeDecks(canal());

  const enxuto = decks.slice(0, 200).map((d) => ({
    commanders: (d.commanders || []).map((c) => ({
      oracleId: c.oracleId, name: c.name, colors: c.colors, art: c.art || '',
    })),
    lastUsed: d.lastUsed || 0,
  }));

  await pedir('/rest/v1/profiles?id=eq.' + encodeURIComponent(dono.id), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ [coluna]: enxuto }),
  });
  if (conta.perfil) conta.perfil[coluna] = enxuto;
  return enxuto;
}

export async function buscarHandle(handle) {
  const h = normalizarHandle(handle);
  if (!handleValido(h)) return null;
  const linhas = await pedir('/rest/v1/rpc/buscar_handle', {
    method: 'POST',
    body: JSON.stringify({ h }),
  });
  return Array.isArray(linhas) && linhas.length ? linhas[0] : null;
}

/**
 * O que este @ e para mim: 'atual', 'livre' ou 'ocupado' (ver regras.js).
 *
 * Isto e uma CONSULTA, nao uma reserva: entre a resposta e o salvamento alguem
 * pode pegar o mesmo nome. Quem decide de verdade e o banco - o indice unico e
 * o gatilho que guarda todo @ ja usado (sql/008) -, e salvarHandle() trata o
 * 409. Aqui e so para nao deixar a pessoa digitar um nome ocupado e so
 * descobrir no fim.
 */
export async function situacaoDoHandleAgora(h) {
  const achado = await buscarHandle(h);
  const meu = meuPerfil();
  return situacaoDoHandle(h, achado, meu && meu.id);
}

/**
 * Grava o nome nas partidas. Vazio apaga - e a mesa volta a usar o @.
 *
 * So existe com perfil: a linha de `profiles` nasce com o @, e e nela que o
 * nome mora.
 */
export async function salvarNome(texto) {
  const dono = currentUser();
  if (!dono || !conta.perfil) throw new Error('sem perfil');
  const nome = normalizarNome(texto) || null;
  await pedir('/rest/v1/profiles?id=eq.' + encodeURIComponent(dono.id), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ display_name: nome }),
  });
  conta.perfil = { ...conta.perfil, display_name: nome };
  avisar();
  return nome;
}
