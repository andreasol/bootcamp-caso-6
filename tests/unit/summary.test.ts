import { describe, expect, it } from "vitest";
import { percent, summarize, type SummaryInput } from "@/lib/summary";

const row = (over: Partial<SummaryInput> = {}): SummaryInput => ({
  count: 1,
  status: "open",
  type: "amount_mismatch",
  rulePriority: 2,
  country: { code: "CL", name: "Chile" },
  ...over,
});

describe("summarize", () => {
  it("counts only open and escalated as pending, and approved/corrected as resolved", () => {
    const s = summarize([
      row(),
      row({ status: "escalated" }),
      row({ status: "approved" }),
      row({ status: "corrected" }),
    ]);
    expect(s).toMatchObject({ total: 4, pending: 2, resolved: 2, escalated: 1 });
  });

  it("counts high priority among pending only", () => {
    const s = summarize([
      row({ rulePriority: 1 }),
      row({ rulePriority: 1, status: "escalated" }),
      row({ rulePriority: 1, status: "approved" }),
      row({ rulePriority: 3 }),
    ]);
    expect(s.highPending).toBe(2);
  });

  it("always lists the three priorities in order, keeping zeros", () => {
    const s = summarize([row({ rulePriority: 3 })]);
    expect(s.byPriority.map((b) => `${b.label}:${b.count}`)).toEqual(["Alta:0", "Media:0", "Baja:1"]);
  });

  it("sorts types and countries by count, with a stable tiebreak", () => {
    const s = summarize([
      row({ type: "missing_file", country: { code: "MX", name: "México" } }),
      row({ type: "amount_mismatch" }),
      row({ type: "amount_mismatch" }),
      row({ type: "leave_balance_mismatch", country: { code: "PE", name: "Perú" } }),
    ]);
    // ties are broken by the Spanish label: "Archivo no recibido" comes before "Saldo de vacaciones distinto"
    expect(s.byType.map((b) => `${b.key}:${b.count}`)).toEqual([
      "amount_mismatch:2",
      "missing_file:1",
      "leave_balance_mismatch:1",
    ]);
    expect(s.byCountry.map((b) => `${b.label}:${b.count}`)).toEqual(["Chile:2", "México:1", "Perú:1"]);
  });

  it("ignores resolved rows in the breakdowns", () => {
    const s = summarize([row({ status: "approved", type: "missing_file" })]);
    expect(s.byType).toEqual([]);
    expect(s.byCountry).toEqual([]);
  });

  it("handles an empty scope", () => {
    expect(summarize([])).toMatchObject({ total: 0, pending: 0, resolved: 0, byType: [] });
  });
});

describe("grouped counts", () => {
  it("weights every figure by the group's count", () => {
    const s = summarize([
      row({ count: 5, rulePriority: 1 }),
      row({ count: 3, status: "escalated", rulePriority: 2, type: "missing_file" }),
      row({ count: 4, status: "approved" }),
    ]);
    expect(s).toMatchObject({ total: 12, pending: 8, resolved: 4, escalated: 3, highPending: 5 });
    expect(s.byPriority.map((b) => b.count)).toEqual([5, 3, 0]);
    expect(s.byType.map((b) => `${b.key}:${b.count}`)).toEqual(["amount_mismatch:5", "missing_file:3"]);
  });

  it("merges groups that share a country or type", () => {
    const s = summarize([row({ count: 2 }), row({ count: 3, rulePriority: 3 })]);
    expect(s.byCountry).toEqual([{ key: "CL", label: "Chile", count: 5 }]);
  });
});

describe("percent", () => {
  it("rounds and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 0)).toBe(0);
  });
});
