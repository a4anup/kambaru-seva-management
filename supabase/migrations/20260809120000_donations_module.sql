create table public.donation_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now()
);

create unique index donation_types_name_unique_idx on public.donation_types (lower(name));

create table public.donation_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  phone text,
  alternate_phone text,
  address_line1 text,
  address_line2 text,
  city text,
  district text,
  state text,
  postal_code text,
  linked_devotee_id uuid references public.devotees(id) on delete restrict,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null check (length(trim(donor_name)) > 0),
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  district text,
  state text,
  postal_code text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  receipt_number text,
  donation_date date not null,
  donation_type_id uuid not null references public.donation_types(id) on delete restrict,
  payment_method text check (payment_method is null or payment_method in ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
  payment_reference text,
  donation_group_id uuid references public.donation_groups(id) on delete restrict,
  linked_devotee_id uuid references public.devotees(id) on delete restrict,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  modified_at timestamptz not null default now(),
  archived_at timestamptz
);

create trigger donation_types_set_modified_at before update on public.donation_types
for each row execute function public.set_modified_at();
create trigger donation_groups_set_modified_at before update on public.donation_groups
for each row execute function public.set_modified_at();
create trigger donations_set_modified_at before update on public.donations
for each row execute function public.set_modified_at();

create index donations_date_idx on public.donations (donation_date desc, created_at desc);
create index donations_group_idx on public.donations (donation_group_id) where archived_at is null;
create index donations_type_idx on public.donations (donation_type_id) where archived_at is null;
create index donations_devotee_idx on public.donations (linked_devotee_id) where archived_at is null;
create index donations_receipt_idx on public.donations (lower(receipt_number)) where receipt_number is not null and archived_at is null;
create index donations_donor_idx on public.donations (lower(donor_name));
create index donation_groups_devotee_idx on public.donation_groups (linked_devotee_id) where archived_at is null;
create index donation_groups_title_idx on public.donation_groups (lower(title));

alter table public.donation_types enable row level security;
alter table public.donation_groups enable row level security;
alter table public.donations enable row level security;

create policy "active staff read donation types" on public.donation_types for select to authenticated using (public.is_active_staff());
create policy "active staff manage donation types" on public.donation_types for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "active staff manage donation groups" on public.donation_groups for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "active staff manage donations" on public.donations for all to authenticated using (public.is_active_staff()) with check (public.is_active_staff());

revoke delete on public.donation_types, public.donation_groups, public.donations from authenticated;

insert into public.donation_types (name, display_order) values
  ('General Donation', 10), ('Annadana', 20), ('Temple Development', 30),
  ('Festival Donation', 40), ('Pooja Donation', 50), ('Renovation', 60), ('Other', 70)
on conflict (lower(name)) do nothing;

create or replace view public.donation_group_summary
with (security_invoker = true)
as
select
  g.id as group_id,
  g.title,
  g.phone,
  g.city,
  g.state,
  g.linked_devotee_id,
  d.full_name as linked_devotee_name,
  coalesce(sum(n.amount_minor) filter (where n.archived_at is null), 0)::bigint as total_amount_minor,
  count(n.id) filter (where n.archived_at is null)::integer as donation_count,
  min(n.donation_date) filter (where n.archived_at is null) as first_donation_date,
  max(n.donation_date) filter (where n.archived_at is null) as latest_donation_date,
  g.created_at,
  g.modified_at
from public.donation_groups g
left join public.donations n on n.donation_group_id = g.id
left join public.devotees d on d.id = g.linked_devotee_id
where g.archived_at is null
group by g.id, d.full_name;

create or replace function public.donation_types_active()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.display_order, lower(t.name)), '[]'::jsonb)
  from public.donation_types t where t.active;
$$;

