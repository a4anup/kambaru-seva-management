create function public.archive_donation(target_donation_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.donations; saved public.donations;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into item from public.donations where id=target_donation_id and archived_at is null for update;
  if not found then return false; end if;
  update public.donations set archived_at=now() where id=item.id returning * into saved;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
  values(auth.uid(),'archived','donation',item.id,to_jsonb(item),to_jsonb(saved));
  return true;
end; $$;

create or replace function public.archive_donation_group(target_group_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.donation_groups; donation_item public.donations; saved_group public.donation_groups;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into item from public.donation_groups where id=target_group_id and archived_at is null for update;
  if not found then return false; end if;
  for donation_item in select * from public.donations where donation_group_id=target_group_id and archived_at is null for update loop
    update public.donations set donation_group_id=null where id=donation_item.id;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
    values(auth.uid(),'unmapped','donation',donation_item.id,to_jsonb(donation_item),to_jsonb(donation_item)-'donation_group_id');
  end loop;
  update public.donation_groups set archived_at=now() where id=target_group_id returning * into saved_group;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
  values(auth.uid(),'archived','donation_group',item.id,to_jsonb(item),to_jsonb(saved_group));
  return true;
end; $$;

grant execute on function public.archive_donation(uuid) to authenticated;
