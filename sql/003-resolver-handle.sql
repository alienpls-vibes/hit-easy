-- =====================================================================
-- O convite precisa saber A QUEM pertence
--
-- Rode isto DEPOIS de 002-participantes.sql. É idempotente.
--
-- O defeito: o aplicativo lembra a que conta um nome de jogador pertence,
-- para não perguntar de novo toda semana. Nesse caminho ele preenche o
-- `@` mas não o `user_id` — ele não tem: só a busca por conta devolve o
-- identificador, e a graça de lembrar é justamente não buscar de novo.
--
-- A política de resposta exige `user_id = auth.uid()`. Em SQL, `null` não
-- é igual a nada, nem a si mesmo. Então a linha entrava com user_id nulo
-- e NINGUÉM podia reivindicá-la — nem a pessoa certa. O convite nascia
-- morto, sem erro, sem aviso, para sempre.
--
-- Só funcionava na primeira vez que alguém era marcado. Da segunda em
-- diante, que é o caminho comum, não.
--
-- A correção fica no banco e não no cliente, por três razões: o cliente
-- pode estar offline quando a partida termina; o `@` é dado do servidor e
-- é lá que ele se resolve; e um cliente antigo, que ninguém atualizou,
-- passa a funcionar sem precisar ser atualizado.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Um gatilho só, com a ordem explícita
--
-- Antes havia `aceitar_se_confia`. Resolver o handle precisa acontecer
-- ANTES de decidir o aceite automático, porque o aceite depende de saber
-- quem é a pessoa. Dois gatilhos BEFORE na mesma tabela disparam em ordem
-- ALFABÉTICA do nome — o que faria "aceitar" rodar antes de "resolver",
-- exatamente ao contrário do necessário.
--
-- Depender de ordem alfabética para a correção funcionar seria uma
-- armadilha para quem renomear qualquer um dos dois. Um gatilho só, com
-- os dois passos em sequência escrita, não tem essa ambiguidade.
-- ---------------------------------------------------------------------
create or replace function public.preparar_participante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  -- 1. Quem é esta pessoa? O cliente pode saber (marcou buscando a conta)
  --    ou não (marcou pelo @ que o aparelho lembrava).
  if new.user_id is null and new.handle is not null then
    select p.id into new.user_id
    from public.profiles p
    where p.handle = lower(btrim(new.handle));
  end if;

  -- @ que não existe continua sem dono, e é o certo: não há a quem
  -- convidar. A linha fica registrada para o caso de a pessoa criar conta
  -- com esse @ depois - e aí o bloco de recuperação abaixo a alcança.
  if new.user_id is null or new.status <> 'pendente' then
    return new;
  end if;

  -- 2. É alguém que já confia em quem registrou a mesa?
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
drop trigger if exists preparar_participante on public.match_players;
create trigger preparar_participante
  before insert on public.match_players
  for each row execute function public.preparar_participante();


-- ---------------------------------------------------------------------
-- Recupera os convites que já nasceram órfãos
--
-- Tudo que foi marcado pelo caminho do @ lembrado está no banco com
-- user_id nulo, esperando por ninguém. Isto os entrega a quem sempre
-- foram destinados.
--
-- Rodar de novo não faz mal: só alcança o que ainda está nulo.
-- ---------------------------------------------------------------------
update public.match_players mp
   set user_id = p.id
  from public.profiles p
 where mp.user_id is null
   and mp.handle is not null
   and p.handle = lower(btrim(mp.handle));


-- ---------------------------------------------------------------------
-- Confira o resultado
-- ---------------------------------------------------------------------
select mp.handle,
       mp.status,
       mp.user_id is not null as tem_dono,
       count(*) as quantos
from public.match_players mp
group by mp.handle, mp.status, (mp.user_id is not null)
order by mp.handle;
