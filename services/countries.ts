import type { ServerSupabase } from "@/lib/supabase/server";

export interface VisibleCountry {
  id: string;
  code: string;
  name: string;
}

// RLS returns only the countries in the user's scope.
export async function listVisibleCountries(
  supabase: ServerSupabase,
): Promise<{ data: VisibleCountry[] | null; error: string | null }> {
  const { data, error } = await supabase.from("countries").select("id, code, name").order("name");
  if (error) return { data: null, error: error.message };
  return { data: data as VisibleCountry[], error: null };
}
