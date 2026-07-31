-- Add today's missing-phone/missing-pincode/missing-address counts to the
-- dashboard summary, computed in Postgres against every matching enrollment
-- for the day (not just the first page shown in the Today's Poojas table).

create or replace function public.dashboard_summary(target_date date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with dates as (
    select (target_date + n)::date as service_date from generate_series(0, 5) n
  ), daily as (
    select dt.service_date, count(e.id)::integer as pooja_count
    from dates dt
    left join public.pooja_enrollments e
      on e.status = 'active'
      and public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, dt.service_date)
    group by dt.service_date
  ), today_rows as (
    select
      case when e.address_mode = 'custom' then e.custom_address_line1 else d.address_line1 end as address_line1,
      case when e.address_mode = 'custom' then e.custom_address_postal_code else d.address_postal_code end as postal_code,
      d.phone_primary
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    where e.status = 'active'
      and public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, target_date)
  )
  select jsonb_build_object(
    'todayCount', (select pooja_count from daily where service_date = target_date),
    'weekCount', (
      select count(*) from public.pooja_enrollments e
      where e.status = 'active' and exists (
        select 1 from generate_series(0, 6) n
        where public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, date_trunc('week', target_date::timestamp)::date + n)
      )
    ),
    'activeCount', (select count(*) from public.pooja_enrollments where status = 'active'),
    'devoteeCount', (select count(*) from public.devotees where archived_at is null),
    'dailyCounts', (select jsonb_agg(jsonb_build_object('date', service_date, 'count', pooja_count) order by service_date) from daily),
    'missingPhoneCount', (select count(*) from today_rows where coalesce(trim(phone_primary), '') = ''),
    'missingPincodeCount', (select count(*) from today_rows where coalesce(postal_code, '') !~ '^[0-9]{6}$'),
    'missingAddressCount', (select count(*) from today_rows where coalesce(trim(address_line1), '') = '')
  );
$$;
