-- Oferta deschisă de client.
--
-- Până acum se știa doar dacă oferta a fost acceptată. Dar cea mai utilă
-- informație din vânzare e cealaltă: omul a deschis linkul acum două ore și
-- n-a apăsat nimic. Asta schimbă complet momentul în care dai telefon.

alter table public.quotes
  add column if not exists viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;

/**
 * Marchează oferta ca deschisă.
 *
 * Apelată din pagina publică, deci de `anon`. Rulează cu drepturile
 * definitorului, dar nu poate atinge nimic altceva: doar cele trei coloane
 * de mai jos, doar pe rândul cu tokenul dat.
 *
 * Două precauții care țin cifra cinstită:
 *   - propriul cont nu-și marchează oferta (își deschide linkul ca să-l
 *     verifice înainte de a-l trimite);
 *   - o reîncărcare la câteva secunde nu numără încă o vizită.
 */
create or replace function public.mark_quote_viewed(token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.quotes;
begin
  if token is null or length(token) < 20 then
    return;
  end if;

  select * into target
  from public.quotes q
  where q.public_token = token
    and q.deleted_at is null
    and q.status <> 'draft'
    and (q.valid_until is null or q.valid_until >= current_date)
  for update;

  if not found then
    return;
  end if;

  -- Cine a scris oferta n-o „vizitează”.
  if auth.uid() is not null and auth.uid() = target.user_id then
    return;
  end if;

  if target.last_viewed_at is not null
     and target.last_viewed_at > now() - interval '10 minutes' then
    return;
  end if;

  update public.quotes
  set viewed_at = coalesce(viewed_at, now()),
      last_viewed_at = now(),
      view_count = coalesce(view_count, 0) + 1,
      updated_at = now()
  where id = target.id;
end;
$$;

revoke all on function public.mark_quote_viewed(text) from public;
grant execute on function public.mark_quote_viewed(text) to anon, authenticated;