create or replace function public.donation_list_page(
  search_text text default null, from_date date default null, to_date date default null,
  filter_type_id uuid default null, filter_group_id uuid default null, mapping_status text default null,
  minimum_amount bigint default null, maximum_amount bigint default null,
  sort_by text default 'date_desc', page_size integer default 25, page_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select n.*, t.name as donation_type_name, g.title as donation_group_title,
      dv.full_name as linked_devotee_name, dv.devotee_no as linked_devotee_no
    from public.donations n
    join public.donation_types t on t.id = n.donation_type_id
    left join public.donation_groups g on g.id = n.donation_group_id and g.archived_at is null
    left join public.devotees dv on dv.id = n.linked_devotee_id
    where n.archived_at is null
      and (from_date is null or n.donation_date >= from_date)
      and (to_date is null or n.donation_date <= to_date)
      and (filter_type_id is null or n.donation_type_id = filter_type_id)
      and (filter_group_id is null or n.donation_group_id = filter_group_id)
      and (mapping_status is null or mapping_status = 'all'
        or (mapping_status = 'mapped' and n.donation_group_id is not null)
        or (mapping_status = 'unmapped' and n.donation_group_id is null))
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
    'unmappedCount', (select count(*) from filtered where donation_group_id is null)
  );
$$;

create or replace function public.donation_groups_page(
  search_text text default null, sort_by text default 'latest', page_size integer default 18, page_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select * from public.donation_group_summary s
    where nullif(trim(search_text), '') is null or s.title ilike '%' || trim(search_text) || '%'
      or coalesce(s.phone, '') ilike '%' || trim(search_text) || '%'
      or coalesce(s.linked_devotee_name, '') ilike '%' || trim(search_text) || '%'
  ), paged as (
    select * from filtered order by
      case when sort_by = 'amount_desc' then total_amount_minor end desc,
      case when sort_by = 'amount_asc' then total_amount_minor end asc,
      case when sort_by = 'count_desc' then donation_count end desc,
      case when sort_by = 'name_asc' then lower(title) end asc,
      case when sort_by not in ('amount_desc','amount_asc','count_desc','name_asc') then latest_donation_date end desc nulls last,
      lower(title), group_id
    limit least(greatest(page_size, 1), 100) offset greatest(page_offset, 0)
  ), donation_totals as (
    select count(*)::integer as count, coalesce(sum(amount_minor), 0)::bigint as amount,
      count(*) filter (where donation_group_id is null)::integer as unmapped
    from public.donations where archived_at is null
  ) select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p)) from paged p), '[]'::jsonb),
    'totalGroups', (select count(*) from filtered),
    'totalDonations', (select count from donation_totals),
    'totalAmountMinor', (select amount from donation_totals),
    'unmappedDonations', (select unmapped from donation_totals)
  );
$$;

create or replace function public.donation_group_detail(target_group_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'group', to_jsonb(g),
    'donations', coalesce((select jsonb_agg(to_jsonb(x) order by x.donation_date desc, x.created_at desc)
      from (select n.*, t.name as donation_type_name from public.donations n join public.donation_types t on t.id=n.donation_type_id
        where n.donation_group_id=target_group_id and n.archived_at is null limit 500) x), '[]'::jsonb)
  ) from (
    select s.*, dg.alternate_phone, dg.address_line1, dg.address_line2, dg.district, dg.postal_code, dg.notes,
      dg.created_by, dg.archived_at
    from public.donation_group_summary s join public.donation_groups dg on dg.id=s.group_id
    where s.group_id=target_group_id
  ) g;
$$;

create or replace function public.unassigned_donations(search_text text default null, page_size integer default 50)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.donation_date desc, x.created_at desc), '[]'::jsonb) from (
    select n.*, t.name as donation_type_name from public.donations n
    join public.donation_types t on t.id=n.donation_type_id
    where n.archived_at is null and n.donation_group_id is null
      and (nullif(trim(search_text), '') is null or n.donor_name ilike '%'||trim(search_text)||'%'
        or coalesce(n.phone,'') ilike '%'||trim(search_text)||'%'
        or coalesce(n.receipt_number,'') ilike '%'||trim(search_text)||'%'
        or n.amount_minor::text = regexp_replace(coalesce(search_text,''),'[^0-9]','','g'))
    limit least(greatest(page_size,1),100)
  ) x;
$$;

