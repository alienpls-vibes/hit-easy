-- =====================================================================
-- Passing the table by code (v1)
--
-- Run this AFTER 006-played-together.sql. It is idempotent.
--
-- What changes: passing the table stops depending on a file. Whoever
-- passes uploads the match and gets a short code (K7M2QX); whoever
-- receives types the code and the match comes down. By file, the table
-- arrived through WhatsApp and the receiver's phone could not open the
-- .json - the path failed precisely mid-game, which is when nobody wants
-- to debug a download.
--
-- No account, on purpose: the battery dies on the phone of whoever is at
-- the table, signed in or not. That is why the functions are granted to
-- `anon`, and what protects it is the design:
--
--   - the table has no policy at all: nobody reads or writes it directly.
--     Everything goes through the functions below, which only answer to
--     whoever has the code;
--   - the code works once - `pegar_mesa` marks the table as received, and
--     a second attempt takes nothing. It is the same baton as the file:
--     the table is not copied, it is passed;
--   - it expires in 24 hours, and what expired is deleted on every send;
--   - bound to the channel: a code generated in beta does not open in
--     production.
--
-- The code: 6 characters from an alphabet without the ones that get mixed
-- up when read aloud or typed in a hurry (0/O, 1/I/L). 31^6 is close to
-- 900 million codes for a few dozen alive at a time - guessing one is not
-- a way in. It comes from gen_random_uuid(), which is truly random, and
-- not from random(), which is not.
-- =====================================================================


create table if not exists public.mesas_em_transito (
  codigo      text primary key,
  canal       text not null check (canal in ('producao', 'beta')),
  partida     jsonb not null,
  criada_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '24 hours',
  -- Filled by pegar_mesa. The row stays until it expires so that whoever
  -- passed can learn it arrived, and so that "take back" knows the other
  -- device already has the game.
  recebida_em timestamptz
);

alter table public.mesas_em_transito enable row level security;
-- No policy: with RLS on and no rule, nobody reaches the table through the
-- API. The revoke is belt and braces for the day someone creates one.
revoke all on public.mesas_em_transito from anon, authenticated;

create index if not exists mesas_em_transito_expira_idx
  on public.mesas_em_transito (expira_em);


-- ---------------------------------------------------------------------
-- Send: stores the table and returns the code.
--
-- The limits exist because the function is open to anyone with the public
-- key: a real match is tens of KB, and 1 MB is plenty of slack; two
-- thousand tables alive at the same time is far more than this app will
-- ever have, and stops someone from filling the database in a loop.
-- ---------------------------------------------------------------------
create or replace function public.enviar_mesa(mesa jsonb, c text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  cod text;
begin
  if c not in ('producao', 'beta') then
    raise exception 'canal invalido';
  end if;
  -- The coalesce is not decoration: a missing key makes jsonb_typeof return
  -- NULL, `NULL <> 'object'` yields NULL, and `if` treats NULL as false -
  -- v1 without it accepted `{"x": 1}` as a table.
  if mesa is null
     or coalesce(jsonb_typeof(mesa), '') <> 'object'
     or coalesce(jsonb_typeof(mesa -> 'partida'), '') <> 'object'
     or coalesce(jsonb_typeof(mesa -> 'partida' -> 'events'), '') <> 'array' then
    raise exception 'mesa invalida';
  end if;
  if octet_length(mesa::text) > 1048576 then
    raise exception 'mesa grande demais';
  end if;

  delete from public.mesas_em_transito where expira_em < now();

  if (select count(*) from public.mesas_em_transito) >= 2000 then
    raise exception 'mesas demais em transito';
  end if;

  for tentativa in 1..8 loop
    bytes := uuid_send(gen_random_uuid());
    cod := '';
    for i in 0..5 loop
      cod := cod || substr(alfabeto, 1 + get_byte(bytes, i) % length(alfabeto), 1);
    end loop;
    begin
      insert into public.mesas_em_transito (codigo, canal, partida)
      values (cod, c, mesa);
      return cod;
    exception when unique_violation then
      -- Collision: try another. With 900 million codes, it never goes past
      -- the second round.
      null;
    end;
  end loop;

  raise exception 'sem codigo livre';
end;
$$;


-- ---------------------------------------------------------------------
-- View: the table behind the code, WITHOUT consuming it.
--
-- It exists because receiving replaces the match open on the receiver's
-- device, and nobody confirms what they cannot check. The screen shows how
-- many players the table has before asking; only then does it take it.
-- ---------------------------------------------------------------------
create or replace function public.ver_mesa(cod text, c text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select partida
  from public.mesas_em_transito
  where codigo = upper(cod)
    and canal = c
    and expira_em > now()
    and recebida_em is null;
$$;


-- ---------------------------------------------------------------------
-- Take: consumes the code and returns the table. Only once.
--
-- The `update ... where recebida_em is null` is what makes two devices
-- typing the same code at the same time end up with ONE table: the second
-- finds no row to mark and gets null.
-- ---------------------------------------------------------------------
create or replace function public.pegar_mesa(cod text, c text)
returns jsonb
language sql
volatile
security definer
set search_path = public
as $$
  update public.mesas_em_transito
  set recebida_em = now()
  where codigo = upper(cod)
    and canal = c
    and expira_em > now()
    and recebida_em is null
  returning partida;
$$;


-- ---------------------------------------------------------------------
-- Status: so whoever passed knows whether it arrived.
--
-- 'esperando' | 'recebida' | 'inexistente' (expired, was cancelled, or
-- the code never existed - to whoever asks it is all the same).
-- ---------------------------------------------------------------------
create or replace function public.situacao_mesa(cod text, c text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when recebida_em is null then 'esperando' else 'recebida' end
     from public.mesas_em_transito
     where codigo = upper(cod) and canal = c and expira_em > now()),
    'inexistente'
  );
$$;


-- ---------------------------------------------------------------------
-- Cancel: whoever passed gave up and will take the table back.
--
-- Only cancels what nobody took. If the other device already received it,
-- returns 'recebida' and deletes nothing - whoever takes back needs to know
-- they will create a second live copy of the game.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_mesa(cod text, c text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  situacao text := public.situacao_mesa(cod, c);
begin
  if situacao = 'esperando' then
    delete from public.mesas_em_transito
    where codigo = upper(cod) and canal = c and recebida_em is null;
    return 'cancelada';
  end if;
  return situacao;
end;
$$;


revoke all on function public.enviar_mesa(jsonb, text) from public;
revoke all on function public.ver_mesa(text, text) from public;
revoke all on function public.pegar_mesa(text, text) from public;
revoke all on function public.situacao_mesa(text, text) from public;
revoke all on function public.cancelar_mesa(text, text) from public;

grant execute on function public.enviar_mesa(jsonb, text) to anon, authenticated;
grant execute on function public.ver_mesa(text, text) to anon, authenticated;
grant execute on function public.pegar_mesa(text, text) to anon, authenticated;
grant execute on function public.situacao_mesa(text, text) to anon, authenticated;
grant execute on function public.cancelar_mesa(text, text) to anon, authenticated;
