-- Lucrarea, văzută de client.
--
-- Omul sună „unde sunteți?” fiindcă n-are de unde ști. Linkul îi arată exact
-- atât cât îl privește: când e programată, dacă s-a început, ce pași s-au
-- făcut și pozele. Fără prețuri, fără profit, fără celelalte lucrări.
--
-- Același tipar ca la ofertă și la procesul-verbal: token lung, o funcție care
-- rulează cu drepturile definitorului și întoarce exact ce trebuie văzut.
-- Nicio politică RLS nu se atinge.
alter table public.jobs
  add column if not exists public_token text;

create unique index if not exists jobs_public_token_key
  on public.jobs (public_token)
  where public_token is not null;

comment on column public.jobs.public_token is
  'Cheia linkului prin care clientul își vede lucrarea; gol până la prima partajare.';

create or replace function public.job_by_token(token text)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare result jsonb;
begin
  if token is null or length(token) < 20 then return null; end if;
  select jsonb_build_object(
    'title', j.title,
    'type', j.type,
    'status', j.status,
    'address', j.address,
    'scheduled_date', j.scheduled_date,
    'scheduled_time', j.scheduled_time,
    'start_date', j.start_date,
    'end_date', j.end_date,
    'issuer', jsonb_build_object(
      'name', coalesce(s.company, s.full_name), 'phone', s.phone),
    -- Pașii, fără notițele tale: clientul vede ce s-a făcut, nu cum îți
    -- vorbești ție însuți despre lucrare.
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object('title', t.title, 'done', t.done)
        order by t.position)
      from public.job_tasks t
      where t.job_id = j.id and t.deleted_at is null
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object('path', p.storage_path, 'stage', p.stage)
        order by p.created_at)
      from public.job_photos p
      where p.job_id = j.id and p.deleted_at is null and p.storage_path is not null
    ), '[]'::jsonb))
  into result
  from public.jobs j
  join public.settings s on s.user_id = j.user_id and s.deleted_at is null
  where j.public_token = token and j.deleted_at is null and j.archived_at is null;
  return result;
end; $$;

revoke all on function public.job_by_token(text) from public;
grant execute on function public.job_by_token(text) to anon, authenticated, service_role;

-- Pozele lucrării partajate devin citibile de cine are linkul — și numai ele.
-- Ștergi tokenul de pe lucrare și se închid la loc, în aceeași clipă.
create or replace function public.is_shared_job_photo(path text)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.job_photos p
    join public.jobs j on j.id = p.job_id
    where p.storage_path = path and p.deleted_at is null and j.deleted_at is null
      and j.archived_at is null and j.public_token is not null);
$$;

revoke all on function public.is_shared_job_photo(text) from public;
grant execute on function public.is_shared_job_photo(text) to anon, authenticated, service_role;

drop policy if exists "job_photos_select_shared_job" on storage.objects;
create policy "job_photos_select_shared_job" on storage.objects
  for select to anon
  using (bucket_id = 'job-photos' and public.is_shared_job_photo(name));
