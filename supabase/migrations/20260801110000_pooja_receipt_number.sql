-- Add a manually-entered receipt number (physical receipt book slip number),
-- distinct from the free-text payment_reference (e.g. UPI/bank transaction id).

alter table public.pooja_enrollments add column receipt_number text;

create index if not exists enrollments_receipt_number_trgm_idx
  on public.pooja_enrollments using gin (receipt_number gin_trgm_ops);

create or replace function public.create_pooja_enrollment(input_payload jsonb)
returns public.pooja_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_devotee_id uuid;
  resolved_beneficiary_id uuid;
  created_devotee public.devotees;
  created_beneficiary public.beneficiaries;
  created_enrollment public.pooja_enrollments;
  beneficiary_payload jsonb;
begin
  if not public.is_active_staff() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if input_payload ? 'devoteeId' then
    resolved_devotee_id := (input_payload->>'devoteeId')::uuid;
    if not exists (
      select 1 from public.devotees d
      where d.id = resolved_devotee_id and d.archived_at is null
    ) then
      raise exception 'DEVOTEE_NOT_FOUND' using errcode = 'P0002';
    end if;
  elsif input_payload ? 'newDevotee' then
    created_devotee := public.create_devotee(input_payload->'newDevotee');
    resolved_devotee_id := created_devotee.id;
  else
    raise exception 'DEVOTEE_REQUIRED' using errcode = '22023';
  end if;

  if coalesce((input_payload->>'forSelf')::boolean, false) = false then
    beneficiary_payload := input_payload->'beneficiary';
    if beneficiary_payload is null or nullif(trim(beneficiary_payload->>'fullName'), '') is null then
      raise exception 'BENEFICIARY_REQUIRED' using errcode = '22023';
    end if;

    if beneficiary_payload ? 'id' then
      resolved_beneficiary_id := (beneficiary_payload->>'id')::uuid;
      if not exists (
        select 1 from public.beneficiaries b
        where b.id = resolved_beneficiary_id
          and b.devotee_id = resolved_devotee_id
          and b.archived_at is null
      ) then
        raise exception 'BENEFICIARY_NOT_FOUND' using errcode = 'P0002';
      end if;
    else
      insert into public.beneficiaries (
        devotee_id, full_name, relation, phone, rashi, nakshatra, gotra, notes
      ) values (
        resolved_devotee_id,
        trim(beneficiary_payload->>'fullName'),
        (beneficiary_payload->>'relation')::public.beneficiary_relation,
        nullif(trim(beneficiary_payload->>'phone'), ''),
        nullif(trim(beneficiary_payload->>'rashi'), ''),
        nullif(trim(beneficiary_payload->>'nakshatra'), ''),
        nullif(trim(beneficiary_payload->>'gotra'), ''),
        nullif(trim(beneficiary_payload->>'notes'), '')
      ) returning * into created_beneficiary;
      resolved_beneficiary_id := created_beneficiary.id;
    end if;
  end if;

  insert into public.pooja_enrollments (
    devotee_id, for_self, beneficiary_id, annual_month, annual_day,
    address_mode, custom_address_line1, custom_address_line2,
    custom_address_city, custom_address_district, custom_address_state,
    custom_address_postal_code, status, fee_minor, currency,
    payment_reference, receipt_number, enrollment_date, notes, created_by
  ) values (
    resolved_devotee_id,
    (input_payload->>'forSelf')::boolean,
    resolved_beneficiary_id,
    (input_payload->>'annualMonth')::smallint,
    (input_payload->>'annualDay')::smallint,
    coalesce((input_payload->>'addressMode')::public.address_mode, 'devotee_primary'),
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,line1}'), '') end,
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,line2}'), '') end,
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,city}'), '') end,
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,district}'), '') end,
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,state}'), '') end,
    case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,postalCode}'), '') end,
    coalesce((input_payload->>'status')::public.enrollment_status, 'active'),
    coalesce((input_payload->>'feeMinor')::integer, 100000),
    coalesce(input_payload->>'currency', 'INR'),
    nullif(trim(input_payload->>'paymentReference'), ''),
    nullif(trim(input_payload->>'receiptNumber'), ''),
    coalesce((input_payload->>'enrollmentDate')::date, current_date),
    nullif(trim(input_payload->>'notes'), ''),
    auth.uid()
  ) returning * into created_enrollment;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, after_json)
  values (auth.uid(), 'created', 'pooja_enrollment', created_enrollment.id, to_jsonb(created_enrollment));

  return created_enrollment;
end;
$$;

