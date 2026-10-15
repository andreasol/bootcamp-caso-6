-- 007: DEMO MODE. While the flag is on, a signed-in account with no role may pick its own role.
-- This weakens "only an admin grants access" on purpose, for the review period only.
-- Guard rails: never 'admin', only if the account has no profile yet, scope is validated,
-- every claim is audited, and one UPDATE turns the whole thing off:
--   update public.app_settings set enabled = false where key = 'demo_self_assign';

create table public.app_settings (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
-- No policies: nobody reads or writes it directly. Only the functions below touch it.

insert into public.app_settings (key, enabled) values ('demo_self_assign', true);

-- Lets the sign-up page decide whether to show the role picker (callable before signing in).
create function public.demo_self_assign_enabled()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select enabled from public.app_settings where key = 'demo_self_assign'), false)
$$;

-- Returns null on success or a Spanish error message (never raises for expected cases, so the
-- audit entry for a denied attempt is kept).
create function public.claim_demo_role(
  p_full_name text,
  p_role public.app_role,
  p_country_code text default null,
  p_region_code text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_country_id uuid;
  v_region_id uuid;
  v_meta jsonb := jsonb_build_object('role', p_role, 'country', p_country_code, 'region', p_region_code);
begin
  if auth.uid() is null then
    return 'Inicia sesión para elegir tu rol.';
  end if;
  if not public.demo_self_assign_enabled() then
    perform public.log_event('claim_demo_role', 'profiles', auth.uid()::text, 'denied', 'demo mode is off', v_meta);
    return 'La auto-asignación de roles está desactivada. Pide al administrador que te asigne uno.';
  end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then
    perform public.log_event('claim_demo_role', 'profiles', auth.uid()::text, 'denied', 'already has a role', v_meta);
    return 'Tu cuenta ya tiene un rol asignado.';
  end if;
  if p_role = 'admin' then
    perform public.log_event('claim_demo_role', 'profiles', auth.uid()::text, 'denied', 'admin cannot be self-assigned', v_meta);
    return 'El rol de administrador solo lo asigna otro administrador.';
  end if;
  if coalesce(btrim(p_full_name), '') = '' then
    return 'Escribe tu nombre.';
  end if;

  if p_role = 'analyst' then
    select id into v_country_id from public.countries where code = p_country_code;
    if v_country_id is null then return 'Elige tu país.'; end if;
  elsif p_role = 'regional_lead' then
    select id into v_region_id from public.regions where code = p_region_code;
    if v_region_id is null then return 'Elige tu región.'; end if;
  end if;

  insert into public.profiles (user_id, full_name, role, country_id, region_id)
  values (auth.uid(), btrim(p_full_name), p_role, v_country_id, v_region_id);

  perform public.log_event('claim_demo_role', 'profiles', auth.uid()::text, 'allowed', 'demo self-assign', v_meta);
  return null;
end;
$$;

revoke all on function public.demo_self_assign_enabled() from public;
revoke all on function public.claim_demo_role(text, public.app_role, text, text) from public, anon;
grant execute on function public.demo_self_assign_enabled() to anon, authenticated;
grant execute on function public.claim_demo_role(text, public.app_role, text, text) to authenticated;