create or replace function public.donation_by_id(target_donation_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(x) from (
    select n.*, t.name as donation_type_name, g.title as donation_group_title,
      dv.full_name as linked_devotee_name, dv.devotee_no as linked_devotee_no
    from public.donations n join public.donation_types t on t.id=n.donation_type_id
    left join public.donation_groups g on g.id=n.donation_group_id and g.archived_at is null
    left join public.devotees dv on dv.id=n.linked_devotee_id
    where n.id=target_donation_id and n.archived_at is null
  ) x;
$$;

create or replace function public.save_donation(input_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous_record public.donations; saved_record public.donations; target_id uuid;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  target_id := nullif(input_payload->>'id','')::uuid;
  if target_id is not null then
    select * into previous_record from public.donations where id=target_id and archived_at is null for update;
    if not found then raise exception 'DONATION_NOT_FOUND'; end if;
    if nullif(input_payload->>'expectedModifiedAt','') is null or previous_record.modified_at <> (input_payload->>'expectedModifiedAt')::timestamptz then raise exception 'STALE_RECORD'; end if;
    update public.donations set
      donor_name=trim(input_payload->>'donorName'), phone=nullif(trim(input_payload->>'phone'),''),
      address_line1=nullif(trim(input_payload->>'addressLine1'),''), address_line2=nullif(trim(input_payload->>'addressLine2'),''),
      city=nullif(trim(input_payload->>'city'),''), district=nullif(trim(input_payload->>'district'),''), state=nullif(trim(input_payload->>'state'),''), postal_code=nullif(trim(input_payload->>'postalCode'),''),
      amount_minor=(input_payload->>'amountMinor')::bigint, receipt_number=nullif(trim(input_payload->>'receiptNumber'),''),
      donation_date=(input_payload->>'donationDate')::date, donation_type_id=(input_payload->>'donationTypeId')::uuid,
      payment_method=nullif(input_payload->>'paymentMethod',''), payment_reference=nullif(trim(input_payload->>'paymentReference'),''),
      donation_group_id=nullif(input_payload->>'donationGroupId','')::uuid, linked_devotee_id=nullif(input_payload->>'linkedDevoteeId','')::uuid,
      notes=nullif(trim(input_payload->>'notes'),'') where id=target_id returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json) values(auth.uid(),'updated','donation',saved_record.id,to_jsonb(previous_record),to_jsonb(saved_record));
  else
    insert into public.donations(donor_name,phone,address_line1,address_line2,city,district,state,postal_code,amount_minor,receipt_number,donation_date,donation_type_id,payment_method,payment_reference,donation_group_id,linked_devotee_id,notes,created_by)
    values(trim(input_payload->>'donorName'),nullif(trim(input_payload->>'phone'),''),nullif(trim(input_payload->>'addressLine1'),''),nullif(trim(input_payload->>'addressLine2'),''),nullif(trim(input_payload->>'city'),''),nullif(trim(input_payload->>'district'),''),nullif(trim(input_payload->>'state'),''),nullif(trim(input_payload->>'postalCode'),''),(input_payload->>'amountMinor')::bigint,nullif(trim(input_payload->>'receiptNumber'),''),(input_payload->>'donationDate')::date,(input_payload->>'donationTypeId')::uuid,nullif(input_payload->>'paymentMethod',''),nullif(trim(input_payload->>'paymentReference'),''),nullif(input_payload->>'donationGroupId','')::uuid,nullif(input_payload->>'linkedDevoteeId','')::uuid,nullif(trim(input_payload->>'notes'),''),auth.uid()) returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,after_json) values(auth.uid(),'created','donation',saved_record.id,to_jsonb(saved_record));
  end if;
  return to_jsonb(saved_record);
end; $$;

