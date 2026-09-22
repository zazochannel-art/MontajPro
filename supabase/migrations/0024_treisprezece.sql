-- Treisprezece funcții, într-o singură schemă.
--
-- Toate coloanele sunt opționale sau au valori implicite sigure: un telefon
-- rămas pe versiunea veche scrie rânduri fără ele și nimic nu se rupe.

/* ---------------------------------------------------------------- *
 * 1. Ajutorul plătit
 *
 * Tariful stă în setările patronului, nu pe rândul din echipă: ajutorul își
 * poate citi propriul rând (are nevoie, ca să știe la cine e în echipă), iar
 * cât îi dai pe oră e treaba ta. Cheia hărții e `auth.uid()` al omului, exact
 * ce scrie `work_sessions.by_member_id`.
 * ---------------------------------------------------------------- */
alter table public.settings
  add column if not exists member_rates jsonb not null default '{}'::jsonb;

-- Plata către ajutor e o cheltuială ca oricare alta: intră în bani fără să
-- inventăm un al doilea fel de a scoate lei din buzunar.
alter table public.expenses
  add column if not exists member_id uuid;

create index if not exists expenses_member_idx
  on public.expenses (user_id, member_id)
  where member_id is not null;

/* ---------------------------------------------------------------- *
 * 2. Restul de material se întoarce în stoc
 * ---------------------------------------------------------------- */
alter table public.job_materials
  add column if not exists returned_quantity numeric not null default 0;

alter table public.job_materials
  add constraint job_materials_returned_sane
  check (returned_quantity >= 0)
  not valid;

/* ---------------------------------------------------------------- *
 * 8. Prețuri pe client
 *
 * Procent, nu preț absolut: „minus 10 la sută pentru constructorul care îmi
 * aduce cinci apartamente pe an”. Negativ = reducere, pozitiv = adaos.
 * ---------------------------------------------------------------- */
alter table public.clients
  add column if not exists price_adjust numeric not null default 0;

alter table public.clients
  add constraint clients_price_adjust_sane
  check (price_adjust > -100 and price_adjust <= 100)
  not valid;

/* ---------------------------------------------------------------- *
 * 11. Kilometrii chiar făcuți
 *
 * Tariful pe kilometru exista în setări; câți kilometri ai făcut de fapt la o
 * lucrare, nu.
 * ---------------------------------------------------------------- */
alter table public.jobs
  add column if not exists travel_km numeric;

/* ---------------------------------------------------------------- *
 * 6. Sculele, pe fel de lucrare
 * ---------------------------------------------------------------- */
alter table public.tools
  add column if not exists job_types jsonb not null default '[]'::jsonb;

/* ---------------------------------------------------------------- *
 * 12. Zile blocate
 *
 * O nuntă, o sărbătoare, o zi la spital. Calendarul te credea liber.
 * ---------------------------------------------------------------- */
create table if not exists public.day_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  /** Ziua blocată, ISO (YYYY-MM-DD). */
  day date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists day_blocks_user_idx on public.day_blocks (user_id);
create index if not exists day_blocks_synced_idx on public.day_blocks (user_id, synced_at);
create unique index if not exists day_blocks_unique_day
  on public.day_blocks (user_id, day)
  where deleted_at is null;

drop trigger if exists day_blocks_synced_at on public.day_blocks;
create trigger day_blocks_synced_at before insert or update on public.day_blocks
  for each row execute function public.set_synced_at();

alter table public.day_blocks enable row level security;

drop policy if exists day_blocks_select_own on public.day_blocks;
create policy day_blocks_select_own on public.day_blocks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists day_blocks_insert_own on public.day_blocks;
create policy day_blocks_insert_own on public.day_blocks
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists day_blocks_update_own on public.day_blocks;
create policy day_blocks_update_own on public.day_blocks
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists day_blocks_delete_own on public.day_blocks;
create policy day_blocks_delete_own on public.day_blocks
  for delete to authenticated using (user_id = (select auth.uid()));

/* ---------------------------------------------------------------- *
 * 7 + 10. Linkuri publice: portofoliul și calendarul
 *
 * Aceeași idee ca la ofertă — un token lung, imposibil de ghicit, pe care îl
 * dai cui vrei. Ștergi tokenul, linkul moare.
 * ---------------------------------------------------------------- */
alter table public.settings
  add column if not exists portfolio_token text unique;

alter table public.settings
  add column if not exists portfolio_intro text;

alter table public.settings
  add column if not exists calendar_token text unique;

/* ---------------------------------------------------------------- *
 * 9. Clientul semnează predarea de pe telefonul lui
 * ---------------------------------------------------------------- */
alter table public.handovers
  add column if not exists public_token text unique;

alter table public.handovers
  add column if not exists client_signature_image text;

alter table public.handovers
  add column if not exists signed_by_client_at timestamptz;

/* ---------------------------------------------------------------- *
 * Linkurile publice, ca funcții cu drepturile definitorului.
 *
 * Aceeași alegere ca la ofertă: datele nu ies prin politici slăbite, ci prin
 * funcții care întorc exact ce trebuie văzut și nimic mai mult.
 * ---------------------------------------------------------------- */

