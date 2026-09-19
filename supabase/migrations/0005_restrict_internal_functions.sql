-- Funcțiile interne nu trebuie să fie apelabile din browser.
--
-- Supabase acordă implicit EXECUTE rolurilor `anon` și `authenticated` pe
-- funcțiile din schema `public`, iar un simplu `revoke ... from public` nu
-- atinge acele granturi separate. Cum `due_reminders()` e SECURITY DEFINER și
-- întoarce rândurile *tuturor* utilizatorilor, oricine ar fi putut-o apela
-- direct prin PostgREST și vedea datele altora. O revocăm explicit.
--
-- Singurele funcții care rămân publice sunt cele două RPC-uri pentru linkul de
-- ofertă trimis clientului: `quote_by_token` și `accept_quote`.

revoke execute on function public.due_reminders() from anon, authenticated;
revoke execute on function public.set_synced_at() from anon, authenticated;

-- `set_synced_at` e doar funcție de trigger: o rulează Postgres, nu clientul.
revoke execute on function public.set_synced_at() from public;
