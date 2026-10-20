-- =====================================================================
-- The daily challenge's notice, sent by the server (v1)
--
-- Run this AFTER 011-profiles-by-handle.sql. It is idempotent.
--
-- Why: the notice used to depend on Periodic Background Sync, where the
-- BROWSER decides when to wake the app. Chrome does it at most every 12
-- hours, only for sites it judges engaging, and never on iPhone - so on
-- most days the notice simply never came. Now each device hands over a Web
-- Push subscription, and the Edge Function `daily-push`
-- (supabase/functions/daily-push), called every hour by pg_cron (see
-- 013-daily-notice-schedule.sql), sends the notice at 09:00 in that
-- device's own time zone.
--
-- No account, on purpose, like the challenge itself: the functions are
-- granted to `anon`, and what protects them is the design:
--
--   - the table has no policy at all: nobody reads or writes it directly;
--   - the subscription endpoint is the key. It is a long random URL that
--     only the device and its push service know - whoever has it can only
--     change that one device's notice;
--   - the endpoint must belong to a real push service (Google, Mozilla,
--     Apple, Microsoft). Without that rule, anyone could make the server
--     POST once a day to a URL of their choice;
--   - texts are capped, and so is the number of rows.
--
-- One row per device and channel. Days are the device's 'YYYY-MM-DD' in
-- its own time zone, the same as dayKey() in src/daily/day.js: the card
-- turns at local midnight.
-- =====================================================================


create table if not exists public.avisos_diarios (
  endpoint      text primary key,
  p256dh        text not null,
  auth          text not null,
  canal         text not null check (canal in ('producao', 'beta')),
  -- IANA name, as Intl.DateTimeFormat reports it ('America/Sao_Paulo').
  fuso          text not null default 'UTC',
  -- The notice in the person's language, written by the app.
  titulo        text not null,
  corpo         text not null,
  -- Local day the person finished the card: no notice that day.
  jogado_em     date,
  -- Local day the notice went out: at most one a day.
  enviado_em    date,
  criado_em     timestamptz not null default now(),
  -- Every app opening refreshes the row; a device silent for 60 days is
  -- dropped (see avisos_a_enviar).
  atualizado_em timestamptz not null default now()
);

alter table public.avisos_diarios enable row level security;
-- No policy: with RLS on and no rule, nobody reaches the table through the
-- API. The revoke is belt and braces for the day someone creates one.
revoke all on public.avisos_diarios from anon, authenticated;


-- The hosts browsers really push through. Chrome, Edge (on Android),
-- Samsung Internet, Opera and Brave use Google's; Edge on Windows uses
-- Microsoft's; Firefox, Mozilla's; Safari and the iPhone, Apple's.
create or replace function public.endpoint_de_push_valido(e text)
returns boolean
language sql
immutable
as $$
  select coalesce(length(e) <= 1000, false)
     and e ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/';
$$;


