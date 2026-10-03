/**
 * Conta e armazenamento na nuvem (Supabase) - a porta do subsistema.
 *
 * Sem SDK: sao chamadas REST diretas. O SDK do Supabase traz mais de 100 KB
 * para fazer o que aqui cabe em algumas centenas de linhas, e o app inteiro
 * nao tem uma dependencia sequer - nao vale comecar agora.
 *
 * O que este modulo NAO faz: decidir quem pode ler o que. Isso e do banco (ver
 * sql/schema.sql). Se alguem apagar o portao daqui pelo devtools, o Postgres
 * continua devolvendo lista vazia. O cliente so pergunta; quem responde e o
 * servidor.
 *
 * As pecas vivem em src/cloud/, em camadas que so olham para baixo:
 *
 *   regras.js      funcao pura - e a parte que os testes alcancam sem rede
 *   estado.js      o que se lembra de quem entrou
 *   http.js        um pedido, com renovacao de token em volta
 *   auth.js        entrar e sair
 *   assinatura.js  se a assinatura vale
 *   partidas.js    subir, baixar e apagar partida
 *   perfil.js      o nome e o @
 *   convites.js    partida em que alguem diz que voce estava
 *   iniciar.js     a subida, em ordem
 *
 * Quem importa daqui nao precisa saber dessa divisao, e e de proposito: mexer
 * na divisao amanha nao toca em nenhum dos cinco modulos que dependem daqui.
 */

export {
  HANDLE_RE,
  SENHA_MINIMA,
  accountState,
  assinaturaAtiva,
  exibirHandle,
  fromRow,
  handleValido,
  montarConvites,
  normalizarHandle,
  participantesDe,
  pendentes,
  podeVerEstatisticas,
  precisaRenovar,
  senhaValida,
  sessaoAproveitavel,
  sessaoGuardada,
  sessaoValida,
  toRow,
} from './cloud/regras.js';

export {
  conta,
  currentUser,
  esquecerSessao,
  onAccountChange,
  state,
  subscription,
} from './cloud/estado.js';

export {
  renovarSessao,
} from './cloud/http.js';

export {
  capturarRetorno,
  carregarConfig,
  carregarUsuario,
  criarConta,
  definirSenha,
  entrarCom,
  entrarComSenha,
  enviarLink,
  jaTinhaConta,
  pedidoDeLink,
  pedirTrocaDeSenha,
  provedores,
  sair,
  temSenha,
  urlDeRetorno,
} from './cloud/auth.js';

export {
  assinaturaConhecida,
  carregarAssinatura,
} from './cloud/assinatura.js';

export {
  apagarPartida,
  baixarPartidas,
  enviarPartida,
  idsRemotos,
} from './cloud/partidas.js';

export {
  buscarHandle,
  carregarPerfil,
  handleDisponivel,
  meuPerfil,
  salvarMeusDecks,
  colunaDeDecks,
  salvarHandle,
} from './cloud/perfil.js';

export {
  anfitriaoDoConvite,
  anfitrioesConfiaveis,
  anfitrioesRecusados,
  confiarEm,
  convitesAbertos,
  convitesPendentes,
  deixarDeConfiar,
  enviarParticipantes,
  responderConvite,
} from './cloud/convites.js';

export {
  iniciar,
} from './cloud/iniciar.js';
