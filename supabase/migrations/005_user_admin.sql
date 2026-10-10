-- 005: self sign-up lands with no profile (sees nothing); only an admin assigns role and scope.
-- Everything goes through SECURITY DEFINER functions that check is_admin() themselves,
-- so no service_role key is needed in the app.

-- Lists every account with its current role. Non-admins get an error and the attempt is logged.
create function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role public.app_role,
  country_code text,
  region_code text
)
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    perform public.log_event('admin_list_users', 'profiles', null, 'denied', 'caller is not admin');
    return;
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', '')::text,
      u.created_at,
      u.last_sign_in_at,
      p.role,
      c.code,
      r.code
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.countries c on c.id = p.country_id
    left join public.regions r on r.id = p.region_id
    order by p.role nulls first, u.created_at desc;
end;
$$;

-- Assigns (or changes) a user's role and scope. Returns null on success or a Spanish error
-- message; it never raises for expected cases so the audit entry is not rolled back.
create function public.admin_assign_role(
  p_user_id uuid,
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
  v_old_role public.app_role;
  v_meta jsonb := jsonb_build_object('target', p_user_id, 'role', p_role,
    'country', p_country_code, 'region', p_region_code);
begin
  if not private.is_admin() then
    perform public.log_event('admin_assign_role', 'profiles', p_user_id::text, 'denied', 'caller is not admin', v_meta);
    return 'No tienes permiso para asignar roles.';
  end if;
  if p_user_id = auth.uid() then
    perform public.log_event('admin_assign_role', 'profiles', p_user_id::text, 'denied', 'cannot change own role', v_meta);
    return 'No puedes cambiar tu propio rol.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    return 'La cuenta no existe.';
  end if;
  if coalesce(btrim(p_full_name), '') = '' then
    return 'Escribe el nombre de la persona.';
  end if;

  if p_role = 'analyst' then
    select id into v_country_id from public.countries where code = p_country_code;
    if v_country_id is null then return 'Elige el país del analista.'; end if;
  elsif p_role = 'regional_lead' then
    select id into v_region_id from public.regions where code = p_region_code;
    if v_region_id is null then return 'Elige la región del líder.'; end if;
  end if;

  select role into v_old_role from public.profiles where user_id = p_user_id;

  insert into public.profiles (user_id, full_name, role, country_id, region_id)
  values (p_user_id, btrim(p_full_name), p_role, v_country_id, v_region_id)
  on conflict (user_id) do update
    set full_name = excluded.full_name, role = excluded.role,
        country_id = excluded.country_id, region_id = excluded.region_id;

  perform public.log_event('admin_assign_role', 'profiles', p_user_id::text, 'allowed', null,
    v_meta || jsonb_build_object('previous_role', v_old_role));
  return null;
end;
$$;

-- Removes a user's role: the account still exists but sees nothing again.
create function public.admin_revoke_role(p_user_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    perform public.log_event('admin_revoke_role', 'profiles', p_user_id::text, 'denied', 'caller is not admin');
    return 'No tienes permiso para quitar roles.';
  end if;
  if p_user_id = auth.uid() then
    perform public.log_event('admin_revoke_role', 'profiles', p_user_id::text, 'denied', 'cannot change own role');
    return 'No puedes quitarte tu propio rol.';
  end if;

  delete from public.profiles where user_id = p_user_id;
  perform public.log_event('admin_revoke_role', 'profiles', p_user_id::text, 'allowed');
  return null;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_assign_role(uuid, text, public.app_role, text, text) from public, anon;
revoke all on function public.admin_revoke_role(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_assign_role(uuid, text, public.app_role, text, text) to authenticated;
grant execute on function public.admin_revoke_role(uuid) to authenticated;
