/**
 * Conta e armazenamento na nuvem (Supabase).
 *
 * Sem SDK: sao chamadas REST diretas. O SDK do Supabase traz mais de 100 KB
 * para fazer o que aqui cabe em duzentas linhas, e o app inteiro nao tem uma
 * dependencia sequer - nao vale comecar agora.
 *
 * O que este modulo NAO faz: decidir quem pode ler o que. Isso e do banco (ver
 * sql/schema.sql). Se alguem apagar o portao daqui pelo devtools, o Postgres
 * continua devolvendo lista vazia. O cliente so pergunta; quem responde e o
 * servidor.
 *
 * As funcoes puras ficam separadas das que tocam a rede, para poderem ser
 * testadas sem servidor nenhum.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, cloudEnabled } from './config.js';
import { chave } from './canal.js';

const SESSAO = chave('mtglc.session.v1');

/* ------------------------------------------------------------------ */
/* Parte pura                                                          */
/* ------------------------------------------------------------------ */

/**
 * Em que estado a conta esta. A interface inteira se desenha a partir daqui.
 *
 *   'desligado'   nuvem nao configurada - o app roda local, como antes
 *   'deslogado'   ha nuvem, mas ninguem entrou
 *   'sem-assinatura'  entrou, mas nao assina: grava partidas, nao le
 *   'assinante'   acesso completo
 */
export function accountState({ ligado, sessao, assinatura }) {
  if (!ligado) return 'desligado';
  if (!sessao || !sessao.access_token) return 'deslogado';
  return assinaturaAtiva(assinatura) ? 'assinante' : 'sem-assinatura';
}

/**
 * Uma assinatura vale ate um dia depois do fim do periodo.
 *
 * A tolerancia existe porque cartao falha: o Stripe tenta de novo em algumas
 * horas, e derrubar o acesso nesse meio-tempo puniria quem esta em dia por um
 * problema do banco emissor.
 */
export function assinaturaAtiva(assinatura, agora = Date.now()) {
  if (!assinatura || assinatura.status !== 'active') return false;
  if (!assinatura.current_period_end) return true;
  const fim = new Date(assinatura.current_period_end).getTime();
  return Number.isFinite(fim) && fim > agora - 24 * 60 * 60 * 1000;
}

/** Uma sessao expirada e tao inutil quanto nenhuma. */
export function sessaoValida(sessao, agora = Date.now()) {
  if (!sessao || !sessao.access_token) return false;
  if (!sessao.expires_at) return true;
  return sessao.expires_at * 1000 > agora;
}

/** A partida como o banco a guarda. */
export function toRow(match, ownerId) {
  return {
    id: match.id,
    owner: ownerId,
    started_at: new Date(match.startedAt).toISOString(),
    payload: { ...match, redo: [] }, // refazer e estado de tela, nao historico
  };
}

/** E o caminho de volta. */
export function fromRow(row) {
  return { ...row.payload, id: row.id };
}

/**
 * O que ainda falta subir.
 *
 * Partida encerrada e imutavel, entao comparar por id basta - nao ha versao
 * nem conflito para resolver. E o que torna esta sincronizacao tao simples.
 */
export function pendentes(locais, idsRemotos) {
  const remotos = new Set(idsRemotos || []);
  return (locais || []).filter((m) => m && m.id && !remotos.has(m.id));
}

/* ------------------------------------------------------------------ */
/* Sessao guardada                                                     */
/* ------------------------------------------------------------------ */

let sessao = lerSessao();
let assinatura = null;
const ouvintes = new Set();

function lerSessao() {
  try {
    const bruto = localStorage.getItem(SESSAO);
    const s = bruto ? JSON.parse(bruto) : null;
    return sessaoValida(s) ? s : null;
  } catch {
    return null;
  }
}

function gravarSessao(s) {
  sessao = s;
  try {
    if (s) localStorage.setItem(SESSAO, JSON.stringify(s));
    else localStorage.removeItem(SESSAO);
  } catch {
    /* modo privado: a sessao vale so enquanto a aba estiver aberta */
  }
  avisar();
}

function avisar() {
  ouvintes.forEach((fn) => fn(state()));
}

