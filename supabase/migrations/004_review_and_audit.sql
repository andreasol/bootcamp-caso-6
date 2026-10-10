-- 004: thresholds, discrepancies, human review and the append-only audit log.
-- Users never write tables directly: status changes and audit entries go through
-- SECURITY DEFINER functions that re-check scope in code.

create table public.thresholds (
  id uuid primary key default gen_random_uuid(),
  -- null country = default for every country
  country_id uuid references public.countries (id),
  concept text not null,
  abs_threshold numeric(14, 2) not null check (abs_threshold >= 0),
  pct_threshold numeric(6, 4) not null check (pct_threshold >= 0),
  created_at timestamptz not null default now(),
  unique nulls not distinct (country_id, concept)
);

create table public.discrepancies (
  id uuid primary key default gen_random_uuid(),
  period date not null check (extract(day from period) = 1),
  type text not null check (type in (
    'amount_mismatch', 'leave_balance_mismatch', 'missing_in_global', 'missing_in_local', 'missing_file'
  )),
  country_id uuid not null references public.countries (id),
  -- null for missing_file
  employee_id uuid references public.employees (id),
  concept text,
  -- null for missing_file; set for file-level discrepancies
  source_system_id uuid references public.source_systems (id),
  unit text check (unit in ('currency', 'days')),
  local_value numeric(14, 2),
  global_value numeric(14, 2),
  variance numeric(14, 2),
  variance_pct numeric(10, 4),
  threshold_abs numeric(14, 2),
  threshold_pct numeric(6, 4),
  local_record_id text,
  global_record_id text,
  rule_priority smallint not null check (rule_priority between 1 and 3),
  rule_reason text not null,
  status text not null default 'open' check (status in ('open', 'approved', 'corrected', 'escalated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (period, type, country_id, employee_id, concept, source_system_id)
);

create index discrepancies_queue_idx on public.discrepancies (country_id, status, rule_priority);

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  discrepancy_id uuid not null references public.discrepancies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('approve', 'correct', 'escalate')),
  comment text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  role text,
  action text not null,
  resource text not null,
  resource_id text,
  result text not null check (result in ('allowed', 'denied', 'error')),
  reason text,
  metadata jsonb not null default '{}'
);

create index audit_log_created_idx on public.audit_log (created_at desc);

-- Append-only: nobody (not even service_role) may rewrite history.
create function private.block_audit_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.block_audit_changes();

alter table public.thresholds enable row level security;
alter table public.discrepancies enable row level security;
alter table public.review_actions enable row level security;
alter table public.audit_log enable row level security;

create policy thresholds_select_in_scope on public.thresholds
  for select to authenticated
  using (
    (country_id is null and (select private.current_app_role()) is not null)
    or country_id = any ((select private.visible_country_ids())::uuid[])
  );

create policy discrepancies_select_in_scope on public.discrepancies
  for select to authenticated
  using (country_id = any ((select private.visible_country_ids())::uuid[]));

create policy review_actions_select_in_scope on public.review_actions
  for select to authenticated
  using (exists (
    select 1 from public.discrepancies d
    where d.id = review_actions.discrepancy_id
      and d.country_id = any ((select private.visible_country_ids())::uuid[])
  ));

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select private.is_admin()));

-- Writes an audit entry stamped with the caller's identity. Callers cannot spoof user or role.
create function public.log_event(
  p_action text,
  p_resource text,
  p_resource_id text default null,
  p_result text default 'allowed',
  p_reason text default null,
  p_metadata jsonb default '{}'
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (user_id, role, action, resource, resource_id, result, reason, metadata)
  values (
    auth.uid(),
    private.current_app_role()::text,
    p_action, p_resource, p_resource_id, p_result, p_reason, coalesce(p_metadata, '{}')
  );
end;
$$;

-- The only way to change a discrepancy's status. Out-of-scope ids behave exactly like
-- non-existent ids (returns null) so the response leaks nothing; the attempt is audited.
create function public.review_discrepancy(p_id uuid, p_action text, p_comment text default null)
returns public.discrepancies
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.discrepancies;
  v_new_status text;
begin
  if p_action not in ('approve', 'correct', 'escalate') then
    raise exception 'invalid action: %', p_action;
  end if;
  if p_action in ('correct', 'escalate') and coalesce(btrim(p_comment), '') = '' then
    raise exception 'comment required for %', p_action;
  end if;

  select * into v_row from public.discrepancies d
  where d.id = p_id and d.country_id = any (private.visible_country_ids())
  for update;

  if not found then
    perform public.log_event('review_discrepancy', 'discrepancies', p_id::text, 'denied',
      'not found or out of scope', jsonb_build_object('action', p_action));
    return null;
  end if;

  if v_row.status in ('approved', 'corrected') then
    perform public.log_event('review_discrepancy', 'discrepancies', p_id::text, 'denied',
      'already closed', jsonb_build_object('action', p_action, 'status', v_row.status));
    return null;
  end if;

  v_new_status := case p_action
    when 'approve' then 'approved' when 'correct' then 'corrected' else 'escalated' end;

  insert into public.review_actions (discrepancy_id, user_id, action, comment)
  values (p_id, auth.uid(), p_action, nullif(btrim(p_comment), ''));

  update public.discrepancies set status = v_new_status, updated_at = now()
  where id = p_id returning * into v_row;

  perform public.log_event('review_discrepancy', 'discrepancies', p_id::text, 'allowed', null,
    jsonb_build_object('action', p_action, 'new_status', v_new_status));
  return v_row;
end;
$$;

revoke all on function public.log_event(text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.review_discrepancy(uuid, text, text) from public, anon;
grant execute on function public.log_event(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.review_discrepancy(uuid, text, text) to authenticated;

-- Defense in depth on top of RLS: anon reads nothing, authenticated only reads.
-- All writes go through the functions above or through local service_role scripts.
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate on all tables in schema public from authenticated;

-- Same rule for anything created later (Phase 2 tables and functions).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
