-- =====================================================================
-- What is today's @ of someone I met under another @ (v1)
--
-- Run this AFTER 009-handle-every-15-days.sql. It is idempotent.
--
-- History is not rewritten when someone changes @: the match keeps the @
-- the seat had that day, and a match recorded by another host does not
-- even belong to whoever changed. The device is what consolidates, on
-- read: it keeps an "@old -> @current" map and the statistics go through
-- it - that way changing @ does not split anyone into two rows.
--
-- For its OWN @ the device already knows at the moment of the change. For
-- friends who changed, it asks here: it sends the @s that appear in its
-- history and gets back only the ones that changed.
--
-- It reveals nothing beyond what `buscar_handle` already reveals - an old
-- @ leads to the current owner -, only in batch, so it is not a hundred
-- requests. Still exact equality only, only for whoever is signed in, and
-- capped at 500 @s per question.
-- =====================================================================


create or replace function public.handles_atuais(hs text[])
returns table (pedido text, atual text)
language sql
stable
security definer
set search_path = public
as $$
  select x.h, p.handle
  from (
    select distinct lower(btrim(h)) as h
    from unnest((coalesce(hs, '{}'::text[]))[1:500]) as h
  ) x
  join public.profiles p on p.id = public.dono_do_handle(x.h)
  where p.handle <> x.h;
$$;

revoke all on function public.handles_atuais(text[]) from public;
revoke all on function public.handles_atuais(text[]) from anon;
grant execute on function public.handles_atuais(text[]) to authenticated;
