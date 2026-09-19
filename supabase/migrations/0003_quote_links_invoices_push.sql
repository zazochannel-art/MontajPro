-- Ofertă publică, facturi și notificări push.
--
-- Trei lucruri care ating serverul:
--   * oferta trimisă clientului ca link, cu accept scris — fără cont și fără
--     acces anonim la tabele: totul trece prin două funcții controlate;
--   * facturile, care se sincronizează ca orice altă tabelă;
--   * abonamentele de push, care NU se sincronizează: sunt legate de un
--     dispozitiv anume, nu de date.

/* ------------------------------------------------------------------ */
/* Oferta publică                                                      */
/* ------------------------------------------------------------------ */

alter table public.quotes
  add column if not exists public_token text,
  add column if not exists accepted_by_client_at timestamptz,
  add column if not exists client_signature text;

-- Tokenul e cheia linkului trimis clientului; trebuie să fie unic pe tot
-- sistemul, nu doar pe cont.
create unique index if not exists quotes_public_token_key
  on public.quotes (public_token)
  where public_token is not null;

/**
 * Oferta văzută de client.
 *
 * Rulează cu drepturile definitorului, deci `anon` nu primește acces la
 * tabele — doar la rândul cerut, și numai dacă tokenul este corect, oferta
 * nu e ștearsă, nu e ciornă și nu a expirat.
 */
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

/**
 * Acceptarea ofertei de către client.
 *
 * Singurele câmpuri pe care le poate schimba cineva neautentificat sunt
 * statusul, momentul acceptării și numele semnatarului. O ofertă deja
 * acceptată sau refuzată nu se mai modifică.
 */
create or replace function public.accept_quote(token text, signer text)
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
      updated_at = now()
  where id = target.id;

  return public.quote_by_token(token);
end;
$$;

revoke all on function public.quote_by_token(text) from public;
revoke all on function public.accept_quote(text, text) from public;
grant execute on function public.quote_by_token(text) to anon, authenticated;
grant execute on function public.accept_quote(text, text) to anon, authenticated;

/* ------------------------------------------------------------------ */
/* Facturi                                                             */
/* ------------------------------------------------------------------ */

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  series text not null default 'MP',
  number integer not null default 1,
  issued_at date not null default current_date,
  due_at date,
  -- Datele clientului sunt copiate în factură: o factură nu are voie să se
  -- schimbe pentru că cineva a editat fișa clientului șase luni mai târziu.
  client_name text,
  client_address text,
  client_phone text,
  subtotal numeric(12, 2) not null default 0,
  vat_percent numeric(5, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  paid_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create unique index if not exists invoices_number_per_user
  on public.invoices (user_id, series, number)
  where deleted_at is null;

create index if not exists invoices_user_synced_idx on public.invoices (user_id, synced_at);
create index if not exists invoices_job_idx on public.invoices (job_id);

drop trigger if exists invoices_synced_at on public.invoices;
create trigger invoices_synced_at before insert or update on public.invoices
  for each row execute function public.set_synced_at();

alter table public.invoices enable row level security;

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists invoices_insert_own on public.invoices;
create policy invoices_insert_own on public.invoices
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists invoices_update_own on public.invoices;
create policy invoices_update_own on public.invoices
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists invoices_delete_own on public.invoices;
create policy invoices_delete_own on public.invoices
  for delete to authenticated using (user_id = (select auth.uid()));

/* ------------------------------------------------------------------ */
/* Abonamente push                                                     */
/* ------------------------------------------------------------------ */

-- Nu intră în sincronizarea local-first: un abonament aparține unui browser
-- anume, nu contului. Se scrie direct, la activarea notificărilor.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists push_insert_own on public.push_subscriptions;
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists push_update_own on public.push_subscriptions;
create policy push_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

/**
 * Ce trebuie trimis astăzi, pentru toți utilizatorii.
 *
 * Edge Function-ul rulează cu `service_role` și cheamă asta o dată pe zi;
 * regulile stau în SQL ca să nu depindă de aplicație ca să fie deschisă.
 */
create or replace function public.due_reminders()
returns table (
  user_id uuid,
  kind text,
  title text,
  body text,
  job_id uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  -- Lucrări programate azi sau mâine
  select j.user_id,
         case when j.scheduled_date = current_date then 'job_today' else 'job_tomorrow' end,
         case when j.scheduled_date = current_date then 'Lucrare astăzi' else 'Lucrare mâine' end,
         j.title || coalesce(' — ' || c.name, '') ||
           coalesce(', ora ' || j.scheduled_time, ''),
         j.id
  from public.jobs j
  left join public.clients c on c.id = j.client_id and c.deleted_at is null
  where j.deleted_at is null
    and j.status <> 'done'
    and j.scheduled_date in (current_date, current_date + 1)

  union all

  -- Lucrări finalizate cu bani neîncasați
  select j.user_id,
         'payment_due',
         'Plată restantă',
         j.title || ': ' || to_char(j.price_total - coalesce(p.paid, 0), 'FM999999990') ||
           ' de încasat',
         j.id
  from public.jobs j
  left join (
    select job_id, sum(amount) as paid
    from public.payments
    where deleted_at is null
    group by job_id
  ) p on p.job_id = j.id
  where j.deleted_at is null
    and j.status = 'done'
    and j.price_total - coalesce(p.paid, 0) > 0.5
    and j.end_date >= current_date - 60

  union all

  -- Oferte trimise și neconfirmate de mai bine de trei zile
  select q.user_id,
         'quote_pending',
         'Ofertă neconfirmată',
         q.title || ' — trimisă pe ' || to_char(q.sent_at, 'DD.MM'),
         q.job_id
  from public.quotes q
  where q.deleted_at is null
    and q.status = 'sent'
    and q.sent_at < now() - interval '3 days'
    and q.sent_at > now() - interval '30 days';
$$;

revoke all on function public.due_reminders() from public;
grant execute on function public.due_reminders() to service_role;
