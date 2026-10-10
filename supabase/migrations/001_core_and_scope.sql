-- 001: geography, user profiles and the scope helpers every RLS policy relies on.
-- Deny by default: RLS is enabled on every table and anon gets no table privileges.

create type public.app_role as enum ('analyst', 'regional_lead', 'global_manager', 'admin');

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2}$'),
  name text not null,
  region_id uuid not null references public.regions (id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  country_id uuid references public.countries (id),
  region_id uuid references public.regions (id),
  created_at timestamptz not null default now(),
  -- each role carries exactly the scope it needs, nothing more
  constraint profiles_scope_matches_role check (
    (role = 'analyst' and country_id is not null and region_id is null)
    or (role = 'regional_lead' and region_id is not null and country_id is null)
    or (role in ('global_manager', 'admin') and country_id is null and region_id is null)
  )
);

-- Helpers live in a schema that PostgREST does not expose, so they cannot be called over the API.
create schema private;
grant usage on schema private to authenticated;

-- SECURITY DEFINER lets the helpers read profiles without recursing into profiles' own RLS.
create function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid()
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.user_id = auth.uid()), false)
$$;

-- Countries the current user may see. Empty array (never null) when there is no profile.
create function private.visible_country_ids()
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(c.id), '{}')
  from public.countries c
  join public.profiles p on p.user_id = auth.uid()
  where p.role in ('global_manager', 'admin')
     or (p.role = 'regional_lead' and c.region_id = p.region_id)
     or (p.role = 'analyst' and c.id = p.country_id)
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

alter table public.regions enable row level security;
alter table public.countries enable row level security;
alter table public.profiles enable row level security;

-- (select ...) wrappers make Postgres evaluate the helper once per query, not once per row.
create policy countries_select_in_scope on public.countries
  for select to authenticated
  using (id = any ((select private.visible_country_ids())::uuid[]));

create policy regions_select_in_scope on public.regions
  for select to authenticated
  using (exists (
    select 1 from public.countries c
    where c.region_id = regions.id
      and c.id = any ((select private.visible_country_ids())::uuid[])
  ));

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
