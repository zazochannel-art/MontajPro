-- Cheltuielile care vin în fiecare lună, indiferent de lucrări.
--
-- Chiria la depozit, leasingul, telefonul, asigurarea. N-aveau unde să fie
-- puse decât ca o cheltuială pe o lucrare — ceea ce e fals — așa că profitul
-- lunar ieșea mai mare decât adevărul cu exact suma lor.
--
-- Nu se șterg când te lași de ele: au o dată de încheiere, ca lunile trecute
-- să rămână cum au fost.

create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null default 0,
  started_at date not null default current_date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists fixed_costs_user_idx on public.fixed_costs (user_id);
create index if not exists fixed_costs_synced_idx on public.fixed_costs (user_id, synced_at);

drop trigger if exists fixed_costs_synced_at on public.fixed_costs;
create trigger fixed_costs_synced_at before insert or update on public.fixed_costs
  for each row execute function public.set_synced_at();

alter table public.fixed_costs enable row level security;

drop policy if exists fixed_costs_select_own on public.fixed_costs;
create policy fixed_costs_select_own on public.fixed_costs
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists fixed_costs_insert_own on public.fixed_costs;
create policy fixed_costs_insert_own on public.fixed_costs
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists fixed_costs_update_own on public.fixed_costs;
create policy fixed_costs_update_own on public.fixed_costs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists fixed_costs_delete_own on public.fixed_costs;
create policy fixed_costs_delete_own on public.fixed_costs
  for delete to authenticated using (user_id = (select auth.uid()));
