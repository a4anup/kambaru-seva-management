-- Server-side read models for Labels and Reports so neither page needs to loop
-- through the whole devotee/enrollment tables client-side. Mirrors the pattern
-- already used by devotee_directory_page / pooja_register_page.

create or replace function public.label_recipients(
  filter_mode text,
  target_date date default current_date,
  range_from date default null,
  range_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      e.id,
      case when e.for_self then d.full_name else coalesce(b.full_name, d.full_name) end as name,
      case when e.for_self then d.phone_primary else coalesce(b.phone, d.phone_primary) end as phone,
      case when e.address_mode = 'custom' then e.custom_address_line1 else d.address_line1 end as address_line,
      case when e.address_mode = 'custom' then e.custom_address_line2 else d.address_line2 end as address_line2,
      case when e.address_mode = 'custom' then e.custom_address_city else d.address_city end as city,
      case when e.address_mode = 'custom' then e.custom_address_state else d.address_state end as state,
      case when e.address_mode = 'custom' then e.custom_address_postal_code else d.address_postal_code end as postal_code
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
    where e.status = 'active'
      and (
        case filter_mode
          when 'range' then range_from is not null and range_to is not null and exists (
            select 1 from generate_series(0, greatest(range_to - range_from, 0)) n
            where public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, range_from + n)
          )
          else public.annual_pooja_matches_date(e.annual_month, e.annual_day, e.leap_day_policy, target_date)
        end
      )
  )
  select coalesce(jsonb_agg(to_jsonb(base) order by name), '[]'::jsonb) from base;
$$;

create or replace function public.label_invitation_recipients(scope text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select
      'devotee-' || d.id::text as id,
      d.full_name as name,
      d.phone_primary as phone,
      d.address_line1 as address_line,
      d.address_line2 as address_line2,
      d.address_city as city,
      d.address_state as state,
      d.address_postal_code as postal_code
    from public.devotees d
    where d.archived_at is null
      and scope in ('all', 'devotees')
    union all
    select
      'beneficiary-' || e.id::text as id,
      case when e.for_self then d.full_name else coalesce(b.full_name, d.full_name) end as name,
      case when e.for_self then d.phone_primary else coalesce(b.phone, d.phone_primary) end as phone,
      case when e.address_mode = 'custom' then e.custom_address_line1 else d.address_line1 end as address_line,
      case when e.address_mode = 'custom' then e.custom_address_line2 else d.address_line2 end as address_line2,
      case when e.address_mode = 'custom' then e.custom_address_city else d.address_city end as city,
      case when e.address_mode = 'custom' then e.custom_address_state else d.address_state end as state,
      case when e.address_mode = 'custom' then e.custom_address_postal_code else d.address_postal_code end as postal_code
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
    where e.status = 'active'
      and scope in ('all', 'beneficiaries')
  ), keyed as (
    select
      *,
      coalesce(
        nullif(regexp_replace(lower(concat_ws('|', address_line, address_line2, city, state, postal_code)), '[^a-z0-9|]', '', 'g'), ''),
        'missing-' || id
      ) as dedup_key
    from candidates
  ), deduped as (
    select distinct on (dedup_key) id, name, phone, address_line, address_line2, city, state, postal_code
    from keyed
    order by dedup_key, name
  )
  select coalesce(jsonb_agg(to_jsonb(deduped) order by name), '[]'::jsonb) from deduped;
$$;

