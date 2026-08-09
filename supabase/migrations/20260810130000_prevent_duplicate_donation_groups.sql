create or replace function public.save_donation_group(input_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_record public.donation_groups;
  saved_record public.donation_groups;
  target_id uuid;
  normalized_title text;
begin
  if not public.is_active_staff() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  target_id := nullif(input_payload->>'id','')::uuid;
  normalized_title := lower(trim(input_payload->>'title'));
  perform pg_advisory_xact_lock(hashtextextended(normalized_title, 0));

  if exists (
    select 1 from public.donation_groups
    where archived_at is null
      and lower(trim(title)) = normalized_title
      and (target_id is null or id <> target_id)
  ) then
    raise exception 'DUPLICATE_GROUP';
  end if;

  if target_id is not null then
    select * into previous_record
    from public.donation_groups
    where id = target_id and archived_at is null
    for update;

    if not found then raise exception 'GROUP_NOT_FOUND'; end if;
    if nullif(input_payload->>'expectedModifiedAt','') is null
      or previous_record.modified_at <> (input_payload->>'expectedModifiedAt')::timestamptz then
      raise exception 'STALE_RECORD';
    end if;

    update public.donation_groups set
      title=trim(input_payload->>'title'), phone=nullif(trim(input_payload->>'phone'),''),
      alternate_phone=nullif(trim(input_payload->>'alternatePhone'),''),
      address_line1=nullif(trim(input_payload->>'addressLine1'),''),
      address_line2=nullif(trim(input_payload->>'addressLine2'),''),
      city=nullif(trim(input_payload->>'city'),''), district=nullif(trim(input_payload->>'district'),''),
      state=nullif(trim(input_payload->>'state'),''), postal_code=nullif(trim(input_payload->>'postalCode'),''),
      linked_devotee_id=nullif(input_payload->>'linkedDevoteeId','')::uuid,
      notes=nullif(trim(input_payload->>'notes'),'')
    where id=target_id returning * into saved_record;

    insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
    values(auth.uid(),'updated','donation_group',saved_record.id,to_jsonb(previous_record),to_jsonb(saved_record));
  else
    insert into public.donation_groups(
      title,phone,alternate_phone,address_line1,address_line2,city,district,state,postal_code,
      linked_devotee_id,notes,created_by
    ) values (
      trim(input_payload->>'title'),nullif(trim(input_payload->>'phone'),''),
      nullif(trim(input_payload->>'alternatePhone'),''),nullif(trim(input_payload->>'addressLine1'),''),
      nullif(trim(input_payload->>'addressLine2'),''),nullif(trim(input_payload->>'city'),''),
      nullif(trim(input_payload->>'district'),''),nullif(trim(input_payload->>'state'),''),
      nullif(trim(input_payload->>'postalCode'),''),nullif(input_payload->>'linkedDevoteeId','')::uuid,
      nullif(trim(input_payload->>'notes'),''),auth.uid()
    ) returning * into saved_record;

    insert into public.audit_events(actor_id,action,entity_type,entity_id,after_json)
    values(auth.uid(),'created','donation_group',saved_record.id,to_jsonb(saved_record));
  end if;

  return to_jsonb(saved_record);
end;
$$;

grant execute on function public.save_donation_group(jsonb) to authenticated;
