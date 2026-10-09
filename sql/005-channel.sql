-- =====================================================================
-- Separating the test channel from the real channel (v1)
--
-- Run this AFTER 004-account-decks.sql. It is idempotent: running it again
-- breaks nothing.
--
-- The problem it solves: production and beta live on the same origin, and
-- the app already separates what goes to the DISK — `storageKey()` in
-- src/channel.js adds a `.beta` suffix in localStorage. But the CLOUD did
-- not know what a channel was. A match played in beta went up to the same
-- `matches` table, and the production app downloaded it as if it were
-- real: a test match in the real history, in the statistics, in the
-- average damage, in a deck's win rate.
--
-- Worse than noise: `learnWhoIsWho` learns aliases from what it downloads,
-- and a test seat tagged with a friend's @ becomes an invite for the real
-- person. The test channel was writing into third parties' lives.
--
-- Through a column, and not a separate Supabase project: the account, the
-- subscription and the @s need to be the SAME on both channels. With two
-- projects, testing sign-in would be testing another sign-in, and the
-- person would have to create an account again to try beta — nobody tests
-- like that.
-- =====================================================================


-- ---------------------------------------------------------------------
-- The column, in the two tables that store matches
--
-- The default is 'producao' on purpose: every row that already exists was
-- written by the real app, before this concept existed. Any other default
-- would hide everyone's history on migration day. ('producao' is the
-- stored name of the production channel.)
--
-- `match_players` carries its own copy instead of asking the match. It is
-- deliberate denormalization: both rows are born in the same upload, from
-- the same client, and the alternative would be a join embedded in every
-- invite query — including that of a non-subscriber, who cannot read
-- `matches`.
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
-- Indexes
--
-- Every match read now filters by channel, so the index that served
-- `owner` alone no longer covers the whole query.
-- ---------------------------------------------------------------------
create index if not exists matches_owner_canal_idx
  on public.matches (owner, canal);

create index if not exists match_players_user_canal_idx
  on public.match_players (user_id, status, canal);


-- ---------------------------------------------------------------------
-- The profile decks, also per channel
--
-- `profiles.decks` (004) keeps the decks that follow the account. Without
-- separating, a test table with made-up commanders would get into the
-- deck picker of the real app — the feature exists precisely so the
-- picker knows the person's decks, and filling it with junk undoes it.
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
-- Who reads, and who does not
--
-- No new policy, again, and again that is the point: the policies of
-- `matches`, `match_players` and `profiles` decide by OWNER, and the
-- channel does not change who owns what. Filtering by channel is the
-- client's job, because it is the one that knows which channel it runs on.
--
-- It is worth saying what this means: the channel is NOT a security
-- boundary. It is data separation. Whoever wants to see their own beta
-- matches from the production app can, by querying the database by hand —
-- and that is fine, they are theirs. What the column guarantees is that
-- the app never MIXES the two by itself.
--
-- And `buscar_handle()` still returns only id, handle and display_name. Do
-- not add `decks` nor `decks_beta` there.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- The leftover: what beta uploaded BEFORE this migration
--
-- Every row that already existed got `canal = 'producao'`, because it was
-- the only possible default — and that includes the test tables beta
-- uploaded before the column existed. They still show up in the real app.
--
-- There is no way for the database to tell by itself: nothing in them
-- says where they came from. But you recognize them by the date and the
-- names. To look:
--
--   select id, started_at, payload->'seats' as cadeiras
--     from public.matches
--    where canal = 'producao'
--    order by started_at desc
--    limit 30;
--
-- And to reclassify the ones that are test:
--
--   update public.matches       set canal = 'beta' where id in ('...','...');
--   update public.match_players set canal = 'beta' where match_id in ('...');
--
-- Reclassifying does NOT delete anything: the match leaves the production
-- history on the next sync and starts showing up in beta. Deleting for
-- good is `delete from public.matches where id in (...)`, and the cascade
-- takes the seats along.
-- ---------------------------------------------------------------------

-- A quick check, to run afterwards and see that it held:
--
--   select canal, count(*) from public.matches group by canal;
--   select canal, count(*) from public.match_players group by canal;
--
-- Before the new app runs, both should say 'producao' for everything.
