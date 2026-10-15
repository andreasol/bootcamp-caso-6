import { describe, expect, it } from "vitest";
import { defaultMode, orderQueue, type InsightView } from "@/lib/ai/order";
import type { QueueItem } from "@/services/discrepancies";

const item = (id: string, rulePriority: 1 | 2 | 3): QueueItem =>
  ({ id, rulePriority }) as unknown as QueueItem;

const insight = (priority: 1 | 2 | 3): InsightView => ({
  priority,
  explanation: "x",
  suggestedAction: "y",
  confidence: 0.8,
  relatedIds: [],
  model: "m",
  createdAt: "2026-10-15T00:00:00Z",
});

// already in rule order: a(1) b(1) c(2) d(3)
const items = [item("a", 1), item("b", 1), item("c", 2), item("d", 3)];

describe("orderQueue", () => {
  it("keeps the rule order and labels everything as rules when there is no AI", () => {
    const rows = orderQueue(items, new Map(), "ia");
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b", "c", "d"]);
    expect(rows.every((r) => r.source === "reglas" && r.rulesPriority === null)).toBe(true);
  });

  it("reorders by the AI priority and keeps rule order on ties", () => {
    const ins = new Map([["a", insight(3)], ["c", insight(1)]]);
    const rows = orderQueue(items, ins, "ia");
    // b stays rules(1); c becomes AI(1) and goes after b; a drops to 3 and, tied with d, keeps its
    // earlier place from the rule order
    expect(rows.map((r) => `${r.item.id}:${r.priority}:${r.source}`)).toEqual([
      "b:1:reglas",
      "c:1:ia",
      "a:3:ia",
      "d:3:reglas",
    ]);
  });

  it("shows the rules priority next to the AI one only when they differ", () => {
    const ins = new Map([["a", insight(1)], ["b", insight(2)]]);
    const rows = orderQueue(items, ins, "ia");
    expect(rows.find((r) => r.item.id === "a")!.rulesPriority).toBeNull();
    expect(rows.find((r) => r.item.id === "b")!.rulesPriority).toBe(1);
  });

  it("ignores the AI completely in rules mode", () => {
    const rows = orderQueue(items, new Map([["d", insight(1)]]), "reglas");
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b", "c", "d"]);
    expect(rows.every((r) => r.source === "reglas")).toBe(true);
  });

  it("does not mutate the input order", () => {
    const copy = [...items];
    orderQueue(items, new Map([["d", insight(1)]]), "ia");
    expect(items).toEqual(copy);
  });
});

describe("defaultMode", () => {
  it("uses AI only if some visible item has an insight", () => {
    expect(defaultMode(new Map(), items)).toBe("reglas");
    expect(defaultMode(new Map([["zzz", insight(1)]]), items)).toBe("reglas");
    expect(defaultMode(new Map([["c", insight(2)]]), items)).toBe("ia");
  });
});
