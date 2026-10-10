import type { ServerSupabase } from "@/lib/supabase/server";
import type { AppRole } from "./profile";

export interface ManagedUser {
  userId: string;
  email: string;
  fullName: string;
  createdAt: string;
  lastSignInAt: string | null;
  role: AppRole | null;
  countryCode: string | null;
  regionCode: string | null;
}

interface Row {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: AppRole | null;
  country_code: string | null;
  region_code: string | null;
}

// The database function returns nothing unless the caller is admin.
export async function listUsers(supabase: ServerSupabase): Promise<{ data: ManagedUser[] | null; error: string | null }> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) return { data: null, error: error.message };
  return {
    data: (data as Row[]).map((r) => ({
      userId: r.user_id,
      email: r.email,
      fullName: r.full_name,
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      role: r.role,
      countryCode: r.country_code,
      regionCode: r.region_code,
    })),
    error: null,
  };
}

export async function assignRole(
  supabase: ServerSupabase,
  input: { userId: string; fullName: string; role: AppRole; countryCode: string | null; regionCode: string | null },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc("admin_assign_role", {
    p_user_id: input.userId,
    p_full_name: input.fullName,
    p_role: input.role,
    p_country_code: input.countryCode,
    p_region_code: input.regionCode,
  });
  if (error) return { error: error.message };
  return { error: (data as string | null) ?? null };
}

export async function revokeRole(supabase: ServerSupabase, userId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc("admin_revoke_role", { p_user_id: userId });
  if (error) return { error: error.message };
  return { error: (data as string | null) ?? null };
}
