do $$
declare
  renovation_type_id uuid;
  previous_record public.donations;
  saved_record public.donations;
begin
  insert into public.donation_types (name, display_order, active)
  values ('Renovation', 10, true)
  on conflict (lower(name)) do update
    set name = 'Renovation', display_order = 10, active = true
  returning id into renovation_type_id;

  for previous_record in
    select n.*
    from public.donations n
    where n.donation_type_id <> renovation_type_id
    for update
  loop
    update public.donations
    set donation_type_id = renovation_type_id
    where id = previous_record.id
    returning * into saved_record;

    insert into public.audit_events (
      actor_id, action, entity_type, entity_id, before_json, after_json
    ) values (
      null,
      'normalized_donation_type',
      'donation',
      saved_record.id,
      to_jsonb(previous_record),
      to_jsonb(saved_record)
    );
  end loop;

  update public.donation_types
  set active = (id = renovation_type_id),
      display_order = case when id = renovation_type_id then 10 else display_order end;
end;
$$;

