-- Secretele push, citite din Vault.
--
-- O funcție Edge își ia secretele din două locuri: variabilele ei de mediu
-- (`supabase secrets set`) sau Vault-ul bazei. Le folosim pe amândouă —
-- funcția caută întâi în mediu, iar dacă nu găsește, întreabă baza. Așa
-- proiectul poate fi configurat numai din SQL, fără acces la tabloul de bord,
-- iar cine preferă variabilele de mediu nu schimbă nimic.
--
-- Funcția de mai jos e singura cale către acele secrete, și o poate chema doar
-- `service_role` — adică funcția Edge, care primește cheia din mediul propriu.
-- `anon` și `authenticated` n-o văd deloc.
--
-- Secretele se pun o singură dată, cu numele astea (valorile sunt ale tale,
-- deci nu stau în repo):
--
--   select vault.create_secret('<cheia publică>',  'montajpro_vapid_public');
--   select vault.create_secret('<cheia privată>',  'montajpro_vapid_private');
--   select vault.create_secret('mailto:tu@...',    'montajpro_vapid_subject');
--   select vault.create_secret('<șir aleatoriu>',  'montajpro_cron_secret');
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-reminders',
--                              'montajpro_functions_url');

create or replace function public.push_config()
returns table (
  vapid_subject text,
  vapid_public text,
  vapid_private text,
  cron_secret text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = 'montajpro_vapid_subject'),
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = 'montajpro_vapid_public'),
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = 'montajpro_vapid_private'),
    (select s.decrypted_secret from vault.decrypted_secrets s
      where s.name = 'montajpro_cron_secret');
$$;

revoke all on function public.push_config() from public;
revoke execute on function public.push_config() from anon, authenticated;
grant execute on function public.push_config() to service_role;
