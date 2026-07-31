-- Development/validation data only. Never run against a production project.
-- Creates 2,000 synthetic Indian devotees, one reusable beneficiary per devotee,
-- and exactly 5,000 active Shashwatha Poojas. Calendar dates are deliberately
-- distributed across zero, low (2), medium (4), and high (217+) volume days.

begin;

do $$
begin
  if exists (
    select 1 from public.devotees
    where notes = 'CALENDAR_VALIDATION_SEED_V1'
  ) then
    raise exception 'CALENDAR_VALIDATION_SEED_V1 already exists; seed was not run again.';
  end if;
end;
$$;

create temporary table validation_devotees (
  seed_no integer primary key,
  devotee_id uuid not null,
  beneficiary_id uuid not null
) on commit drop;

insert into validation_devotees (seed_no, devotee_id, beneficiary_id)
select seed_no, gen_random_uuid(), gen_random_uuid()
from generate_series(1, 2000) seed_no;

with source as (
  select
    mapping.*,
    (array[
      'Aarav','Aditya','Akash','Akshay','Amar','Anand','Ananya','Anil','Anirudh','Anjali',
      'Arjun','Asha','Bhavana','Chaitra','Deepa','Divya','Ganesh','Gayathri','Girish','Harish',
      'Kamal','Kavya','Kiran','Lakshmi','Madhav','Manjula','Meera','Mohan','Nandini','Naveen',
      'Nithya','Pooja','Prakash','Priya','Raghav','Ramesh','Rashmi','Rohan','Sanjay','Shankar',
      'Shilpa','Shreya','Sneha','Suresh','Swathi','Uday','Varun','Vidya','Vijaya','Vinay'
    ])[1 + ((mapping.seed_no - 1) % 50)] as first_name,
    (array[
      'Acharya','Bhat','Gowda','Hegde','Kamath','Kini','Kudva','Kulkarni','Nayak','Pai',
      'Prabhu','Rao','Shenoy','Shetty','Upadhya','Bhandary','Karkera','Mallya','Poojary','Naik'
    ])[1 + (((mapping.seed_no - 1) / 50) % 20)] as surname,
    (array['Bengaluru','Mangaluru','Mysuru','Udupi','Karkala','Kasaragod','Dharwad','Madikeri','Panaji','Tumakuru'])[1 + ((mapping.seed_no - 1) % 10)] as city,
    (array['Karnataka','Karnataka','Karnataka','Karnataka','Karnataka','Kerala','Karnataka','Karnataka','Goa','Karnataka'])[1 + ((mapping.seed_no - 1) % 10)] as state_name
  from validation_devotees mapping
)
insert into public.devotees (
  id, devotee_no, full_name, date_of_birth, phone_primary, phone_alternate,
  email, rashi, nakshatra, gotra, notes, address_line1, address_line2,
  address_city, address_district, address_state, address_postal_code,
  created_at, modified_at
)
select
  devotee_id,
  public.next_devotee_number(),
  first_name || ' ' || chr(65 + ((seed_no - 1) % 26)) || '. ' || surname,
  date '1945-01-01' + ((seed_no * 137) % 23000),
  (7000000000 + seed_no)::text,
  case when seed_no % 5 = 0 then (8000000000 + seed_no)::text end,
  case when seed_no % 4 = 0 then lower(first_name || '.' || surname || seed_no || '@example.test') end,
  (array['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrischika','Dhanu','Makara','Kumbha','Meena'])[1 + ((seed_no - 1) % 12)],
  (array['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Magha','Hasta','Chitra','Swati'])[1 + ((seed_no - 1) % 12)],
  (array['Kashyapa','Bharadwaja','Vasishta','Vishwamitra','Gautama','Atri','Jamadagni','Agastya'])[1 + ((seed_no - 1) % 8)],
  'CALENDAR_VALIDATION_SEED_V1',
  ((seed_no % 180) + 1)::text || ', ' || (array['Temple Road','Car Street','Market Road','MG Road','Station Road','Main Road'])[1 + ((seed_no - 1) % 6)],
  case when seed_no % 3 = 0 then (array['Near Temple','Opposite School','Behind Post Office'])[1 + ((seed_no - 1) % 3)] end,
  city,
  city,
  state_name,
  (560000 + (seed_no % 39999))::text,
  now() - ((seed_no % 720) || ' days')::interval,
  now()
from source;

with source as (
  select
    mapping.*,
    (array['Ananya','Arjun','Asha','Deepa','Ganesh','Kavya','Lakshmi','Madhav','Meera','Naveen','Priya','Rohan'])[1 + ((seed_no - 1) % 12)] as first_name,
    (array['Acharya','Bhat','Gowda','Hegde','Kamath','Nayak','Pai','Rao','Shenoy','Shetty'])[1 + ((seed_no - 1) % 10)] as surname
  from validation_devotees mapping
)
insert into public.beneficiaries (
  id, devotee_id, full_name, relation, phone, rashi, nakshatra, gotra,
  notes, created_at, modified_at
)
select
  beneficiary_id,
  devotee_id,
  first_name || ' ' || surname,
  (array['son','daughter','wife','husband','father','mother','other']::public.beneficiary_relation[])[1 + ((seed_no - 1) % 7)],
  case when seed_no % 3 = 0 then (9000000000 + seed_no)::text end,
  (array['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrischika','Dhanu','Makara','Kumbha','Meena'])[1 + ((seed_no + 2) % 12)],
  (array['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Magha','Hasta','Chitra','Swati'])[1 + ((seed_no + 4) % 12)],
  (array['Kashyapa','Bharadwaja','Vasishta','Vishwamitra','Gautama','Atri','Jamadagni','Agastya'])[1 + ((seed_no + 1) % 8)],
  'CALENDAR_VALIDATION_SEED_V1',
  now() - ((seed_no % 720) || ' days')::interval,
  now()
