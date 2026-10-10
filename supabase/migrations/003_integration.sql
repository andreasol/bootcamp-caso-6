-- 003: employees, mapping tables, the common normalized schema and the quarantine.

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  global_employee_id text not null unique,
  country_id uuid not null references public.countries (id),
  full_name text not null,
  created_at timestamptz not null default now()
);

-- Local employee code -> global employee. Missing rows send records to quarantine.
create table public.employee_id_map (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references public.source_systems (id),
  local_code text not null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_system_id, local_code)
);

-- Local status codes (A/C/P...) -> normalized status.
create table public.status_code_map (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references public.source_systems (id),
  local_code text not null,
  normalized_status text not null check (normalized_status in ('active', 'closed', 'pending')),
  created_at timestamptz not null default now(),
  unique (source_system_id, local_code)
);

-- Local concept codes -> common concept names shared with the global system.
create table public.concept_map (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references public.source_systems (id),
  local_code text not null,
  concept text not null,
  created_at timestamptz not null default now(),
  unique (source_system_id, local_code)
);

create table public.normalized_records (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),
  employee_id uuid not null references public.employees (id),
  country_id uuid not null references public.countries (id),
  concept text not null,
  amount numeric(14, 2) not null,
  -- 'currency' for payroll amounts, 'days' for leave balances
  unit text not null check (unit in ('currency', 'days')),
  source_kind text not null check (source_kind in ('local', 'global')),
  source_system_id uuid not null references public.source_systems (id),
  source_record_id text not null,
  status text not null check (status in ('active', 'closed', 'pending')),
  created_at timestamptz not null default now(),
  unique (source_system_id, source_record_id)
);

-- Records the adapter could not map. Blocked by default: no country, admin-only.
create table public.quarantine (
  id uuid primary key default gen_random_uuid(),
  source_system_id uuid not null references public.source_systems (id),
  source_table text not null,
  source_record_id text not null,
  reason text not null check (reason in (
    'unmapped_employee', 'unmapped_country', 'unmapped_status', 'unmapped_concept',
    'invalid_date', 'invalid_amount', 'missing_field'
  )),
  detail text not null,
  raw jsonb not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_system_id, source_record_id)
);

alter table public.employees enable row level security;
alter table public.employee_id_map enable row level security;
alter table public.status_code_map enable row level security;
alter table public.concept_map enable row level security;
alter table public.normalized_records enable row level security;
alter table public.quarantine enable row level security;

create policy employees_select_in_scope on public.employees
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

-- Mapping tables cross country boundaries (they list every local code), so admin-only.
create policy employee_id_map_select_admin on public.employee_id_map
  for select to authenticated
  using ((select private.is_admin()));

create policy status_code_map_select_admin on public.status_code_map
  for select to authenticated
  using ((select private.is_admin()));

create policy concept_map_select_admin on public.concept_map
  for select to authenticated
  using ((select private.is_admin()));

create policy normalized_records_select_in_scope on public.normalized_records
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

create policy quarantine_select_admin on public.quarantine
  for select to authenticated
  using ((select private.is_admin()));
