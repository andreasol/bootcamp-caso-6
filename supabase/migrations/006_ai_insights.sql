-- 006: AI suggestions. Advisory only: they never change a discrepancy's status.
-- A run is one call to the model; every run leaves a row, valid or not, as evidence.

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  run_id uuid not null,
  -- null on the row that records a failed run (nothing valid to attach)
  discrepancy_id uuid references public.discrepancies (id) on delete cascade,
  kind text not null check (kind in ('priority', 'briefing')),
  suggested_priority smallint check (suggested_priority between 1 and 3),
  explanation text,
  suggested_action text,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  -- every id here was checked against the ids actually sent to the model
  cited_ids uuid[] not null default '{}',
  model text not null,
  prompt_version text not null,
  validation_status text not null check (validation_status in (
    'valid', 'invalid_json', 'invalid_schema', 'unknown_id', 'timeout', 'error'
  )),
  latency_ms integer,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade
);

create index ai_insights_discrepancy_idx on public.ai_insights (discrepancy_id, created_at desc);

alter table public.ai_insights enable row level security;

-- Read: insights about discrepancies in scope; run-level rows only for their author or admin.
create policy ai_insights_select_in_scope on public.ai_insights
  for select to authenticated
  using (
    (discrepancy_id is not null and exists (
      select 1 from public.discrepancies d
      where d.id = ai_insights.discrepancy_id
        and d.country_id = any ((select private.visible_country_ids())::uuid[])
    ))
    or (discrepancy_id is null and (created_by = (select auth.uid()) or (select private.is_admin())))
  );

-- Write: the signed-in user stores the result of its own run, only for discrepancies it can see.
create policy ai_insights_insert_own_in_scope on public.ai_insights
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (discrepancy_id is null or exists (
      select 1 from public.discrepancies d
      where d.id = ai_insights.discrepancy_id
        and d.country_id = any ((select private.visible_country_ids())::uuid[])
    ))
  );

grant insert on public.ai_insights to authenticated;
