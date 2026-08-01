-- Bounded, privacy-conscious audit log read model for the staff UI.
create or replace function public.audit_log_page(
  search_text text default null,
  entity_filter text default null,
  action_filter text default null,
  page_size integer default 25,
  page_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with readable as (
    select
      a.id,
      a.actor_id,
      coalesce(s.display_name, 'System import') as actor_name,
      a.action,
      a.entity_type,
      a.entity_id,
      coalesce(d.devotee_no, e.pooja_no, left(a.entity_id::text, 8)) as reference_no,
      a.occurred_at,
      coalesce((
        select jsonb_agg(key order by key)
        from (
          select distinct key
          from jsonb_object_keys(coalesce(a.before_json, '{}'::jsonb) || coalesce(a.after_json, '{}'::jsonb)) key
          where coalesce(a.before_json, '{}'::jsonb)->key
            is distinct from coalesce(a.after_json, '{}'::jsonb)->key
        ) changed
      ), '[]'::jsonb) as changed_fields
    from public.audit_events a
    left join public.staff_profiles s on s.user_id = a.actor_id
    left join public.devotees d on a.entity_type = 'devotee' and d.id = a.entity_id
    left join public.pooja_enrollments e on a.entity_type = 'pooja_enrollment' and e.id = a.entity_id
    where
      (nullif(trim(entity_filter), '') is null or a.entity_type = trim(entity_filter))
      and (nullif(trim(action_filter), '') is null or a.action = trim(action_filter))
      and (
        nullif(trim(search_text), '') is null
        or a.action ilike '%' || trim(search_text) || '%'
        or a.entity_type ilike '%' || trim(search_text) || '%'
        or coalesce(s.display_name, 'System import') ilike '%' || trim(search_text) || '%'
        or coalesce(d.devotee_no, e.pooja_no, a.entity_id::text) ilike '%' || trim(search_text) || '%'
      )
  ), page_rows as (
    select * from readable
    order by occurred_at desc, id desc
    limit least(greatest(page_size, 1), 100)
    offset greatest(page_offset, 0)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by p.occurred_at desc, p.id desc) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from readable)
  );
$$;

create index if not exists audit_events_occurred_at_idx
  on public.audit_events (occurred_at desc, id desc);

grant execute on function public.audit_log_page(text, text, text, integer, integer) to authenticated;
