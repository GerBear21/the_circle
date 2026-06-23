-- ============================================================================
-- HRIMS DEMO — faithful structural clone of the real HRIMS tables + fake seed
-- ----------------------------------------------------------------------------
-- RUN THIS ON THE "HRIMS DEMO" SUPABASE PROJECT (a throwaway clone — NOT the
-- real HRIMS, NOT The Circle staging).
--
-- This reproduces the REAL HRIMS structure for the tables The Circle reads
-- (business_units, departments, employees, organogram_positions) — exact
-- columns, enum types, defaults, CHECK constraints and foreign keys — then
-- seeds a self-contained fake org chart. No real HRIMS data (PII) is copied.
--
-- FK targets that already exist in any Supabase project (auth.users) are kept;
-- the parent `organizations` table is recreated minimally so its FKs resolve.
--
-- Then point ONLY staging's HRIMS_SUPABASE_URL / HRIMS_SUPABASE_SERVICE_ROLE_KEY
-- at this project. No application code changes are required.
--
-- Safe to re-run.
-- ============================================================================

-- ---- clean slate -----------------------------------------------------------
drop table if exists public.organogram_positions cascade;
drop table if exists public.employees cascade;
drop table if exists public.departments cascade;
drop table if exists public.business_units cascade;
drop table if exists public.organizations cascade;
drop type if exists business_unit_type cascade;
drop type if exists employment_status cascade;
drop type if exists employment_type cascade;
drop type if exists exit_type cascade;

-- ---- enum types (mirrors real HRIMS) ---------------------------------------
create type business_unit_type as enum ('head_office','hotel','restaurant','tour_operator','other');
create type employment_status as enum ('active','on_leave','terminated','retired','probation','suspended','resigned');
create type employment_type  as enum ('full_time','part_time','contract','intern','consultant');
create type exit_type        as enum ('resignation','termination','retirement','transfer');

-- ---- parent table (FK target) ----------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- ---- business_units --------------------------------------------------------
create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  type business_unit_type not null,
  description text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  is_active boolean not null default true,
  image_url text,
  organogram_version integer default 1,
  organogram_last_updated timestamptz,
  organogram_approved_by uuid references auth.users(id) on delete set null,
  unique (organization_id, code)
);

-- ---- departments (department_head_id FK added after employees exists) -------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  name text not null,
  code text not null,
  description text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  department_head_id uuid,
  unique (business_unit_id, code)
);

-- ---- employees (current_position_id FK added after positions exist) ---------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  employee_number text not null unique,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  job_title text,
  employment_status employment_status default 'active',
  employment_type employment_type default 'full_time',
  hire_date date,
  termination_date date,
  manager_id uuid references public.employees(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  offboarding_status text default 'not_initiated'
    check (offboarding_status in ('not_initiated','initiated','in_progress','completed','cancelled')),
  exit_type exit_type,
  last_working_day date,
  exit_reason text,
  exit_notes text,
  resignation_letter_url text,
  exit_submitted_date timestamptz,
  exit_approved_date timestamptz,
  exit_approved_by uuid references public.employees(id) on delete set null,
  exit_rejection_reason text,
  enable_questionnaire boolean default true,
  enable_thank_you_message boolean default true,
  enable_certificate_of_employment boolean default true,
  offboarding_hr_notes text,
  clearance_departments jsonb default '[]'::jsonb,
  clearance_status jsonb default '{}'::jsonb,
  exit_questionnaire_response jsonb,
  salary numeric,
  current_position_id uuid,
  race text,
  nationality text default 'Zimbabwean',
  passport_number text,
  phone_secondary text,
  shift_schedule text,
  job_description text,
  probation_start_date date,
  address_line1 text,
  address_line2 text,
  city text,
  state_province text,
  postal_code text,
  country text,
  date_of_birth date,
  middle_name text,
  gender text,
  marital_status text,
  emergency_contact_email text,
  next_of_kin_address text,
  national_id text,
  next_of_kin_name text,
  next_of_kin_phone text,
  next_of_kin_relationship text,
  profile_verified boolean default false,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  grade text,
  belina_employee_code text,
  belina_client_id text,
  pay_point_name text,
  pay_point_code text,
  cost_centre_name text,
  cost_centre_code text,
  internal_grade text,
  nec_grade text,
  payroll_name text,
  auth_provider text not null default 'azure' check (auth_provider in ('azure','google')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- ---- organogram_positions --------------------------------------------------
create table public.organogram_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  position_title text not null,
  position_code text,
  grade text,
  level integer not null default 1,
  description text,
  responsibilities text[],
  required_qualifications text[],
  required_skills text[],
  count integer not null default 1,
  filled_count integer not null default 0,
  status text not null default 'vacant'
    check (status in ('filled','vacant','partially_filled','proposed','frozen','eliminated')),
  parent_position_id uuid references public.organogram_positions(id) on delete set null,
  sort_order integer default 0,
  employee_id uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  salary_min numeric(15,2),
  salary_max numeric(15,2),
  currency text default 'USD',
  metadata jsonb default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  effective_date date default current_date,
  end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz default now(),
  constraint valid_filled_count check (filled_count <= count),
  constraint valid_dates check (effective_date is null or end_date is null or effective_date <= end_date),
  constraint valid_salary_range check (salary_min is null or salary_max is null or salary_min <= salary_max)
);

-- ---- deferred (circular) foreign keys --------------------------------------
alter table public.departments
  add constraint departments_department_head_id_fkey
  foreign key (department_head_id) references public.employees(id) on delete set null;

alter table public.employees
  add constraint employees_current_position_id_fkey
  foreign key (current_position_id) references public.organogram_positions(id) on delete set null;

create index on public.employees (lower(email));
create index on public.organogram_positions (parent_position_id);
create index on public.organogram_positions (employee_id);

-- ============================================================================
-- SEED — fake org chart. Emails are NON-Microsoft (@rtg.demo)
-- except Geraldine, who signs in via real Azure AD and must resolve to a role.
-- ============================================================================

insert into public.organizations (id, name, code) values
  ('00000000-0000-0000-0000-0000000000aa', 'RTG Demo', 'RTGDEMO');

insert into public.business_units (id, organization_id, name, code, type, is_active) values
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'Rainbow Towers', 'RTH', 'hotel', true);

