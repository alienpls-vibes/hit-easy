-- =====================================================================
-- Changing @ only every 15 days (v1)
--
-- Run this AFTER 008-reserved-handle-and-name.sql. It is idempotent.
--
-- With 008, every @ an account uses stays reserved for it forever. Without
-- an interval, that becomes a way to hoard names: changing ten times in
-- an afternoon reserves ten @s. And the @ is how friends find the person -
-- a name that changes every week does not serve that. Fifteen days is
-- enough for the @ to be stable, and short enough that whoever made a
-- mistake is not stuck for long.
--
-- The clock starts on the CHOICE, not only on the change: choosing and
-- changing the next day is exactly the case the rule exists to prevent.
-- The screen warns about this before saving.
--
-- Whoever already had an @ before this migration has no date, and can
-- change right away - there is no way to know when they chose, and
-- locking someone who just arrived would be punishment for something the
-- rule did not say yet.
-- =====================================================================


alter table public.profiles
  add column if not exists handle_trocado_em timestamptz;


-- ---------------------------------------------------------------------
-- The guard from 008, now with the clock too
--
-- It fires on EVERY profile write, not only when the @ changes. The reason
-- is the "cuidar do proprio perfil" policy: it lets the person update any
-- column of their own row, including this one. If the trigger only looked
-- at @ changes, a PATCH with `handle_trocado_em = 2000-01-01` before the
-- change would be enough. Here the column belongs to the server: whatever
-- comes from the client is ignored.
--
-- The too-early error comes out with its own code (HE015) and the unlock
-- date in `detail`, so the screen can say "you can change it on Oct 24"
-- instead of an unexplained "it failed". 23505 is still "the @ belongs to
-- another account".
-- ---------------------------------------------------------------------
create or replace function public.guardar_handle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
  liberado timestamptz;
begin
  if tg_op = 'UPDATE' then
    -- The date never comes from the client.
    new.handle_trocado_em := old.handle_trocado_em;

    -- Wrote something else (the name, the decks): nothing to check.
    if new.handle = old.handle then
      return new;
    end if;

    liberado := old.handle_trocado_em + interval '15 days';
    if old.handle_trocado_em is not null and now() < liberado then
      raise exception 'handle troca cedo'
        using errcode = 'HE015',
              detail = to_char(liberado at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    end if;
  end if;

  -- From 008: nobody takes an @ that already belonged to another account.
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

  -- Choosing (insert) or changing (update with a different @): the clock restarts.
  new.handle_trocado_em := now();
  return new;
end;
$$;

-- No `of handle`: the trigger needs to see every write (see above).
drop trigger if exists guardar_handle on public.profiles;
create trigger guardar_handle
  before insert or update on public.profiles
  for each row execute function public.guardar_handle();


-- A quick check, to run afterwards:
--
--   select handle, handle_trocado_em from public.profiles;
--   -- existing accounts: empty (can change); anyone choosing from now on: the date.
