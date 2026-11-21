-- Address verification is staff approval for dispatch, not proof of delivery.
-- Existing and new addresses default to Verified. Never rewrite old snapshots.
alter table public.devotees
  add column address_verification_status text not null default 'verified'
    check (address_verification_status in ('verified', 'unverified')),
  add column address_verification_reason text check (length(address_verification_reason) <= 500),
  add column address_verification_changed_at timestamptz,
  add column address_verification_changed_by uuid references auth.users(id) on delete set null;

alter table public.pooja_enrollments
  add column custom_address_verification_status text not null default 'verified'
    check (custom_address_verification_status in ('verified', 'unverified')),
  add column custom_address_verification_reason text check (length(custom_address_verification_reason) <= 500),
  add column custom_address_verification_changed_at timestamptz,
  add column custom_address_verification_changed_by uuid references auth.users(id) on delete set null;

-- Capture actor/time and audit even when a caller writes directly through RLS.
-- Unrelated edits and address corrections preserve verification automatically.
create or replace function public.track_address_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or
     (new.address_verification_status, new.address_verification_reason)
       is distinct from (old.address_verification_status, old.address_verification_reason) then
    if not public.is_active_staff() then
      raise exception 'NOT_AUTHORIZED' using errcode = '42501';
    end if;
    new.address_verification_changed_at := clock_timestamp();
    new.address_verification_changed_by := auth.uid();
    if tg_op = 'UPDATE' then
      insert into public.audit_events (actor_id, action, entity_type, entity_id, before_json, after_json)
      values (auth.uid(), 'address_verification_changed', 'devotee', new.id, to_jsonb(old), to_jsonb(new));
    end if;
  else
    new.address_verification_changed_at := old.address_verification_changed_at;
    new.address_verification_changed_by := old.address_verification_changed_by;
  end if;
  return new;
end;
$$;
revoke all on function public.track_address_verification() from public;
create trigger track_address_verification before insert or update on public.devotees
for each row execute function public.track_address_verification();

create or replace function public.track_custom_address_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or
     (new.custom_address_verification_status, new.custom_address_verification_reason)
       is distinct from (old.custom_address_verification_status, old.custom_address_verification_reason) then
    if not public.is_active_staff() then
      raise exception 'NOT_AUTHORIZED' using errcode = '42501';
    end if;
    new.custom_address_verification_changed_at := clock_timestamp();
    new.custom_address_verification_changed_by := auth.uid();
    if tg_op = 'UPDATE' then
      insert into public.audit_events (actor_id, action, entity_type, entity_id, before_json, after_json)
      values (auth.uid(), 'address_verification_changed', 'pooja_enrollment', new.id, to_jsonb(old), to_jsonb(new));
    end if;
  else
    new.custom_address_verification_changed_at := old.custom_address_verification_changed_at;
    new.custom_address_verification_changed_by := old.custom_address_verification_changed_by;
  end if;
  return new;
end;
$$;
revoke all on function public.track_custom_address_verification() from public;
create trigger track_custom_address_verification before insert or update on public.pooja_enrollments
for each row execute function public.track_custom_address_verification();

alter table public.pooja_occurrences
  add column address_verification_status_snapshot text
    check (address_verification_status_snapshot in ('verified', 'unverified'));
create or replace function public.snapshot_address_verification()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.address_verification_status_snapshot is distinct from old.address_verification_status_snapshot then
      raise exception 'Occurrence verification snapshot is immutable' using errcode = '23514';
    end if;
    return new;
  end if;
  select case when e.address_mode = 'custom' then e.custom_address_verification_status
    else d.address_verification_status end
  into new.address_verification_status_snapshot
  from public.pooja_enrollments e join public.devotees d on d.id = e.devotee_id
  where e.id = new.enrollment_id;
  return new;
end;
$$;
revoke all on function public.snapshot_address_verification() from public;
create trigger snapshot_address_verification before insert or update on public.pooja_occurrences
for each row execute function public.snapshot_address_verification();