-- ---------------------------------------------------------------------
-- Subscribe, or refresh: the app calls this when the switch goes on and
-- on every opening after that, with the texts in today's language.
--
-- A device that subscribes after 09:00 gets its first notice TOMORROW:
-- without that, turning the switch on at 3 pm would buzz the phone within
-- the hour, about the card the person is looking at.
-- ---------------------------------------------------------------------
create or replace function public.inscrever_aviso(
  endpoint text, p256dh text, auth text, c text, fuso text,
  titulo text, corpo text, jogado date default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  f text := coalesce(fuso, 'UTC');
  hoje date;
begin
  if c not in ('producao', 'beta') then
    raise exception 'canal invalido';
  end if;
  if not public.endpoint_de_push_valido(endpoint) then
    raise exception 'endpoint invalido';
  end if;
  if coalesce(length(p256dh), 0) not between 80 and 100
     or coalesce(length(auth), 0) not between 16 and 30 then
    raise exception 'chaves invalidas';
  end if;
  if coalesce(length(titulo), 0) not between 1 and 120
     or coalesce(length(corpo), 0) not between 1 and 300 then
    raise exception 'texto invalido';
  end if;
  if not exists (select 1 from pg_timezone_names where name = f) then
    f := 'UTC';
  end if;
  hoje := (now() at time zone f)::date;

  if not exists (select 1 from public.avisos_diarios a where a.endpoint = inscrever_aviso.endpoint)
     and (select count(*) from public.avisos_diarios) >= 100000 then
    raise exception 'avisos demais';
  end if;

  insert into public.avisos_diarios as a
    (endpoint, p256dh, auth, canal, fuso, titulo, corpo, jogado_em, enviado_em)
  values (
    inscrever_aviso.endpoint, inscrever_aviso.p256dh, inscrever_aviso.auth, c, f,
    inscrever_aviso.titulo, inscrever_aviso.corpo, jogado,
    case when extract(hour from now() at time zone f) >= 9 then hoje end
  )
  on conflict on constraint avisos_diarios_pkey do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    canal = excluded.canal,
    fuso = excluded.fuso,
    titulo = excluded.titulo,
    corpo = excluded.corpo,
    -- A refresh without the day never forgets one already known.
    jogado_em = greatest(a.jogado_em, excluded.jogado_em),
    atualizado_em = now();
end;
$$;


-- ---------------------------------------------------------------------
-- The card of `dia` was finished: no notice that day.
-- ---------------------------------------------------------------------
create or replace function public.aviso_jogado(endpoint text, dia date)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.avisos_diarios a
  set jogado_em = greatest(a.jogado_em, dia), atualizado_em = now()
  where a.endpoint = aviso_jogado.endpoint;
$$;


-- ---------------------------------------------------------------------
-- The switch went off.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_aviso(endpoint text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.avisos_diarios a where a.endpoint = cancelar_aviso.endpoint;
$$;


-- ---------------------------------------------------------------------
-- For the Edge Function only: claims the notices due now and returns them.
--
-- Due: it is between 09:00 and 21:59 on the device's clock, nothing went
-- out today, and today's card was not played. "From 09:00", not "at
-- 09:00": an hourly run that fails is caught up by the next one.
--
-- The `update ... returning` is the claim. Two runs at the same time (a
-- retry, a manual call) split the rows instead of both sending: the second
-- finds enviado_em already set.
-- ---------------------------------------------------------------------
create or replace function public.avisos_a_enviar()
returns table (endpoint text, p256dh text, auth text, titulo text, corpo text, dia date)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  delete from public.avisos_diarios a where a.atualizado_em < now() - interval '60 days';

  return query
  update public.avisos_diarios a
  set enviado_em = (now() at time zone a.fuso)::date
  where extract(hour from now() at time zone a.fuso) between 9 and 21
    and a.enviado_em is distinct from (now() at time zone a.fuso)::date
    and a.jogado_em is distinct from (now() at time zone a.fuso)::date
  returning a.endpoint, a.p256dh, a.auth, a.titulo, a.corpo, a.enviado_em;
end;
$$;


-- ---------------------------------------------------------------------
-- For the Edge Function only: the push service said this device is gone
-- (404 or 410). Keeping the row would only fail again every day.
-- ---------------------------------------------------------------------
create or replace function public.aviso_expirado(endpoint text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.avisos_diarios a where a.endpoint = aviso_expirado.endpoint;
$$;


revoke all on function public.inscrever_aviso(text, text, text, text, text, text, text, date) from public;
revoke all on function public.aviso_jogado(text, date) from public;
revoke all on function public.cancelar_aviso(text) from public;
revoke all on function public.avisos_a_enviar() from public, anon, authenticated;
revoke all on function public.aviso_expirado(text) from public, anon, authenticated;

grant execute on function public.inscrever_aviso(text, text, text, text, text, text, text, date) to anon, authenticated;
grant execute on function public.aviso_jogado(text, date) to anon, authenticated;
grant execute on function public.cancelar_aviso(text) to anon, authenticated;
grant execute on function public.avisos_a_enviar() to service_role;
grant execute on function public.aviso_expirado(text) to service_role;
