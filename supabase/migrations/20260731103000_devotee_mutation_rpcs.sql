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
    candidate := 'DEV-' || lpad(nextval('public.devotee_number_seq')::text, 5, '0');
    exit when not exists (
      select 1 from public.devotees where devotee_no = candidate
    );
  end loop;
  return candidate;
end;
$$;

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
    address_postal_code
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
    coalesce(trim(input_payload ->> 'postalCode'), '')
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

revoke all on function public.next_devotee_number() from public;
revoke all on function public.create_devotee(jsonb) from public;
revoke all on function public.update_devotee(uuid, timestamptz, jsonb) from public;
grant execute on function public.create_devotee(jsonb) to authenticated;
grant execute on function public.update_devotee(uuid, timestamptz, jsonb) to authenticated;
