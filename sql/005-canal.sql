-- =====================================================================
-- Separar o canal de teste do canal de verdade (v1)
--
-- Rode isto DEPOIS de 004-decks-da-conta.sql. É idempotente: rodar de novo
-- não quebra.
--
-- O problema que resolve: produção e beta moram na mesma origem, e o app já
-- separa o que vai para o DISCO — `chave()` em src/canal.js põe sufixo
-- `.beta` no localStorage. Mas a NUVEM não sabia o que é canal. Uma partida
-- jogada no beta subia para a mesma tabela `matches`, e o app de produção a
-- baixava como se fosse real: partida de teste no histórico de verdade, nas
-- estatísticas, na média de dano, na taxa de vitória de um deck.
--
-- Pior que ruído: `aprenderQuemEQuem` aprende apelidos do que baixa, e uma
-- cadeira de teste marcada com o @ de um amigo vira convite para a pessoa
-- real. O canal de teste passava a escrever na vida de terceiros.
--
-- Por uma coluna, e não por um projeto Supabase separado: a conta, a
-- assinatura e os @ precisam ser os MESMOS nos dois canais. Com dois
-- projetos, testar o login seria testar outro login, e a pessoa teria de
-- criar conta de novo para experimentar o beta — ninguém testa assim.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A coluna, nas duas tabelas que guardam partida
--
-- O padrão é 'producao' de propósito: toda linha que já existe foi gravada
-- pelo app de verdade, antes de este conceito existir. Qualquer outro padrão
-- esconderia o histórico de todo mundo no dia da migração.
--
-- `match_players` carrega a sua própria cópia em vez de perguntar à partida.
-- É desnormalização consciente: as duas linhas nascem no mesmo envio, do
-- mesmo cliente, e a alternativa seria um join embutido em toda consulta de
-- convite — inclusive na de quem não assina, que não pode ler `matches`.
-- ---------------------------------------------------------------------
alter table public.matches
  add column if not exists canal text not null default 'producao';

alter table public.matches
  drop constraint if exists matches_canal_valido;

alter table public.matches
  add constraint matches_canal_valido
  check (canal in ('producao', 'beta'));

alter table public.match_players
  add column if not exists canal text not null default 'producao';

alter table public.match_players
  drop constraint if exists match_players_canal_valido;

alter table public.match_players
  add constraint match_players_canal_valido
  check (canal in ('producao', 'beta'));


-- ---------------------------------------------------------------------
-- Índices
--
-- Toda leitura de partida passa a filtrar por canal, então o índice que
-- servia a `owner` sozinho deixou de cobrir a consulta inteira.
-- ---------------------------------------------------------------------
create index if not exists matches_owner_canal_idx
  on public.matches (owner, canal);

create index if not exists match_players_user_canal_idx
  on public.match_players (user_id, status, canal);


-- ---------------------------------------------------------------------
-- Os decks do perfil, também por canal
--
-- `profiles.decks` (004) guarda os decks que seguem a conta. Sem separar,
-- uma mesa de teste com comandantes inventados entraria no seletor de deck
-- do app de verdade — o recurso existe justamente para o seletor conhecer
-- os decks da pessoa, e enchê-lo de lixo o desfaz.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists decks_beta jsonb not null default '[]'::jsonb;

alter table public.profiles
  drop constraint if exists decks_beta_formato;

alter table public.profiles
  add constraint decks_beta_formato
  check (jsonb_typeof(decks_beta) = 'array'
         and jsonb_array_length(decks_beta) <= 200);


-- ---------------------------------------------------------------------
-- Quem lê, e quem não lê
--
-- Nenhuma policy nova, de novo, e de novo esse é o ponto: as policies de
-- `matches`, `match_players` e `profiles` decidem por DONO, e o canal não
-- muda quem é dono de quê. Filtrar por canal é trabalho do cliente, porque
-- é ele quem sabe em qual canal está rodando.
--
-- Vale dizer o que isso significa: o canal NÃO é fronteira de segurança. É
-- separação de dados. Quem quiser ver as próprias partidas de beta pelo app
-- de produção consegue, consultando o banco na mão — e tudo bem, são dele.
-- O que a coluna garante é que o app nunca MISTURA os dois sozinho.
--
-- E `buscar_handle()` continua devolvendo só id, handle e display_name. Não
-- acrescente `decks` nem `decks_beta` ali.
-- ---------------------------------------------------------------------

-- Conferência rápida, para rodar depois e ver que ficou de pé:
--
--   select canal, count(*) from public.matches group by canal;
--   select canal, count(*) from public.match_players group by canal;
--
-- Antes de o app novo rodar, as duas devem dizer 'producao' para tudo.
