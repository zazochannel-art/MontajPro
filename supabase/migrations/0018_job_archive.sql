-- Arhiva lucrărilor.
--
-- Nu e o ștergere: lucrarea rămâne în rapoarte și în căutare, fiindcă istoria
-- banilor n-are voie să dispară odată cu curățenia din liste. Doar nu-ți mai
-- stă în drum.

alter table public.jobs
  add column if not exists archived_at timestamptz;

create index if not exists jobs_archived_idx on public.jobs (user_id, archived_at);
