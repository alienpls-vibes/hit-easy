-- =====================================================================
-- Quem já jogou com você não precisa pedir de novo (v1)
--
-- Rode isto DEPOIS de 005-canal.sql. É idempotente.
--
-- O que muda: confiar deixa de ser um passo. Se duas contas já jogaram uma
-- partida juntas e aquela foi aceita, as próximas entram sozinhas — em
-- qualquer direção, porque jogar junto é simétrico e quem convida muda de
-- semana para semana.
--
-- Por que no banco e não no app: o aceite automático já vivia no gatilho
-- `preparar_participante`, e o cliente de quem recebe pode estar fechado por
-- dias. Decidir no servidor faz o convite nascer aceito; decidir no cliente
-- faria a pessoa ver "1 convite esperando" que some sozinho quando ela abrir
-- o app, que é a pior das duas experiências.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Poder dizer não
--
-- Esta é a parte que não dá para esquecer. Com o aceite derivado do
-- histórico, jogar uma única vez com um estranho num torneio passaria a
-- valer para sempre, e não haveria como desfazer: apagar a linha de
-- confiança não adianta se a regra se refaz a partir das partidas.
--
-- Por isso `confia` em vez de só presença: a linha com `false` é o "não
-- aceite mais nada desta pessoa", e ela vence qualquer histórico. As linhas
-- que já existem viram `true`, que é o que elas sempre significaram.
-- ---------------------------------------------------------------------
alter table public.trusted_hosts
  add column if not exists confia boolean not null default true;


-- ---------------------------------------------------------------------
-- Já jogamos juntos?
--
-- Verdadeiro quando existe uma partida ACEITA ligando as duas contas, em
-- qualquer direção: eu aceitei uma mesa que ela registrou, ou ela aceitou
-- uma que eu registrei.
--
-- `aceita` e não apenas registrada, de propósito. Uma cadeira marcada com o
-- meu @ que eu nunca aceitei não é prova de que jogamos: é prova de que
-- alguém digitou o meu @. Aceitar é o único ato que veio de mim.
--
-- Preso ao canal: uma mesa de teste não pode criar confiança que vale na
-- vida real. É a mesma regra de 005, aplicada a mais um lugar.
--
-- `security definer` pelo mesmo motivo das outras: sem isso a consulta
-- dispara as policies de `match_players` e `matches`, que por sua vez
-- consultam de volta — o 42P17 que 002 já documenta.
-- ---------------------------------------------------------------------
create or replace function public.ja_jogamos_juntos(a uuid, b uuid, c text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
    where mp.status = 'aceito'
      and m.canal = c
      and (
        (mp.user_id = a and m.owner = b)
        or
        (mp.user_id = b and m.owner = a)
      )
  );
$$;


-- ---------------------------------------------------------------------
-- O gatilho, com o passo novo
--
-- Reescrito inteiro e não emendado: é um gatilho só, com os passos em
-- sequência escrita, justamente para não depender da ordem alfabética de
-- dois gatilhos (ver 003).
--
-- A ordem das três perguntas é a ordem da autoridade:
--   1. a pessoa disse não? então não, e o histórico não desfaz isso;
--   2. a pessoa disse sim? então sim;
--   3. já jogaram juntas? então sim.
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
  --    ou não (marcou pelo @ que o aparelho lembrava).
  if new.user_id is null and new.handle is not null then
    select p.id into new.user_id
    from public.profiles p
    where p.handle = lower(btrim(new.handle));
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

  -- 2. O que a pessoa decidiu explicitamente sobre este anfitrião, se
  --    decidiu alguma coisa. `null` = nunca disse nada.
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

drop trigger if exists aceitar_se_confia on public.match_players;
drop trigger if exists preparar_participante on public.match_players;
create trigger preparar_participante
  before insert on public.match_players
  for each row execute function public.preparar_participante();


-- ---------------------------------------------------------------------
-- Quem lê, e quem não lê
--
-- Nenhuma policy nova. `trusted_hosts` já é `for all using (auth.uid() =
-- user_id)`: cada um lê e escreve só a própria lista, e a coluna nova não
-- muda isso.
--
-- `ja_jogamos_juntos` é `security definer` e recebe os dois ids como
-- parâmetro, então em tese responderia sobre terceiros. Ela existe para o
-- gatilho; o cliente não a chama, e não há motivo para expô-la. O execute
-- fica revogado.
-- ---------------------------------------------------------------------
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from public;
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from anon;
revoke all on function public.ja_jogamos_juntos(uuid, uuid, text) from authenticated;

-- Conferência rápida, para rodar depois:
--
--   select confia, count(*) from public.trusted_hosts group by confia;
--
-- Tudo que já existia deve aparecer como `true`.
