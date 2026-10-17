// POST /api/ai/prioritize: runs the AI over the caller's own open queue. The Supabase client
// carries the caller's session (never service_role), so RLS decides what the model receives.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmConfig, llmComplete } from "@/lib/ai/llm";
import { publicError } from "@/lib/public-error";
import { runPrioritization } from "@/services/ai";

// The model can take ~10-40 s for a full queue; the platform default would cut it off.
export const maxDuration = 60;

// One run per user per minute. Sign-up is open, so this is what stops quota abuse.
const COOLDOWN_SECONDS = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { data: wait, error: limitError } = await supabase.rpc("ai_try_start", { p_cooldown_seconds: COOLDOWN_SECONDS });
  if (limitError) return NextResponse.json({ error: publicError(limitError.message) }, { status: 500 });
  if (typeof wait === "number" && wait > 0) {
    return NextResponse.json(
      { error: `Ya analizaste hace poco. Espera ${wait} s antes de volver a pedirlo.`, retryAfterSeconds: wait },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const { data, error } = await runPrioritization(supabase, { complete: llmComplete(), ...llmConfig() });
  if (error || !data) return NextResponse.json({ error: publicError(error ?? "sin datos") }, { status: 422 });

  // The provider's error text stays on the server: the client only needs the status.
  const { reason, ...safe } = data;
  if (reason) console.error(`[ai run ${data.runId}] ${data.status}: ${reason}`);
  return NextResponse.json(safe);
}
