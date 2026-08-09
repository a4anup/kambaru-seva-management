alter table public.donations
  add column review_status text not null default 'review_required'
    check (review_status in ('review_required', 'reviewed')),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users(id) on delete restrict,
  add column review_notes text,
  add constraint donations_review_completion_check check (
    (review_status = 'review_required' and reviewed_at is null and reviewed_by is null)
    or (review_status = 'reviewed' and reviewed_at is not null and reviewed_by is not null)
  );

create index donations_review_status_idx on public.donations (review_status, donation_date desc)
where archived_at is null;

create function public.reset_donation_review_after_material_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.donor_name is distinct from new.donor_name
    or old.amount_minor is distinct from new.amount_minor
    or old.receipt_number is distinct from new.receipt_number
    or old.donation_date is distinct from new.donation_date
    or old.donation_type_id is distinct from new.donation_type_id
    or old.payment_method is distinct from new.payment_method
    or old.payment_reference is distinct from new.payment_reference then
    new.review_status := 'review_required';
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end; $$;

create trigger donations_reset_review_after_material_change
before update on public.donations for each row
execute function public.reset_donation_review_after_material_change();

drop function if exists public.donation_list_page(text,date,date,uuid,uuid,text,bigint,bigint,text,integer,integer);
create function public.donation_list_page(
  search_text text default null, from_date date default null, to_date date default null,
  filter_type_id uuid default null, filter_group_id uuid default null,
  mapping_status text default null, filter_review_status text default null,
  minimum_amount bigint default null, maximum_amount bigint default null,
  sort_by text default 'date_desc', page_size integer default 25, page_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select n.*, t.name as donation_type_name, g.title as donation_group_title,
      dv.full_name as linked_devotee_name, dv.devotee_no as linked_devotee_no,
      reviewer.display_name as reviewed_by_name
    from public.donations n
    join public.donation_types t on t.id = n.donation_type_id
    left join public.donation_groups g on g.id = n.donation_group_id and g.archived_at is null
    left join public.devotees dv on dv.id = n.linked_devotee_id
    left join public.staff_profiles reviewer on reviewer.user_id = n.reviewed_by
    where n.archived_at is null
      and (from_date is null or n.donation_date >= from_date)
      and (to_date is null or n.donation_date <= to_date)
      and (filter_type_id is null or n.donation_type_id = filter_type_id)
      and (filter_group_id is null or n.donation_group_id = filter_group_id)
      and (mapping_status is null or mapping_status = 'all'
        or (mapping_status = 'mapped' and n.donation_group_id is not null)
        or (mapping_status = 'unmapped' and n.donation_group_id is null))
      and (filter_review_status is null or filter_review_status = 'all' or n.review_status = filter_review_status)
      and (minimum_amount is null or n.amount_minor >= minimum_amount)
      and (maximum_amount is null or n.amount_minor <= maximum_amount)
      and (nullif(trim(search_text), '') is null or n.donor_name ilike '%' || trim(search_text) || '%'
        or coalesce(n.phone, '') ilike '%' || trim(search_text) || '%'
        or coalesce(n.receipt_number, '') ilike '%' || trim(search_text) || '%')
  ), paged as (
    select * from filtered order by
      case when sort_by = 'amount_desc' then amount_minor end desc,
      case when sort_by = 'amount_asc' then amount_minor end asc,
      case when sort_by = 'name_asc' then lower(donor_name) end asc,
      case when sort_by = 'created_desc' then created_at end desc,
      case when sort_by not in ('amount_desc','amount_asc','name_asc','created_desc') then donation_date end desc,
      created_at desc, id
    limit least(greatest(page_size, 1), 100) offset greatest(page_offset, 0)
  ) select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p)) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'totalAmountMinor', coalesce((select sum(amount_minor) from filtered), 0),
    'mappedCount', (select count(*) from filtered where donation_group_id is not null),
    'unmappedCount', (select count(*) from filtered where donation_group_id is null),
    'reviewRequiredCount', (select count(*) from filtered where review_status = 'review_required'),
    'reviewedCount', (select count(*) from filtered where review_status = 'reviewed')
  );
$$;

