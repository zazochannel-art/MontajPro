-- Șapte lucruri care nu aveau unde să stea.
--
-- Toate coloanele sunt opționale și cu valori implicite sigure: un telefon
-- care încă n-a luat versiunea nouă a aplicației scrie rânduri fără ele și
-- nimic nu se rupe.

-- 1. Revenirea în garanție.
--
-- O lucrare poate fi „revenirea” la alta: ai fost înapoi să repari o treaptă
-- care scârțâie. Legătura spune care lucrare o repară pe care; dacă a fost
-- gratis sau plătită se vede din banii lucrării, nu dintr-un bifat separat
-- care ar putea contrazice încasările.
alter table public.jobs
  add column if not exists warranty_of_job_id uuid references public.jobs(id) on delete set null;

create index if not exists jobs_warranty_of_idx
  on public.jobs (user_id, warranty_of_job_id)
  where warranty_of_job_id is not null;

-- 2. Aclimatizarea materialului.
--
-- Parchetul trebuie să stea în camera în care se montează, ca să ajungă la
-- umiditatea ei. Momentul în care materialul a ajuns la client pornește ceasul.
alter table public.jobs
  add column if not exists material_delivered_at timestamptz;

-- 3. De unde a venit clientul.
--
-- `source` e canalul (recomandare, Facebook, trecător...), iar când e o
-- recomandare, `referred_by_client_id` spune de la cine. Așa se poate
-- răspunde la „cine îmi aduce de fapt de lucru?”.
alter table public.clients
  add column if not exists source text;

alter table public.clients
  add column if not exists referred_by_client_id uuid references public.clients(id) on delete set null;

create index if not exists clients_referred_by_idx
  on public.clients (user_id, referred_by_client_id)
  where referred_by_client_id is not null;

-- 4. Cât are un pachet.
--
-- Parchetul se vinde în pachete, nu la metru pătrat. Cifra e exprimată în
-- unitatea materialului: un pachet de 2,18 m² înseamnă `pack_size = 2.18`
-- pentru un material cu `unit = 'm²'`. Gol înseamnă „se vinde la bucată”.
alter table public.materials
  add column if not exists pack_size numeric;

alter table public.materials
  add constraint materials_pack_size_positive
  check (pack_size is null or pack_size > 0)
  not valid;

-- 5. Cât stă materialul la aclimatizat, în ore.
--
-- 48 de ore e minimul obișnuit pentru parchet. Rămâne reglabil: depinde de
-- material, de anotimp și de cât de uscată e casa.
alter table public.settings
  add column if not exists acclimatization_hours integer not null default 48;

alter table public.settings
  add constraint settings_acclimatization_hours_sane
  check (acclimatization_hours >= 0 and acclimatization_hours <= 336)
  not valid;

-- 6. Ce se cere unei trepte ca să se urce bine.
--
-- O scară de beci și una de living nu se fac la fel, iar omul de pe șantier
-- știe mai bine decât aplicația ce se cere la el. Gol înseamnă „valorile
-- obișnuite de interior”, din `lib/stairs.ts`.
alter table public.settings
  add column if not exists stair_limits jsonb not null default '{}'::jsonb;
