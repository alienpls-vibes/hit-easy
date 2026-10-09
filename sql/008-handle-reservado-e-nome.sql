-- =====================================================================
-- O @ é de quem pegou primeiro, para sempre; e o nome nas partidas (v1)
--
-- Rode isto DEPOIS de 007-mesa-por-codigo.sql. É idempotente.
--
-- O problema: o índice único de `profiles.handle` só protege o @ que está
-- em uso AGORA. Trocar de @ soltava o antigo, e qualquer conta podia pegá-lo
-- - e com ele os convites de quem ainda marcava o @ velho na mesa, que é
-- exatamente quem confiava naquele nome. O @ é por onde os amigos acham a
-- pessoa; ele não pode mudar de dono.
--
-- A regra agora: todo @ que uma conta já usou continua dela. Ela pode trocar
-- de @ quantas vezes quiser, e voltar a um antigo; ninguém mais pode pegar
-- nenhum deles. E quem marca o @ antigo ainda acha a mesma pessoa - a busca
-- e os convites resolvem o antigo para o atual.
--
-- O nome nas partidas (`display_name`) é o outro lado: o @ é a identidade,
-- só minúsculas; o nome é como a pessoa aparece na mesa, do jeito que ela
-- quiser escrever - "Alê", "Dr. Strange", "MARIA". Ele já existia na tabela
-- e já virava o nome da cadeira; faltava poder escrever.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Todo @ que cada conta já usou
--
-- Sem policy: ninguém lê nem escreve aqui pela API. Quem mexe é o gatilho
-- abaixo e as funções de busca, todos `security definer`. Uma policy de
-- leitura transformaria isto num catálogo de @ - o mesmo motivo de
-- `profiles` só ser alcançável por igualdade exata.
--
-- `on delete cascade`: apagar a conta solta os @ dela. Reservar nome de quem
-- pediu para sair seria guardar dado de quem não quer mais estar aqui.
-- ---------------------------------------------------------------------
create table if not exists public.handles_usados (
  handle   text primary key,
  user_id  uuid not null references auth.users on delete cascade,
  desde    timestamptz not null default now()
);

alter table public.handles_usados enable row level security;
revoke all on public.handles_usados from anon, authenticated;

create index if not exists handles_usados_user_idx on public.handles_usados (user_id);

-- Quem já tem @ hoje entra na lista com ele.
insert into public.handles_usados (handle, user_id)
select p.handle, p.id from public.profiles p
on conflict (handle) do nothing;


-- ---------------------------------------------------------------------
-- De quem é este @, atual ou antigo?
--
-- O atual vence: se por algum acaso o mesmo @ aparecer nos dois lugares, a
-- tabela viva é a autoridade.
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
-- O guarda: ninguém pega @ que já foi de outra conta
--
-- Antes de gravar, confere a lista. O erro sai como 23505 (unique_violation)
-- de propósito: é o mesmo código do índice único, o PostgREST o devolve como
-- 409, e o app já trata 409 como "esse @ já é de outra pessoa". Um código
-- novo exigiria ensinar o app a reconhecê-lo, e app velho não aprenderia.
--
-- Depois de gravar, o @ novo entra na lista - e o antigo nunca sai.
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
-- A busca por @ acha também o antigo, e devolve o atual
--
-- Quem guardou "@alex" no aparelho continua achando a mesma pessoa depois
-- que ela virou "@alexandre". A resposta traz o @ ATUAL, então a cadeira
-- passa a ser marcada com ele. Continua só por igualdade exata.
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
-- O convite também resolve o @ antigo
--
-- Reescrito inteiro a partir de 006 - é um gatilho só, em sequência escrita
-- (ver 003). A única mudança é o passo 1, que agora pergunta a
-- dono_do_handle em vez de olhar só a tabela viva.
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
  -- 1. Quem é esta pessoa? O cliente pode saber (marcou buscando a conta)
  --    ou não (marcou pelo @ que o aparelho lembrava - talvez um antigo).
  if new.user_id is null and new.handle is not null then
    new.user_id := public.dono_do_handle(new.handle);
  end if;

  -- @ que não existe continua sem dono, e é o certo: não há a quem
  -- convidar. A linha fica registrada para o caso de a pessoa criar conta
  -- com esse @ depois.
  if new.user_id is null or new.status <> 'pendente' then
    return new;
  end if;

  select m.owner into dono from public.matches m where m.id = new.match_id;
  if dono is null then
    return new;
  end if;

  -- 2. O que a pessoa decidiu explicitamente sobre este anfitrião.
  select th.confia into decidiu
  from public.trusted_hosts th
  where th.user_id = new.user_id and th.host_id = dono;

  if decidiu is false then
    return new;                       -- disse não: fica pendente, sempre
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
-- O nome nas partidas
--
-- Livre na forma - maiúsculas, acentos, pontuação, espaço -, presa no
-- tamanho: 18 caracteres é o que cabe no painel de um jogador na mesa, o
-- mesmo limite do nome digitado na cadeira. Vazio vira null, e aí a mesa
-- usa o @.
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


-- Conferência rápida, para rodar depois:
--
--   select count(*) from public.handles_usados;   -- ao menos um por perfil
--   select public.dono_do_handle('seu_handle');    -- o seu id
