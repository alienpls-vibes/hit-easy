/**
 * Entrar e sair: link magico, senha, login social e o retorno pela URL.
 *
 * O login por link volta de FORA do app - a pessoa sai para o e-mail e
 * retorna por um endereco com a sessao no fragmento -, entao capturarRetorno()
 * roda na subida e nao em resposta a um toque.
 */

import { cloudEnabled } from '../config.js';
import { carregarAssinatura } from './assinatura.js';
import {
  conta, currentUser, esquecerSessao, gravarSessao, state,
} from './estado.js';
import { cabecalhosAnonimos, guardarDoServidor, pedir, url } from './http.js';
import { carregarPerfil } from './perfil.js';

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
  if (!conta.sessao) return null;
  const user = await pedir('/auth/v1/user');
  gravarSessao({ ...conta.sessao, user });
  return user;
}

export async function sair() {
  try {
    await pedir('/auth/v1/logout', { method: 'POST' });
  } catch {
    /* servidor fora do ar nao pode impedir alguem de sair */
  }
  esquecerSessao();
}

/**
 * O e-mail e o link magico continuam existindo - e o caminho de quem esqueceu
 * a senha, e o unico que nao depende de lembrar de nada. Mas ele nao pode ser
 * o caminho de TODO dia: abrir a caixa de entrada para entrar no proprio
 * aparelho e atrito demais, e num aparelho emprestado e pior ainda.
 */

async function pedirToken(caminho, corpo) {
  const res = await fetch(url(caminho), {
    method: 'POST',
    headers: cabecalhosAnonimos(),
    body: JSON.stringify(corpo),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(d.error_description || d.msg || d.message || 'falhou');
    e.codigo = d.error_code || d.error || res.status;
    throw e;
  }
  return d;
}

export async function entrarComSenha(email, senha) {
  const d = await pedirToken('/auth/v1/token?grant_type=password', {
    email: String(email || '').trim(),
    password: String(senha || ''),
  });
  guardarDoServidor(d);
  try {
    await carregarUsuario();
    // Entrou COM senha, logo tem senha. Cobre quem ja tinha uma antes de este
    // campo existir, sem precisar que a pessoa defina de novo.
    if (!temSenha()) await marcarQueTemSenha();
    await carregarPerfil();
    await carregarAssinatura();
  } catch { /* entrou; o resto chega depois */ }
  return state();
}

/**
 * Cria a conta ja com senha.
 *
 * Se o projeto exigir confirmacao de e-mail, o servidor NAO devolve sessao -
 * devolve so o usuario. Nesse caso quem chama precisa dizer "confira sua
 * caixa", e nao fingir que entrou.
 */
/**
 * A conta ja existia?
 *
 * Com confirmacao de e-mail ligada, o GoTrue NAO diz "esse e-mail ja tem conta"
 * - responderia se um endereco existe ou nao para qualquer um que perguntasse,
 * o que transformaria o cadastro num verificador de e-mails. Em vez disso ele
 * devolve um usuario de fachada, com `identities` VAZIO. E esse array vazio o
 * unico sinal, e e o sinal documentado.
 *
 * Sem ler isso, o app dizia "confira sua caixa de entrada" para quem ja tinha
 * conta - e a pessoa ficava esperando um e-mail que nao ia chegar, ou chegava e
 * nao servia para nada.
 */
export function jaTinhaConta(resposta) {
  if (!resposta || resposta.access_token) return false;
  return Array.isArray(resposta.identities) && resposta.identities.length === 0;
}

export async function criarConta(email, senha) {
  const d = await pedirToken('/auth/v1/signup', {
    email: String(email || '').trim(),
    password: String(senha || ''),
  });

  if (d.access_token) {
    guardarDoServidor(d);
    try { await carregarUsuario(); await carregarAssinatura(); } catch { /* depois */ }
    return { entrou: true, estado: state() };
  }

  // Sem confirmacao de e-mail ligada, o servidor recusa com user_already_exists
  // e nem chegamos aqui. Com ela ligada, o sinal e o `identities` vazio.
  if (jaTinhaConta(d)) {
    const e = new Error('conta ja existe');
    e.codigo = 'user_already_exists';
    throw e;
  }

  return { entrou: false, estado: state() };
}

/**
 * Define (ou troca) a senha de quem ja esta dentro.
 *
 * E o passo que fecha o problema: quem chegou por link magico define uma senha
 * uma vez e nunca mais precisa de e-mail - em nenhum aparelho.
 */
/**
 * Esta conta ja tem senha?
 *
 * O GoTrue nao conta isso: a identidade de e-mail existe tanto para quem entrou
 * por link magico quanto para quem tem senha. Entao o proprio app anota, em
 * `user_metadata`, que viaja com a conta e chega igual em qualquer aparelho -
 * ao contrario de uma marca guardada no disco daqui.
 */
export function temSenha() {
  const u = currentUser();
  return Boolean(u && u.user_metadata && u.user_metadata.has_password);
}

async function marcarQueTemSenha() {
  try {
    const u = await pedir('/auth/v1/user', {
      method: 'PUT',
      body: JSON.stringify({ data: { has_password: true } }),
    });
    if (u && u.id) gravarSessao({ ...conta.sessao, user: u });
  } catch {
    /* a senha ja foi definida; a anotacao tenta de novo na proxima */
  }
}

/**
 * Define a primeira senha.
 *
 * Senha e marca vao no MESMO pedido, de proposito. Em duas chamadas o segundo
 * pedido pode falhar - rede caiu, token venceu - e a conta fica num estado
 * mentiroso: tem senha, mas o app acha que nao, e continua oferecendo "salvar
 * senha" para sempre. Uma chamada so nao tem esse meio-termo.
 */
export async function definirSenha(senha) {
  if (!conta.sessao) throw new Error('sem sessao');
  const u = await pedir('/auth/v1/user', {
    method: 'PUT',
    body: JSON.stringify({
      password: String(senha || ''),
      data: { has_password: true },
    }),
  });
  // A resposta ja e o usuario atualizado: guardar aqui evita uma ida a rede so
  // para descobrir o que o servidor acabou de contar.
  if (u && u.id) gravarSessao({ ...conta.sessao, user: u });
  else await carregarUsuario();
}

/**
 * Pede a troca de senha por e-mail.
 *
 * Trocar senha nao pode ser tao facil quanto defini-la pela primeira vez:
 * quem senta num aparelho ja logado - e um contador de vida de mesa vive
 * emprestado - poderia trocar a senha da pessoa e tomar a conta. O e-mail e o
 * que prova que quem pede e o dono.
 *
 * `redirect_to` vai na QUERY, como em todo endpoint do GoTrue. No corpo ele e
 * ignorado em silencio e o link cai no Site URL do projeto - foi assim que o
 * primeiro login real foi parar em localhost:3000.
 */
export async function pedirTrocaDeSenha(email, redirecionar = urlDeRetorno()) {
  await pedir('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirecionar), {
    method: 'POST',
    body: JSON.stringify({ email: String(email || '').trim() }),
  });
}
