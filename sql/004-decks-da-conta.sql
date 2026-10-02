-- =====================================================================
-- Os decks seguem a conta (v1)
--
-- Rode isto DEPOIS de 002-participantes.sql. É idempotente: rodar de novo
-- não quebra.
--
-- O problema que resolve: a lista de decks de uma pessoa é derivada do
-- histórico LOCAL. Num aparelho novo esse histórico está vazio, então quem
-- acabou de entrar na conta não acha o próprio deck e precisa buscar na
-- Scryfall de novo — justamente a pessoa que o app já conhece.
--
-- Por que na tabela de perfis, e não derivado das partidas: baixar partidas
-- exige assinatura (o RLS devolve lista vazia sem ela), e precisa que os
-- convites tenham sido aceitos. O deck que a pessoa joga não é estatística,
-- é conveniência de cadastro — e tem de funcionar no primeiro login.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A coluna
--
-- Cada item é `{ "commanders": [...], "lastUsed": 1730000000000 }`. Um deck
-- pode ter dois comandantes (parceiro), então `commanders` é lista.
--
-- O teto de 200 não é para economizar espaço: é para um defeito do cliente
-- não conseguir escrever megabytes aqui. O app já corta bem antes disso.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists decks jsonb not null default '[]'::jsonb;

alter table public.profiles
  drop constraint if exists decks_formato;

alter table public.profiles
  add constraint decks_formato
  check (jsonb_typeof(decks) = 'array' and jsonb_array_length(decks) <= 200);


-- ---------------------------------------------------------------------
-- Quem lê, e quem não lê
--
-- Nenhuma policy nova é necessária, e isso é o ponto: a policy
-- "cuidar do proprio perfil" já é `for all using (auth.uid() = id)`, então
-- cada pessoa lê e escreve só a própria linha. Os decks de alguém são
-- privados dele.
--
-- E a busca por @ não os entrega: `buscar_handle()` seleciona
-- explicitamente id, handle e display_name. Acrescentar `decks` ali
-- transformaria a confirmação de um @ numa devassa do que a pessoa joga.
-- Não acrescente.
-- ---------------------------------------------------------------------

-- Confirmação rápida, para rodar depois e ver que ficou de pé:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'profiles'
--      and column_name = 'decks';