create or replace function public.update_pooja_enrollment(
  enrollment_id uuid,
  expected_modified_at timestamptz,
  input_payload jsonb
)
returns public.pooja_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_record public.pooja_enrollments;
  saved_record public.pooja_enrollments;
  beneficiary_payload jsonb;
  resolved_beneficiary_id uuid;
begin
  if not public.is_active_staff() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into previous_record
  from public.pooja_enrollments e
  where e.id = enrollment_id
  for update;

  if not found then
    raise exception 'ENROLLMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if previous_record.modified_at <> expected_modified_at then
    raise exception 'STALE_RECORD' using errcode = '40001';
  end if;

  if coalesce((input_payload->>'forSelf')::boolean, previous_record.for_self) = false then
    beneficiary_payload := input_payload->'beneficiary';
    if beneficiary_payload is null or nullif(trim(beneficiary_payload->>'fullName'), '') is null then
      raise exception 'BENEFICIARY_REQUIRED' using errcode = '22023';
    end if;

    resolved_beneficiary_id := coalesce(
      (beneficiary_payload->>'id')::uuid,
      previous_record.beneficiary_id
    );
    if resolved_beneficiary_id is null then
      insert into public.beneficiaries (
        devotee_id, full_name, relation, phone, rashi, nakshatra, gotra, notes
      ) values (
        previous_record.devotee_id,
        trim(beneficiary_payload->>'fullName'),
        (beneficiary_payload->>'relation')::public.beneficiary_relation,
        nullif(trim(beneficiary_payload->>'phone'), ''),
        nullif(trim(beneficiary_payload->>'rashi'), ''),
        nullif(trim(beneficiary_payload->>'nakshatra'), ''),
        nullif(trim(beneficiary_payload->>'gotra'), ''),
        nullif(trim(beneficiary_payload->>'notes'), '')
      ) returning id into resolved_beneficiary_id;
    else
      update public.beneficiaries
      set
        full_name = trim(beneficiary_payload->>'fullName'),
        relation = (beneficiary_payload->>'relation')::public.beneficiary_relation,
        phone = nullif(trim(beneficiary_payload->>'phone'), ''),
        rashi = nullif(trim(beneficiary_payload->>'rashi'), ''),
        nakshatra = nullif(trim(beneficiary_payload->>'nakshatra'), ''),
        gotra = nullif(trim(beneficiary_payload->>'gotra'), ''),
        notes = nullif(trim(beneficiary_payload->>'notes'), '')
      where id = resolved_beneficiary_id
        and devotee_id = previous_record.devotee_id
        and archived_at is null;
      if not found then
        raise exception 'BENEFICIARY_NOT_FOUND' using errcode = 'P0002';
      end if;
    end if;
  end if;

  update public.pooja_enrollments
  set
    for_self = coalesce((input_payload->>'forSelf')::boolean, for_self),
    beneficiary_id = case
      when coalesce((input_payload->>'forSelf')::boolean, for_self) then null
      else resolved_beneficiary_id
    end,
    annual_month = coalesce((input_payload->>'annualMonth')::smallint, annual_month),
    annual_day = coalesce((input_payload->>'annualDay')::smallint, annual_day),
    address_mode = coalesce((input_payload->>'addressMode')::public.address_mode, address_mode),
    custom_address_line1 = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,line1}'), '') else null end,
    custom_address_line2 = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,line2}'), '') else null end,
    custom_address_city = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,city}'), '') else null end,
    custom_address_district = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,district}'), '') else null end,
    custom_address_state = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,state}'), '') else null end,
    custom_address_postal_code = case when input_payload->>'addressMode' = 'custom' then nullif(trim(input_payload#>>'{customAddress,postalCode}'), '') else null end,
    status = coalesce((input_payload->>'status')::public.enrollment_status, status),
    fee_minor = coalesce((input_payload->>'feeMinor')::integer, fee_minor),
    payment_reference = case when input_payload ? 'paymentReference' then nullif(trim(input_payload->>'paymentReference'), '') else payment_reference end,
    receipt_number = case when input_payload ? 'receiptNumber' then nullif(trim(input_payload->>'receiptNumber'), '') else receipt_number end,
    enrollment_date = coalesce((input_payload->>'enrollmentDate')::date, enrollment_date),
    notes = case when input_payload ? 'notes' then nullif(trim(input_payload->>'notes'), '') else notes end
  where id = enrollment_id
  returning * into saved_record;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, before_json, after_json)
  values (
    auth.uid(), 'updated', 'pooja_enrollment', saved_record.id,
    to_jsonb(previous_record), to_jsonb(saved_record)
  );
  return saved_record;
end;
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

grant execute on function public.pooja_register_page(text, date, text, integer, integer) to authenticated;
