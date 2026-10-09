-- =====================================================================
-- Current @ and chosen match name, in a batch (v1)
--
-- Run this AFTER 010-current-handles.sql. It is idempotent.
--
-- 010 answers "which of these @s changed". This one also answers "what name
-- did each of these accounts choose for matches" (`profiles.display_name`),
-- so a device can show a friend's chosen name on its own statistics and on
-- the table - not only the @. 010 stays: older clients keep calling it.
--
-- Same boundaries as `buscar_handle`, which already returns `display_name`
-- for one @: exact match only, signed-in users only, at most 500 @s per call.
-- It returns every @ that belongs to an account (changed or not), because a
-- name can change without the @ changing.
-- =====================================================================


create or replace function public.perfis_por_handle(hs text[])
returns table (pedido text, atual text, nome text)
language sql
stable
security definer
set search_path = public
as $$
  select x.h, p.handle, p.display_name
  from (
    select distinct lower(btrim(h)) as h
    from unnest((coalesce(hs, '{}'::text[]))[1:500]) as h
  ) x
  join public.profiles p on p.id = public.dono_do_handle(x.h);
$$;

revoke all on function public.perfis_por_handle(text[]) from public;
revoke all on function public.perfis_por_handle(text[]) from anon;
grant execute on function public.perfis_por_handle(text[]) to authenticated;