export function onAccountChange(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function state() {
  return accountState({ ligado: cloudEnabled(), sessao, assinatura });
}

export function currentUser() {
  return sessao && sessao.user ? sessao.user : null;
}

export function subscription() {
  return assinatura;
}

/* ------------------------------------------------------------------ */
/* Rede                                                                */
/* ------------------------------------------------------------------ */

function url(caminho) {
  return SUPABASE_URL.replace(/\/+$/, '') + caminho;
}

function cabecalhos(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + ((sessao && sessao.access_token) || SUPABASE_ANON_KEY),
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function pedir(caminho, opcoes = {}) {
  const res = await fetch(url(caminho), { ...opcoes, headers: cabecalhos(opcoes.headers) });
  if (res.status === 401 || res.status === 403) {
    gravarSessao(null); // sessao morreu: melhor pedir login do que insistir
    throw new Error('nao autorizado');
  }
  if (!res.ok) throw new Error('servidor respondeu ' + res.status);
  return res.status === 204 ? null : res.json();
}

/**
 * Para onde o login deve voltar.
 *
 * Sem o fragmento: se a pessoa pedir um segundo link estando numa URL que ainda
 * carrega `#access_token=...`, esse token viajaria dentro do e-mail. Sem a query
 * tambem, porque o endereco precisa bater com a lista de Redirect URLs do
 * Supabase - qualquer sobra faz o servidor recusar e cair no Site URL.
 */
export function urlDeRetorno(loc = location) {
  return loc.origin + loc.pathname;
}

/**
 * Como o pedido de link magico vai para a rede.
 *
 * Separado da chamada para poder ser conferido por teste. O detalhe que importa:
 * `redirect_to` e QUERY, nao corpo. O SDK do Supabase aceita
 * `options.emailRedirectTo` e traduz para esta query; a API REST crua nao traduz
 * nada - ela ignora o campo desconhecido calada e manda o link para o Site URL
 * do projeto. Foi exatamente esse engano que fez o primeiro login real cair em
 * localhost:3000.
 */
export function pedidoDeLink(email, redirecionar) {
  return {
    caminho: '/auth/v1/otp?redirect_to=' + encodeURIComponent(redirecionar),
    corpo: { email: String(email || '').trim(), create_user: true },
  };
}

/** Manda o link magico para o e-mail. */
export async function enviarLink(email, redirecionar = urlDeRetorno()) {
  const { caminho, corpo } = pedidoDeLink(email, redirecionar);
  await pedir(caminho, { method: 'POST', body: JSON.stringify(corpo) });
}

/** Leva para o Google/Apple e volta com a sessao na URL. */
export function entrarCom(provedor, redirecionar = urlDeRetorno()) {
  const alvo = url('/auth/v1/authorize')
    + '?provider=' + encodeURIComponent(provedor)
    + '&redirect_to=' + encodeURIComponent(redirecionar);
  location.assign(alvo);
}

/**
 * O Supabase devolve a sessao no fragmento da URL (#access_token=...).
 * Fragmento nunca chega ao servidor - por isso o token viaja ali.
 */
export function capturarRetorno() {
  if (!location.hash || location.hash.length < 2) return false;
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get('access_token');
  if (!token) return false;

  gravarSessao({
    access_token: token,
    refresh_token: p.get('refresh_token'),
    expires_at: Number(p.get('expires_at')) || null,
    user: null,
  });
  // Limpa a barra de enderecos: token em historico de navegacao e vazamento.
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

let provedoresAtivos = [];

/** Quais logins sociais o servidor aceita. Vazio ate carregarConfig() rodar. */
export function provedores() {
  return provedoresAtivos;
}

/**
 * Pergunta ao servidor o que esta ligado.
 *
 * Sem isso a tela mostraria "Entrar com Google" mesmo com o provedor desligado,
 * e o toque levaria a uma pagina de erro do Supabase - pior que nao ter botao.
 */
export async function carregarConfig() {
  if (!cloudEnabled()) return [];
  try {
    const cfg = await pedir('/auth/v1/settings');
    provedoresAtivos = Object.entries(cfg.external || {})
      .filter(([nome, ligado]) => ligado && nome !== 'email')
      .map(([nome]) => nome);
  } catch {
    provedoresAtivos = [];
  }
  return provedoresAtivos;
}

export async function carregarUsuario() {
  if (!sessao) return null;
  const user = await pedir('/auth/v1/user');
  gravarSessao({ ...sessao, user });
  return user;
}

export async function carregarAssinatura() {
  if (!sessao) { assinatura = null; return null; }
  const linhas = await pedir('/rest/v1/subscriptions?select=*&limit=1');
  assinatura = Array.isArray(linhas) && linhas.length ? linhas[0] : null;
  avisar();
  return assinatura;
}

export async function sair() {
  try {
    await pedir('/auth/v1/logout', { method: 'POST' });
  } catch {
    /* servidor fora do ar nao pode impedir alguem de sair */
  }
  assinatura = null;
  gravarSessao(null);
}

/* ------------------------------------------------------------------ */
/* Partidas                                                            */
/* ------------------------------------------------------------------ */

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
    body: JSON.stringify(toRow(match, dono.id)),
  });
}

/**
 * Traz o historico. Sem assinatura, o banco devolve lista vazia - e nao um
 * erro. Do ponto de vista do RLS, aquelas linhas simplesmente nao existem
 * para quem nao assina.
 */
export async function baixarPartidas() {
  const linhas = await pedir('/rest/v1/matches?select=*&order=started_at.desc');
  return (linhas || []).map(fromRow);
}

export async function apagarPartida(id) {
  await pedir('/rest/v1/matches?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
}

/**
 * Arranque da conta, chamado uma vez pelo app.
 *
 * Ordem importa: primeiro captura o token que veio na URL (senao ele fica no
 * historico do navegador), depois carrega quem e a pessoa e se ela assina.
 */
export async function iniciar() {
  if (!cloudEnabled()) return state();
  const voltou = capturarRetorno();
  carregarConfig();

  if (sessao) {
    try {
      await carregarUsuario();
      await carregarAssinatura();
    } catch {
      /* sessao invalida ja foi limpa por pedir() */
    }
  }
  if (voltou) avisar();
  return state();
}
