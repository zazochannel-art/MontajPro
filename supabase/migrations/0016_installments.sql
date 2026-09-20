-- Scadențarul lucrării.
--
-- „Avans” și „rest” nu descriu cum vin banii în realitate: la semnare, la
-- comanda materialului, la predare. Tranșele sunt un plan; `payment_id` leagă
-- planul de încasarea adevărată, ca scadențarul să nu spună „încasat” în timp
-- ce Finanțele nu știu nimic.

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  label text not null default 'Tranșă',
  amount numeric(12, 2) not null default 0,
  due_date date,
  payment_id uuid references public.payments (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists installments_user_idx on public.installments (user_id);
create index if not exists installments_job_idx on public.installments (job_id, position);
create index if not exists installments_synced_idx on public.installments (user_id, synced_at);

drop trigger if exists installments_synced_at on public.installments;
create trigger installments_synced_at before insert or update on public.installments
  for each row execute function public.set_synced_at();

alter table public.installments enable row level security;

drop policy if exists installments_select_own on public.installments;
create policy installments_select_own on public.installments
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists installments_insert_own on public.installments;
create policy installments_insert_own on public.installments
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists installments_update_own on public.installments;
create policy installments_update_own on public.installments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists installments_delete_own on public.installments;
create policy installments_delete_own on public.installments
  for delete to authenticated using (user_id = (select auth.uid()));
