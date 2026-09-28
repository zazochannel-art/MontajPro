-- Desenul scării, scos dintr-o fotografie.
--
-- Se ține ca geometrie, nu ca imagine: puncte, trepte, cote. Diferența nu e de
-- gust — dintr-o poză nu se poate socoti nici suprafața, nici materialul, nici
-- planul de debitare, iar astea sunt tocmai lucrurile pentru care desenul
-- există. `doc` e documentul întreg, în jsonb, fiindcă forma lui se va mai
-- schimba pe măsură ce se adaugă socoteli, iar o coloană pe fiecare colț de
-- treaptă n-ar avea niciun sens.
--
-- `scale_mm` stă separat, la vedere, deși e și în `doc`: e singura cifră care
-- hotărăște dacă desenul are voie să scrie milimetri. Cât e null, tot ce se
-- vede pe ecran sunt proporții, și așa se și spune.
--
-- Legătura cu lucrarea e opțională. Un montator măsoară scara înainte să
-- existe lucrarea, iar desenul n-are de ce să aștepte.

create table if not exists public.stair_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  title text not null default 'Desen scară',
  -- Fotografia de la care s-a pornit; ca peste tot, întâi local, apoi în bucket.
  photo_path text,
  photo_local_key text,
  -- Documentul vectorial: puncte, trepte, cote, detecție.
  doc jsonb not null default '{}'::jsonb,
  -- Câți milimetri face o unitate de desen. Null = necalibrat.
  scale_mm numeric,
  -- Ce a ieșit din citirea fotografiei, păstrat ca să se vadă cât e de crezut.
  detected_steps integer,
  detected_kind text,
  detected_confidence numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  synced_at timestamptz not null default now()
);

create index if not exists stair_designs_user_idx on public.stair_designs (user_id);
create index if not exists stair_designs_synced_idx on public.stair_designs (user_id, synced_at);
create index if not exists stair_designs_job_idx on public.stair_designs (job_id);

drop trigger if exists stair_designs_synced_at on public.stair_designs;
create trigger stair_designs_synced_at before insert or update on public.stair_designs
  for each row execute function public.set_synced_at();

alter table public.stair_designs enable row level security;

drop policy if exists stair_designs_select_own on public.stair_designs;
create policy stair_designs_select_own on public.stair_designs
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists stair_designs_insert_own on public.stair_designs;
create policy stair_designs_insert_own on public.stair_designs
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists stair_designs_update_own on public.stair_designs;
create policy stair_designs_update_own on public.stair_designs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists stair_designs_delete_own on public.stair_designs;
create policy stair_designs_delete_own on public.stair_designs
  for delete to authenticated using (user_id = (select auth.uid()));