create or replace function public.report_query(
  from_date date default null,
  to_date date default null,
  search_text text default null,
  filter_pincode text default null,
  filter_state text default null,
  filter_rashi text default null,
  filter_gotra text default null,
  filter_nakshatra text default null,
  filter_relation text default null,
  filter_address_mode text default null,
  filter_status text default null,
  group_by text default 'date',
  page_size integer default 25,
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
      e.id as enrollment_id,
      d.devotee_no,
      d.full_name as sponsor_name,
      case when e.for_self then d.full_name else coalesce(b.full_name, d.full_name) end as beneficiary_name,
      case when e.for_self then 'Self' else initcap(coalesce(b.relation::text, 'other')) end as relation,
      case when e.for_self then d.phone_primary else coalesce(b.phone, d.phone_primary) end as phone,
      coalesce(b.rashi, d.rashi, '') as rashi,
      coalesce(b.nakshatra, d.nakshatra, '') as nakshatra,
      coalesce(b.gotra, d.gotra, '') as gotra,
      case when e.address_mode = 'custom' then coalesce(nullif(e.custom_address_city, ''), d.address_city) else d.address_city end as address_city,
      coalesce(nullif(case when e.address_mode = 'custom' then e.custom_address_state else d.address_state end, ''), d.address_state) as state,
      case when e.address_mode = 'custom' then coalesce(nullif(e.custom_address_postal_code, ''), d.address_postal_code) else d.address_postal_code end as postal_code,
      e.address_mode,
      e.status,
      e.annual_month,
      e.annual_day,
      (extract(year from current_date)::text || '-' || lpad(e.annual_month::text, 2, '0') || '-' || lpad(e.annual_day::text, 2, '0')) as annual_date_text
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
  ), filtered as (
    select * from base
    where
      (from_date is null or annual_date_text >= from_date::text)
      and (to_date is null or annual_date_text <= to_date::text)
      and (nullif(trim(search_text), '') is null or
        sponsor_name ilike '%' || trim(search_text) || '%'
        or beneficiary_name ilike '%' || trim(search_text) || '%'
        or devotee_no ilike '%' || trim(search_text) || '%'
        or coalesce(phone, '') ilike '%' || trim(search_text) || '%')
      and (nullif(filter_pincode, '') is null or postal_code = filter_pincode)
      and (nullif(filter_state, '') is null or state = filter_state)
      and (nullif(filter_rashi, '') is null or rashi = filter_rashi)
      and (nullif(filter_gotra, '') is null or gotra = filter_gotra)
      and (nullif(filter_nakshatra, '') is null or nakshatra = filter_nakshatra)
      and (nullif(filter_relation, '') is null or relation = filter_relation)
      and (nullif(filter_address_mode, '') is null or address_mode::text = filter_address_mode)
      and (nullif(filter_status, '') is null or status::text = filter_status)
  ), page_rows as (
    select * from filtered
    order by annual_month, annual_day, lower(beneficiary_name), enrollment_id
    limit least(greatest(page_size, 1), 200)
    offset greatest(page_offset, 0)
  ), groups as (
    select
      case group_by
        when 'pincode' then coalesce(nullif(postal_code, ''), 'Missing PIN')
        when 'devotee' then sponsor_name
        when 'rashi' then coalesce(nullif(rashi, ''), 'Not provided')
        when 'gotra' then coalesce(nullif(gotra, ''), 'Not provided')
        when 'nakshatra' then coalesce(nullif(nakshatra, ''), 'Not provided')
        when 'state' then coalesce(nullif(state, ''), 'Not provided')
        else to_char(make_date(2028, annual_month, 1), 'DD Mon') || ' ' || lpad(annual_day::text, 2, '0')
      end as group_label,
      count(*) as group_count
    from filtered
    group by 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'activeCount', (select count(*) from filtered where status = 'active'),
    'uniqueDevotees', (select count(distinct devotee_no) from filtered),
    'incompleteCount', (select count(*) from filtered where coalesce(phone, '') = '' or coalesce(postal_code, '') = ''),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('label', group_label, 'count', group_count) order by group_count desc, group_label) from groups), '[]'::jsonb),
    'filterOptions', jsonb_build_object(
      'states', coalesce((select jsonb_agg(distinct state order by state) from filtered where nullif(state, '') is not null), '[]'::jsonb),
      'rashis', coalesce((select jsonb_agg(distinct rashi order by rashi) from filtered where nullif(rashi, '') is not null), '[]'::jsonb),
      'gotras', coalesce((select jsonb_agg(distinct gotra order by gotra) from filtered where nullif(gotra, '') is not null), '[]'::jsonb),
      'nakshatras', coalesce((select jsonb_agg(distinct nakshatra order by nakshatra) from filtered where nullif(nakshatra, '') is not null), '[]'::jsonb),
      'pincodes', coalesce((select jsonb_agg(distinct postal_code order by postal_code) from filtered where nullif(postal_code, '') is not null), '[]'::jsonb)
    )
  );
