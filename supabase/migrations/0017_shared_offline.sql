-- Munca ajutorului, înregistrată cu orele ei adevărate.
--
-- Cronometrul pornit fără semnal se scrie abia când revine internetul. Dacă
-- durata s-ar calcula la scriere, o sesiune de trei ore terminată dimineața și
-- urcată seara ar ieși de unsprezece ore. De-asta orele intră explicit, nu
-- din `now()`.

create or replace function public.shared_session_log(
  job uuid,
  started timestamptz,
  ended timestamptz
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

  -- Ore din viitor sau de-a-ndoaselea nu se scriu: mai bine lipsește o
  -- sesiune decât să strice socoteala lucrării.
  if started is null or ended is null or ended <= started or started > now() then
    return null;
  end if;

  select coalesce(t.member_name, t.member_email) into who
    from public.team_members t
   where t.owner_id = owner and t.member_id = auth.uid()
   limit 1;

  insert into public.work_sessions
    (user_id, job_id, started_at, ended_at, duration_minutes,
     by_member_id, by_member_name)
  values (
    owner, job, started, ended,
    greatest(0, round(extract(epoch from (ended - started)) / 60)::int),
    auth.uid(), who
  )
  returning id into fresh;
  return fresh;
end;
$$;

revoke all on function public.shared_session_log(uuid, timestamptz, timestamptz) from public;
revoke execute on function public.shared_session_log(uuid, timestamptz, timestamptz) from anon;
grant execute on function public.shared_session_log(uuid, timestamptz, timestamptz)
  to authenticated, service_role;
