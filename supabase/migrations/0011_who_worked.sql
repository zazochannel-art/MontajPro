-- Cine a lucrat, vizibil pentru patron.
--
-- `by_member_id` spunea deja cine, dar un id nu se citește. Numele se scrie
-- lângă el, în rând: altfel patronul ar trebui să ceară tabelul echipei ca să
-- afle cine a pus o poză — adică exact lucrul care nu merge offline.
--
-- E o denormalizare asumată, ca datele clientului înghețate în factură: ce a
-- fost adevărat atunci rămâne scris atunci.

alter table public.work_sessions
  add column if not exists by_member_name text;

alter table public.job_photos
  add column if not exists by_member_name text;

create or replace function public.shared_session_start(job uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  who text;
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

  select coalesce(t.member_name, t.member_email) into who
    from public.team_members t
   where t.owner_id = owner and t.member_id = auth.uid()
   limit 1;

  -- O singură sesiune deschisă pe lucrare pentru același om.
  select s.id into fresh
    from public.work_sessions s
   where s.job_id = job and s.ended_at is null and s.deleted_at is null
     and s.by_member_id = auth.uid()
   limit 1;
  if fresh is not null then
    return fresh;
  end if;

  -- `note` rămâne al patronului: nu-l mai umplem cu e-mailul ajutorului.
  insert into public.work_sessions
    (user_id, job_id, started_at, by_member_id, by_member_name)
  values (owner, job, now(), auth.uid(), who)
  returning id into fresh;
  return fresh;
end;
$$;

revoke all on function public.shared_session_start(uuid) from public;
revoke execute on function public.shared_session_start(uuid) from anon;
grant execute on function public.shared_session_start(uuid) to authenticated, service_role;

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
  who text;
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

  select coalesce(t.member_name, t.member_email) into who
    from public.team_members t
   where t.owner_id = owner and t.member_id = auth.uid()
   limit 1;

  insert into public.job_photos
    (user_id, job_id, stage, storage_path, caption, by_member_id, by_member_name)
  values (owner, job, 'during', path, caption, auth.uid(), who)
  returning id into fresh;
  return fresh;
end;
$$;

revoke all on function public.shared_photo_add(uuid, text, text) from public;
revoke execute on function public.shared_photo_add(uuid, text, text) from anon;
grant execute on function public.shared_photo_add(uuid, text, text) to authenticated, service_role;
