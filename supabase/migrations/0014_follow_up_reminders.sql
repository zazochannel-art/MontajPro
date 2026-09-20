-- Revenirea la client și garanția lucrării.
--
-- Motorul din aplicație le calculează deja; regulile astea sunt pentru push,
-- care rulează pe server și trebuie să meargă cu telefonul închis.

create or replace function public.due_reminders()
returns table (
  user_id uuid,
  kind text,
  title text,
  body text,
  job_id uuid
)
language sql
security definer
set search_path = ''
stable
as $$
  -- Lucrări programate azi sau mâine
  select j.user_id,
         case when j.scheduled_date = current_date then 'job_today' else 'job_tomorrow' end,
         case when j.scheduled_date = current_date then 'Lucrare astăzi' else 'Lucrare mâine' end,
         j.title || coalesce(' — ' || c.name, '') ||
           coalesce(', ora ' || j.scheduled_time, ''),
         j.id
  from public.jobs j
  left join public.clients c on c.id = j.client_id and c.deleted_at is null
  where j.deleted_at is null
    and j.status <> 'done'
    and j.scheduled_date in (current_date, current_date + 1)

  union all

  -- Lucrări finalizate cu bani neîncasați
  select j.user_id,
         'payment_due',
         'Plată restantă',
         j.title || ': ' || to_char(j.price_total - coalesce(p.paid, 0), 'FM999999990') ||
           ' de încasat',
         j.id
  from public.jobs j
  left join (
    select job_id, sum(amount) as paid
    from public.payments
    where deleted_at is null
    group by job_id
  ) p on p.job_id = j.id
  where j.deleted_at is null
    and j.status = 'done'
    and j.price_total - coalesce(p.paid, 0) > 0.5
    and j.end_date >= current_date - 60

  union all

  -- Oferte trimise și neconfirmate de mai bine de trei zile
  select q.user_id,
         'quote_pending',
         'Ofertă neconfirmată',
         q.title || ' — trimisă pe ' || to_char(q.sent_at, 'DD.MM'),
         q.job_id
  from public.quotes q
  where q.deleted_at is null
    and q.status = 'sent'
    and q.sent_at < now() - interval '3 days'
    and q.sent_at > now() - interval '30 days'

  union all

  -- Revino la client: șase luni de la o lucrare terminată
  select j.user_id,
         'follow_up',
         'Sună clientul',
         coalesce(c.name, 'Client') || ' — au trecut 6 luni de la „' || j.title || '”',
         j.id
  from public.jobs j
  left join public.clients c on c.id = j.client_id and c.deleted_at is null
  where j.deleted_at is null
    and j.status = 'done'
    and j.end_date between current_date - 210 and current_date - 180

  union all

  -- Garanția lucrării stă să expire
  select h.user_id,
         'job_warranty',
         'Garanția lucrării expiră',
         coalesce(h.client_name, 'Lucrare') || ' — garanția expiră pe ' ||
           to_char((h.handed_at + (h.warranty_months || ' months')::interval)::date, 'DD.MM.YYYY'),
         h.job_id
  from public.handovers h
  where h.deleted_at is null
    and h.warranty_months is not null
    and (h.handed_at + (h.warranty_months || ' months')::interval)::date
        between current_date and current_date + 30;
$$;

-- Drepturile rămân cum le-am pus: funcția e internă, doar `service_role` o
-- cheamă, din funcția Edge.
revoke all on function public.due_reminders() from public;
revoke execute on function public.due_reminders() from anon, authenticated;
grant execute on function public.due_reminders() to service_role;
