import { describe, expect, it } from "vitest";
import { detectDiscrepancies, evaluateVariance, findThreshold, type DetectInput } from "@/lib/discrepancies/detect";
import { rulePriority } from "@/lib/discrepancies/priority";
import type { NormalizedRecord, SourceSystem, Threshold } from "@/lib/domain/types";

const thresholds: Threshold[] = [
  { countryCode: "CL", concept: "base_salary", abs: 5000, pct: 0.005 },
  { countryCode: null, concept: "leave_balance", abs: 0.5, pct: 0.05 },
];

describe("evaluateVariance", () => {
  const t = thresholds[0];
  it("does not flag a difference under both thresholds", () => {
    expect(evaluateVariance(1_004_000, 1_000_000, t).exceeds).toBe(false);
  });
  it("flags when the absolute threshold is exceeded", () => {
    const v = evaluateVariance(1_006_000, 1_000_000, t);
    expect(v).toMatchObject({ exceeds: true, variance: 6000, variancePct: 0.006 });
  });
  it("flags when only the percentage threshold is exceeded", () => {
    expect(evaluateVariance(1_000, 900, { ...t, abs: 1000 }).exceeds).toBe(true);
  });
  it("treats exactly-at-threshold as not exceeding", () => {
    expect(evaluateVariance(1_005_000, 1_000_000, { ...t, pct: 1 }).exceeds).toBe(false);
  });
  it("is signed: local below global gives negative variance", () => {
    expect(evaluateVariance(990_000, 1_000_000, t).variance).toBe(-10000);
  });
  it("reports the multiple of the larger exceeded threshold", () => {
    expect(evaluateVariance(1_020_000, 1_000_000, t).multiple).toBe(4);
  });
});

describe("findThreshold", () => {
  it("prefers the country threshold and falls back to the default", () => {
    expect(findThreshold(thresholds, "CL", "base_salary").abs).toBe(5000);
    expect(findThreshold(thresholds, "PE", "leave_balance").abs).toBe(0.5);
  });
  it("throws when no threshold is configured", () => {
    expect(() => findThreshold(thresholds, "PE", "base_salary")).toThrow(/No threshold/);
  });
});

describe("rulePriority", () => {
  it.each([
    [{ type: "missing_file", unit: null, thresholdMultiple: null }, 1],
    [{ type: "missing_in_global", unit: "currency", thresholdMultiple: null }, 1],
    [{ type: "missing_in_global", unit: "days", thresholdMultiple: null }, 2],
    [{ type: "missing_in_local", unit: "currency", thresholdMultiple: null }, 2],
    [{ type: "amount_mismatch", unit: "currency", thresholdMultiple: 3 }, 1],
    [{ type: "amount_mismatch", unit: "currency", thresholdMultiple: 1.5 }, 2],
    [{ type: "leave_balance_mismatch", unit: "days", thresholdMultiple: 2 }, 3],
    [{ type: "leave_balance_mismatch", unit: "days", thresholdMultiple: 5 }, 1],
  ] as const)("%o -> %i", (input, expected) => {
    expect(rulePriority(input).priority).toBe(expected);
  });
});

const systems: SourceSystem[] = [
  { code: "gl_pay", name: "g", kind: "global", domain: "payroll", countryCode: null },
  { code: "cl_remu_pay", name: "l", kind: "local", domain: "payroll", countryCode: "CL" },
];
const rec = (kind: "local" | "global", emp: string, amount: number): NormalizedRecord => ({
  period: "2026-09-01",
  employeeGlobalId: emp,
  countryCode: "CL",
  concept: "base_salary",
  amount,
  unit: "currency",
  sourceKind: kind,
  sourceSystemCode: kind === "local" ? "cl_remu_pay" : "gl_pay",
  sourceRecordId: `${kind}-${emp}`,
  status: "active",
});
const files = [
  { period: "2026-09-01", countryCode: "CL", systemCode: "gl_pay" },
  { period: "2026-09-01", countryCode: "CL", systemCode: "cl_remu_pay" },
];
const base = (over: Partial<DetectInput> = {}): DetectInput => ({
  local: [rec("local", "G-1", 1_000_000), rec("local", "G-2", 900_000)],
  global: [rec("global", "G-1", 1_100_000), rec("global", "G-3", 800_000)],
  systems,
  expected: files,
  received: files,
  thresholds,
  blockedKeys: new Set(),
  ...over,
});

describe("detectDiscrepancies", () => {
  it("finds mismatch, missing_in_global and missing_in_local with code-computed values", () => {
    const out = detectDiscrepancies(base());
    expect(out.map((d) => [d.type, d.employeeGlobalId])).toEqual([
      ["amount_mismatch", "G-1"],
      ["missing_in_global", "G-2"],
      ["missing_in_local", "G-3"],
    ]);
    expect(out[0]).toMatchObject({ variance: -100000, thresholdAbs: 5000, localRecordId: "local-G-1", globalRecordId: "global-G-1" });
  });

  it("reports a missing local file once and skips record comparison for that group", () => {
    const out = detectDiscrepancies(base({ received: [files[0]], local: [] }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "missing_file", sourceSystemCode: "cl_remu_pay", rulePriority: 1 });
  });

  it("does not report missing_in_local when the local row is in quarantine", () => {
    const out = detectDiscrepancies(base({ blockedKeys: new Set(["2026-09-01|G-3|base_salary"]) }));
    expect(out.find((d) => d.type === "missing_in_local")).toBeUndefined();
  });

  it("does not compare countries that have no local system", () => {
    const out = detectDiscrepancies(base({ expected: [files[0]], received: [files[0]] }));
    expect(out).toHaveLength(0);
  });

  it("fails loudly on duplicate records instead of picking one", () => {
    expect(() => detectDiscrepancies(base({ local: [rec("local", "G-1", 1), rec("local", "G-1", 2)] }))).toThrow(/Duplicate/);
  });
});
