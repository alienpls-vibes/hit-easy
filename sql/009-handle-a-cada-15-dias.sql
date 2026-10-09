-- =====================================================================
-- Trocar de @ só a cada 15 dias (v1)
--
-- Rode isto DEPOIS de 008-handle-reservado-e-nome.sql. É idempotente.
--
-- Com 008, todo @ que uma conta usa fica reservado para ela para sempre.
-- Sem um intervalo, isso vira um jeito de acumular nomes: trocar dez vezes
-- numa tarde reserva dez @. E o @ é por onde os amigos acham a pessoa - um
-- nome que muda toda semana não serve para isso. Quinze dias é o bastante
-- para o @ ser estável, e pouco o bastante para quem errou não ficar preso
-- muito tempo.
--
-- A conta começa a contar na ESCOLHA, não só na troca: escolher e já trocar
-- no dia seguinte é exatamente o caso que a regra existe para impedir. A
-- tela avisa isso antes de salvar.
--
-- Quem já tinha @ antes desta migração não tem data, e pode trocar já - não
-- dá para saber quando escolheu, e travar quem acabou de chegar seria
-- castigo por algo que a regra ainda não dizia.
-- =====================================================================


alter table public.profiles
  add column if not exists handle_trocado_em timestamptz;


-- ---------------------------------------------------------------------
-- O guarda de 008, agora também com o relógio
--
-- Dispara em TODA gravação do perfil, e não só quando o @ muda. O motivo é a
-- policy "cuidar do proprio perfil": ela deixa a pessoa atualizar qualquer
-- coluna da própria linha, inclusive esta. Se o gatilho só olhasse trocas de
-- @, bastaria um PATCH com `handle_trocado_em = 2000-01-01` antes da troca.
-- Aqui a coluna é do servidor: o que vier do cliente é ignorado.
--
-- O erro da troca cedo sai com código próprio (HE015) e a data liberada no
-- `detail`, para a tela dizer "você pode trocar em 24 out." em vez de um
-- "não deu" sem explicação. 23505 continua sendo "o @ é de outra conta".
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
    -- A data nunca vem do cliente.
    new.handle_trocado_em := old.handle_trocado_em;

    -- Gravou outra coisa (o nome, os decks): nada a conferir.
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

  -- De 008: ninguém pega @ que já foi de outra conta.
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

  -- Escolher (insert) ou trocar (update com @ diferente): o relógio recomeça.
  new.handle_trocado_em := now();
  return new;
end;
$$;

-- Sem `of handle`: o gatilho precisa ver toda gravação (ver acima).
drop trigger if exists guardar_handle on public.profiles;
create trigger guardar_handle
  before insert or update on public.profiles
  for each row execute function public.guardar_handle();


-- Conferência rápida, para rodar depois:
--
--   select handle, handle_trocado_em from public.profiles;
--   -- quem já existia: vazio (pode trocar); quem escolher daqui em diante: a data.