insert into public.departments (id, business_unit_id, name, code) values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Finance',     'FIN'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Procurement', 'PRC'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Projects',    'PRJ'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'ICT',         'ICT'),
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'Corporate',   'COR');

-- employees first (current_position_id wired up after positions exist)
insert into public.employees
  (id, organization_id, business_unit_id, department_id, employee_number, first_name, last_name, email, job_title, employment_status) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'D001', 'Tendai',    'Chikwava', 'ceo@rtg.demo',          'Chief Executive Officer',      'active'),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'D002', 'Rumbidzai', 'Madziva',  'md@rtg.demo',           'Managing Director',            'active'),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'D003', 'Farai',     'Moyo',     'fd@rtg.demo',           'Finance Director',             'active'),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'D004', 'Chipo',     'Dube',     'fm@rtg.demo',           'Finance Manager',              'active'),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'D005', 'Tatenda',   'Sibanda',  'proc@rtg.demo',  'Procurement Manager',          'active'),
  ('e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'D006', 'Kudakwashe','Nyathi',   'proj@rtg.demo',     'Projects Manager',             'active'),
  ('e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'D007', 'Nomsa',     'Khumalo',  'chod@rtg.demo', 'Corporate Head of Department', 'active'),
  ('e0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'D008', 'Brian',     'Chari',    'it@rtg.demo',    'Head of IT',                   'active'),
  ('e0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'D009', 'Rudo',      'Chasi'   ,'rudo@rtg.demo',    'ICT Officer',                  'active'),
  ('e0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'D010', 'Geraldine', 'Ndoro',    'Geraldine.Ndoro@rtg.co.zw',         'Systems Analyst',              'active');

insert into public.organogram_positions
  (id, organization_id, business_unit_id, position_title, level, status, count, filled_count, parent_position_id, employee_id, department_id, sort_order, is_active) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'CEO',                          1, 'filled', 1, 1, null,                                     'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 0, true),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Managing Director',            2, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 0, true),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Finance Director',             3, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 0, true),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Corporate Head of Department', 3, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000005', 1, true),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Finance Manager',              4, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 0, true),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Procurement Manager',          4, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 1, true),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Projects Manager',             4, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 2, true),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Head of IT',                   4, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000004', 3, true),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'ICT Officer',                  5, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000004', 0, true),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-0000000000aa', 'b0000000-0000-0000-0000-000000000001', 'Systems Analyst',              5, 'filled', 1, 1, 'a0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000004', 1, true);

-- wire employees -> their current position
update public.employees e set current_position_id = p.id
from public.organogram_positions p
where p.employee_id = e.id;

-- wire department heads (CAPEX "general_manager" / department-head resolution)
update public.departments set department_head_id = 'e0000000-0000-0000-0000-000000000003' where id = 'd0000000-0000-0000-0000-000000000001'; -- Finance     -> Farai Moyo
update public.departments set department_head_id = 'e0000000-0000-0000-0000-000000000005' where id = 'd0000000-0000-0000-0000-000000000002'; -- Procurement -> Tatenda Sibanda
update public.departments set department_head_id = 'e0000000-0000-0000-0000-000000000006' where id = 'd0000000-0000-0000-0000-000000000003'; -- Projects    -> Kudakwashe Nyathi
update public.departments set department_head_id = 'e0000000-0000-0000-0000-000000000008' where id = 'd0000000-0000-0000-0000-000000000004'; -- ICT         -> Brian Chari
update public.departments set department_head_id = 'e0000000-0000-0000-0000-000000000007' where id = 'd0000000-0000-0000-0000-000000000005'; -- Corporate   -> Nomsa Khumalo
