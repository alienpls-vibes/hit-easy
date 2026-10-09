-- =====================================================================
-- The @ belongs to whoever took it first, forever; and the match name (v1)
--
-- Run this AFTER 007-table-by-code.sql. It is idempotent.
--
-- The problem: the unique index on `profiles.handle` only protects the @
-- in use RIGHT NOW. Changing @ released the old one, and any account could
-- take it - and with it the invites of whoever still tagged the old @ at
-- the table, who are exactly the people who trusted that name. The @ is
-- how friends find the person; it cannot change owners.
--
-- The rule now: every @ an account has ever used stays theirs. They can
-- change @ as many times as they want, and go back to an old one; nobody
-- else can take any of them. And whoever tags the old @ still finds the
-- same person - search and invites resolve the old one to the current one.
--
-- The match name (`display_name`) is the other side: the @ is the
-- identity, lowercase only; the name is how the person shows up at the
-- table, written however they like - "Alê", "Dr. Strange", "MARIA". It
-- already existed in the table and already became the seat name; what was
-- missing was being able to write it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Every @ each account has ever used
--
-- No policy: nobody reads or writes here through the API. What touches it
-- is the trigger below and the search functions, all `security definer`.
-- A read policy would turn this into a catalog of @s - the same reason
-- `profiles` is only reachable by exact equality.
--
-- `on delete cascade`: deleting the account releases its @s. Reserving the
-- name of someone who asked to leave would be keeping data of someone who
-- no longer wants to be here.
-- ---------------------------------------------------------------------
create table if not exists public.handles_usados (
  handle   text primary key,
  user_id  uuid not null references auth.users on delete cascade,
  desde    timestamptz not null default now()
);

alter table public.handles_usados enable row level security;
revoke all on public.handles_usados from anon, authenticated;

create index if not exists handles_usados_user_idx on public.handles_usados (user_id);

-- Whoever already has an @ today goes into the list with it.
insert into public.handles_usados (handle, user_id)
select p.handle, p.id from public.profiles p
on conflict (handle) do nothing;


-- ---------------------------------------------------------------------
-- Whose @ is this, current or old?
--
-- The current one wins: if by some chance the same @ shows up in both
-- places, the live table is the authority.
-- ---------------------------------------------------------------------
create or replace function public.dono_do_handle(h text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.id from public.profiles p where p.handle = lower(btrim(coalesce(h, '')))),
    (select u.user_id from public.handles_usados u where u.handle = lower(btrim(coalesce(h, ''))))
  );
$$;

revoke all on function public.dono_do_handle(text) from public;
revoke all on function public.dono_do_handle(text) from anon;
revoke all on function public.dono_do_handle(text) from authenticated;


-- ---------------------------------------------------------------------
-- The guard: nobody takes an @ that already belonged to another account
--
-- Before writing, it checks the list. The error comes out as 23505
-- (unique_violation) on purpose: it is the same code as the unique index,
-- PostgREST returns it as 409, and the app already treats 409 as "that @
-- already belongs to someone else". A new code would require teaching the
-- app to recognize it, and an old app would not learn.
--
-- After writing, the new @ goes into the list - and the old one never
-- leaves.
-- ---------------------------------------------------------------------
create or replace function public.guardar_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  select u.user_id into dono
  from public.handles_usados u
  where u.handle = new.handle;

  if dono is not null and dono <> new.id then
    raise exception 'handle ja usado por outra conta'
      using errcode = '23505';
  end if;

  insert into public.handles_usados (handle, user_id)
  values (new.handle, new.id)
  on conflict (handle) do nothing;

  return new;
end;
$$;

drop trigger if exists guardar_handle on public.profiles;
create trigger guardar_handle
  before insert or update of handle on public.profiles
  for each row execute function public.guardar_handle();


-- ---------------------------------------------------------------------
-- The @ search also finds the old one, and returns the current one
--
-- Whoever saved "@alex" on the device keeps finding the same person after
-- they became "@alexandre". The answer carries the CURRENT @, so the seat
-- starts being tagged with it. Still exact equality only.
-- ---------------------------------------------------------------------
create or replace function public.buscar_handle(h text)
returns table (id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name
  from public.profiles p
  where p.id = public.dono_do_handle(h)
  limit 1;
$$;

revoke all on function public.buscar_handle(text) from public;
revoke all on function public.buscar_handle(text) from anon;
grant execute on function public.buscar_handle(text) to authenticated;


-- ---------------------------------------------------------------------
-- The invite also resolves the old @
--
-- Rewritten whole from 006 - it is a single trigger, in a written sequence
-- (see 003). The only change is step 1, which now asks dono_do_handle
-- instead of looking only at the live table.
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
  --    account) or not (tagged through the @ the device remembered -
  --    maybe an old one).
  if new.user_id is null and new.handle is not null then
    new.user_id := public.dono_do_handle(new.handle);
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

  -- 2. What the person explicitly decided about this host.
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

drop trigger if exists preparar_participante on public.match_players;
create trigger preparar_participante
  before insert on public.match_players
  for each row execute function public.preparar_participante();


-- ---------------------------------------------------------------------
-- The match name
--
-- Free in form - uppercase, accents, punctuation, spaces -, capped in
-- length: 18 characters is what fits on a player's panel at the table,
-- the same limit as the name typed on the seat. Empty becomes null, and
-- then the table uses the @.
-- ---------------------------------------------------------------------
update public.profiles
set display_name = null
where display_name is not null and btrim(display_name) = '';

update public.profiles
set display_name = left(btrim(display_name), 18)
where display_name is not null and char_length(btrim(display_name)) > 18;

alter table public.profiles
  drop constraint if exists display_name_formato;

alter table public.profiles
  add constraint display_name_formato
  check (
    display_name is null
    or (char_length(display_name) between 1 and 18
        and display_name = btrim(display_name))
  );


-- A quick check, to run afterwards:
--
--   select count(*) from public.handles_usados;   -- at least one per profile
--   select public.dono_do_handle('your_handle');   -- your id
