create or replace function public.archive_pooja_enrollment(
  target_enrollment_id uuid,
  expected_modified_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_record public.pooja_enrollments;
  saved_record public.pooja_enrollments;
begin
  if not public.is_active_staff() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into previous_record
  from public.pooja_enrollments
  where id = target_enrollment_id
  for update;

  if not found then
    raise exception 'ENROLLMENT_NOT_FOUND';
  end if;
  if previous_record.modified_at <> expected_modified_at then
    raise exception 'STALE_RECORD';
  end if;

  update public.pooja_enrollments
  set status = 'cancelled'
  where id = target_enrollment_id
  returning * into saved_record;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, before_json, after_json
  ) values (
    auth.uid(), 'archived', 'pooja_enrollment', saved_record.id,
    to_jsonb(previous_record), to_jsonb(saved_record)
  );

  return true;
end;
$$;

grant execute on function public.archive_pooja_enrollment(uuid, timestamptz) to authenticated;

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
    where e.status <> 'cancelled'
      and case filter_mode
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
        or coalesce(e.receipt_number, '') ilike '%' || trim(search_text) || '%'
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

