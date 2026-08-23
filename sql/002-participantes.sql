-- =====================================================================
-- Participantes de uma partida (v1: handle + convite)
--
-- Rode isto DEPOIS de schema.sql. É idempotente: rodar de novo não quebra.
--
-- O problema que resolve: uma partida tem UM aparelho que a registrou e
-- VÁRIOS jogadores. Hoje `matches.owner` é um único uuid, então quem jogou
-- no celular do amigo simplesmente não tem aquela partida.
--
-- O jeito óbvio de resolver - o anfitrião marca "@fulano" na cadeira e
-- pronto - é o jeito errado: passaria a permitir que outra pessoa escreva
-- no SEU histórico. Dez partidas forjadas e a sua estatística está podre.
-- Como estatística é o produto pago, ela precisa ser confiável; ninguém
-- pode ser autor do registro alheio.
--
-- Por isso o anfitrião não ATRIBUI, ele CONVIDA. A partida só entra no
-- histórico de alguém quando essa pessoa aceita.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Perfil público: o @ pelo qual alguém é encontrável
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text not null,
  display_name  text,
  created_at    timestamptz not null default now(),
  -- Só minúsculas, para que "@Alex" e "@alex" nunca sejam duas pessoas.
  constraint handle_formato
    check (handle = lower(handle) and handle ~ '^[a-z0-9_]{3,20}$')
);

create unique index if not exists profiles_handle_idx on public.profiles (handle);

alter table public.profiles enable row level security;

-- Ninguém lê a tabela de perfis direto - nem uma linha. A busca por @ passa
-- obrigatoriamente pela função abaixo, que só aceita igualdade exata. Uma
-- policy de select aberta transformaria isto num catálogo de todas as contas.
drop policy if exists "ler o proprio perfil" on public.profiles;
create policy "ler o proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "cuidar do proprio perfil" on public.profiles;
create policy "cuidar do proprio perfil"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Busca por @, só por igualdade exata.
--
-- Sem LIKE, sem prefixo, sem listagem, e devolvendo no máximo uma linha. É
-- o mesmo desenho de Signal e Venmo: dá para confirmar um @ que você já
-- conhece, não para descobrir quem existe. Um `handle like $1 || '%'` aqui
-- entregaria a base de usuários inteira a qualquer pessoa logada.
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

-- `revoke from public` NAO basta: o Supabase concede execute a `anon` por
-- privilegio padrao, e esse grant sobrevive. Sem a linha do anon, qualquer
-- pessoa sem conta nenhuma consegue sondar @ - conferido contra o servidor.
revoke all on function public.buscar_handle(text) from public;
revoke all on function public.buscar_handle(text) from anon;
grant execute on function public.buscar_handle(text) to authenticated;


-- ---------------------------------------------------------------------
-- Anfitriões de confiança
--
-- Grupo de Commander joga toda semana. Aprovar uma por uma toda quinta
-- transformaria a proteção em incômodo, e incômodo é o que faz as pessoas
-- desligarem a proteção. Confia uma vez, as próximas entram sozinhas.
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
-- Duas perguntas que quebram um ciclo
--
-- A policy de `matches` precisa saber se eu aceitei o convite; a de
-- `match_players` precisa saber se eu sou o anfitriao. Se cada uma consultar
-- a outra tabela DIRETO, o Postgres avalia a policy da outra, que consulta a
-- primeira de novo - e derruba as duas com 42P17, "infinite recursion
-- detected in policy". Nao e teoria: foi o que aconteceu, e quebrou ate a
-- leitura de partida que ja funcionava antes.
--
-- `security definer` corta o ciclo. A funcao roda como dona da tabela, e RLS
-- nao se aplica ao dono - entao a consulta de dentro nao dispara policy
-- nenhuma. Mesmo recurso que `is_subscriber` ja usava.
--
-- Ambas continuam presas a `auth.uid()`: nao ha parametro de usuario, so o
-- da partida. Chamar isto direto pelo PostgREST nao revela nada sobre
-- terceiros - so responde sobre quem esta perguntando.
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
-- Quem sentou em cada cadeira
--
-- Uma linha por cadeira reivindicável - a partida NÃO é duplicada. Duas
-- cópias divergiriam no primeiro conflito, e aí não haveria mais uma
-- verdade sobre o que aconteceu na mesa.
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

-- Só o dono da partida convida. Ninguém se enfia numa mesa alheia.
drop policy if exists "o anfitriao convida" on public.match_players;
create policy "o anfitriao convida"
  on public.match_players for insert
  with check (public.sou_anfitriao(match_id));

-- Vejo os convites endereçados a mim, e as cadeiras das partidas que eu
-- registrei. SEM exigir assinatura, de propósito: quem não assina precisa
-- conseguir ver que há algo esperando, senão nunca aceita e nunca saberia
-- que existe. O convite é livre; ler o CONTEÚDO da partida é que é pago.
drop policy if exists "ver os proprios convites" on public.match_players;
create policy "ver os proprios convites"
  on public.match_players for select
  using (user_id = auth.uid() or public.sou_anfitriao(match_id));

-- Só o convidado responde, e só pela própria cadeira. O `with check` prende
-- user_id em auth.uid(): sem ele daria para repassar a cadeira a outra
-- pessoa. E como `using` compara user_id com auth.uid(), cadeira ainda não
-- reivindicada (user_id nulo) não pode ser agarrada por ninguém.
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
-- Aceite automático para anfitrião de confiança
--
-- Precisa ser gatilho: quem insere é o ANFITRIÃO, e o anfitrião não pode
-- ler a lista de confiança do convidado - essa lista é do convidado. Só o
-- servidor enxerga os dois lados.
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
-- Ler partida: minha, ou uma em que eu aceitei ter jogado
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
-- Apagar não pode reescrever o passado de terceiros
--
-- Se o anfitrião apagar a mesa, quem aceitou aquela partida perderia um
-- pedaço do próprio histórico - e o anfitrião passaria a poder editar a
-- estatística alheia por omissão, que é justamente o que este arquivo
-- inteiro existe para impedir.
--
-- Então apagar SOLTA o dono em vez de destruir a linha, quando ainda há
-- outro participante que aceitou. Para o anfitrião o efeito é o mesmo: sem
-- `owner`, a partida some da conta dele e ele não a alcança mais. A linha
-- só morre de verdade quando ninguém mais a reivindica.
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
    return null;  -- cancela o delete: a linha continua, sem dono
  end if;
  return old;
end;
$$;

drop trigger if exists soltar_em_vez_de_apagar on public.matches;
create trigger soltar_em_vez_de_apagar
  before delete on public.matches
  for each row execute function public.soltar_em_vez_de_apagar();


-- ---------------------------------------------------------------------
-- Quem me convidou
--
-- "Bruno registrou uma partida com voce" e a diferenca entre um convite que
-- da para julgar e um pedido anonimo que ninguem aceita. Mas o convidado nao
-- pode simplesmente LER a partida para descobrir o dono - ler partida exige
-- assinatura, e o convite tem de funcionar sem ela.
--
-- Entao o servidor responde so isto, e so para quem esta de fato convidado
-- naquela mesa. Sem convite, nao ha resposta.
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
