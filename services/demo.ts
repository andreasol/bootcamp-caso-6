import type { ServerSupabase } from "@/lib/supabase/server";
import type { AppRole } from "./profile";

// Demo mode flag (migration 007). Readable before signing in so /signup can show the picker.
export async function isDemoSelfAssignEnabled(supabase: ServerSupabase): Promise<boolean> {
  const { data, error } = await supabase.rpc("demo_self_assign_enabled");
  return !error && data === true;
}

export type SelfRole = Exclude<AppRole, "admin">;

// Returns null on success or a Spanish message; admin is refused by the database function.
export async function claimDemoRole(
  supabase: ServerSupabase,
  input: { fullName: string; role: AppRole; countryCode: string | null; regionCode: string | null },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc("claim_demo_role", {
    p_full_name: input.fullName,
    p_role: input.role,
    p_country_code: input.countryCode,
    p_region_code: input.regionCode,
  });
  if (error) return { error: "No pudimos asignar el rol. Intenta de nuevo." };
  return { error: (data as string | null) ?? null };
}