create or replace function public.create_devotee(input_payload jsonb)
returns public.devotees
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.devotees;
begin
  if not public.is_active_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(trim(input_payload ->> 'fullName'), '') is null then
    raise exception 'Devotee name is required' using errcode = '22023';
  end if;

  insert into public.devotees (
    devotee_no,
    full_name,
    date_of_birth,
    phone_primary,
    phone_alternate,
    email,
    rashi,
    nakshatra,
    gotra,
    notes,
    address_line1,
    address_line2,
    address_city,
    address_district,
    address_state,
    address_postal_code, address_verification_status, address_verification_reason
  )
  values (
    public.next_devotee_number(),
    trim(input_payload ->> 'fullName'),
    nullif(input_payload ->> 'dateOfBirth', '')::date,
    nullif(trim(input_payload ->> 'phone'), ''),
    nullif(trim(input_payload ->> 'phoneAlternate'), ''),
    nullif(trim(input_payload ->> 'email'), ''),
    nullif(trim(input_payload ->> 'rashi'), ''),
    nullif(trim(input_payload ->> 'nakshatra'), ''),
    nullif(trim(input_payload ->> 'gotra'), ''),
    nullif(trim(input_payload ->> 'notes'), ''),
    coalesce(trim(input_payload ->> 'addressLine1'), ''),
    nullif(trim(input_payload ->> 'addressLine2'), ''),
    coalesce(trim(input_payload ->> 'city'), ''),
    nullif(trim(input_payload ->> 'district'), ''),
    coalesce(trim(input_payload ->> 'state'), ''),
    coalesce(trim(input_payload ->> 'postalCode'), ''),
    coalesce(input_payload->>'addressVerificationStatus', 'verified'),
    nullif(trim(input_payload->>'addressVerificationReason'), '')
  )
  returning * into created;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, after_json
  )
  values (
    auth.uid(), 'create', 'devotee', created.id, to_jsonb(created)
  );

  return created;
end;
$$;

create or replace function public.update_devotee(
  devotee_id uuid,
  expected_modified_at timestamptz,
  input_payload jsonb
)
returns public.devotees
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous public.devotees;
  updated public.devotees;
begin
  if not public.is_active_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(trim(input_payload ->> 'fullName'), '') is null then
    raise exception 'Devotee name is required' using errcode = '22023';
  end if;

  select * into previous
  from public.devotees
  where id = devotee_id and archived_at is null
  for update;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if previous.modified_at <> expected_modified_at then
    raise exception 'STALE_RECORD' using errcode = '40001';
  end if;

  update public.devotees
  set
    full_name = trim(input_payload ->> 'fullName'),
    date_of_birth = nullif(input_payload ->> 'dateOfBirth', '')::date,
    phone_primary = nullif(trim(input_payload ->> 'phone'), ''),
    phone_alternate = nullif(trim(input_payload ->> 'phoneAlternate'), ''),
    email = nullif(trim(input_payload ->> 'email'), ''),
    rashi = nullif(trim(input_payload ->> 'rashi'), ''),
    nakshatra = nullif(trim(input_payload ->> 'nakshatra'), ''),
    gotra = nullif(trim(input_payload ->> 'gotra'), ''),
    notes = nullif(trim(input_payload ->> 'notes'), ''),
    address_line1 = coalesce(trim(input_payload ->> 'addressLine1'), ''),
    address_line2 = nullif(trim(input_payload ->> 'addressLine2'), ''),
    address_city = coalesce(trim(input_payload ->> 'city'), ''),
    address_district = nullif(trim(input_payload ->> 'district'), ''),
    address_state = coalesce(trim(input_payload ->> 'state'), ''),
    address_verification_status = coalesce(input_payload->>'addressVerificationStatus', address_verification_status),
    address_verification_reason = case when input_payload ? 'addressVerificationReason' then nullif(trim(input_payload->>'addressVerificationReason'), '') else address_verification_reason end,
    address_postal_code = coalesce(trim(input_payload ->> 'postalCode'), '')
  where id = devotee_id
  returning * into updated;

  insert into public.audit_events (
    actor_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    auth.uid(), 'update', 'devotee', updated.id, to_jsonb(previous), to_jsonb(updated)
  );

  return updated;
end;
$$;

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
    custom_address_postal_code, custom_address_verification_status, custom_address_verification_reason, status, fee_minor, currency,
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
    coalesce(input_payload->>'customAddressVerificationStatus', 'verified'),
    nullif(trim(input_payload->>'customAddressVerificationReason'), ''),
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
    custom_address_verification_status = coalesce(input_payload->>'customAddressVerificationStatus', custom_address_verification_status),
    custom_address_verification_reason = case when input_payload ? 'customAddressVerificationReason' then nullif(trim(input_payload->>'customAddressVerificationReason'), '') else custom_address_verification_reason end,
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
      count(e.id) filter (where e.status = 'active')::integer as pooja_count,
      count(e.id) filter (where e.status = 'active' and e.address_mode = 'devotee_primary')::integer as primary_address_pooja_count
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
      d.address_verification_status as devotee_address_verification_status,
      d.address_verification_reason as devotee_address_verification_reason,
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
      case when e.address_mode = 'custom' then e.custom_address_verification_status else d.address_verification_status end as address_verification_status,
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
      d.address_verification_status,
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
      case when e.address_mode = 'custom' then e.custom_address_verification_status else d.address_verification_status end as address_verification_status,
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
    select distinct on (dedup_key)
      case when bool_or(address_verification_status = 'unverified') over (partition by dedup_key)
        then 'unverified' else 'verified' end as address_verification_status, id, name, phone, address_line, address_line2, city, state, postal_code
    from keyed
    order by dedup_key, name, id
  )
  select coalesce(jsonb_agg(to_jsonb(deduped) order by name), '[]'::jsonb) from deduped;
$$;

