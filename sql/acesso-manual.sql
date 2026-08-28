-- =====================================================================
-- Liberar o acesso premium na mão, enquanto não há cobrança
--
-- NÃO rode este arquivo inteiro. Cada bloco é para ser copiado sozinho,
-- com o e-mail trocado, no SQL Editor do Supabase.
--
-- Por que aqui e não por um botão no app: o portão das estatísticas é o
-- RLS (`is_subscriber` em schema.sql). Quem decide quem assina é a tabela
-- `subscriptions`, e ela não tem política de insert nem de update — o
-- aplicativo não consegue escrever nela, de propósito. Só o SQL Editor
-- (que roda como dono do banco) e, no futuro, o webhook do Stripe.
--
-- Por que NÃO existe uma função `liberar_premium(email)`:
--
--   O Supabase concede EXECUTE a `anon` e `authenticated` por privilégio
--   padrão. Isso já mordeu este projeto uma vez — `buscar_handle` ficou
--   aberta para quem não tinha conta nenhuma, e só foi descoberto testando
--   contra o servidor. Uma função que LIBERA PREMIUM com esse mesmo
--   descuido deixaria qualquer pessoa logada se auto-liberar. O risco não
--   compensa a comodidade de digitar menos.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LIBERAR alguém  (troque o e-mail)
-- ---------------------------------------------------------------------
insert into public.subscriptions (user_id, status, current_period_end, updated_at)
select u.id, 'active', now() + interval '1 year', now()
from auth.users u
where lower(u.email) = lower('troque-pelo-email@exemplo.com')
on conflict (user_id) do update
  set status = 'active',
      current_period_end = excluded.current_period_end,
      updated_at = now();

-- Devolveu "INSERT 0 0"? Então esse e-mail ainda não criou conta no app.
-- A pessoa precisa entrar uma vez (link mágico ou senha) antes de existir
-- alguém para liberar.


-- ---------------------------------------------------------------------
-- 2. TIRAR o acesso de alguém
-- ---------------------------------------------------------------------
update public.subscriptions s
   set status = 'canceled', updated_at = now()
  from auth.users u
 where u.id = s.user_id
   and lower(u.email) = lower('troque-pelo-email@exemplo.com');


-- ---------------------------------------------------------------------
-- 3. VER quem tem acesso hoje
--
-- `is_subscriber` dá um dia de tolerância depois do fim do período, então
-- a coluna `vale_agora` é a verdade que o app enxerga — e não o `status`
-- sozinho, que pode estar 'active' com a data já vencida.
-- ---------------------------------------------------------------------
select u.email,
       s.status,
       s.current_period_end,
       public.is_subscriber(s.user_id) as vale_agora
from public.subscriptions s
join auth.users u on u.id = s.user_id
order by s.updated_at desc;


-- ---------------------------------------------------------------------
-- 4. Quem tem conta mas nunca foi liberado
--
-- Útil para saber quem está batendo na paywall.
-- ---------------------------------------------------------------------
select u.email, u.created_at
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null
order by u.created_at desc;
