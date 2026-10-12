// Runs an AI prioritization for the signed-in user's open queue and stores the evidence.
// Reads go through the user's session, so the model only ever sees rows RLS allowed.
import type { ServerSupabase } from "@/lib/supabase/server";
import { prioritizeWithAI, type AiRun, type CompleteFn } from "@/lib/ai/prioritize";
import { logEvent } from "./audit";
import { listQueue } from "./discrepancies";

export interface RunSummary {
  runId: string;
  source: AiRun["source"];
  status: AiRun["status"];
  reason: string | null;
  model: string;
  latencyMs: number;
  sentCount: number;
  insightCount: number;
}

interface InsightRow {
  run_id: string;
  kind: "priority";
  model: string;
  prompt_version: string;
  validation_status: AiRun["status"];
  latency_ms: number;
  discrepancy_id: string | null;
  explanation: string | null;
  suggested_priority?: number;
  suggested_action?: string;
  confidence?: number;
  cited_ids?: string[];
}

export async function runPrioritization(
  supabase: ServerSupabase,
  opts: { complete: CompleteFn; model: string; timeoutMs: number },
): Promise<{ data: RunSummary | null; error: string | null }> {
  const queue = await listQueue(supabase, { status: "open" });
  if (queue.error || !queue.data) return { data: null, error: queue.error ?? "Sin datos" };
  if (queue.data.length === 0) return { data: null, error: "No hay discrepancias abiertas para priorizar." };

  const run = await prioritizeWithAI(queue.data, opts);
  const runId = crypto.randomUUID();
  const common = {
    run_id: runId,
    kind: "priority" as const,
    model: run.model,
    prompt_version: run.promptVersion,
    validation_status: run.status,
    latency_ms: run.latencyMs,
  };

  const rows: InsightRow[] =
    run.source === "ai"
      ? [...run.insights].map(([id, i]) => ({
          ...common,
          discrepancy_id: id,
          suggested_priority: i.priority,
          explanation: i.explanation,
          suggested_action: i.suggestedAction,
          confidence: i.confidence,
          cited_ids: [id, ...i.relatedIds],
        }))
      : [{ ...common, discrepancy_id: null, explanation: run.reason }];

  const { error } = await supabase.from("ai_insights").insert(rows);

  // What was sent is logged by id only, never by content.
  await logEvent(supabase, {
    action: "ai_prioritize",
    resource: "discrepancies",
    resourceId: runId,
    result: run.source === "ai" ? "allowed" : "error",
    reason: run.status === "valid" ? null : `${run.status}: ${run.reason}`,
    metadata: {
      sent_ids: run.sentIds,
      model: run.model,
      prompt_version: run.promptVersion,
      validation_status: run.status,
      latency_ms: run.latencyMs,
      insight_count: run.insights.size,
      stored: !error,
    },
  });
  if (error) return { data: null, error: error.message };

  return {
    data: {
      runId,
      source: run.source,
      status: run.status,
      reason: run.reason,
      model: run.model,
      latencyMs: run.latencyMs,
      sentCount: run.sentIds.length,
      insightCount: run.insights.size,
    },
    error: null,
  };
}
