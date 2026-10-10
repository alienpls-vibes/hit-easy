-- =====================================================================
-- Granting premium access by hand, while there is no billing
--
-- Do NOT run this whole file. Each block is meant to be copied on its own,
-- with the e-mail replaced, into the Supabase SQL Editor.
--
-- Why here and not through a button in the app: the statistics gate is
-- RLS (`is_subscriber` in schema.sql). What decides who subscribes is the
-- `subscriptions` table, and it has no insert or update policy — the app
-- cannot write to it, on purpose. Only the SQL Editor (which runs as the
-- database owner) and, in the future, the Stripe webhook.
--
-- Why there is NO `liberar_premium(email)` function:
--
--   Supabase grants EXECUTE to `anon` and `authenticated` by default
--   privilege. That already bit this project once — `buscar_handle` was
--   left open to people with no account at all, and it was only found by
--   testing against the server. A function that GRANTS PREMIUM with the
--   same oversight would let anyone signed in grant it to themselves. The
--   risk is not worth the convenience of typing less.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GRANT access to someone  (replace the e-mail)
-- ---------------------------------------------------------------------
insert into public.subscriptions (user_id, status, current_period_end, updated_at)
select u.id, 'active', now() + interval '1 year', now()
from auth.users u
where lower(u.email) = lower('troque-pelo-email@exemplo.com')
on conflict (user_id) do update
  set status = 'active',
      current_period_end = excluded.current_period_end,
      updated_at = now();

-- Got "INSERT 0 0"? Then that e-mail has not created an account in the app
-- yet. The person needs to sign in once (magic link or password) before
-- there is anyone to grant.


-- ---------------------------------------------------------------------
-- 2. REVOKE someone's access
-- ---------------------------------------------------------------------
update public.subscriptions s
   set status = 'canceled', updated_at = now()
  from auth.users u
 where u.id = s.user_id
   and lower(u.email) = lower('troque-pelo-email@exemplo.com');


-- ---------------------------------------------------------------------
-- 3. SEE who has access today
--
-- `is_subscriber` gives one day of grace after the period ends, so the
-- `vale_agora` column is the truth the app sees — and not `status` alone,
-- which can be 'active' with the date already past.
-- ---------------------------------------------------------------------
select u.email,
       s.status,
       s.current_period_end,
       public.is_subscriber(s.user_id) as vale_agora
from public.subscriptions s
join auth.users u on u.id = s.user_id
order by s.updated_at desc;


-- ---------------------------------------------------------------------
-- 4. Who has an account but was never granted access
--
-- Useful to know who is hitting the paywall.
-- ---------------------------------------------------------------------
select u.email, u.created_at
from auth.users u
left join public.subscriptions s on s.user_id = u.id
where s.user_id is null
order by u.created_at desc;
