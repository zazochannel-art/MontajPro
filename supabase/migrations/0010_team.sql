-- Al doilea om.
--
-- Ajutorul trebuie să vadă lucrarea, să bifeze pașii, să pornească cronometrul
-- și să pună poze — fără să vadă un leu: nici prețuri, nici plăți, nici
-- cheltuieli, nici oferte, nici facturi.
--
-- Decizia de arhitectură: RLS-ul existent NU se atinge. Fiecare rând rămâne al
-- unui singur cont (`user_id = auth.uid()`), exact ca până acum, iar ajutorul
-- ajunge la datele patronului doar prin funcțiile de mai jos, cu drepturile
-- definitorului. Așa, o greșeală într-o politică nouă nu poate deschide restul
-- aplicației, iar ce nu e returnat explicit de o funcție nu există pentru el.
-- Banii nu sunt ascunși prin permisiuni pe coloane — pur și simplu nu ies din
-- server.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  /** Invitația se face pe e-mail; contul poate nici să nu existe încă. */
  member_email text not null,
  member_id uuid references auth.users (id) on delete set null,
  member_name text,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_members_owner_email
  on public.team_members (owner_id, lower(member_email));
create index if not exists team_members_member_idx on public.team_members (member_id);

alter table public.team_members enable row level security;

-- Patronul își vede și își gestionează invitațiile.
drop policy if exists team_owner_all on public.team_members;
create policy team_owner_all on public.team_members
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Invitatul își vede propria invitație, ca să știe la cine e în echipă.
drop policy if exists team_member_select on public.team_members;
create policy team_member_select on public.team_members
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or lower(member_email) = lower((select auth.jwt() ->> 'email'))
  );

/** Patronii la care contul curent e ajutor acceptat și neretras. */
create or replace function public.team_owners()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select t.owner_id
  from public.team_members t
  where t.member_id = auth.uid()
    and t.accepted_at is not null
    and t.revoked_at is null;
$$;

revoke all on function public.team_owners() from public;
revoke execute on function public.team_owners() from anon;
grant execute on function public.team_owners() to authenticated, service_role;

/**
 * Invitația se acceptă de cel invitat, pe baza e-mailului din propriul token.
 * Nimeni nu se poate lega singur de un cont străin: rândul trebuie să existe,
 * pus acolo de patron.
 */
