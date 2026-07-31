create extension if not exists pgcrypto;

create type public.beneficiary_relation as enum
  ('son', 'daughter', 'wife', 'husband', 'father', 'mother', 'other');
create type public.enrollment_status as enum ('active', 'paused', 'cancelled');
create type public.address_mode as enum ('devotee_primary', 'custom');
create type public.leap_day_policy as enum ('feb_28', 'mar_1', 'leap_year_only');
create type public.occurrence_status as enum
  ('pending', 'prepared', 'packed', 'dispatched', 'exception');

create table public.devotees (
  id uuid primary key default gen_random_uuid(),
  devotee_no text not null unique,
  full_name text not null check (length(trim(full_name)) > 0),
  date_of_birth date,
  phone_primary text,
  phone_alternate text,
  email text,
  rashi text,
  nakshatra text,
  gotra text,
  notes text,
  address_line1 text not null default '',
  address_line2 text,
  address_city text not null default '',
  address_district text,
  address_state text not null default '',
  address_postal_code text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now()
);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  devotee_id uuid not null references public.devotees(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  relation public.beneficiary_relation not null,
  phone text,
  rashi text,
  nakshatra text,
  gotra text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now()
);

create table public.pooja_enrollments (
  id uuid primary key default gen_random_uuid(),
  devotee_id uuid not null references public.devotees(id) on delete restrict,
  for_self boolean not null,
  beneficiary_id uuid references public.beneficiaries(id) on delete restrict,
  annual_month smallint not null check (annual_month between 1 and 12),
  annual_day smallint not null check (annual_day between 1 and 31),
  leap_day_policy public.leap_day_policy not null default 'feb_28',
  address_mode public.address_mode not null default 'devotee_primary',
  custom_address_line1 text,
  custom_address_line2 text,
  custom_address_city text,
  custom_address_district text,
  custom_address_state text,
  custom_address_postal_code text,
  status public.enrollment_status not null default 'active',
  fee_minor integer not null default 100000 check (fee_minor >= 0),
  currency char(3) not null default 'INR',
  payment_reference text,
  enrollment_date date not null default current_date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  constraint pooja_beneficiary_mode_check check (
    (for_self and beneficiary_id is null)
    or (not for_self and beneficiary_id is not null)
  ),
  constraint pooja_custom_address_mode_check check (
    address_mode = 'custom' or (
      custom_address_line1 is null
      and custom_address_line2 is null
      and custom_address_city is null
      and custom_address_district is null
      and custom_address_state is null
      and custom_address_postal_code is null
    )
  ),
  constraint pooja_annual_date_check check (
    annual_day <= case annual_month
      when 2 then 29
      when 4 then 30
      when 6 then 30
      when 9 then 30
      when 11 then 30
      else 31
    end
  )
);

create table public.pooja_occurrences (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.pooja_enrollments(id) on delete restrict,
  service_date date not null,
  recipient_name_snapshot text not null,
  phone_snapshot text,
  address_snapshot_json jsonb not null,
  operational_status public.occurrence_status not null default 'pending',
  generated_at timestamptz not null default now(),
  unique (enrollment_id, service_date)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_json jsonb,
  after_json jsonb,
  occurred_at timestamptz not null default now()
);

create or replace function public.set_modified_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.modified_at = now();
  return new;
end;
$$;

create trigger devotees_set_modified_at
before update on public.devotees
for each row execute function public.set_modified_at();

create trigger beneficiaries_set_modified_at
before update on public.beneficiaries
for each row execute function public.set_modified_at();

create trigger pooja_enrollments_set_modified_at
before update on public.pooja_enrollments
for each row execute function public.set_modified_at();

create or replace function public.enforce_beneficiary_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.for_self and not exists (
    select 1
    from public.beneficiaries b
    where b.id = new.beneficiary_id
      and b.devotee_id = new.devotee_id
      and b.archived_at is null
  ) then
    raise exception 'Beneficiary must belong to the selected devotee';
  end if;
  return new;
end;
$$;

create trigger pooja_enrollment_beneficiary_ownership
before insert or update of devotee_id, beneficiary_id, for_self
on public.pooja_enrollments
for each row execute function public.enforce_beneficiary_ownership();

create index devotees_name_idx on public.devotees using btree (lower(full_name));
create index devotees_phone_idx on public.devotees (phone_primary);
create index devotees_postal_code_idx on public.devotees (address_postal_code);
create index devotees_state_idx on public.devotees (address_state);
create index devotees_rashi_idx on public.devotees (rashi);
create index devotees_nakshatra_idx on public.devotees (nakshatra);
create index devotees_gotra_idx on public.devotees (gotra);
create index beneficiaries_devotee_idx on public.beneficiaries (devotee_id);
create index enrollments_annual_date_idx
  on public.pooja_enrollments (annual_month, annual_day)
  where status = 'active';
create index enrollments_devotee_idx on public.pooja_enrollments (devotee_id);
create index enrollments_beneficiary_idx on public.pooja_enrollments (beneficiary_id);
create index enrollments_custom_postal_code_idx
  on public.pooja_enrollments (custom_address_postal_code)
  where address_mode = 'custom';
create index occurrences_service_date_idx on public.pooja_occurrences (service_date);
create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, occurred_at desc);

alter table public.devotees enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.pooja_enrollments enable row level security;
alter table public.pooja_occurrences enable row level security;
alter table public.audit_events enable row level security;

create policy "staff manage devotees"
on public.devotees for all to authenticated
using (true) with check (true);
create policy "staff manage beneficiaries"
on public.beneficiaries for all to authenticated
using (true) with check (true);
create policy "staff manage enrollments"
on public.pooja_enrollments for all to authenticated
using (true) with check (true);
create policy "staff manage occurrences"
on public.pooja_occurrences for all to authenticated
using (true) with check (true);
create policy "staff read audit events"
on public.audit_events for select to authenticated using (true);
create policy "staff append audit events"
on public.audit_events for insert to authenticated with check (actor_id = auth.uid());

revoke update, delete on public.audit_events from authenticated;
revoke delete on public.pooja_occurrences from authenticated;
revoke delete on public.devotees from authenticated;
revoke delete on public.beneficiaries from authenticated;
revoke delete on public.pooja_enrollments from authenticated;
