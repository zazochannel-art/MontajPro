-- Programarea notificărilor zilnice.
--
-- Se rulează DUPĂ ce funcția `send-reminders` este publicată și secretele sunt
-- puse. Înlocuiește `<PROJECT_REF>` și `<CRON_SECRET>` cu valorile tale, sau
-- pune-le în Vault (recomandat) și citește-le cu `vault.decrypted_secrets`.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Ora 7:30 UTC — înainte de plecarea pe șantier, indiferent de sezon.
select cron.unschedule('montajpro-reminders')
where exists (select 1 from cron.job where jobname = 'montajpro-reminders');

select cron.schedule(
  'montajpro-reminders',
  '30 7 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
