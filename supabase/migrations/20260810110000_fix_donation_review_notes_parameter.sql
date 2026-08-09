drop function if exists public.mark_donation_reviewed(uuid,text);

create function public.mark_donation_reviewed(
  target_donation_id uuid,
  review_notes_input text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous_record public.donations;
  saved_record public.donations;
begin
  if not public.is_active_staff() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into previous_record
  from public.donations
  where id = target_donation_id and archived_at is null
  for update;

  if not found then
    raise exception 'DONATION_NOT_FOUND';
  end if;

  update public.donations
  set review_status = 'reviewed',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_notes = nullif(trim(review_notes_input), '')
  where id = target_donation_id
  returning * into saved_record;

  insert into public.audit_events(
    actor_id, action, entity_type, entity_id, before_json, after_json
  ) values (
    auth.uid(), 'reviewed', 'donation', saved_record.id,
    to_jsonb(previous_record), to_jsonb(saved_record)
  );

  return to_jsonb(saved_record);
end;
$$;

grant execute on function public.mark_donation_reviewed(uuid,text) to authenticated;
