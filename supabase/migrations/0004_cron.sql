-- Programarea notificărilor zilnice.
--
-- Se rulează DUPĂ ce funcția `send-reminders` e publicată și secretele sunt
-- puse în Vault (vezi `0006_push_config.sql` pentru nume). Nu are nimic de
-- completat de mână: adresa funcției și secretul cronului se citesc din Vault
-- la fiecare rulare, deci nu ajung niciodată în repo și se pot schimba fără să
-- rescrii programarea.

-- pg_net merge în `extensions`, nu în `public`: altfel linterul Supabase îl
-- semnalează, pe bună dreptate — o extensie în schema expusă prin API e
-- suprafață în plus. Funcțiile lui rămân în schema `net` oricum.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Ora 7:30 UTC — înainte de plecarea pe șantier, indiferent de sezon.
select cron.unschedule('montajpro-reminders')
where exists (select 1 from cron.job where jobname = 'montajpro-reminders');

select cron.schedule(
  'montajpro-reminders',
  '30 7 * * *',
  $job$
  -- `where exists` ține cronul liniștit cât timp secretele lipsesc, în loc să
  -- pice zilnic pe o adresă nulă.
  select net.http_post(
    url := (select s.decrypted_secret from vault.decrypted_secrets s
             where s.name = 'montajpro_functions_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select s.decrypted_secret from vault.decrypted_secrets s
                         where s.name = 'montajpro_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from vault.decrypted_secrets s where s.name = 'montajpro_functions_url'
  ) and exists (
    select 1 from vault.decrypted_secrets s where s.name = 'montajpro_cron_secret'
  );
  $job$
);
