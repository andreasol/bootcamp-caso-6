// POST /api/ai/prioritize: runs the AI over the caller's own open queue. The Supabase client
// carries the caller's session (never service_role), so RLS decides what the model receives.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { llmConfig, openRouterComplete } from "@/lib/ai/llm";
import { runPrioritization } from "@/services/ai";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });

  const { data, error } = await runPrioritization(supabase, { complete: openRouterComplete(), ...llmConfig() });
  if (error || !data) return NextResponse.json({ error }, { status: 422 });
  return NextResponse.json(data);
}
