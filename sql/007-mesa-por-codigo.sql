-- =====================================================================
-- Passar a mesa por código (v1)
--
-- Rode isto DEPOIS de 006-ja-jogamos-juntos.sql. É idempotente.
--
-- O que muda: passar a mesa deixa de depender de um arquivo. Quem passa sobe
-- a partida e recebe um código curto (K7M2QX); quem recebe digita o código e
-- a partida desce. Por arquivo, a mesa chegava pelo WhatsApp e o celular de
-- quem recebia não conseguia abrir o .json - o caminho falhava justamente no
-- meio do jogo, que é a hora em que ninguém quer depurar download.
--
-- Sem conta, de propósito: a bateria acaba no celular de quem estiver na
-- mesa, logado ou não. Por isso as funções valem para `anon`, e o que
-- protege é o desenho:
--
--   - a tabela não tem policy nenhuma: ninguém lê nem escreve nela direto.
--     Tudo passa pelas funções abaixo, que só respondem a quem tem o código;
--   - o código vale uma vez - `pegar_mesa` marca a mesa como recebida, e uma
--     segunda tentativa não leva nada. É o mesmo bastão do arquivo: a mesa
--     não é copiada, é passada;
--   - vence em 24 horas, e o que venceu é apagado a cada envio;
--   - preso ao canal: o código gerado no beta não abre em produção.
--
-- O código: 6 caracteres de um alfabeto sem os que se confundem lidos em voz
-- alta ou digitados com pressa (0/O, 1/I/L). 31^6 é perto de 900 milhões de
-- códigos para algumas dezenas vivos de cada vez - adivinhar um não é
-- caminho. Sai de gen_random_uuid(), que é aleatório de verdade, e não de
-- random(), que não é.
-- =====================================================================


create table if not exists public.mesas_em_transito (
  codigo      text primary key,
  canal       text not null check (canal in ('producao', 'beta')),
  partida     jsonb not null,
  criada_em   timestamptz not null default now(),
  expira_em   timestamptz not null default now() + interval '24 hours',
  -- Preenchido por pegar_mesa. A linha continua até vencer para que quem
  -- passou consiga saber que chegou, e para que "retomar" saiba que o outro
  -- aparelho já está com o jogo.
  recebida_em timestamptz
);

alter table public.mesas_em_transito enable row level security;
-- Sem policy: com RLS ligado e nenhuma regra, ninguém alcança a tabela pela
-- API. O revoke é cinto e suspensório para o dia em que alguém criar uma.
revoke all on public.mesas_em_transito from anon, authenticated;

create index if not exists mesas_em_transito_expira_idx
  on public.mesas_em_transito (expira_em);


-- ---------------------------------------------------------------------
-- Enviar: guarda a mesa e devolve o código.
--
-- Os limites existem porque a função é aberta a qualquer um com a chave
-- pública: uma partida de verdade tem dezenas de KB, e 1 MB é folga de sobra;
-- duas mil mesas vivas ao mesmo tempo é muito mais do que este app terá, e
-- impede que alguém encha o banco num laço.
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
  if mesa is null
     or jsonb_typeof(mesa) <> 'object'
     or jsonb_typeof(mesa -> 'partida') <> 'object'
     or jsonb_typeof(mesa -> 'partida' -> 'events') <> 'array' then
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
      -- Colisão: tenta outro. Com 900 milhões de códigos, nunca passa da
      -- segunda volta.
      null;
    end;
  end loop;

  raise exception 'sem codigo livre';
end;
$$;


-- ---------------------------------------------------------------------
-- Ver: a mesa por trás do código, SEM consumir.
--
-- Existe porque receber substitui a partida aberta no aparelho de quem
-- recebe, e ninguém confirma o que não consegue conferir. A tela mostra
-- quantos jogadores tem a mesa antes de perguntar; só então pega.
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
-- Pegar: consome o código e devolve a mesa. Uma vez só.
--
-- O `update ... where recebida_em is null` é o que faz dois aparelhos
-- digitando o mesmo código ao mesmo tempo terminarem com UMA mesa: o
-- segundo não acha linha para marcar e recebe null.
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
-- Situação: para quem passou saber se chegou.
--
-- 'esperando' | 'recebida' | 'inexistente' (venceu, foi cancelada, ou o
-- código nunca existiu - para quem pergunta dá no mesmo).
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
-- Cancelar: quem passou desistiu e vai retomar a mesa.
--
-- Só cancela o que ninguém pegou. Se o outro aparelho já recebeu, devolve
-- 'recebida' e não apaga nada - quem retoma precisa saber que vai criar uma
-- segunda cópia viva do jogo.
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
