-- Materialul scos din depozit pentru o lucrare.
--
-- Inventarul nu scădea niciodată: aveai cantități în depozit și materiale pe
-- lucrări, iar cele două nu se atingeau. După câteva lucrări, stocul din
-- aplicație n-avea nicio legătură cu raftul.
--
-- Steagul e separat de `purchased` fiindcă sunt lucruri diferite: una e să dai
-- bani furnizorului, alta e să iei de pe raft ce aveai deja. Doar al doilea
-- mișcă stocul, și doar o dată.

alter table public.job_materials
  add column if not exists taken_from_stock boolean not null default false;
