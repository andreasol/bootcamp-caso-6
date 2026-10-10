-- 002: source systems, file inventory, raw local data (old format) and global data (new format).
-- Raw local rows are text exactly as received; only the deterministic adapter interprets them.

create table public.source_systems (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('local', 'global')),
  domain text not null check (domain in ('payroll', 'leave')),
  -- local systems belong to one country; global systems serve all of them
  country_id uuid references public.countries (id),
  created_at timestamptz not null default now(),
  constraint source_systems_country_by_kind check (
    (kind = 'local' and country_id is not null) or (kind = 'global' and country_id is null)
  )
);

-- What should arrive each month, per country. Basis for missing_file and the collection inventory.
create table public.expected_sources (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),
  country_id uuid not null references public.countries (id),
  source_system_id uuid not null references public.source_systems (id),
  created_at timestamptz not null default now(),
  unique (period, country_id, source_system_id)
);

-- What actually arrived: one file per system, country and period.
create table public.source_batches (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),
  country_id uuid not null references public.countries (id),
  source_system_id uuid not null references public.source_systems (id),
  file_name text not null,
  row_count integer not null check (row_count >= 0),
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (period, country_id, source_system_id)
);

create table public.local_payroll_raw (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.source_batches (id) on delete cascade,
  line_number integer not null,
  emp_code text,
  period_text text,
  concept_code text,
  amount_text text,
  status_code text,
  pay_date_text text,
  country_code text,
  created_at timestamptz not null default now(),
  unique (batch_id, line_number)
);

create table public.local_leave_raw (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.source_batches (id) on delete cascade,
  line_number integer not null,
  emp_code text,
  period_text text,
  leave_type_code text,
  balance_text text,
  status_code text,
  as_of_text text,
  country_code text,
  created_at timestamptz not null default now(),
  unique (batch_id, line_number)
);

create table public.global_payroll (
  id uuid primary key default gen_random_uuid(),
  record_id text not null unique,
  batch_id uuid not null references public.source_batches (id) on delete cascade,
  global_employee_id text not null,
  country_id uuid not null references public.countries (id),
  period date not null check (extract(day from period) = 1),
  concept text not null,
  amount numeric(14, 2) not null,
  currency text not null,
  pay_date date not null,
  status text not null check (status in ('active', 'closed', 'pending')),
  created_at timestamptz not null default now()
);

create table public.global_leave (
  id uuid primary key default gen_random_uuid(),
  record_id text not null unique,
  batch_id uuid not null references public.source_batches (id) on delete cascade,
  global_employee_id text not null,
  country_id uuid not null references public.countries (id),
  period date not null check (extract(day from period) = 1),
  leave_type text not null,
  balance_days numeric(6, 2) not null,
  as_of date not null,
  status text not null check (status in ('active', 'closed', 'pending')),
  created_at timestamptz not null default now()
);

alter table public.source_systems enable row level security;
alter table public.expected_sources enable row level security;
alter table public.source_batches enable row level security;
alter table public.local_payroll_raw enable row level security;
alter table public.local_leave_raw enable row level security;
alter table public.global_payroll enable row level security;
alter table public.global_leave enable row level security;

create policy source_systems_select_in_scope on public.source_systems
  for select to authenticated
  using (
    (kind = 'global' and (select private.current_app_role()) is not null)
    or country_id = any ((select private.visible_country_ids())::uuid[])
  );

create policy expected_sources_select_in_scope on public.expected_sources
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

create policy source_batches_select_in_scope on public.source_batches
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

-- Raw rows are not yet mapped to a trusted country, so only admins read them.
create policy local_payroll_raw_select_admin on public.local_payroll_raw
  for select to authenticated
  using ((select private.is_admin()));

create policy local_leave_raw_select_admin on public.local_leave_raw
  for select to authenticated
  using ((select private.is_admin()));

create policy global_payroll_select_in_scope on public.global_payroll
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

create policy global_leave_select_in_scope on public.global_leave
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));
