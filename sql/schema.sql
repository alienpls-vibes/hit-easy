-- =====================================================================
-- Hit Easy — database schema (Supabase / Postgres)
--
-- Run this in the Supabase SQL Editor, all at once. It is idempotent:
-- running it twice breaks nothing.
--
-- The central idea: the lock does NOT live in the app, it lives here.
-- A row-level policy (RLS) decides who reads what, and Postgres applies
-- it to every query, wherever it comes from. There is no "if" in the
-- JavaScript for someone to remove through devtools.
--
-- Table, column, policy and function names are part of the live
-- database and stay as they are (several are in Portuguese).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Subscriptions
--
-- Filled by the Stripe webhook, never by the app: that is why it has no
-- write policy for a regular user. What writes here is the service key,
-- which lives on the server and never reaches the browser.
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id             uuid primary key references auth.users on delete cascade,
  status              text not null default 'inactive',   -- active | past_due | canceled | inactive
  stripe_customer_id  text unique,
  current_period_end  timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- The person can SEE their own subscription (the interface needs to show
-- the state), but cannot change it. No insert/update policy.
drop policy if exists "ler a propria assinatura" on public.subscriptions;
create policy "ler a propria assinatura"
  on public.subscriptions for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- Who has access right now
--
-- security definer so it can read subscriptions bypassing RLS -
-- otherwise the function would only see its own row and would not work
-- as a gate. The fixed search_path prevents schema hijacking.
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
       -- One day of grace: a card failure should not drop access before
       -- Stripe tries again.
       and (s.current_period_end is null or s.current_period_end > now() - interval '1 day')
  );
$$;


-- ---------------------------------------------------------------------
-- Matches
--
-- `payload` keeps the whole match as JSON - seats and event log. Not
-- normalized on purpose: the app already treats the match as a closed
-- log, and every statistic is derived from it on the client.
-- Normalizing would only be worth it if there were per-event queries on
-- the server.
--
-- `id` is the same identifier the app already generates, so sending the
-- same match twice is a key conflict, not a duplicate.
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

-- WRITING does not require a subscription, on purpose.
--
-- Whoever does not subscribe yet keeps playing and the matches keep
-- being stored. Nobody loses history for not having paid - they just
-- cannot read it back yet. Deleting someone's data would be the hostile
-- choice, and on top of that would create a problem when the person
-- subscribed later.
drop policy if exists "gravar as proprias partidas" on public.matches;
create policy "gravar as proprias partidas"
  on public.matches for insert
  with check (auth.uid() = owner);

-- READING requires an active subscription. This is the gate, and
-- Postgres is what applies it.
drop policy if exists "ler as proprias partidas assinando" on public.matches;
create policy "ler as proprias partidas assinando"
  on public.matches for select
  using (auth.uid() = owner and public.is_subscriber(auth.uid()));

-- DELETING never requires a subscription: it is a right over your own
-- data (LGPD), and cannot sit behind a payment.
drop policy if exists "apagar as proprias partidas" on public.matches;
create policy "apagar as proprias partidas"
  on public.matches for delete
  using (auth.uid() = owner);

-- A finished match is immutable. No update policy: the history is not
-- rewritten, and that is what makes the statistics trustworthy.


-- ---------------------------------------------------------------------
-- Account preferences
--
-- Hidden decks and players: they are the person's choice, not match
-- data, and need to follow the account across devices.
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
