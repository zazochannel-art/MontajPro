-- Trei coloane mici, cu trei motive diferite.

-- 1. Banii statului.
--
-- Din fiecare încasare, o parte nu e a ta. Nimeni n-o separă, iar în aprilie
-- suma apare dintr-o dată, întreagă. Procentul stă aici, iar aplicația arată
-- cât ai de pus deoparte pe lună și pe an.
alter table public.settings
  add column if not exists tax_percent numeric(5, 2) not null default 0;

-- 2. Limba interfeței.
--
-- Jumătate din Moldova lucrează în rusă. Preferința ține de om, nu de telefon,
-- deci merge cu contul.
alter table public.settings
  add column if not exists language text not null default 'ro';

-- 3. Mementoul trimis clientului pentru o ofertă neconfirmată.
--
-- Ca să nu dai ghes de trei ori în aceeași zi fără să-ți amintești.
alter table public.quotes
  add column if not exists reminder_sent_at timestamptz;
