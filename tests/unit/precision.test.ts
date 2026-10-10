// Detection quality against the planted ground truth: the seed goes through the real CSV
// text, the adapter and the engine, and must match the ground truth exactly.
import { describe, expect, it } from "vitest";
import { generateDataset } from "@/lib/seed/generate";
import { datasetToPipelineInput } from "@/lib/seed/to-pipeline";
import { discrepancyKey, runPipeline } from "@/lib/pipeline/run";

const ds = generateDataset();
const out = runPipeline(datasetToPipelineInput(ds));
const gt = ds.groundTruth;

describe("seed", () => {
  it("is deterministic", () => {
    expect(JSON.stringify(generateDataset())).toBe(JSON.stringify(ds));
  });
  it("has the planned size", () => {
    expect(ds.employees).toHaveLength(220);
    expect(ds.countries).toHaveLength(5);
    expect(new Set(ds.countries.map((c) => c.regionCode)).size).toBe(3);
  });
  it("plants every defect category", () => {
    const types = new Set(gt.discrepancies.map((d) => d.type));
    expect([...types].sort()).toEqual(
      ["amount_mismatch", "leave_balance_mismatch", "missing_file", "missing_in_global", "missing_in_local"].sort(),
    );
    expect(new Set(gt.quarantine.map((q) => q.reason))).toEqual(new Set(["unmapped_employee", "unmapped_country", "invalid_date"]));
  });
});

describe("detection vs ground truth", () => {
  const detected = new Set(out.discrepancies.map(discrepancyKey));
  const expected = new Set(gt.discrepancies.map(discrepancyKey));
  const truePositives = [...detected].filter((k) => expected.has(k));

  it("has 100% recall (no planted defect is missed)", () => {
    expect([...expected].filter((k) => !detected.has(k))).toEqual([]);
  });
  it("has 100% precision (no false positives)", () => {
    expect([...detected].filter((k) => !expected.has(k))).toEqual([]);
    expect(truePositives.length).toBe(expected.size);
  });
  it("ignores the below-threshold trap and the rounding noise", () => {
    for (const b of gt.belowThreshold) {
      expect(out.discrepancies.find((d) => d.employeeGlobalId === b.employeeGlobalId && d.period === b.period)).toBeUndefined();
    }
  });
  it("finds nothing in the clean previous period", () => {
    expect(out.discrepancies.filter((d) => d.period === "2026-08-01")).toEqual([]);
  });
});

describe("quarantine vs ground truth", () => {
  it("quarantines exactly the planted records with the planted reason", () => {
    const actual = out.quarantined.map((q) => `${q.sourceRecordId}|${q.reason}`).sort();
    const expected = gt.quarantine.map((q) => `${q.sourceRecordId}|${q.reason}`).sort();
    expect(actual).toEqual(expected);
  });
  it("never lets a quarantined record into the normalized set", () => {
    const normalizedIds = new Set(out.normalized.map((r) => r.sourceRecordId));
    expect(out.quarantined.filter((q) => normalizedIds.has(q.sourceRecordId))).toEqual([]);
  });
});
