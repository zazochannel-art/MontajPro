-- Semnătura desenată pe ofertă.
--
-- Procesul-verbal are de mult o semnătură trasă cu degetul; oferta se
-- mulțumea cu un nume tastat. Pentru client, diferența dintre „am scris ceva
-- într-o căsuță" și „am semnat" e toată.

alter table public.quotes
  add column if not exists client_signature_image text;

-- Pagina publică trebuie să poată arăta semnătura după acceptare, deci
-- funcția de citire o întoarce și ea.
create or replace function public.quote_by_token(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  result jsonb;
begin
  if token is null or length(token) < 20 then
    return null;
  end if;

  select jsonb_build_object(
    'id', q.id,
    'number', q.number,
    'title', q.title,
    'status', q.status,
    'advance', q.advance,
    'discount', q.discount,
    'valid_until', q.valid_until,
    'notes', q.notes,
    'created_at', q.created_at,
    'accepted_at', q.accepted_at,
    'accepted_by_client_at', q.accepted_by_client_at,
    'client_signature', q.client_signature,
    'client_signature_image', q.client_signature_image,
    'currency', coalesce(s.currency, 'MDL'),
    'client', case when c.id is null then null else jsonb_build_object(
      'name', c.name,
      'address', c.address
    ) end,
    'issuer', jsonb_build_object(
      'name', coalesce(s.company, s.full_name),
      'phone', s.phone,
      'email', s.email
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', i.description,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price
      ) order by i.position)
      from public.quote_items i
      where i.quote_id = q.id and i.deleted_at is null
    ), '[]'::jsonb)
  )
  into result
  from public.quotes q
  left join public.clients c on c.id = q.client_id and c.deleted_at is null
  left join public.settings s on s.user_id = q.user_id and s.deleted_at is null
  where q.public_token = token
    and q.deleted_at is null
    and q.status <> 'draft'
    and (q.valid_until is null or q.valid_until >= current_date);

  return result;
end;
$$;

-- Funcția veche avea doi parametri. Un `create or replace` cu unul în plus ar
-- lăsa două variante, iar apelul cu doi parametri ar deveni ambiguu.
drop function if exists public.accept_quote(text, text);

create or replace function public.accept_quote(
  token text,
  signer text,
  signature text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.quotes;
begin
  if token is null or length(token) < 20 then
    return null;
  end if;

  -- Semnătura vine de la `anon`: o imagine cât un fișier n-are ce căuta
  -- într-un rând de bază de date.
  if signature is not null and length(signature) > 200000 then
    return null;
  end if;

  select * into target
  from public.quotes q
  where q.public_token = token
    and q.deleted_at is null
    and q.status = 'sent'
    and (q.valid_until is null or q.valid_until >= current_date)
  for update;

  if not found then
    return null;
  end if;

  update public.quotes
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now()),
      accepted_by_client_at = now(),
      client_signature = nullif(btrim(signer), ''),
      client_signature_image = case
        when signature like 'data:image/%' then signature
        else client_signature_image
      end,
      updated_at = now()
  where id = target.id;

  return public.quote_by_token(token);
end;
$$;

revoke all on function public.accept_quote(text, text, text) from public;
grant execute on function public.accept_quote(text, text, text) to anon, authenticated;