from source;

create temporary table validation_dates (
  annual_month smallint not null,
  annual_day smallint not null,
  target_count integer not null,
  bucket text not null,
  primary key (annual_month, annual_day)
) on commit drop;

-- Upcoming reference days: high on 1–3 Aug, zero on 4/6/7 Aug,
-- medium on 5 Aug, and low on 8 Aug.
insert into validation_dates values
  (8, 1, 300, 'high'),
  (8, 2, 250, 'high'),
  (8, 3, 200, 'high'),
  (8, 5, 4, 'medium'),
  (8, 8, 2, 'low');

create temporary table validation_date_candidates on commit drop as
select
  extract(month from service_date)::smallint as annual_month,
  extract(day from service_date)::smallint as annual_day,
  row_number() over (order by md5(service_date::text || '-KDP-CALENDAR-V1')) as candidate_no
from generate_series(date '2028-01-01', date '2028-12-31', interval '1 day') service_date
where service_date not in (
  date '2028-08-01', date '2028-08-02', date '2028-08-03', date '2028-08-04',
  date '2028-08-05', date '2028-08-06', date '2028-08-07', date '2028-08-08'
);

-- Seventeen additional high-volume dates: 3,690 poojas total.
insert into validation_dates (annual_month, annual_day, target_count, bucket)
select annual_month, annual_day, case when candidate_no = 1 then 218 else 217 end, 'high'
from validation_date_candidates
where candidate_no between 1 and 17;

-- Ninety-nine additional medium dates, four poojas each.
insert into validation_dates (annual_month, annual_day, target_count, bucket)
select annual_month, annual_day, 4, 'medium'
from validation_date_candidates
where candidate_no between 18 and 116;

-- Seventy-nine additional low dates, two poojas each.
insert into validation_dates (annual_month, annual_day, target_count, bucket)
select annual_month, annual_day, 2, 'low'
from validation_date_candidates
where candidate_no between 117 and 195;

with expanded_dates as (
  select
    annual_month,
    annual_day,
    bucket,
    row_number() over (order by annual_month, annual_day, occurrence_no) as enrollment_no
  from validation_dates
  cross join lateral generate_series(1, target_count) occurrence_no
), enrollment_source as (
  select
    expanded.*,
    mapping.devotee_id,
    mapping.beneficiary_id,
    expanded.enrollment_no % 3 = 0 as for_self
  from expanded_dates expanded
  join validation_devotees mapping
    on mapping.seed_no = 1 + ((expanded.enrollment_no - 1) % 2000)
)
insert into public.pooja_enrollments (
  devotee_id, for_self, beneficiary_id, annual_month, annual_day,
  address_mode, custom_address_line1, custom_address_line2,
  custom_address_city, custom_address_district, custom_address_state,
  custom_address_postal_code, status, fee_minor, currency,
  enrollment_date, notes, created_at, modified_at
)
select
  devotee_id,
  for_self,
  case when for_self then null else beneficiary_id end,
  annual_month,
  annual_day,
  case when enrollment_no % 5 = 0 then 'custom'::public.address_mode else 'devotee_primary'::public.address_mode end,
  case when enrollment_no % 5 = 0 then ((enrollment_no % 190) + 1)::text || ', Festival Road' end,
  case when enrollment_no % 10 = 0 then 'Near Community Hall' end,
  case when enrollment_no % 5 = 0 then (array['Bengaluru','Mangaluru','Udupi','Mysuru','Karkala'])[1 + ((enrollment_no - 1) % 5)] end,
  case when enrollment_no % 5 = 0 then (array['Bengaluru Urban','Dakshina Kannada','Udupi','Mysuru','Udupi'])[1 + ((enrollment_no - 1) % 5)] end,
  case when enrollment_no % 5 = 0 then 'Karnataka' end,
  case when enrollment_no % 5 = 0 then (570000 + (enrollment_no % 29999))::text end,
  'active'::public.enrollment_status,
  100000,
  'INR',
  current_date - ((enrollment_no % 1000) || ' days')::interval,
  'CALENDAR_VALIDATION_SEED_V1:' || bucket,
  now() - ((enrollment_no % 1000) || ' days')::interval,
  now()
from enrollment_source;

do $$
declare
  devotee_count integer;
  pooja_count integer;
begin
  select count(*) into devotee_count from public.devotees where notes = 'CALENDAR_VALIDATION_SEED_V1';
  select count(*) into pooja_count from public.pooja_enrollments where notes like 'CALENDAR_VALIDATION_SEED_V1:%';
  if devotee_count <> 2000 or pooja_count <> 5000 then
    raise exception 'Unexpected seed counts: % devotees, % poojas', devotee_count, pooja_count;
  end if;
end;
$$;

commit;
