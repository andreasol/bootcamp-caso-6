// Reads stored AI suggestions. RLS limits them to discrepancies the user can see.
import type { InsightView } from "@/lib/ai/order";
import type { ServerSupabase } from "@/lib/supabase/server";

interface Row {
  discrepancy_id: string | null;
  suggested_priority: number | null;
  explanation: string | null;
  suggested_action: string | null;
  confidence: number | null;
  cited_ids: string[];
  model: string;
  created_at: string;
}

const COLUMNS = "discrepancy_id, suggested_priority, explanation, suggested_action, confidence, cited_ids, model, created_at";

function toView(r: Row): InsightView {
  return {
    priority: r.suggested_priority as 1 | 2 | 3,
    explanation: r.explanation ?? "",
    suggestedAction: r.suggested_action ?? "",
    confidence: Number(r.confidence ?? 0),
    // cited_ids[0] is the row's own id; the rest are other cases with the same likely cause
    relatedIds: r.cited_ids.filter((id) => id !== r.discrepancy_id),
    model: r.model,
    createdAt: r.created_at,
  };
}

// Latest valid suggestion per discrepancy (rows come newest first, so the first one wins).
export async function listInsights(
  supabase: ServerSupabase,
  discrepancyIds: string[],
): Promise<{ data: Map<string, InsightView> | null; error: string | null }> {
  if (discrepancyIds.length === 0) return { data: new Map(), error: null };
  const { data, error } = await supabase
    .from("ai_insights")
    .select(COLUMNS)
    .in("discrepancy_id", discrepancyIds)
    .eq("validation_status", "valid")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return { data: null, error: error.message };
  const map = new Map<string, InsightView>();
  for (const r of data as Row[]) {
    if (r.discrepancy_id && !map.has(r.discrepancy_id)) map.set(r.discrepancy_id, toView(r));
  }
  return { data: map, error: null };
}

export async function getInsight(
  supabase: ServerSupabase,
  discrepancyId: string,
): Promise<{ data: InsightView | null; error: string | null }> {
  const { data, error } = await listInsights(supabase, [discrepancyId]);
  if (error || !data) return { data: null, error };
  return { data: data.get(discrepancyId) ?? null, error: null };
}

export interface LastRun {
  status: string;
  reason: string | null;
  model: string;
  createdAt: string;
}

// The signed-in user's most recent run, valid or not: used to tell them when it fell back to rules.
export async function getLastOwnRun(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ data: LastRun | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("validation_status, explanation, model, created_at, discrepancy_id")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return {
    data: {
      status: data.validation_status,
      // a failed run stores its reason in `explanation`
      reason: data.discrepancy_id ? null : data.explanation,
      model: data.model,
      createdAt: data.created_at,
    },
    error: null,
  };
}
