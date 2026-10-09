-- =====================================================================
-- Whoever already played with you does not need to ask again (v1)
--
-- Run this AFTER 005-channel.sql. It is idempotent.
--
-- What changes: trusting stops being a step. If two accounts already played
-- a match together and it was accepted, the next ones come in by themselves
-- — in either direction, because playing together is symmetric and who
-- invites changes from week to week.
--
-- Why in the database and not in the app: the auto-accept already lived in
-- the `preparar_participante` trigger, and the receiving client may be
-- closed for days. Deciding on the server makes the invite be born
-- accepted; deciding on the client would make the person see "1 invite
-- waiting" that vanishes by itself when they open the app, which is the
-- worse of the two experiences.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Being able to say no
--
-- This is the part that cannot be forgotten. With the accept derived from
-- history, playing a single time with a stranger at a tournament would
-- count forever, and there would be no way to undo it: deleting the trust
-- row does not help if the rule rebuilds itself from the matches.
--
-- That is why `confia` instead of mere presence: the row with `false` is
-- the "do not accept anything else from this person", and it beats any
-- history. The rows that already exist become `true`, which is what they
-- always meant.
-- ---------------------------------------------------------------------
alter table public.trusted_hosts
  add column if not exists confia boolean not null default true;


-- ---------------------------------------------------------------------
-- Have we played together?
--
-- True when there is an ACCEPTED match linking the two accounts, in either
-- direction: I accepted a table they recorded, or they accepted one I
-- recorded.
--
-- `aceita` and not merely recorded, on purpose. A seat tagged with my @
-- that I never accepted is not proof that we played: it is proof that
-- someone typed my @. Accepting is the only act that came from me.
--
-- Bound to the channel: a test table cannot create trust that counts in
-- real life. It is the same rule as 005, applied to one more place.
--
-- `security definer` for the same reason as the others: without it the
-- query triggers the policies of `match_players` and `matches`, which in
-- turn query back — the 42P17 that 002 already documents.
-- ---------------------------------------------------------------------
create or replace function public.ja_jogamos_juntos(a uuid, b uuid, c text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.status = 'aceito'
      and m.canal = c
      and (
        (mp.user_id = a and m.owner = b)
        or
        (mp.user_id = b and m.owner = a)
      )
  );
$$;


-- ---------------------------------------------------------------------
-- The trigger, with the new step
--
-- Rewritten whole and not patched: it is a single trigger, with the steps
-- in a written sequence, precisely so as not to depend on the alphabetical
-- order of two triggers (see 003).
--
-- The order of the three questions is the order of authority:
--   1. did the person say no? then no, and history does not undo that;
--   2. did the person say yes? then yes;
--   3. have they played together? then yes.
-- ---------------------------------------------------------------------
create or replace function public.preparar_participante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  decidiu boolean;
begin
  -- 1. Who is this person? The client may know (tagged by searching the
  --    account) or not (tagged through the @ the device remembered).
  if new.user_id is null and new.handle is not null then
    select p.id into new.user_id
    from public.profiles p
    where p.handle = lower(btrim(new.handle));
  end if;

  -- An @ that does not exist stays without an owner, and that is right:
  -- there is nobody to invite. The row stays recorded in case the person
  -- creates an account with that @ later.
  if new.user_id is null or new.status <> 'pendente' then
    return new;
  end if;

  select m.owner into dono from public.matches m where m.id = new.match_id;
  if dono is null then
    return new;
  end if;

  -- 2. What the person explicitly decided about this host, if they
  --    decided anything. `null` = never said anything.
  select th.confia into decidiu
  from public.trusted_hosts th
  where th.user_id = new.user_id and th.host_id = dono;

  if decidiu is false then
    return new;                       -- said no: stays pending, always
  end if;

  if decidiu is true
     or public.ja_jogamos_juntos(new.user_id, dono, new.canal) then
    new.status := 'aceito';
  end if;

  return new;
end;
$$;

drop trigger if exists aceitar_se_confia on public.match_players;
drop trigger if exists preparar_participante on public.match_players;
create trigger preparar_participante
  before insert on public.match_players
  for each row execute function public.preparar_participante();


-- ---------------------------------------------------------------------
-- Who reads, and who does not
--
-- No new policy. `trusted_hosts` already is `for all using (auth.uid() =
-- user_id)`: each one reads and writes only their own list, and the new
-- column does not change that.
--
-- `ja_jogamos_juntos` is `security definer` and takes both ids as
-- parameters, so in theory it would answer about third parties. It exists
-- for the trigger; the client does not call it, and there is no reason to
-- expose it. Execute stays revoked.
-- ---------------------------------------------------------------------
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from public;
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from anon;
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from authenticated;

-- A quick check, to run afterwards:
--
--   select confia, count(*) from public.trusted_hosts group by confia;
--
-- Everything that already existed should show up as `true`.
