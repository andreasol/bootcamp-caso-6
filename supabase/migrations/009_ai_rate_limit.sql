-- 009: per-user cooldown for the AI endpoint (OWASP A04: unrestricted resource consumption).
-- Sign-up is open and every account can reach the endpoint, so without a limit anyone could burn
-- the model quota in a loop. The check is atomic: INSERT .. ON CONFLICT DO UPDATE .. WHERE takes a
-- row lock, so two simultaneous clicks cannot both pass.

create table public.ai_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_started_at timestamptz not null
);

alter table public.ai_rate_limits enable row level security;
-- No policies: users never read or write this table directly.

-- Returns 0 when the caller may start a run (and records it), or the seconds still to wait.
-- Returns -1 for an anonymous caller.
create function public.ai_try_start(p_cooldown_seconds integer default 60)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_wait integer;
begin
  if auth.uid() is null then
    return -1;
  end if;

  insert into public.ai_rate_limits as r (user_id, last_started_at)
  values (auth.uid(), now())
  on conflict (user_id) do update
    set last_started_at = now()
    where r.last_started_at <= now() - make_interval(secs => p_cooldown_seconds);

  if found then
    return 0;
  end if;

  select greatest(ceil(extract(epoch from (r.last_started_at + make_interval(secs => p_cooldown_seconds) - now())))::integer, 1)
    into v_wait
  from public.ai_rate_limits r
  where r.user_id = auth.uid();

  perform public.log_event('ai_prioritize', 'discrepancies', null, 'denied', 'rate limited',
    jsonb_build_object('wait_seconds', v_wait));
  return v_wait;
end;
$$;

revoke all on function public.ai_try_start(integer) from public, anon;
grant execute on function public.ai_try_start(integer) to authenticated;
