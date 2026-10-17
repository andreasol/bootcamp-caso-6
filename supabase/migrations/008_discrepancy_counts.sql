-- 008: counts for the queue summary, computed in the database instead of in the app.
-- security_invoker makes the view run with the CALLER's privileges, so RLS on discrepancies and
-- countries applies exactly as for a direct query: each role only counts what it can see.
-- Grouped output is tiny (countries x types x statuses x priorities), so it never hits the
-- API row cap that a row-by-row read of the whole scope would.

create view public.discrepancy_counts
with (security_invoker = true) as
select
  c.code as country_code,
  c.name as country_name,
  d.type,
  d.status,
  d.rule_priority,
  count(*)::int as n
from public.discrepancies d
join public.countries c on c.id = d.country_id
group by c.code, c.name, d.type, d.status, d.rule_priority;

revoke all on public.discrepancy_counts from public, anon;
grant select on public.discrepancy_counts to authenticated;
