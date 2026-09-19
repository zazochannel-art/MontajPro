-- Poziții proprii în lista de prețuri.
--
-- Tarifele implicite (`default_rates`) acoperă lucrările obișnuite. Aici intră
-- ce mai face fiecare montator — demontare, transport, pregătit stratul suport
-- — cu nume, unitate și preț la un loc, ca să poată fi alese direct în
-- calculatorul de preț.

alter table public.settings
  add column if not exists price_list jsonb not null default '[]'::jsonb;
