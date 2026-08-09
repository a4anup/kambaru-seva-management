create or replace function public.return_donation_to_review(target_donation_id uuid)
returns jsonb
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
  set review_status = 'review_required',
      reviewed_at = null,
      reviewed_by = null
  where id = target_donation_id
  returning * into saved_record;

  insert into public.audit_events(
    actor_id, action, entity_type, entity_id, before_json, after_json
  ) values (
    auth.uid(), 'review_required', 'donation', saved_record.id,
    to_jsonb(previous_record), to_jsonb(saved_record)
  );

  return to_jsonb(saved_record);
end;
$$;

grant execute on function public.return_donation_to_review(uuid) to authenticated;
