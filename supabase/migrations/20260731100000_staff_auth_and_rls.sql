create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  role text not null default 'admin' check (role in ('admin')),
  is_active boolean not null default false,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  constraint staff_deactivation_consistency check (
    (is_active and deactivated_at is null)
    or (not is_active)
  )
);

create trigger staff_profiles_set_modified_at
before update on public.staff_profiles
for each row execute function public.set_modified_at();

create or replace function public.create_staff_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_profiles (user_id, display_name, is_active)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'Temple Staff'), '@', 1)
    ),
    false
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_create_staff_profile
after insert on auth.users
for each row execute function public.create_staff_profile_for_auth_user();

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles
    where user_id = auth.uid()
      and is_active = true
  );
$$;

grant execute on function public.is_active_staff() to authenticated;

alter table public.staff_profiles enable row level security;

drop policy if exists "staff manage devotees" on public.devotees;
drop policy if exists "staff manage beneficiaries" on public.beneficiaries;
drop policy if exists "staff manage enrollments" on public.pooja_enrollments;
drop policy if exists "staff manage occurrences" on public.pooja_occurrences;
drop policy if exists "staff read audit events" on public.audit_events;
drop policy if exists "staff append audit events" on public.audit_events;

create policy "active staff read staff profiles"
on public.staff_profiles for select to authenticated
using (public.is_active_staff());

create policy "active staff update staff profiles"
on public.staff_profiles for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "active staff select devotees"
on public.devotees for select to authenticated
using (public.is_active_staff());
create policy "active staff insert devotees"
on public.devotees for insert to authenticated
with check (public.is_active_staff());
create policy "active staff update devotees"
on public.devotees for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "active staff select beneficiaries"
on public.beneficiaries for select to authenticated
using (public.is_active_staff());
create policy "active staff insert beneficiaries"
on public.beneficiaries for insert to authenticated
with check (public.is_active_staff());
create policy "active staff update beneficiaries"
on public.beneficiaries for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "active staff select enrollments"
on public.pooja_enrollments for select to authenticated
using (public.is_active_staff());
create policy "active staff insert enrollments"
on public.pooja_enrollments for insert to authenticated
with check (public.is_active_staff());
create policy "active staff update enrollments"
on public.pooja_enrollments for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "active staff select occurrences"
on public.pooja_occurrences for select to authenticated
using (public.is_active_staff());
create policy "active staff insert occurrences"
on public.pooja_occurrences for insert to authenticated
with check (public.is_active_staff());
create policy "active staff update occurrences"
on public.pooja_occurrences for update to authenticated
using (public.is_active_staff())
with check (public.is_active_staff());

create policy "active staff read audit events"
on public.audit_events for select to authenticated
using (public.is_active_staff());
create policy "active staff append own audit events"
on public.audit_events for insert to authenticated
with check (public.is_active_staff() and actor_id = auth.uid());

alter table public.devotees
  add column phone_primary_normalized text
  generated always as (
    regexp_replace(coalesce(phone_primary, ''), '[^0-9]', '', 'g')
  ) stored,
  add column phone_alternate_normalized text
  generated always as (
    regexp_replace(coalesce(phone_alternate, ''), '[^0-9]', '', 'g')
  ) stored;

alter table public.beneficiaries
  add column phone_normalized text
  generated always as (
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
  ) stored;

create index devotees_phone_primary_normalized_idx
  on public.devotees (phone_primary_normalized);
create index devotees_phone_alternate_normalized_idx
  on public.devotees (phone_alternate_normalized);
create index beneficiaries_phone_normalized_idx
  on public.beneficiaries (phone_normalized);

revoke delete on public.staff_profiles from authenticated;
