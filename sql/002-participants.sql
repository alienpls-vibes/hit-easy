-- =====================================================================
-- Participants of a match (v1: handle + invite)
--
-- Run this AFTER schema.sql. It is idempotent: running it again breaks
-- nothing.
--
-- The problem it solves: a match has ONE device that recorded it and
-- SEVERAL players. Today `matches.owner` is a single uuid, so whoever
-- played on a friend's phone simply does not have that match.
--
-- The obvious way to solve it - the host tags "@someone" on the seat and
-- that is it - is the wrong way: it would let someone else write into
-- YOUR history. Ten forged matches and your statistics are rotten. Since
-- the statistics are the paid product, they need to be trustworthy;
-- nobody can author someone else's record.
--
-- That is why the host does not ASSIGN, the host INVITES. The match only
-- goes into someone's history when that person accepts.
--
-- Table, column, policy, constraint and function names are part of the
-- live database and stay as they are (several are in Portuguese).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Public profile: the @ through which someone can be found
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  -- Lowercase only, so "@Alex" and "@alex" are never two people.
  constraint handle_formato
    check (handle = lower(handle) and handle ~ '^[a-z0-9_]{3,20}$')
);

create unique index if not exists profiles_handle_idx on public.profiles (handle);

alter table public.profiles enable row level security;

-- Nobody reads the profiles table directly - not a single row. Searching
-- by @ has to go through the function below, which only accepts an exact
-- match. An open select policy would turn this into a catalog of every
-- account.
drop policy if exists "ler o proprio perfil" on public.profiles;
create policy "ler o proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "cuidar do proprio perfil" on public.profiles;
create policy "cuidar do proprio perfil"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Search by @, exact match only.
--
-- No LIKE, no prefix, no listing, and returning at most one row. It is the
-- same design as Signal and Venmo: you can confirm an @ you already know,
-- not discover who exists. A `handle like $1 || '%'` here would hand the
-- whole user base to anyone signed in.
create or replace function public.buscar_handle(h text)
returns table (id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name
  from public.profiles p
  where p.handle = lower(btrim(coalesce(h, '')))
  limit 1;
$$;

-- `revoke from public` is NOT enough: Supabase grants execute to `anon` by
-- default privilege, and that grant survives. Without the anon line, anyone
-- with no account at all can probe @s - checked against the server.
revoke all on function public.buscar_handle(text) from public;
revoke all on function public.buscar_handle(text) from anon;
grant execute on function public.buscar_handle(text) to authenticated;


-- ---------------------------------------------------------------------
-- Trusted hosts
--
-- A Commander group plays every week. Approving one by one every Thursday
-- would turn the protection into a nuisance, and a nuisance is what makes
-- people turn the protection off. Trust once, the next ones come in by
-- themselves.
-- ---------------------------------------------------------------------
create table if not exists public.trusted_hosts (
  user_id     uuid not null references auth.users on delete cascade,
  host_id     uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, host_id)
);

alter table public.trusted_hosts enable row level security;

drop policy if exists "cuidar da propria lista de confianca" on public.trusted_hosts;
create policy "cuidar da propria lista de confianca"
  on public.trusted_hosts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- Two questions that break a cycle
--
-- The `matches` policy needs to know whether I accepted the invite; the
-- `match_players` one needs to know whether I am the host. If each one
-- queries the other table DIRECTLY, Postgres evaluates the other's policy,
-- which queries the first again - and takes both down with 42P17,
-- "infinite recursion detected in policy". It is not theory: it is what
-- happened, and it broke even the match reads that already worked.
--
-- `security definer` cuts the cycle. The function runs as the table owner,
-- and RLS does not apply to the owner - so the inner query triggers no
-- policy at all. The same resource `is_subscriber` already used.
--
-- Both stay bound to `auth.uid()`: there is no user parameter, only the
-- match one. Calling this directly through PostgREST reveals nothing about
-- third parties - it only answers about whoever is asking.
-- ---------------------------------------------------------------------
create or replace function public.sou_anfitriao(mid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id = mid and m.owner = auth.uid()
  );
$$;

create or replace function public.aceitei_a_partida(mid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = mid
      and mp.user_id = auth.uid()
      and mp.status = 'aceito'
  );
$$;


-- ---------------------------------------------------------------------
-- Who sat in each seat
--
-- One row per claimable seat - the match is NOT duplicated. Two copies
-- would diverge at the first conflict, and then there would no longer be
-- one truth about what happened at the table.
-- ---------------------------------------------------------------------
create table if not exists public.match_players (
  match_id    text not null references public.matches on delete cascade,
  seat_id     text not null,
  user_id     uuid references auth.users on delete set null,
  handle      text,
  status      text not null default 'pendente'
              check (status in ('pendente', 'aceito', 'recusado')),
  created_at  timestamptz not null default now(),
  primary key (match_id, seat_id)
);

