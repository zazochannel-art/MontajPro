-- Cât s-a scos chiar din depozit.
--
-- „Scoate din depozit” scădea cantitatea de pe lucrare, dar nu cobora sub
-- zero: un stoc negativ nu înseamnă nimic. Aveai 5 pe raft, lucrarea cerea 8,
-- rămâneau 0 — și ți se spunea că au lipsit 3.
--
-- Apăsarea înapoi, însă, punea la loc cantitatea de pe lucrare: 0 + 8 = 8.
-- Dintr-o apăsare greșită și anularea ei, raftul creștea cu 3 pachete care nu
-- existaseră niciodată. Iar stocul e tocmai cifra după care hotărăști dacă mai
-- treci pe la depozit.
--
-- Coloana ține minte cât s-a scos de fapt, ca întoarcerea să pună înapoi exact
-- atât. Rândurile scoase înainte de coloana asta rămân cu `null`: pentru ele
-- nu s-a notat nimic, deci nu se poate ști — se întoarce cantitatea de pe
-- lucrare, ca până acum.
alter table public.job_materials
  add column if not exists taken_quantity numeric;

comment on column public.job_materials.taken_quantity is
  'Cât s-a scos chiar din depozit când s-a apăsat „scoate” — poate fi mai puțin decât `quantity`, dacă n-a fost destul pe raft.';
