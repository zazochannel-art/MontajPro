-- Zece lucruri, dintre care cinci au nevoie de coloane noi.

-- 1. Lucrarea care ține mai multe zile.
--
-- Până acum o lucrare avea o singură zi. O scară de trei zile punea toate
-- orele pe prima: săptămâna ieșea suprarezervată luni și liberă marți. Gol
-- înseamnă, ca înainte, o lucrare de o zi.
alter table public.jobs
  add column if not exists scheduled_end_date date;

comment on column public.jobs.scheduled_end_date is
  'Ultima zi a lucrării; gol = o singură zi, cea din scheduled_date.';

-- 2. Cine merge la lucrarea asta.
--
-- `work_sessions.by_member_id` spune cine a lucrat, după fapt. Asta spune
-- cine e trimis, înainte. Fără cheie străină spre `auth.users`: omul poate
-- fi scos din echipă, iar lucrarea de anul trecut trebuie să-și țină minte
-- cine a fost pe ea.
alter table public.jobs
  add column if not exists assigned_member_id uuid;

comment on column public.jobs.assigned_member_id is
  'Omul din echipă repartizat pe lucrare; gol = mergi tu.';

-- 3. Lucrarea pusă pe pauză.
--
-- O lucrare stătută fiindcă omul nu s-a hotărât rămânea „confirmată" și
-- mânca din capacitatea săptămânii. „issue" înseamnă altceva: acolo e o
-- problemă de rezolvat, aici se așteaptă.
alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add constraint jobs_status_check check (
    status = any (array['quote','confirmed','materials','in_progress','done','issue','on_hold'])
  );

-- 4. Clientul cu mai multe adrese.
--
-- Omul cu trei apartamente avea un singur rând. Se ține ca listă în chiar
-- rândul clientului, nu ca tabel separat: sunt două-trei adrese, nu o
-- evidență, iar un tabel nou ar cere politici proprii degeaba.
alter table public.clients
  add column if not exists addresses jsonb not null default '[]'::jsonb;

comment on column public.clients.addresses is
  'Adrese în plus față de cea principală: [{"label":"Apartament 2","address":"..."}].';

-- 5. Ce ai de recuperat de la furnizor.
--
-- `returned_quantity` înseamnă „pus înapoi în depozitul meu". Asta e
-- altceva: materialul adus greșit, dus înapoi la furnizor, pentru care
-- aștepți banii. Valoarea se calculează din `unit_price` al aceleiași linii.
alter table public.job_materials
  add column if not exists supplier_return_quantity numeric not null default 0;

comment on column public.job_materials.supplier_return_quantity is
  'Cantitatea dusă înapoi la furnizor, pentru care aștepți banii.';