$$;

create or replace function public.report_export_rows(
  from_date date default null,
  to_date date default null,
  search_text text default null,
  filter_pincode text default null,
  filter_state text default null,
  filter_rashi text default null,
  filter_gotra text default null,
  filter_nakshatra text default null,
  filter_relation text default null,
  filter_address_mode text default null,
  filter_status text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select
      e.id as enrollment_id,
      d.devotee_no,
      d.full_name as sponsor_name,
      case when e.for_self then d.full_name else coalesce(b.full_name, d.full_name) end as beneficiary_name,
      case when e.for_self then 'Self' else initcap(coalesce(b.relation::text, 'other')) end as relation,
      case when e.for_self then d.phone_primary else coalesce(b.phone, d.phone_primary) end as phone,
      coalesce(b.rashi, d.rashi, '') as rashi,
      coalesce(b.nakshatra, d.nakshatra, '') as nakshatra,
      coalesce(b.gotra, d.gotra, '') as gotra,
      case when e.address_mode = 'custom' then coalesce(nullif(e.custom_address_city, ''), d.address_city) else d.address_city end as address_city,
      coalesce(nullif(case when e.address_mode = 'custom' then e.custom_address_state else d.address_state end, ''), d.address_state) as state,
      case when e.address_mode = 'custom' then coalesce(nullif(e.custom_address_postal_code, ''), d.address_postal_code) else d.address_postal_code end as postal_code,
      e.address_mode,
      e.status,
      e.annual_month,
      e.annual_day,
      (extract(year from current_date)::text || '-' || lpad(e.annual_month::text, 2, '0') || '-' || lpad(e.annual_day::text, 2, '0')) as annual_date_text
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
  ), filtered as (
    select * from base
    where
      (from_date is null or annual_date_text >= from_date::text)
      and (to_date is null or annual_date_text <= to_date::text)
      and (nullif(trim(search_text), '') is null or
        sponsor_name ilike '%' || trim(search_text) || '%'
        or beneficiary_name ilike '%' || trim(search_text) || '%'
        or devotee_no ilike '%' || trim(search_text) || '%'
        or coalesce(phone, '') ilike '%' || trim(search_text) || '%')
      and (nullif(filter_pincode, '') is null or postal_code = filter_pincode)
      and (nullif(filter_state, '') is null or state = filter_state)
      and (nullif(filter_rashi, '') is null or rashi = filter_rashi)
      and (nullif(filter_gotra, '') is null or gotra = filter_gotra)
      and (nullif(filter_nakshatra, '') is null or nakshatra = filter_nakshatra)
      and (nullif(filter_relation, '') is null or relation = filter_relation)
      and (nullif(filter_address_mode, '') is null or address_mode::text = filter_address_mode)
      and (nullif(filter_status, '') is null or status::text = filter_status)
  ), capped as (
    select * from filtered
    order by annual_month, annual_day, lower(beneficiary_name)
    limit 20000
  )
  select coalesce(jsonb_agg(to_jsonb(capped) order by annual_month, annual_day, lower(beneficiary_name)), '[]'::jsonb)
  from capped;
$$;

grant execute on function public.label_recipients(text, date, date, date) to authenticated;
grant execute on function public.label_invitation_recipients(text) to authenticated;
grant execute on function public.report_query(date, date, text, text, text, text, text, text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.report_export_rows(date, date, text, text, text, text, text, text, text, text, text) to authenticated;
