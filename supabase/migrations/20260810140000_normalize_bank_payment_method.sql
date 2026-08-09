insert into public.audit_events(actor_id, action, entity_type, entity_id, before_json, after_json)
select null, 'normalized_payment_method', 'donation', id, to_jsonb(d),
  to_jsonb(d) || jsonb_build_object('payment_method', 'Bank')
from public.donations d
where payment_method = 'Bank Transfer';

alter table public.donations disable trigger donations_reset_review_after_material_change;

update public.donations
set payment_method = 'Bank'
where payment_method = 'Bank Transfer';

alter table public.donations enable trigger donations_reset_review_after_material_change;

alter table public.donations drop constraint if exists donations_payment_method_check;
alter table public.donations add constraint donations_payment_method_check
  check (payment_method is null or payment_method in ('Cash', 'UPI', 'Bank', 'Cheque', 'Other'));
