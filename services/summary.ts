// Counts for the queue summary, read from the discrepancy_counts view (migration 008).
import type { ServerSupabase } from "@/lib/supabase/server";
import type { SummaryInput } from "@/lib/summary";
import type { DiscrepancyType } from "@/lib/domain/types";

interface CountRow {
  country_code: string;
  country_name: string;
  type: DiscrepancyType;
  status: SummaryInput["status"];
  rule_priority: 1 | 2 | 3;
  n: number;
}

// The view runs with the caller's privileges, so RLS already limits it to their scope.
export async function listCounts(
  supabase: ServerSupabase,
): Promise<{ data: SummaryInput[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("discrepancy_counts")
    .select("country_code, country_name, type, status, rule_priority, n");
  if (error) return { data: null, error: error.message };
  return {
    data: (data as CountRow[]).map((r) => ({
      count: r.n,
      status: r.status,
      type: r.type,
      rulePriority: r.rule_priority,
      country: { code: r.country_code, name: r.country_name },
    })),
    error: null,
  };
}
