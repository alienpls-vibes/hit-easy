/**
 * As regras da conta, sem rede e sem estado.
 *
 * Tudo aqui e funcao de entrada para saida: em que estado a conta esta, se a
 * assinatura vale, se a sessao vence, como a partida vira linha do banco e
 * volta. Por isso e a parte que os testes alcancam sem servidor nenhum - e a
 * razao de estar em arquivo separado, e nao de estar no fim de outro.
 *
 * Nada daqui importa http.js nem estado.js. Se um dia importar, deixou de ser
 * regra e passou a ser comportamento.
 */

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
export function toRow(match, ownerId, canal) {
  return {
    id: match.id,
    owner: ownerId,
    started_at: new Date(match.startedAt).toISOString(),
    // Em que canal esta partida foi jogada. Coluna, e nao algo dentro do
    // payload: e por ela que a leitura filtra, e o banco nao indexa o que
    // esta enterrado num jsonb.
    //
    // Sem valor explicito o banco poria 'producao' por padrao, que e o certo
    // para as linhas antigas e seria exatamente o errado para uma partida de
    // teste: o beta subiria carimbado como real.
    canal: canal || 'producao',
    // `redo` e estado de tela, nao historico. `owner` e coluna: guardar de
    // novo dentro do payload criaria uma segunda verdade sobre quem registrou.
    payload: { ...match, redo: [], owner: undefined },
  };
}

/** E o caminho de volta. */
/**
 * E o caminho de volta.
 *
 * Traz `owner` junto, da COLUNA. Quem registrou a partida decide se da para
 * aprender algo dela (ver apelidosAprendidos em sync.js): de partida propria e
 * de anfitriao confiavel, sim; de estranho, nao. Sem este campo nao haveria
 * como fazer essa pergunta.
 */
export function fromRow(row) {
  return { ...row.payload, id: row.id, owner: row.owner || null };
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
 * O que um @ e para mim: o que ja uso, um livre, ou de outra conta.
 *
 * `achado` e o que a busca devolveu (ou null). A busca resolve @ ANTIGO para o
 * dono atual, entao "achou uma conta" nao basta para dizer ocupado:
 *
 *   achou a mim, com o mesmo @   'atual'   - e o que ja uso; nao ha o que trocar
 *   achou a mim, com outro @     'livre'   - um @ antigo meu, posso voltar a ele
 *   achou outra conta            'ocupado' - atual ou antigo, e de outra pessoa
 *   nao achou                    'livre'
 *
 * Antes o primeiro caso dizia "livre", e a pessoa via o proprio @ oferecido
 * como se fosse um nome novo.
 */
export function situacaoDoHandle(pedido, achado, meuId) {
  if (!achado) return 'livre';
  if (!meuId || achado.id !== meuId) return 'ocupado';
  return normalizarHandle(achado.handle) === normalizarHandle(pedido) ? 'atual' : 'livre';
}

/** O tamanho que cabe no painel de um jogador na mesa - o mesmo do nome digitado. */
export const NOME_MAX = 18;

/**
 * O nome nas partidas, do jeito que a pessoa escreveu.
 *
 * Livre na forma: maiusculas, acentos, pontuacao, emoji. So se tira o que
 * nao e escrita - caractere de controle, espaco sobrando, caractere invisivel
 * que inverte ou esconde texto - e se corta no tamanho, contando por ponto de
 * codigo, como o `char_length` do banco. O U+200D fica: e ele que junta os
 * emojis compostos.
 */
export function normalizarNome(texto) {
  const limpo = String(texto == null ? '' : texto)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u2028-\u202e\u2060-\u206f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...limpo].slice(0, NOME_MAX).join('').trim();
}

/**
 * As cadeiras que viram convite.
 *
 * So entra cadeira marcada com um @. As outras seguem sendo texto livre, como
 * sempre foram: a esmagadora maioria das mesas nunca vai criar conta, e o app
 * nao pode piorar para elas.
 */
export function participantesDe(match, canal) {
  if (!match || !match.id) return [];
  return (match.seats || [])
    .filter((s) => s && s.id && handleValido(s.handle))
    .map((s) => ({
      match_id: match.id,
      seat_id: s.id,
      user_id: s.userId || null,
      handle: normalizarHandle(s.handle),
      // O mesmo canal da partida. Sem isto, uma cadeira marcada numa mesa de
      // teste viraria convite visivel no app de verdade - o canal de teste
      // escrevendo na vida de outra pessoa.
      canal: canal || 'producao',
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
