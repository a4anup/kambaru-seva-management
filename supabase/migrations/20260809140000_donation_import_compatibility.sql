alter table public.donations alter column donor_name drop not null;
alter table public.donations drop constraint donations_donor_name_check;
alter table public.donations drop constraint donations_payment_method_check;
alter table public.donations add constraint donations_payment_method_check
  check (payment_method is null or payment_method in ('Cash', 'UPI', 'Bank', 'Bank Transfer', 'Cheque', 'Other'));
alter table public.donations add constraint donations_reviewed_donor_required_check
  check (review_status = 'review_required' or nullif(trim(donor_name), '') is not null);

create function public.normalize_optional_donation_donor()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.donor_name := nullif(trim(new.donor_name), '');
  return new;
end; $$;

create trigger donations_normalize_optional_donor
before insert or update on public.donations for each row
execute function public.normalize_optional_donation_donor();
