-- De ce n-a ieșit oferta.
--
-- Se ține ca text, nu ca enum: lista de motive se mai lungește, iar o
-- migrație pentru fiecare motiv nou n-ar merita. Valorile scrise de aplicație
-- sunt cele din `REJECT_REASONS`; orice altceva se citește ca „fără motiv”,
-- deci un rând vechi sau stricat nu dărâmă socoteala.
alter table public.quotes
  add column if not exists rejected_reason text;

comment on column public.quotes.rejected_reason is
  'Motivul refuzului: price, timing, competitor, postponed, no_answer, other.';