create or replace function public.save_donation(input_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous_record public.donations; saved_record public.donations; target_id uuid; material_changed boolean;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  target_id := nullif(input_payload->>'id','')::uuid;
  if target_id is not null then
    select * into previous_record from public.donations where id=target_id and archived_at is null for update;
    if not found then raise exception 'DONATION_NOT_FOUND'; end if;
    if nullif(input_payload->>'expectedModifiedAt','') is null or previous_record.modified_at <> (input_payload->>'expectedModifiedAt')::timestamptz then raise exception 'STALE_RECORD'; end if;
    material_changed := previous_record.donor_name is distinct from trim(input_payload->>'donorName')
      or previous_record.amount_minor is distinct from (input_payload->>'amountMinor')::bigint
      or previous_record.receipt_number is distinct from nullif(trim(input_payload->>'receiptNumber'),'')
      or previous_record.donation_date is distinct from (input_payload->>'donationDate')::date
      or previous_record.donation_type_id is distinct from (input_payload->>'donationTypeId')::uuid
      or previous_record.payment_method is distinct from nullif(input_payload->>'paymentMethod','')
      or previous_record.payment_reference is distinct from nullif(trim(input_payload->>'paymentReference'),'');
    update public.donations set
      donor_name=trim(input_payload->>'donorName'), phone=nullif(trim(input_payload->>'phone'),''),
      address_line1=nullif(trim(input_payload->>'addressLine1'),''), address_line2=nullif(trim(input_payload->>'addressLine2'),''),
      city=nullif(trim(input_payload->>'city'),''), district=nullif(trim(input_payload->>'district'),''), state=nullif(trim(input_payload->>'state'),''), postal_code=nullif(trim(input_payload->>'postalCode'),''),
      amount_minor=(input_payload->>'amountMinor')::bigint, receipt_number=nullif(trim(input_payload->>'receiptNumber'),''),
      donation_date=(input_payload->>'donationDate')::date, donation_type_id=(input_payload->>'donationTypeId')::uuid,
      payment_method=nullif(input_payload->>'paymentMethod',''), payment_reference=nullif(trim(input_payload->>'paymentReference'),''),
      donation_group_id=nullif(input_payload->>'donationGroupId','')::uuid, linked_devotee_id=nullif(input_payload->>'linkedDevoteeId','')::uuid,
      notes=nullif(trim(input_payload->>'notes'),''),
      review_status=case when material_changed then 'review_required' else review_status end,
      reviewed_at=case when material_changed then null else reviewed_at end,
      reviewed_by=case when material_changed then null else reviewed_by end
    where id=target_id returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
    values(auth.uid(),case when material_changed and previous_record.review_status='reviewed' then 'review_required' else 'updated' end,'donation',saved_record.id,to_jsonb(previous_record),to_jsonb(saved_record));
  else
    insert into public.donations(donor_name,phone,address_line1,address_line2,city,district,state,postal_code,amount_minor,receipt_number,donation_date,donation_type_id,payment_method,payment_reference,donation_group_id,linked_devotee_id,notes,created_by)
    values(trim(input_payload->>'donorName'),nullif(trim(input_payload->>'phone'),''),nullif(trim(input_payload->>'addressLine1'),''),nullif(trim(input_payload->>'addressLine2'),''),nullif(trim(input_payload->>'city'),''),nullif(trim(input_payload->>'district'),''),nullif(trim(input_payload->>'state'),''),nullif(trim(input_payload->>'postalCode'),''),(input_payload->>'amountMinor')::bigint,nullif(trim(input_payload->>'receiptNumber'),''),(input_payload->>'donationDate')::date,(input_payload->>'donationTypeId')::uuid,nullif(input_payload->>'paymentMethod',''),nullif(trim(input_payload->>'paymentReference'),''),nullif(input_payload->>'donationGroupId','')::uuid,nullif(input_payload->>'linkedDevoteeId','')::uuid,nullif(trim(input_payload->>'notes'),''),auth.uid()) returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,after_json) values(auth.uid(),'created','donation',saved_record.id,to_jsonb(saved_record));
  end if;
  return to_jsonb(saved_record);
end; $$;

create function public.mark_donation_reviewed(target_donation_id uuid, notes text default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous_record public.donations; saved_record public.donations;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into previous_record from public.donations where id=target_donation_id and archived_at is null for update;
  if not found then raise exception 'DONATION_NOT_FOUND'; end if;
  update public.donations set review_status='reviewed', reviewed_at=now(), reviewed_by=auth.uid(),
    review_notes=nullif(trim(notes),'') where id=target_donation_id returning * into saved_record;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
  values(auth.uid(),'reviewed','donation',saved_record.id,to_jsonb(previous_record),to_jsonb(saved_record));
  return to_jsonb(saved_record);
end; $$;

grant execute on function public.donation_list_page(text,date,date,uuid,uuid,text,text,bigint,bigint,text,integer,integer) to authenticated;
grant execute on function public.mark_donation_reviewed(uuid,text) to authenticated;