create or replace function public.team_accept(invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.team_members
     set member_id = auth.uid(),
         member_name = coalesce(member_name, auth.jwt() ->> 'email'),
         accepted_at = coalesce(accepted_at, now()),
         revoked_at = null,
         updated_at = now()
   where id = invite_id
     and revoked_at is null
     and lower(member_email) = lower(auth.jwt() ->> 'email');
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.team_accept(uuid) from public;
revoke execute on function public.team_accept(uuid) from anon;
grant execute on function public.team_accept(uuid) to authenticated, service_role;

/**
 * Lucrările la care are acces ajutorul.
 *
 * Ce lipsește din listă e la fel de important ca ce e în ea: nu iese niciun
 * preț, avans sau cost. Adresa și telefonul clientului ies, pentru că fără ele
 * omul nu ajunge la lucrare.
 */
create or replace function public.shared_jobs()
returns table (
  id uuid,
  owner_id uuid,
  title text,
  type text,
  status text,
  address text,
  scheduled_date date,
  scheduled_time text,
  notes text,
  client_name text,
  client_phone text
)
language sql
security definer
set search_path = ''
stable
as $$
  select j.id,
         j.user_id,
         j.title,
         j.type,
         j.status,
         coalesce(j.address, c.address),
         j.scheduled_date,
         j.scheduled_time,
         j.notes,
         c.name,
         c.phone
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  where j.user_id in (select public.team_owners())
    and j.deleted_at is null
    and j.status in ('confirmed', 'materials', 'in_progress', 'issue')
  order by j.scheduled_date nulls last, j.created_at;
$$;

revoke all on function public.shared_jobs() from public;
revoke execute on function public.shared_jobs() from anon;
grant execute on function public.shared_jobs() to authenticated, service_role;

/** Pașii lucrării partajate. */
create or replace function public.shared_tasks(job uuid)
-- „position” e cuvânt rezervat în Postgres (funcția position(x in y)), deci
-- numele coloanei de ieșire se scrie între ghilimele.
returns table (id uuid, title text, done boolean, "position" integer)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, t.title, t.done, t.position as "position"
  from public.job_tasks t
  join public.jobs j on j.id = t.job_id
  where t.job_id = job
    and t.deleted_at is null
    and j.user_id in (select public.team_owners())
  order by t.position;
$$;

revoke all on function public.shared_tasks(uuid) from public;
revoke execute on function public.shared_tasks(uuid) from anon;
grant execute on function public.shared_tasks(uuid) to authenticated, service_role;

/** Bifarea unui pas de către ajutor. */
create or replace function public.shared_task_set(task uuid, value boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.job_tasks t
     set done = value,
         done_at = case when value then now() else null end,
         updated_at = now()
    from public.jobs j
   where t.id = task
     and j.id = t.job_id
     and t.deleted_at is null
     and j.user_id in (select public.team_owners());
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.shared_task_set(uuid, boolean) from public;
revoke execute on function public.shared_task_set(uuid, boolean) from anon;
grant execute on function public.shared_task_set(uuid, boolean) to authenticated, service_role;

-- Cine a lucrat. Nu folosim câmpul de notițe pentru identitate: notița e text
-- pe care patronul îl poate rescrie, iar atunci ajutorul n-ar mai găsi
-- sesiunea pe care s-o oprească.
alter table public.work_sessions
  add column if not exists by_member_id uuid references auth.users (id) on delete set null;

alter table public.job_photos
  add column if not exists by_member_id uuid references auth.users (id) on delete set null;

/**
 * Cronometrul ajutorului.
 *
 * Sesiunea se scrie pe contul patronului, ca orele să intre în socoteala
 * lucrării, dar ține minte cine a pornit-o.
 */
create or replace function public.shared_session_start(job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  fresh uuid;
begin
  select j.user_id into owner
    from public.jobs j
   where j.id = job
     and j.deleted_at is null
     and j.user_id in (select public.team_owners());
  if owner is null then
    return null;
  end if;

  -- O singură sesiune deschisă pe lucrare pentru același om.
  select s.id into fresh
    from public.work_sessions s
   where s.job_id = job and s.ended_at is null and s.deleted_at is null
     and s.by_member_id = auth.uid()
   limit 1;
  if fresh is not null then
    return fresh;
  end if;

  insert into public.work_sessions (user_id, job_id, started_at, by_member_id, note)
  values (owner, job, now(), auth.uid(), auth.jwt() ->> 'email')
  returning id into fresh;
  return fresh;
end;
$$;

revoke all on function public.shared_session_start(uuid) from public;
revoke execute on function public.shared_session_start(uuid) from anon;
grant execute on function public.shared_session_start(uuid) to authenticated, service_role;

create or replace function public.shared_session_stop(session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.work_sessions s
     set ended_at = now(),
         duration_minutes = greatest(
           0, round(extract(epoch from (now() - s.started_at)) / 60)::int
         ),
         updated_at = now()
    from public.jobs j
   where s.id = session_id
     and j.id = s.job_id
     and s.ended_at is null
     and j.user_id in (select public.team_owners());
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.shared_session_stop(uuid) from public;
revoke execute on function public.shared_session_stop(uuid) from anon;
grant execute on function public.shared_session_stop(uuid) to authenticated, service_role;

/** Sesiunea deschisă chiar de ajutor, ca să știe ce să oprească. */
create or replace function public.shared_open_session(job uuid)
returns table (id uuid, started_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select s.id, s.started_at
  from public.work_sessions s
  join public.jobs j on j.id = s.job_id
  where s.job_id = job
    and s.ended_at is null
    and s.deleted_at is null
    and s.by_member_id = auth.uid()
    and j.user_id in (select public.team_owners())
  limit 1;
$$;

revoke all on function public.shared_open_session(uuid) from public;
revoke execute on function public.shared_open_session(uuid) from anon;
grant execute on function public.shared_open_session(uuid) to authenticated, service_role;

/** Poza pusă de ajutor: rândul se scrie pe contul patronului. */
create or replace function public.shared_photo_add(
  job uuid,
  path text,
  caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  fresh uuid;
begin
  select j.user_id into owner
    from public.jobs j
   where j.id = job
     and j.deleted_at is null
     and j.user_id in (select public.team_owners());
  if owner is null then
    return null;
  end if;

  insert into public.job_photos
    (user_id, job_id, stage, storage_path, caption, by_member_id)
  values (owner, job, 'during', path, caption, auth.uid())
  returning id into fresh;
  return fresh;
end;
$$;

revoke all on function public.shared_photo_add(uuid, text, text) from public;
revoke execute on function public.shared_photo_add(uuid, text, text) from anon;
grant execute on function public.shared_photo_add(uuid, text, text) to authenticated, service_role;

-- Storage: ajutorul poate pune fișiere în folderul patronului, ca poza să
-- ajungă la lucrare. Citirea rămâne cum era — poza se vede prin aplicația
-- patronului.
drop policy if exists "job photos team insert" on storage.objects;
create policy "job photos team insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] in (
      select o::text from public.team_owners() o
    )
  );
