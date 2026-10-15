// POST /api/ai/prioritize: runs the AI over the caller's own open queue. The Supabase client
// carries the caller's session (never service_role), so RLS decides what the model receives.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmConfig, llmComplete } from "@/lib/ai/llm";
import { runPrioritization } from "@/services/ai";

// The model can take ~10-40 s for a full queue; the platform default would cut it off.
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { data, error } = await runPrioritization(supabase, { complete: llmComplete(), ...llmConfig() });
  if (error || !data) return NextResponse.json({ error }, { status: 422 });
  return NextResponse.json(data);
}
