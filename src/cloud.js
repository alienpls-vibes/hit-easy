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
 * Esta pessoa pode abrir as estatisticas?
 *
 * Sem nuvem configurada o app roda como sempre rodou - local, sem conta, sem
 * cobranca -, e trancar ali nao protegeria nada: os dados estao no proprio
 * aparelho de quem esta olhando.
 *
 * Com nuvem, a resposta e a assinatura. Nao existe caso de "deslogado ve o que
 * e dele": bastaria sair da conta para abrir a porta, e um portao que se abre
 * ao ser evitado nao e um portao.
 *
 * Isto e a TELA. O portao de verdade e o RLS do Postgres, que devolve lista
 * vazia para quem nao assina - apagar esta funcao pelo devtools nao entrega
 * partida nenhuma.
 */
export function podeVerEstatisticas(ligado, estado) {
  if (!ligado) return true;
  return estado === 'assinante';
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

/**
 * Esta sessao precisa ser renovada agora?
 *
 * A margem existe porque o token pode vencer ENTRE a decisao e a chegada do
 * pedido no servidor. Um minuto cobre rede lenta e relogio de aparelho fora de
 * hora, que e comum o bastante para importar.
 */
export function precisaRenovar(s, agora = Date.now(), margem = 60000) {
  if (!s || !s.refresh_token) return false;
  if (!s.expires_at) return false;
  return s.expires_at * 1000 - margem <= agora;
}

/**
 * A sessao ainda serve para alguma coisa?
 *
 * Vencida COM refresh_token nao e sessao perdida - e sessao a renovar. Tratar
 * as duas como a mesma coisa foi o que fazia o login durar uma hora e obrigar
 * um e-mail novo depois disso.
 */
export function sessaoAproveitavel(s, agora = Date.now()) {
  if (!s || !s.access_token) return false;
  return sessaoValida(s, agora) || Boolean(s.refresh_token);
}

/**
 * O que estava guardado no disco vira sessao - ou nao.
 *
 * Separado de quem le o localStorage para que o teste alcance a DECISAO, e nao
 * so a regra solta. Foi exatamente aqui que a sessao morria: a versao antiga
 * exigia sessaoValida() e jogava fora tudo que tivesse vencido, refresh_token
 * junto. Uma regra correta guardada num lugar que ninguem consulta nao conserta
 * nada, e um teste que so exercita a regra nao teria percebido.
 */
export function sessaoGuardada(bruto, agora = Date.now()) {
  try {
    const s = bruto ? JSON.parse(bruto) : null;
    return sessaoAproveitavel(s, agora) ? s : null;
  } catch {
    return null;
  }
}

/** Senha curta demais nem sai do aparelho: o servidor recusaria de todo jeito. */
export const SENHA_MINIMA = 8;

export function senhaValida(v) {
  return String(v == null ? '' : v).length >= SENHA_MINIMA;
}

/* ------------------------------------------------------------------ */
/* Identidade publica e participantes                                  */
/* ------------------------------------------------------------------ */

/**
 * O formato de um @.
 *
 * Tem de bater EXATAMENTE com a constraint handle_formato em
 * sql/002-participantes.sql. Se divergirem, o banco recusa com um 400 cru e a
 * pessoa fica olhando para um erro que nao explica nada. Ha uma verificacao
 * automatica cruzando os dois em tools/check-syntax.js.
 */
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** Tudo vira minusculo, sem @ e sem espaco - "@Alex" e "alex" sao a mesma pessoa. */
export function normalizarHandle(h) {
  return String(h == null ? '' : h).trim().replace(/^@+/, '').toLowerCase();
}

export function handleValido(h) {
  return HANDLE_RE.test(normalizarHandle(h));
}

/** Como o @ aparece na tela. */
export function exibirHandle(h) {
  const n = normalizarHandle(h);
  return n ? '@' + n : '';
}

/**
 * As cadeiras que viram convite.
 *
 * So entra cadeira marcada com um @. As outras seguem sendo texto livre, como
 * sempre foram: a esmagadora maioria das mesas nunca vai criar conta, e o app
 * nao pode piorar para elas.
 */
export function participantesDe(match) {
  if (!match || !match.id) return [];
  return (match.seats || [])
    .filter((s) => s && s.id && handleValido(s.handle))
    .map((s) => ({
      match_id: match.id,
      seat_id: s.id,
      user_id: s.userId || null,
      handle: normalizarHandle(s.handle),
    }));
}

/**
 * Junta o convite com a partida a que ele se refere.
 *
 * O convite chega sempre; a partida so vem se a pessoa assina. Por isso `match`
 * pode ser nulo aqui - e nao e erro, e o portao funcionando. Quem nao assina ve
 * que existem tres partidas esperando, sem ver o que ha dentro delas.
 */
export function montarConvites(linhas, partidas) {
  const porId = new Map((partidas || []).map((m) => [m.id, m]));
  return (linhas || [])
    .filter((l) => l && l.match_id)
    .map((l) => ({
      matchId: l.match_id,
      seatId: l.seat_id,
      status: l.status,
      handle: l.handle,
      match: porId.get(l.match_id) || null,
    }));
}

/* ------------------------------------------------------------------ */
/* Sessao guardada                                                     */
/* ------------------------------------------------------------------ */

let sessao = lerSessao();
let assinatura = null;
const ouvintes = new Set();

function lerSessao() {
  try {
    return sessaoGuardada(localStorage.getItem(SESSAO));
  } catch {
    return null; // modo privado: nem ler o disco e permitido
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

async function pedir(caminho, opcoes = {}, jaRenovou = false) {
  // Renova ANTES quando o token esta para vencer: e mais barato que descobrir
  // pelo 401 e refazer o pedido.
  if (!jaRenovou && precisaRenovar(sessao)) {
    try { await renovarSessao(); } catch { /* o 401 abaixo resolve */ }
  }

  const res = await fetch(url(caminho), { ...opcoes, headers: cabecalhos(opcoes.headers) });

  if (res.status === 401 || res.status === 403) {
    // Uma tentativa de renovar e refazer. Sem isto, um token vencido no meio
    // de uma sincronizacao derrubava a sessao inteira - e a pessoa voltava a
    // pedir e-mail por causa de um segundo de atraso.
    if (!jaRenovou && sessao && sessao.refresh_token) {
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

/** Cabecalhos de quem ainda nao tem sessao (ou cuja sessao venceu). */
function cabecalhosAnonimos() {
  return { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
}

/** Guarda o que o GoTrue devolve num login ou numa renovacao. */
function guardarDoServidor(d) {
  gravarSessao({
    access_token: d.access_token,
    // O Supabase gira o refresh_token a cada uso; perder o novo seria perder
    // a sessao na renovacao seguinte.
    refresh_token: d.refresh_token || (sessao && sessao.refresh_token) || null,
    expires_at: d.expires_at
      || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600),
    user: d.user || (sessao && sessao.user) || null,
  });
  return sessao;
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
  if (!sessao || !sessao.refresh_token) throw new Error('sem refresh');
  if (renovando) return renovando;

  renovando = (async () => {
    const res = await fetch(url('/auth/v1/token?grant_type=refresh_token'), {
      method: 'POST',
      headers: cabecalhosAnonimos(),
      body: JSON.stringify({ refresh_token: sessao.refresh_token }),
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

/**
 * Apaga a sessao daqui, sem falar com o servidor.
 *
 * Separado de sair() porque ha casos em que nao HA com quem falar: token
 * recusado, servidor fora do ar, ou um teste montando o proximo caso. Sair de
 * verdade e isto mais um aviso ao servidor - e o aviso nunca pode ser condicao
 * para a pessoa conseguir sair.
 */
export function esquecerSessao() {
  assinatura = null;
  perfil = null;
  gravarSessao(null);
}

export async function sair() {
  try {
    await pedir('/auth/v1/logout', { method: 'POST' });
  } catch {
    /* servidor fora do ar nao pode impedir alguem de sair */
  }
  esquecerSessao();
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
      // Sessao guardada de ontem chega vencida; renovar aqui e o que faz o app
      // abrir ja logado em vez de pedir e-mail de novo.
      if (precisaRenovar(sessao)) await renovarSessao();
      await carregarUsuario();
      await carregarPerfil();
      await carregarAssinatura();
    } catch {
      /* sessao invalida ja foi limpa por pedir() */
    }
  }
  if (voltou) avisar();
  return state();
}


/* ------------------------------------------------------------------ */
/* Perfil, convites e confianca                                        */
/* ------------------------------------------------------------------ */

let perfil = null;

export function meuPerfil() {
  return perfil;
}

export async function carregarPerfil() {
  if (!sessao) { perfil = null; return null; }
  const linhas = await pedir('/rest/v1/profiles?select=*&limit=1');
  perfil = Array.isArray(linhas) && linhas.length ? linhas[0] : null;
  avisar();
  return perfil;
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
    body: JSON.stringify({ id: dono.id, handle: h, display_name: nome || null }),
  });
  if (res.status === 409) throw new Error('handle ocupado');
  if (!res.ok) throw new Error('servidor respondeu ' + res.status);
  const linhas = await res.json();
  perfil = Array.isArray(linhas) && linhas.length ? linhas[0] : { id: dono.id, handle: h };
  avisar();
  return perfil;
}

/** Procura um @. Igualdade exata: confirma quem voce ja conhece, nao explora. */
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
 * Esse @ esta livre para mim?
 *
 * O meu proprio @ nao conta como ocupado - senao trocar de @ e voltar atras
 * ficaria impossivel, e a tela diria "ja e de outra pessoa" apontando para a
 * propria pessoa que esta olhando.
 *
 * Isto e uma CONSULTA, nao uma reserva: entre a resposta e o salvamento alguem
 * pode pegar o mesmo nome. Quem decide de verdade e o indice unico do banco, e
 * salvarHandle() trata o 409. Aqui e so para nao deixar a pessoa digitar um
 * nome ocupado e so descobrir no fim.
 */
export async function handleDisponivel(h) {
  const achado = await buscarHandle(h);
  if (!achado) return true;
  const meu = meuPerfil();
  return Boolean(meu && meu.id && achado.id === meu.id);
}

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

/** Convites enderecados a mim que ainda nao respondi. */
export async function convitesPendentes() {
  const dono = currentUser();
  if (!dono) return [];
  return (await pedir(
    '/rest/v1/match_players?select=*&status=eq.pendente'
    + '&user_id=eq.' + encodeURIComponent(dono.id),
  )) || [];
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


/* ------------------------------------------------------------------ */
/* Entrar com senha                                                    */
/* ------------------------------------------------------------------ */

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
    if (u && u.id) gravarSessao({ ...sessao, user: u });
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
  if (!sessao) throw new Error('sem sessao');
  const u = await pedir('/auth/v1/user', {
    method: 'PUT',
    body: JSON.stringify({
      password: String(senha || ''),
      data: { has_password: true },
    }),
  });
  // A resposta ja e o usuario atualizado: guardar aqui evita uma ida a rede so
  // para descobrir o que o servidor acabou de contar.
  if (u && u.id) gravarSessao({ ...sessao, user: u });
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
