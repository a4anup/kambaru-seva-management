drop function if exists public.donation_list_page(text,date,date,uuid,uuid,text,text,bigint,bigint,text,integer,integer);

create function public.donation_list_page(
  search_text text default null, donor_initial text default null,
  from_date date default null, to_date date default null,
  filter_type_id uuid default null, filter_group_id uuid default null,
  mapping_status text default null, filter_review_status text default null,
  minimum_amount bigint default null, maximum_amount bigint default null,
  sort_by text default 'name_asc', page_size integer default 25, page_offset integer default 0
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
      and (nullif(trim(donor_initial), '') is null or n.donor_name ilike trim(donor_initial) || '%')
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
    select * from filtered
    order by lower(coalesce(nullif(trim(donor_name), ''), chr(255))) asc, donation_date desc, created_at desc, id
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

grant execute on function public.donation_list_page(text,text,date,date,uuid,uuid,text,text,bigint,bigint,text,integer,integer) to authenticated;
