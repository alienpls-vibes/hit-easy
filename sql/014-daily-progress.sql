-- =====================================================================
-- The daily challenge's progress, kept with the account (v1)
--
-- Run this AFTER 013-daily-notice-schedule.sql. It is idempotent.
--
-- Why: the progress lived only in the browser (mtglc.daily.v1). In 1.12.0 a
-- phone came back with the challenge at zero - played, wins, streak - while
-- the match history, which lives in the cloud, was intact. Whatever cleared
-- it (a reinstall, cleared site data, the browser freeing space), the device
-- held the only copy. Now whoever is signed in keeps a copy here, and a new
-- or wiped device gets it back.
--
-- FREE, for every account: there is no subscription check anywhere below.
-- The challenge shows Wizards cards, and fan content must not sit behind a
-- payment (Wizards Fan Content Policy).
--
-- One row per account and channel, like the matches: beta progress never
-- mixes with production. `dias` has the same shape as `days` on the device:
-- { 'YYYY-MM-DD': { number, card, guesses, done, won, answer } }.
-- =====================================================================


create table if not exists public.progresso_diario (
  user_id       uuid not null references auth.users (id) on delete cascade,
  canal         text not null check (canal in ('producao', 'beta')),
  dias          jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, canal)
);

alter table public.progresso_diario enable row level security;

-- Each account reads and deletes its own row. Writes go through
-- juntar_progresso_diario only, which merges instead of replacing.
drop policy if exists "progresso_diario: own row" on public.progresso_diario;
create policy "progresso_diario: own row" on public.progresso_diario
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "progresso_diario: delete own row" on public.progresso_diario;
create policy "progresso_diario: delete own row" on public.progresso_diario
  for delete to authenticated using (user_id = auth.uid());

-- Explicit, not left to Supabase's default grants: reading and deleting the
-- own row (the policies above narrow it to that), never writing directly.
revoke all on public.progresso_diario from anon, authenticated;
grant select, delete on public.progresso_diario to authenticated;


-- ---------------------------------------------------------------------
-- Merge: the device sends its days, gets the merged whole back.
--
-- A merge and not an upsert, because two devices of the same account each
-- hold part of the story: replacing the row with one device's days would
-- erase what the other one played. Per day, the better record wins - the
-- same rule as betterDay() in src/daily/storage.js:
--   a finished day beats an unfinished one; between two unfinished ones,
--   the one with more tries; between two finished ones, the one already
--   here (a day is played once).
--
-- The row lock (`for update`) makes two devices merging at the same moment
-- take turns instead of one overwriting the other.
-- ---------------------------------------------------------------------
create or replace function public.juntar_progresso_diario(c text, dias jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  atual jsonb;
  novo jsonb;
  k text;
  v jsonb;
  velho jsonb;
begin
  if uid is null then
    raise exception 'sem conta';
  end if;
  if c not in ('producao', 'beta') then
    raise exception 'canal invalido';
  end if;
  if dias is null or coalesce(jsonb_typeof(dias), '') <> 'object' then
    raise exception 'dias invalidos';
  end if;
  -- A year of days is well under 100 KB; 512 KB is slack, and a cap.
  if octet_length(dias::text) > 524288 then
    raise exception 'dias grandes demais';
  end if;

  select p.dias into atual
  from public.progresso_diario p
  where p.user_id = uid and p.canal = c
  for update;

  novo := coalesce(atual, '{}'::jsonb);

  for k, v in select * from jsonb_each(dias) loop
    continue when k !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(v) <> 'object';
    velho := novo -> k;
    if velho is null
       or (coalesce(velho ->> 'done', 'false') <> 'true'
           and (coalesce(v ->> 'done', 'false') = 'true'
                or (case when jsonb_typeof(v -> 'guesses') = 'array' then jsonb_array_length(v -> 'guesses') else 0 end)
                 > (case when jsonb_typeof(velho -> 'guesses') = 'array' then jsonb_array_length(velho -> 'guesses') else 0 end)))
    then
      novo := jsonb_set(novo, array[k], v, true);
    end if;
  end loop;

  if octet_length(novo::text) > 524288 then
    raise exception 'dias grandes demais';
  end if;

  insert into public.progresso_diario as p (user_id, canal, dias, atualizado_em)
  values (uid, c, novo, now())
  on conflict on constraint progresso_diario_pkey
  do update set dias = excluded.dias, atualizado_em = now();

  return novo;
end;
$$;

revoke all on function public.juntar_progresso_diario(text, jsonb) from public, anon;
grant execute on function public.juntar_progresso_diario(text, jsonb) to authenticated;