create index if not exists match_players_user_idx
  on public.match_players (user_id, status);

alter table public.match_players enable row level security;

-- Only the match owner invites. Nobody pushes into someone else's table.
drop policy if exists "o anfitriao convida" on public.match_players;
create policy "o anfitriao convida"
  on public.match_players for insert
  with check (public.sou_anfitriao(match_id));

-- I see the invites addressed to me, and the seats of the matches I
-- recorded. WITHOUT requiring a subscription, on purpose: a non-subscriber
-- needs to be able to see that something is waiting, otherwise they never
-- accept and would never know it exists. The invite is free; reading the
-- match CONTENT is what is paid.
drop policy if exists "ver os proprios convites" on public.match_players;
create policy "ver os proprios convites"
  on public.match_players for select
  using (user_id = auth.uid() or public.sou_anfitriao(match_id));

-- Only the invitee answers, and only for their own seat. The `with check`
-- pins user_id to auth.uid(): without it the seat could be passed on to
-- someone else. And since `using` compares user_id with auth.uid(), a seat
-- not yet claimed (null user_id) cannot be grabbed by anyone.
drop policy if exists "responder o proprio convite" on public.match_players;
create policy "responder o proprio convite"
  on public.match_players for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "o anfitriao desfaz o convite" on public.match_players;
create policy "o anfitriao desfaz o convite"
  on public.match_players for delete
  using (public.sou_anfitriao(match_id));


-- ---------------------------------------------------------------------
-- Auto-accept for a trusted host
--
-- It has to be a trigger: whoever inserts is the HOST, and the host cannot
-- read the invitee's trust list - that list is the invitee's. Only the
-- server sees both sides.
-- ---------------------------------------------------------------------
create or replace function public.aceitar_se_confia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  if new.user_id is null or new.status <> 'pendente' then
    return new;
  end if;

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
create trigger aceitar_se_confia
  before insert on public.match_players
  for each row execute function public.aceitar_se_confia();


-- ---------------------------------------------------------------------
-- Reading a match: mine, or one I accepted having played
-- ---------------------------------------------------------------------
drop policy if exists "ler as proprias partidas assinando" on public.matches;
drop policy if exists "ler partidas proprias ou reivindicadas assinando" on public.matches;
create policy "ler partidas proprias ou reivindicadas assinando"
  on public.matches for select
  using (
    public.is_subscriber(auth.uid())
    and (owner = auth.uid() or public.aceitei_a_partida(id))
  );


-- ---------------------------------------------------------------------
-- Deleting cannot rewrite third parties' past
--
-- If the host deletes the table, whoever accepted that match would lose a
-- piece of their own history - and the host would be able to edit someone
-- else's statistics by omission, which is precisely what this whole file
-- exists to prevent.
--
-- So deleting RELEASES the owner instead of destroying the row, when there
-- is still another participant who accepted. For the host the effect is
-- the same: with no `owner`, the match vanishes from their account and
-- they cannot reach it anymore. The row only really dies when nobody
-- claims it anymore.
-- ---------------------------------------------------------------------
alter table public.matches alter column owner drop not null;

create or replace function public.soltar_em_vez_de_apagar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.match_players mp
    where mp.match_id = old.id
      and mp.status = 'aceito'
      and mp.user_id is not null
      and mp.user_id is distinct from old.owner
  ) then
    update public.matches set owner = null where id = old.id;
    return null;  -- cancels the delete: the row stays, with no owner
  end if;
  return old;
end;
$$;

drop trigger if exists soltar_em_vez_de_apagar on public.matches;
create trigger soltar_em_vez_de_apagar
  before delete on public.matches
  for each row execute function public.soltar_em_vez_de_apagar();


-- ---------------------------------------------------------------------
-- Who invited me
--
-- "Bruno recorded a match with you" is the difference between an invite
-- that can be judged and an anonymous request nobody accepts. But the
-- invitee cannot simply READ the match to find out the owner - reading a
-- match requires a subscription, and the invite has to work without one.
--
-- So the server answers only this, and only to whoever is actually invited
-- at that table. No invite, no answer.
-- ---------------------------------------------------------------------
create or replace function public.anfitriao_do_convite(mid text)
returns table (id uuid, handle text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.handle, p.display_name
  from public.matches m
  join public.profiles p on p.id = m.owner
  where m.id = mid
    and exists (
      select 1 from public.match_players mp
      where mp.match_id = m.id and mp.user_id = auth.uid()
    )
  limit 1;
$$;

revoke all on function public.anfitriao_do_convite(text) from public;
revoke all on function public.anfitriao_do_convite(text) from anon;
grant execute on function public.anfitriao_do_convite(text) to authenticated;
