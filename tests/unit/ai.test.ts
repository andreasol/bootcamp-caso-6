// AI layer with a simulated model: only a fully valid answer is used; everything else falls
// back to the rule order with a recorded reason.
import { describe, expect, it } from "vitest";
import { buildContext } from "@/lib/ai/context";
import { prioritizeWithAI, validateAnswer, type CompleteFn } from "@/lib/ai/prioritize";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import type { QueueItem } from "@/services/discrepancies";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "99999999-9999-4999-8999-999999999999";

const item = (id: string, globalId: string, name: string): QueueItem => ({
  id,
  period: "2026-09-01",
  type: "amount_mismatch",
  concept: "base_salary",
  unit: "currency",
  localValue: 1_350_000,
  globalValue: 1_000_000,
  variance: 350_000,
  variancePct: 0.35,
  thresholdAbs: 5000,
  thresholdPct: 0.005,
  rulePriority: 1,
  ruleReason: "Varianza de 70.0× el umbral (≥ 3×)",
  status: "open",
  localRecordId: "cl_remu_pay/2026-09/L0004",
  globalRecordId: "GP-202609-000004",
  country: { code: "CL", name: "Chile", currency: "CLP" },
  employee: { globalId, fullName: name },
  sourceSystemName: null,
});

const items = [item(ID_A, "G-000004", "Matías Herrera Lagos"), item(ID_B, "G-000004", "Matías Herrera Lagos")];
const sent = buildContext(items);

const answer = (over: Record<string, unknown> = {}, extra: object[] = []) =>
  JSON.stringify({
    items: [
      { id: ID_A, priority: 1, explanation: "Reajuste cargado solo en local.", suggested_action: "Corregir en global.", confidence: 0.8, related_ids: [ID_B], ...over },
      ...extra,
    ],
  });

const run = (complete: CompleteFn, timeoutMs = 1000) => prioritizeWithAI(items, { complete, model: "test-model", timeoutMs });

describe("context sent to the model", () => {
  it("carries ids and computed values but no person names or employee ids", () => {
    const text = JSON.stringify(sent);
    expect(text).not.toContain("Matías");
    expect(text).not.toContain("G-000004");
    expect(sent[0]).toMatchObject({ id: ID_A, variance: 350_000, employee_ref: "E1" });
    expect(sent[1].employee_ref).toBe("E1"); // same employee keeps the same alias
  });

  it("tells the model that data is untrusted", () => {
    expect(SYSTEM_PROMPT).toMatch(/NO confiables/);
  });
});

describe("validateAnswer", () => {
  it("accepts a valid answer", () => {
    const v = validateAnswer(answer(), sent);
    expect(v.status).toBe("valid");
    expect(v.insights.get(ID_A)).toMatchObject({ priority: 1, confidence: 0.8, relatedIds: [ID_B] });
  });

  it("accepts JSON wrapped in markdown fences", () => {
    expect(validateAnswer("```json\n" + answer() + "\n```", sent).status).toBe("valid");
  });

  it.each([
    ["not JSON", "Claro, aquí va mi análisis…", "invalid_json"],
    ["wrong field", answer({ priority: 5 }), "invalid_schema"],
    ["extra field", answer({ approve: true }), "invalid_schema"],
    ["empty list", JSON.stringify({ items: [] }), "invalid_schema"],
    ["invented id", answer({ id: FOREIGN }), "unknown_id"],
    ["invented related id", answer({ related_ids: [FOREIGN] }), "unknown_id"],
    ["id inside the text", answer({ explanation: `Igual que ${FOREIGN} en México.` }), "unknown_id"],
  ])("rejects %s", (_label, raw, status) => {
    const v = validateAnswer(raw, sent);
    expect(v.status).toBe(status);
    expect(v.insights.size).toBe(0);
  });

  it("rejects the same id twice", () => {
    const dup = { id: ID_A, priority: 2, explanation: "x", suggested_action: "y", confidence: 0.5, related_ids: [] };
    expect(validateAnswer(answer({}, [dup]), sent).status).toBe("invalid_schema");
  });
});

describe("prioritizeWithAI", () => {
  it("uses the AI when the answer is valid", async () => {
    const r = await run(async () => answer());
    expect(r).toMatchObject({ source: "ai", status: "valid", model: "test-model", sentIds: [ID_A, ID_B] });
  });

  it("falls back to rules on an invented id", async () => {
    const r = await run(async () => answer({ id: FOREIGN }));
    expect(r).toMatchObject({ source: "rules", status: "unknown_id" });
  });

  it("falls back to rules on timeout", async () => {
    const r = await run(() => new Promise(() => {}), 50);
    expect(r).toMatchObject({ source: "rules", status: "timeout" });
    expect(r.reason).toMatch(/50 ms/);
  });

  it("falls back to rules on a provider error (e.g. bad key)", async () => {
    const r = await run(async () => {
      throw new Error("401 User not found.");
    });
    expect(r).toMatchObject({ source: "rules", status: "error", reason: "401 User not found." });
  });

  it("sends the system prompt and the data block, and passes an abort signal", async () => {
    let seen: { roles: string[]; signal: boolean } | null = null;
    await run(async (messages, signal) => {
      seen = { roles: messages.map((m) => m.role), signal: signal instanceof AbortSignal };
      expect(messages[1].content).toContain("<datos>");
      return answer();
    });
    expect(seen).toEqual({ roles: ["system", "user"], signal: true });
  });
});
