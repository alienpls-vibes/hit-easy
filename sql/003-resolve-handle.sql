-- =====================================================================
-- The invite needs to know WHO it belongs to
--
-- Run this AFTER 002-participants.sql. It is idempotent.
--
-- The defect: the app remembers which account a player name belongs to,
-- so it does not ask again every week. On that path it fills in the `@`
-- but not the `user_id` — it does not have it: only the account search
-- returns the identifier, and the whole point of remembering is not
-- searching again.
--
-- The answer policy requires `user_id = auth.uid()`. In SQL, `null` equals
-- nothing, not even itself. So the row came in with a null user_id and
-- NOBODY could claim it — not even the right person. The invite was born
-- dead, with no error, no warning, forever.
--
-- It only worked the first time someone was tagged. From the second time
-- on, which is the common path, it did not.
--
-- The fix lives in the database and not in the client, for three reasons:
-- the client may be offline when the match ends; the `@` is server data
-- and that is where it gets resolved; and an old client, which nobody
-- updated, starts working without needing an update.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A single trigger, with explicit order
--
-- There used to be `aceitar_se_confia`. Resolving the handle has to happen
-- BEFORE deciding the auto-accept, because the accept depends on knowing
-- who the person is. Two BEFORE triggers on the same table fire in
-- ALPHABETICAL order of their names — which would make "aceitar" run
-- before "resolver", exactly the opposite of what is needed.
--
-- Depending on alphabetical order for the fix to work would be a trap for
-- whoever renames either of the two. A single trigger, with both steps in
-- a written sequence, has no such ambiguity.
-- ---------------------------------------------------------------------
create or replace function public.preparar_participante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
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
  -- creates an account with that @ later - and then the recovery block
  -- below reaches it.
  if new.user_id is null or new.status <> 'pendente' then
    return new;
  end if;

  -- 2. Is it someone who already trusts whoever recorded the table?
  select m.owner into dono from public.matches m where m.id = new.match_id;

  if dono is not null and exists (
    select 1 from public.trusted_hosts th
    where th.user_id = new.user_id and th.host_id = dono
  ) then
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
-- Recovers the invites that were already born orphaned
--
-- Everything tagged through the remembered-@ path is in the database with
-- a null user_id, waiting for nobody. This hands them to whom they were
-- always meant for.
--
-- Running it again does no harm: it only reaches what is still null.
-- ---------------------------------------------------------------------
update public.match_players mp
   set user_id = p.id
  from public.profiles p
 where mp.user_id is null
   and mp.handle is not null
   and p.handle = lower(btrim(mp.handle));


-- ---------------------------------------------------------------------
-- Check the result
-- ---------------------------------------------------------------------
select mp.handle,
       mp.status,
       mp.user_id is not null as tem_dono,
       count(*) as quantos
from public.match_players mp
group by mp.handle, mp.status, (mp.user_id is not null)
order by mp.handle;
