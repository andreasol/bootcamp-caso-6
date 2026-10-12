// Orchestrates one AI prioritization run. The model call is injected so tests can simulate
// valid, invalid, hallucinated and slow answers. Anything not fully valid falls back to rules.
import { buildContext, type ContextItem } from "./context";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { PROMPT_VERSION, responseSchema, type ModelInsight } from "./schema";
import type { QueueItem } from "@/services/discrepancies";

export type ValidationStatus = "valid" | "invalid_json" | "invalid_schema" | "unknown_id" | "timeout" | "error";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// Returns the raw text of the model's answer.
export type CompleteFn = (messages: ChatMessage[], signal: AbortSignal) => Promise<string>;

export interface AiInsight {
  priority: 1 | 2 | 3;
  explanation: string;
  suggestedAction: string;
  confidence: number;
  relatedIds: string[];
}

export interface AiRun {
  source: "ai" | "rules";
  status: ValidationStatus;
  reason: string | null;
  model: string;
  promptVersion: string;
  latencyMs: number;
  sentIds: string[];
  insights: Map<string, AiInsight>;
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Models sometimes wrap JSON in markdown fences even when asked not to.
function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

export function validateAnswer(
  raw: string,
  sent: ContextItem[],
): { status: ValidationStatus; reason: string | null; insights: Map<string, AiInsight> } {
  const empty = new Map<string, AiInsight>();
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return { status: "invalid_json", reason: "La respuesta no es JSON", insights: empty };
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    return { status: "invalid_schema", reason: parsed.error.issues[0]?.message ?? "Esquema inválido", insights: empty };
  }

  const allowed = new Set(sent.map((s) => s.id));
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    // Every id the model mentions, anywhere, must be one we sent: otherwise it invented it
    // (or is echoing something it should not know). The whole answer is discarded.
    const mentioned = [
      item.id,
      ...item.related_ids,
      ...(item.explanation.match(UUID_RE) ?? []),
      ...(item.suggested_action.match(UUID_RE) ?? []),
    ];
    const unknown = mentioned.find((id) => !allowed.has(id.toLowerCase()));
    if (unknown) return { status: "unknown_id", reason: `ID no enviado: ${unknown}`, insights: empty };
    if (seen.has(item.id)) return { status: "invalid_schema", reason: `ID repetido: ${item.id}`, insights: empty };
    seen.add(item.id);
  }

  const insights = new Map<string, AiInsight>(
    parsed.data.items.map((i: ModelInsight) => [
      i.id,
      {
        priority: i.priority as 1 | 2 | 3,
        explanation: i.explanation,
        suggestedAction: i.suggested_action,
        confidence: Math.round(i.confidence * 100) / 100,
        relatedIds: i.related_ids.filter((r) => r !== i.id),
      },
    ]),
  );
  return { status: "valid", reason: null, insights };
}

export async function prioritizeWithAI(
  items: QueueItem[],
  opts: { complete: CompleteFn; model: string; timeoutMs: number; now?: () => number },
): Promise<AiRun> {
  const now = opts.now ?? Date.now;
  const context = buildContext(items);
  const base = { model: opts.model, promptVersion: PROMPT_VERSION, sentIds: context.map((c) => c.id) };
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const raw = await Promise.race([
      opts.complete(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(context) },
        ],
        controller.signal,
      ),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }),
      ),
    ]);
    const v = validateAnswer(raw, context);
    return { ...base, source: v.status === "valid" ? "ai" : "rules", ...v, latencyMs: now() - started };
  } catch (e) {
    const timedOut = controller.signal.aborted;
    return {
      ...base,
      source: "rules",
      status: timedOut ? "timeout" : "error",
      reason: timedOut ? `Sin respuesta en ${opts.timeoutMs} ms` : e instanceof Error ? e.message : "Error desconocido",
      insights: new Map(),
      latencyMs: now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