create or replace function public.save_donation_group(input_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous_record public.donation_groups; saved_record public.donation_groups; target_id uuid;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  target_id := nullif(input_payload->>'id','')::uuid;
  if target_id is not null then
    select * into previous_record from public.donation_groups where id=target_id and archived_at is null for update;
    if not found then raise exception 'GROUP_NOT_FOUND'; end if;
    if nullif(input_payload->>'expectedModifiedAt','') is null or previous_record.modified_at <> (input_payload->>'expectedModifiedAt')::timestamptz then raise exception 'STALE_RECORD'; end if;
    update public.donation_groups set title=trim(input_payload->>'title'),phone=nullif(trim(input_payload->>'phone'),''),alternate_phone=nullif(trim(input_payload->>'alternatePhone'),''),address_line1=nullif(trim(input_payload->>'addressLine1'),''),address_line2=nullif(trim(input_payload->>'addressLine2'),''),city=nullif(trim(input_payload->>'city'),''),district=nullif(trim(input_payload->>'district'),''),state=nullif(trim(input_payload->>'state'),''),postal_code=nullif(trim(input_payload->>'postalCode'),''),linked_devotee_id=nullif(input_payload->>'linkedDevoteeId','')::uuid,notes=nullif(trim(input_payload->>'notes'),'') where id=target_id returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json) values(auth.uid(),'updated','donation_group',saved_record.id,to_jsonb(previous_record),to_jsonb(saved_record));
  else
    insert into public.donation_groups(title,phone,alternate_phone,address_line1,address_line2,city,district,state,postal_code,linked_devotee_id,notes,created_by)
    values(trim(input_payload->>'title'),nullif(trim(input_payload->>'phone'),''),nullif(trim(input_payload->>'alternatePhone'),''),nullif(trim(input_payload->>'addressLine1'),''),nullif(trim(input_payload->>'addressLine2'),''),nullif(trim(input_payload->>'city'),''),nullif(trim(input_payload->>'district'),''),nullif(trim(input_payload->>'state'),''),nullif(trim(input_payload->>'postalCode'),''),nullif(input_payload->>'linkedDevoteeId','')::uuid,nullif(trim(input_payload->>'notes'),''),auth.uid()) returning * into saved_record;
    insert into public.audit_events(actor_id,action,entity_type,entity_id,after_json) values(auth.uid(),'created','donation_group',saved_record.id,to_jsonb(saved_record));
  end if;
  return to_jsonb(saved_record);
end; $$;

create or replace function public.map_donations(target_group_id uuid, donation_ids uuid[])
returns integer language plpgsql security invoker set search_path = '' as $$
declare item public.donations; changed integer := 0;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.donation_groups where id=target_group_id and archived_at is null) then raise exception 'GROUP_NOT_FOUND'; end if;
  for item in select * from public.donations where id=any(donation_ids) and archived_at is null for update loop
    if item.donation_group_id is distinct from target_group_id then
      update public.donations set donation_group_id=target_group_id where id=item.id;
      insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
      values(auth.uid(),case when item.donation_group_id is null then 'mapped' else 'moved' end,'donation',item.id,to_jsonb(item),to_jsonb(item)||jsonb_build_object('donation_group_id',target_group_id));
      changed := changed + 1;
    end if;
  end loop; return changed;
end; $$;

create or replace function public.unmap_donation(target_donation_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.donations;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into item from public.donations where id=target_donation_id and archived_at is null for update;
  if not found then raise exception 'DONATION_NOT_FOUND'; end if;
  if item.donation_group_id is null then return false; end if;
  update public.donations set donation_group_id=null where id=item.id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
  values(auth.uid(),'unmapped','donation',item.id,to_jsonb(item),to_jsonb(item)-'donation_group_id'); return true;
end; $$;

create or replace function public.archive_donation_group(target_group_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare item public.donation_groups;
begin
  if not public.is_active_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into item from public.donation_groups where id=target_group_id and archived_at is null for update;
  if not found then return false; end if;
  update public.donations set donation_group_id=null where donation_group_id=target_group_id and archived_at is null;
  update public.donation_groups set archived_at=now() where id=target_group_id;
  insert into public.audit_events(actor_id,action,entity_type,entity_id,before_json,after_json)
  values(auth.uid(),'archived','donation_group',item.id,to_jsonb(item),to_jsonb(item)||jsonb_build_object('archived_at',now())); return true;
end; $$;

grant select on public.donation_group_summary to authenticated;
grant execute on function public.donation_types_active() to authenticated;
grant execute on function public.donation_list_page(text,date,date,uuid,uuid,text,bigint,bigint,text,integer,integer) to authenticated;
grant execute on function public.donation_groups_page(text,text,integer,integer) to authenticated;
grant execute on function public.donation_group_detail(uuid) to authenticated;
grant execute on function public.unassigned_donations(text,integer) to authenticated;
grant execute on function public.donation_by_id(uuid) to authenticated;
grant execute on function public.save_donation(jsonb) to authenticated;
grant execute on function public.save_donation_group(jsonb) to authenticated;
grant execute on function public.map_donations(uuid,uuid[]) to authenticated;
grant execute on function public.unmap_donation(uuid) to authenticated;
grant execute on function public.archive_donation_group(uuid) to authenticated;
