-- Production read models: keep filtering, counting, joining and pagination in
-- PostgreSQL so operational pages never need to download whole tables.

create or replace function public.annual_pooja_matches_date(
  annual_month integer,
  annual_day integer,
  policy public.leap_day_policy,
  service_date date
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select
    (annual_month = extract(month from service_date)::integer and annual_day = extract(day from service_date)::integer)
    or (
      annual_month = 2 and annual_day = 29
      and extract(month from service_date)::integer = case policy when 'mar_1' then 3 else 2 end
      and extract(day from service_date)::integer = case policy when 'mar_1' then 1 else 28 end
      and extract(day from (make_date(extract(year from service_date)::integer, 3, 1) - 1))::integer = 28
      and policy <> 'leap_year_only'
    );
$$;

create or replace function public.devotee_directory_page(
  search_text text default null,
  initial_letter text default null,
  page_size integer default 10,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      d.*,
      count(e.id) filter (where e.status = 'active')::integer as pooja_count
    from public.devotees d
    left join public.pooja_enrollments e on e.devotee_id = d.id
    where d.archived_at is null
      and (
        nullif(trim(search_text), '') is null
        or d.full_name ilike '%' || trim(search_text) || '%'
        or d.devotee_no ilike '%' || trim(search_text) || '%'
        or coalesce(d.phone_primary, '') ilike '%' || trim(search_text) || '%'
        or coalesce(d.address_city, '') ilike '%' || trim(search_text) || '%'
      )
      and (
        nullif(upper(trim(initial_letter)), '') is null
        or upper(left(trim(d.full_name), 1)) = upper(trim(initial_letter))
      )
    group by d.id
  ), page_rows as (
    select * from filtered
    order by lower(full_name), id
    limit least(greatest(page_size, 1), 100)
    offset greatest(page_offset, 0)
  ), letter_counts as (
    select upper(left(trim(d.full_name), 1)) as letter, count(*)::integer as count
    from public.devotees d
    where d.archived_at is null
    group by upper(left(trim(d.full_name), 1))
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by lower(p.full_name), p.id) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'allTotal', (select count(*) from public.devotees where archived_at is null),
    'letterCounts', coalesce((select jsonb_object_agg(letter, count) from letter_counts), '{}'::jsonb)
  );
$$;

create or replace function public.pooja_register_page(
  filter_mode text default 'today',
  target_date date default current_date,
  search_text text default null,
  page_size integer default 10,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      e.*,
      d.devotee_no,
      d.full_name as sponsor_name,
      d.phone_primary,
      d.rashi as devotee_rashi,
      d.nakshatra as devotee_nakshatra,
      d.gotra as devotee_gotra,
      d.address_line1 as devotee_address_line1,
      d.address_line2 as devotee_address_line2,
      d.address_city as devotee_address_city,
      d.address_district as devotee_address_district,
      d.address_state as devotee_address_state,
      d.address_postal_code as devotee_address_postal_code,
      b.full_name as beneficiary_name,
      b.relation as beneficiary_relation,
      b.phone as beneficiary_phone,
      b.rashi as beneficiary_rashi,
      b.nakshatra as beneficiary_nakshatra,
      b.gotra as beneficiary_gotra,
      b.notes as beneficiary_notes
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
    where
      case filter_mode
        when 'today' then public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, target_date)
        when 'tomorrow' then public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, target_date + 1)
        when 'month' then e.annual_month = extract(month from target_date)::int
        when 'week' then exists (
          select 1 from generate_series(0, 6) n
          where public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, date_trunc('week', target_date::timestamp)::date + n)
        )
        when 'custom' then public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, target_date)
        else true
      end
      and (
        nullif(trim(search_text), '') is null
        or d.full_name ilike '%' || trim(search_text) || '%'
        or coalesce(b.full_name, d.full_name) ilike '%' || trim(search_text) || '%'
        or coalesce(d.phone_primary, '') ilike '%' || trim(search_text) || '%'
        or d.devotee_no ilike '%' || trim(search_text) || '%'
        or e.pooja_no ilike '%' || trim(search_text) || '%'
      )
  ), page_rows as (
    select * from base
    order by annual_month, annual_day, lower(coalesce(beneficiary_name, sponsor_name)), id
    limit least(greatest(page_size, 1), 100)
    offset greatest(page_offset, 0)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by p.annual_month, p.annual_day, lower(coalesce(p.beneficiary_name, p.sponsor_name)), p.id) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from base)
  );
$$;

create or replace function public.pooja_calendar_counts(target_year integer, target_month integer)
returns table(annual_day integer, pooja_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.annual_day::integer, count(*)
  from public.pooja_enrollments e
  join public.devotees d on d.id = e.devotee_id and d.archived_at is null
  where e.status = 'active' and e.annual_month = target_month
  group by e.annual_day
  order by e.annual_day;
$$;

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
    'dailyCounts', (select jsonb_agg(jsonb_build_object('date', service_date, 'count', pooja_count) order by service_date) from daily)
  );
$$;

-- Search patterns use ILIKE; trigram indexes keep partial name/ID searches fast
-- as the directory grows beyond tens of thousands of rows.
create extension if not exists pg_trgm;
create index if not exists devotees_name_trgm_idx on public.devotees using gin (full_name gin_trgm_ops);
create index if not exists devotees_number_trgm_idx on public.devotees using gin (devotee_no gin_trgm_ops);
create index if not exists beneficiaries_name_trgm_idx on public.beneficiaries using gin (full_name gin_trgm_ops);
create index if not exists enrollments_number_trgm_idx on public.pooja_enrollments using gin (pooja_no gin_trgm_ops);
create index if not exists enrollments_status_date_idx on public.pooja_enrollments (status, annual_month, annual_day);

grant execute on function public.devotee_directory_page(text, text, integer, integer) to authenticated;
grant execute on function public.annual_pooja_matches_date(integer, integer, public.leap_day_policy, date) to authenticated;
grant execute on function public.pooja_register_page(text, date, text, integer, integer) to authenticated;
grant execute on function public.pooja_calendar_counts(integer, integer) to authenticated;
grant execute on function public.dashboard_summary(date) to authenticated;
