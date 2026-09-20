-- Data scrisă peste poză.
--
-- O poză „înainte” fără dată nu ține loc de dovadă: oricine poate spune că e
-- de altădată. Pornită implicit, se poate opri din Setări.

alter table public.settings
  add column if not exists photo_stamp boolean not null default true;
