-- Small on-demand lookup for the Devotees list's "view pooja dates" popover —
-- one devotee's enrollments only, not a page-wide join.

create or replace function public.devotee_pooja_dates(target_devotee_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with rows as (
    select
      e.id as enrollment_id,
      e.pooja_no,
      case when e.for_self then d.full_name else coalesce(b.full_name, d.full_name) end as beneficiary_name,
      case when e.for_self then 'Self' else initcap(coalesce(b.relation::text, 'other')) end as relation,
      e.annual_month,
      e.annual_day,
      e.status
    from public.pooja_enrollments e
    join public.devotees d on d.id = e.devotee_id and d.archived_at is null
    left join public.beneficiaries b on b.id = e.beneficiary_id
    where e.devotee_id = target_devotee_id
  )
  select coalesce(jsonb_agg(to_jsonb(rows) order by annual_month, annual_day), '[]'::jsonb) from rows;
$$;

grant execute on function public.devotee_pooja_dates(uuid) to authenticated;
