-- =====================================================================
-- Hit Easy — esquema do banco (Supabase / Postgres)
--
-- Rode isto no SQL Editor do Supabase, de uma vez. É idempotente:
-- rodar duas vezes não quebra nada.
--
-- A ideia central: o bloqueio NÃO fica no aplicativo, fica aqui.
-- Uma política de linha (RLS) decide quem lê o quê, e o Postgres a
-- aplica em toda consulta, venha ela de onde vier. Não há "if" no
-- JavaScript para alguém remover pelo devtools.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Assinaturas
--
-- Preenchida pelo webhook do Stripe, nunca pelo aplicativo: por isso ela
-- não tem política de escrita para o usuário comum. Quem grava aqui é a
-- chave de serviço, que vive no servidor e nunca chega ao navegador.
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id             uuid primary key references auth.users on delete cascade,
  status              text not null default 'inactive',   -- active | past_due | canceled | inactive
  stripe_customer_id  text unique,
  current_period_end  timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- A pessoa pode VER a própria assinatura (a interface precisa mostrar o
-- estado), mas não pode alterá-la. Nenhuma política de insert/update.
drop policy if exists "ler a propria assinatura" on public.subscriptions;
create policy "ler a propria assinatura"
  on public.subscriptions for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- Quem tem acesso agora
--
-- security definer para conseguir ler subscriptions ignorando o RLS -
-- senão a função enxergaria só a própria linha e não serviria como
-- portão. O search_path fixo evita sequestro por schema.
-- ---------------------------------------------------------------------
create or replace function public.is_subscriber(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.subscriptions s
     where s.user_id = uid
       and s.status = 'active'
       -- Tolerância de um dia: falha de cartão não deve derrubar o
       -- acesso antes de o Stripe tentar de novo.
       and (s.current_period_end is null or s.current_period_end > now() - interval '1 day')
  );
$$;


-- ---------------------------------------------------------------------
-- Partidas
--
-- `payload` guarda a partida inteira em JSON - assentos e log de eventos.
-- Sem normalizar de propósito: o aplicativo já trata a partida como um
-- log fechado, e toda estatística é derivada dele no cliente. Normalizar
-- só valeria se houvesse consulta por evento no servidor.
--
-- `id` é o mesmo identificador que o aplicativo já gera, então enviar
-- duas vezes a mesma partida é conflito de chave, não duplicata.
-- ---------------------------------------------------------------------
create table if not exists public.matches (
  id          text primary key,
  owner       uuid not null references auth.users on delete cascade,
  started_at  timestamptz not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists matches_owner_started_idx
  on public.matches (owner, started_at desc);

alter table public.matches enable row level security;

-- GRAVAR não exige assinatura, de propósito.
--
-- Quem ainda não assina continua jogando e as partidas continuam sendo
-- guardadas. Ninguém perde histórico por não ter pago - só não consegue
-- ler de volta ainda. Apagar dados de alguém seria a escolha hostil, e
-- ainda por cima criaria um problema quando a pessoa assinasse depois.
drop policy if exists "gravar as proprias partidas" on public.matches;
create policy "gravar as proprias partidas"
  on public.matches for insert
  with check (auth.uid() = owner);

-- LER exige assinatura ativa. É este o portão, e é o Postgres que o aplica.
drop policy if exists "ler as proprias partidas assinando" on public.matches;
create policy "ler as proprias partidas assinando"
  on public.matches for select
  using (auth.uid() = owner and public.is_subscriber(auth.uid()));

-- APAGAR nunca exige assinatura: é direito sobre o próprio dado (LGPD),
-- e não pode ficar atrás de um pagamento.
drop policy if exists "apagar as proprias partidas" on public.matches;
create policy "apagar as proprias partidas"
  on public.matches for delete
  using (auth.uid() = owner);

-- Partida encerrada é imutável. Sem política de update: o histórico não
-- se reescreve, e é isso que faz a estatística ser confiável.


-- ---------------------------------------------------------------------
-- Preferências da conta
--
-- Decks e jogadores ocultos: são escolha da pessoa, não dado de partida,
-- e precisam acompanhar a conta entre aparelhos.
-- ---------------------------------------------------------------------
create table if not exists public.preferences (
  user_id     uuid primary key references auth.users on delete cascade,
  hidden      jsonb not null default '{"decks":[],"players":[]}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.preferences enable row level security;

drop policy if exists "cuidar das proprias preferencias" on public.preferences;
create policy "cuidar das proprias preferencias"
  on public.preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
