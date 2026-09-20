-- Procesul-verbal de predare.
--
-- Oferta se acceptă la început; asta încheie lucrarea: ce s-a executat,
-- garanția și semnătura clientului. Datele clientului se copiază, ca la
-- factură — un document semnat nu se schimbă pentru că cineva a editat fișa
-- clientului peste șase luni.
--
-- Semnătura stă ca PNG (data URL) chiar în rând: câțiva kilobytes, care se
-- sincronizează odată cu el și nu depind de Storage.

create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  number integer not null default 1,
  handed_at date not null default current_date,
  client_name text,
  client_address text,
  client_phone text,
  work_summary text,
  warranty_months integer,
  notes text,
  signature text,
  signer_name text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists handovers_user_idx on public.handovers (user_id);
create index if not exists handovers_job_idx on public.handovers (job_id);
create index if not exists handovers_synced_idx on public.handovers (user_id, synced_at);

drop trigger if exists handovers_synced_at on public.handovers;
create trigger handovers_synced_at before insert or update on public.handovers
  for each row execute function public.set_synced_at();

alter table public.handovers enable row level security;

drop policy if exists handovers_select_own on public.handovers;
create policy handovers_select_own on public.handovers
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists handovers_insert_own on public.handovers;
create policy handovers_insert_own on public.handovers
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists handovers_update_own on public.handovers;
create policy handovers_update_own on public.handovers
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists handovers_delete_own on public.handovers;
create policy handovers_delete_own on public.handovers
  for delete to authenticated using (user_id = (select auth.uid()));
