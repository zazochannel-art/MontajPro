-- Proiectul: un bloc, zece apartamente.
--
-- Până acum fiecare apartament era o lucrare izolată, fără nimic care să le
-- lege. Pentru o scară de bloc asta înseamnă zece rânduri identice în listă,
-- zece prețuri care trebuie adunate pe hârtie și niciun răspuns la
-- „cât am încasat până acum din toată scara?".
--
-- Proiectul nu ia nimic de la lucrare: ea rămâne întreagă, cu banii și pozele
-- ei. Doar le pune pe toate sub același acoperiș.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  client_id uuid references public.clients (id) on delete set null,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists projects_synced_idx on public.projects (user_id, synced_at);

drop trigger if exists projects_synced_at on public.projects;
create trigger projects_synced_at before insert or update on public.projects
  for each row execute function public.set_synced_at();

alter table public.projects enable row level security;

drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- Legătura dintre lucrare și proiect. `set null` la ștergere: proiectul poate
-- dispărea, lucrările lui rămân — cu banii lor cu tot.
alter table public.jobs
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists jobs_project_idx on public.jobs (user_id, project_id);
