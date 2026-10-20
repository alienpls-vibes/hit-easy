-- =====================================================================
-- The hourly call that sends the daily notices (v1)
--
-- Run this AFTER 012-daily-notice.sql AND after deploying the Edge
-- Function `daily-push` (docs/daily-challenge.md, "Server notice"). It is
-- idempotent: scheduling again replaces the job.
--
-- Every hour, on the hour, pg_cron asks pg_net to POST to the function.
-- The function claims what is due (avisos_a_enviar) and sends it. The
-- hour is UTC on the server, but that does not matter: the function sends
-- to whoever is past 09:00 on their own clock.
--
-- The URL and the shared secret live in Supabase Vault, not in this file,
-- so the repo never holds the secret. Create both once, in the SQL Editor:
--
--   select vault.create_secret(
--     'https://<project>.supabase.co/functions/v1/daily-push', 'daily_push_url');
--   select vault.create_secret('<the CRON_SECRET>', 'daily_push_secret');
--
-- The same CRON_SECRET goes into the function's secrets; the function
-- refuses any call without it.
-- =====================================================================


create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'hiteasy-daily-push',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'daily_push_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'daily_push_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
