import type { ServerSupabase } from "@/lib/supabase/server";

export type ReviewAction = "approve" | "correct" | "escalate";

export interface SourceRecord {
  sourceRecordId: string;
  sourceKind: "local" | "global";
  systemName: string;
  amount: number;
  unit: "currency" | "days";
  status: string;
}

export interface ReviewEntry {
  id: string;
  action: ReviewAction;
  comment: string | null;
  createdAt: string;
  userId: string;
}

// The normalized rows a discrepancy cites. RLS applies: out-of-scope ids return nothing.
export async function listSourceRecords(
  supabase: ServerSupabase,
  recordIds: string[],
): Promise<{ data: SourceRecord[] | null; error: string | null }> {
  if (recordIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from("normalized_records")
    .select("source_record_id, source_kind, amount, unit, status, source_system:source_systems(name)")
    .in("source_record_id", recordIds)
    .order("source_kind", { ascending: false });
  if (error) return { data: null, error: error.message };
  const rows = data as unknown as {
    source_record_id: string;
    source_kind: "local" | "global";
    amount: number;
    unit: "currency" | "days";
    status: string;
    source_system: { name: string } | null;
  }[];
  return {
    data: rows.map((r) => ({
      sourceRecordId: r.source_record_id,
      sourceKind: r.source_kind,
      systemName: r.source_system?.name ?? "—",
      amount: Number(r.amount),
      unit: r.unit,
      status: r.status,
    })),
    error: null,
  };
}

export async function listReviews(
  supabase: ServerSupabase,
  discrepancyId: string,
): Promise<{ data: ReviewEntry[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("review_actions")
    .select("id, action, comment, created_at, user_id")
    .eq("discrepancy_id", discrepancyId)
    .order("created_at", { ascending: false });
  if (error) return { data: null, error: error.message };
  return {
    data: data.map((r) => ({
      id: r.id,
      action: r.action as ReviewAction,
      comment: r.comment,
      createdAt: r.created_at,
      userId: r.user_id,
    })),
    error: null,
  };
}

// The database function checks scope and transitions; it returns no row when it refuses.
export async function reviewDiscrepancy(
  supabase: ServerSupabase,
  input: { id: string; action: ReviewAction; comment: string | null },
): Promise<{ data: { status: string } | null; error: string | null }> {
  const { data, error } = await supabase.rpc("review_discrepancy", {
    p_id: input.id,
    p_action: input.action,
    p_comment: input.comment,
  });
  if (error) return { data: null, error: error.message };
  const row = data as { id: string | null; status: string | null } | null;
  if (!row?.id || !row.status) return { data: null, error: null };
  return { data: { status: row.status }, error: null };
}
