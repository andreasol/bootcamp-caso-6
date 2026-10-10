import type { ServerSupabase } from "@/lib/supabase/server";

export type AppRole = "analyst" | "regional_lead" | "global_manager" | "admin";

export interface CurrentProfile {
  userId: string;
  email: string;
  fullName: string;
  role: AppRole;
  country: { code: string; name: string } | null;
  region: { code: string; name: string } | null;
}

// data is null (with no error) when the user is signed in but has no profile yet.
export async function getCurrentProfile(
  supabase: ServerSupabase,
): Promise<{ data: CurrentProfile | null; error: string | null }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { data: null, error: "No hay una sesión activa." };

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, country:countries(code, name), region:regions(code, name)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };

  const row = data as unknown as {
    full_name: string;
    role: AppRole;
    country: { code: string; name: string } | null;
    region: { code: string; name: string } | null;
  };
  return {
    data: {
      userId: user.id,
      email: user.email ?? "",
      fullName: row.full_name,
      role: row.role,
      country: row.country,
      region: row.region,
    },
    error: null,
  };
}
