-- Stable human-readable production references. UUID columns remain the internal
-- primary/foreign keys; these references are for staff search and paperwork.

create sequence if not exists public.devotee_number_seq start with 1;

create or replace function public.next_devotee_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := 'KDP-DEV-' || lpad(nextval('public.devotee_number_seq')::text, 6, '0');
    exit when not exists (
      select 1 from public.devotees where devotee_no = candidate
    );
  end loop;
  return candidate;
end;
$$;

alter table public.devotees
  alter column devotee_no set default public.next_devotee_number();

-- Convert validation/legacy references before enforcing the production format.
-- Existing valid KDP references retain their number; invalid references continue
-- after the greatest valid number to avoid collisions.
with existing_max as (
  select coalesce(max(substring(devotee_no from '([0-9]{6})$')::integer), 0) as value
  from public.devotees
  where devotee_no ~ '^KDP-DEV-[0-9]{6}$'
), invalid_numbered as (
  select
    id,
    row_number() over (order by created_at, id) + existing_max.value as sequence_value
  from public.devotees
  cross join existing_max
  where devotee_no !~ '^KDP-DEV-[0-9]{6}$'
)
update public.devotees devotee
set devotee_no = 'KDP-DEV-' || lpad(invalid_numbered.sequence_value::text, 6, '0')
from invalid_numbered
where devotee.id = invalid_numbered.id;

select case
  when coalesce(max(substring(devotee_no from '([0-9]{6})$')::bigint), 0) = 0
    then setval('public.devotee_number_seq', 1, false)
  else setval(
    'public.devotee_number_seq',
    max(substring(devotee_no from '([0-9]{6})$')::bigint),
    true
  )
end
from public.devotees
where devotee_no ~ '^KDP-DEV-[0-9]{6}$';

alter table public.devotees
  add constraint devotees_production_number_format
  check (devotee_no ~ '^KDP-DEV-[0-9]{6}$');

alter table public.pooja_enrollments add column pooja_no text;

with numbered as (
  select
    id,
    'KDP-SP-' || lpad(annual_day::text, 2, '0') || lpad(annual_month::text, 2, '0') || '-' ||
      lpad(row_number() over (
        partition by annual_month, annual_day
        order by created_at, id
      )::text, 4, '0') as generated_no
  from public.pooja_enrollments
)
update public.pooja_enrollments enrollment
set pooja_no = numbered.generated_no
from numbered
where enrollment.id = numbered.id;

alter table public.pooja_enrollments
  alter column pooja_no set not null,
  add constraint pooja_enrollments_pooja_no_unique unique (pooja_no),
  add constraint pooja_enrollments_production_number_format
    check (pooja_no ~ '^KDP-SP-[0-9]{4}-[0-9]{4}$');

create table public.pooja_number_counters (
  annual_month smallint not null check (annual_month between 1 and 12),
  annual_day smallint not null check (annual_day between 1 and 31),
  last_value integer not null check (last_value between 1 and 9999),
  primary key (annual_month, annual_day)
);

insert into public.pooja_number_counters (annual_month, annual_day, last_value)
select annual_month, annual_day, count(*)::integer
from public.pooja_enrollments
group by annual_month, annual_day;

create or replace function public.next_pooja_number(target_month smallint, target_day smallint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  sequence_value integer;
begin
  insert into public.pooja_number_counters (annual_month, annual_day, last_value)
  values (target_month, target_day, 1)
  on conflict (annual_month, annual_day)
  do update set last_value = public.pooja_number_counters.last_value + 1
  returning last_value into sequence_value;

  if sequence_value > 9999 then
    raise exception 'POOJA_NUMBER_LIMIT_REACHED' using errcode = '22003';
  end if;

  return 'KDP-SP-' || lpad(target_day::text, 2, '0') ||
    lpad(target_month::text, 2, '0') || '-' || lpad(sequence_value::text, 4, '0');
end;
$$;

create or replace function public.assign_pooja_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.pooja_no is null then
    new.pooja_no := public.next_pooja_number(new.annual_month, new.annual_day);
  elsif tg_op = 'UPDATE' and
    (new.annual_month, new.annual_day) is distinct from (old.annual_month, old.annual_day) then
    new.pooja_no := public.next_pooja_number(new.annual_month, new.annual_day);
  end if;
  return new;
end;
$$;

create trigger assign_pooja_number_before_write
before insert or update of annual_month, annual_day on public.pooja_enrollments
for each row execute function public.assign_pooja_number();

revoke all on table public.pooja_number_counters from public, anon, authenticated;
revoke all on function public.next_devotee_number() from public, anon, authenticated;
revoke all on function public.next_pooja_number(smallint, smallint) from public, anon, authenticated;