-- Portofoliul: ce ai lucrat, pentru omul care întreabă de preț.
create or replace function public.portfolio_by_token(token text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  if token is null or length(token) < 20 then return null; end if;
  select jsonb_build_object(
    'intro', s.portfolio_intro,
    'issuer', jsonb_build_object(
      'name', coalesce(s.company, s.full_name), 'phone', s.phone, 'email', s.email),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'type', j.type,
        'description', j.portfolio_description, 'done_at', j.end_date,
        'photos', coalesce((
          select jsonb_agg(p.storage_path order by p.created_at)
          from public.job_photos p
          where p.job_id = j.id and p.deleted_at is null and p.storage_path is not null
        ), '[]'::jsonb)
      ) order by coalesce(j.end_date, j.created_at::date) desc)
      from public.jobs j
      where j.user_id = s.user_id and j.deleted_at is null and j.in_portfolio = true
    ), '[]'::jsonb))
  into result
  from public.settings s
  where s.portfolio_token = token and s.deleted_at is null;
  return result;
end; $$;

revoke all on function public.portfolio_by_token(text) from public;
grant execute on function public.portfolio_by_token(text) to anon, authenticated, service_role;

-- Pozele din portofoliu devin citibile de oricine are linkul — și numai ele.
-- Ștergi tokenul din setări și se închid la loc.
create or replace function public.is_portfolio_photo(path text)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.job_photos p
    join public.jobs j on j.id = p.job_id
    join public.settings s on s.user_id = j.user_id and s.deleted_at is null
    where p.storage_path = path and p.deleted_at is null and j.deleted_at is null
      and j.in_portfolio = true and s.portfolio_token is not null);
$$;

revoke all on function public.is_portfolio_photo(text) from public;
grant execute on function public.is_portfolio_photo(text) to anon, authenticated, service_role;

drop policy if exists "job_photos_select_portfolio" on storage.objects;
create policy "job_photos_select_portfolio" on storage.objects
  for select to anon
  using (bucket_id = 'job-photos' and public.is_portfolio_photo(name));

-- Procesul-verbal, citit și semnat de client pe telefonul lui.
create or replace function public.handover_by_token(token text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  if token is null or length(token) < 20 then return null; end if;
  select jsonb_build_object(
    'id', h.id, 'number', h.number, 'handed_at', h.handed_at,
    'work_summary', h.work_summary, 'warranty_months', h.warranty_months,
    'notes', h.notes,
    'client_name', coalesce(c.name, h.client_name),
    'client_address', coalesce(c.address, h.client_address),
    'signed_by_client_at', h.signed_by_client_at,
    'client_signature_image', h.client_signature_image,
    'job_title', j.title,
    'issuer', jsonb_build_object(
      'name', coalesce(s.company, s.full_name), 'phone', s.phone, 'email', s.email))
  into result
  from public.handovers h
  left join public.jobs j on j.id = h.job_id and j.deleted_at is null
  left join public.clients c on c.id = h.client_id and c.deleted_at is null
  left join public.settings s on s.user_id = h.user_id and s.deleted_at is null
  where h.public_token = token and h.deleted_at is null;
  return result;
end; $$;

revoke all on function public.handover_by_token(text) from public;
grant execute on function public.handover_by_token(text) to anon, authenticated, service_role;

-- Se semnează o singură dată: a doua apăsare nu schimbă nimic, ca o hârtie
-- semnată care nu se mai poate semna încă o dată.
create or replace function public.sign_handover(token text, signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if token is null or length(token) < 20 then return null; end if;
  if signature is null or length(signature) < 32 or length(signature) > 400000 then
    return null;
  end if;
  update public.handovers h
     set client_signature_image = signature,
         signed_by_client_at = now(), updated_at = now()
   where h.public_token = token and h.deleted_at is null
     and h.signed_by_client_at is null;
  select public.handover_by_token(token) into result;
  return result;
end; $$;

revoke all on function public.sign_handover(text, text) from public;
grant execute on function public.sign_handover(text, text) to anon, authenticated, service_role;

-- Calendarul, ca abonament în telefon: doar ce trebuie ca să apară în agendă.
-- Fără prețuri, fără clienți, fără note.
create or replace function public.calendar_by_token(token text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  if token is null or length(token) < 20 then return null; end if;
  select jsonb_build_object(
    'name', coalesce(s.company, s.full_name, 'MontCraft'),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'address', j.address,
        'date', j.scheduled_date, 'time', j.scheduled_time, 'hours', j.estimated_hours
      ) order by j.scheduled_date)
      from public.jobs j
      where j.user_id = s.user_id and j.deleted_at is null and j.archived_at is null
        and j.scheduled_date is not null
        and j.scheduled_date >= (current_date - interval '60 days')
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('day', b.day, 'reason', b.reason) order by b.day)
      from public.day_blocks b
      where b.user_id = s.user_id and b.deleted_at is null
        and b.day >= (current_date - interval '60 days')
    ), '[]'::jsonb))
  into result
  from public.settings s
  where s.calendar_token = token and s.deleted_at is null;
  return result;
end; $$;

revoke all on function public.calendar_by_token(text) from public;
grant execute on function public.calendar_by_token(text) to anon, authenticated, service_role;
