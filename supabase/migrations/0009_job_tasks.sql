-- Pașii lucrării, cu șabloane pe tip.
--
-- Aceiași pași se repetă de la o scară la alta. Pornesc dintr-un șablon ținut
-- în setări (`task_templates`), dar odată puși pe lucrare sunt ai ei: un
-- șablon schimbat mai târziu nu rescrie lucrările deja pornite.

alter table public.settings
  add column if not exists task_templates jsonb not null default '{}'::jsonb;

create table if not exists public.job_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists job_tasks_user_idx on public.job_tasks (user_id);
create index if not exists job_tasks_job_idx on public.job_tasks (job_id, position);
create index if not exists job_tasks_synced_idx on public.job_tasks (user_id, synced_at);

drop trigger if exists job_tasks_synced_at on public.job_tasks;
create trigger job_tasks_synced_at before insert or update on public.job_tasks
  for each row execute function public.set_synced_at();

alter table public.job_tasks enable row level security;

drop policy if exists job_tasks_select_own on public.job_tasks;
create policy job_tasks_select_own on public.job_tasks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists job_tasks_insert_own on public.job_tasks;
create policy job_tasks_insert_own on public.job_tasks
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists job_tasks_update_own on public.job_tasks;
create policy job_tasks_update_own on public.job_tasks
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists job_tasks_delete_own on public.job_tasks;
create policy job_tasks_delete_own on public.job_tasks
  for delete to authenticated using (user_id = (select auth.uid()));
