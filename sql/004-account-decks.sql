-- =====================================================================
-- Decks follow the account (v1)
--
-- Run this AFTER 002-participants.sql. It is idempotent: running it again
-- breaks nothing.
--
-- The problem it solves: a person's deck list is derived from the LOCAL
-- history. On a new device that history is empty, so whoever just signed
-- in does not find their own deck and has to search Scryfall again —
-- precisely the person the app already knows.
--
-- Why in the profiles table, and not derived from the matches: downloading
-- matches requires a subscription (RLS returns an empty list without it),
-- and requires the invites to have been accepted. The deck a person plays
-- is not a statistic, it is a setup convenience — and it has to work on
-- the first sign-in.
-- =====================================================================


-- ---------------------------------------------------------------------
-- The column
--
-- Each item is `{ "commanders": [...], "lastUsed": 1730000000000 }`. A deck
-- can have two commanders (partner), so `commanders` is a list.
--
-- The cap of 200 is not to save space: it is so a client defect cannot
-- write megabytes here. The app already cuts well before that.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists decks jsonb not null default '[]'::jsonb;

alter table public.profiles
  drop constraint if exists decks_formato;

alter table public.profiles
  add constraint decks_formato
  check (jsonb_typeof(decks) = 'array' and jsonb_array_length(decks) <= 200);


-- ---------------------------------------------------------------------
-- Who reads, and who does not
--
-- No new policy is needed, and that is the point: the policy
-- "cuidar do proprio perfil" already is `for all using (auth.uid() = id)`,
-- so each person reads and writes only their own row. Someone's decks are
-- private to them.
--
-- And the @ search does not hand them out: `buscar_handle()` explicitly
-- selects id, handle and display_name. Adding `decks` there would turn
-- confirming an @ into a dig through what the person plays. Do not add it.
-- ---------------------------------------------------------------------

-- A quick check, to run afterwards and see that it held:
--
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'profiles'
--      and column_name = 'decks';
