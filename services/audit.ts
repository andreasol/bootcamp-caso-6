import type { ServerSupabase } from "@/lib/supabase/server";

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string | null;
  result: "allowed" | "denied" | "error";
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

// user_id and role are stamped by the database function from the JWT, not sent from here.
export async function logEvent(supabase: ServerSupabase, event: AuditEvent): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("log_event", {
    p_action: event.action,
    p_resource: event.resource,
    p_resource_id: event.resourceId ?? null,
    p_result: event.result,
    p_reason: event.reason ?? null,
    p_metadata: event.metadata ?? {},
  });
  return { error: error?.message ?? null };
}
