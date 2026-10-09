-- =====================================================================
-- Qual é o @ de hoje de quem eu conheci com outro @ (v1)
--
-- Rode isto DEPOIS de 009-handle-a-cada-15-dias.sql. É idempotente.
--
-- O histórico não é reescrito quando alguém troca de @: a partida guarda o @
-- que a cadeira tinha naquele dia, e uma partida registrada por outro
-- anfitrião nem pertence a quem trocou. Quem consolida é o aparelho, na
-- leitura: ele mantém um mapa "@antigo -> @atual" e as estatísticas passam
-- por ele - assim trocar de @ não divide ninguém em duas linhas.
--
-- Para o PRÓPRIO @ o aparelho já sabe na hora da troca. Para os amigos que
-- trocaram, ele pergunta aqui: manda os @ que aparecem no histórico dele e
-- recebe de volta só os que mudaram.
--
-- Não revela nada além do que `buscar_handle` já revela - um @ antigo leva ao
-- dono atual -, só que em lote, para não serem cem pedidos. Continua sendo
-- só por igualdade exata, só para quem está logado, e limitado a 500 @ por
-- pergunta.
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
