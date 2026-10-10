import { describe, expect, it } from "vitest";
import { normalizeLocal, type AdapterMaps, type LocalRawRow } from "@/lib/integration/adapter";

const maps: AdapterMaps = {
  employees: new Map([["mx_nomina_pay", new Map([["MX-NOM-0001", { globalId: "G-000001", countryCode: "MX" }]])]]),
  statuses: new Map([["mx_nomina_pay", new Map([["ALTA", "active" as const]])]]),
  concepts: new Map([["mx_nomina_pay", new Map([["P001", "base_salary"]])]]),
  knownCountries: new Set(["MX", "CL"]),
};

const good = {
  emp_code: "MX-NOM-0001",
  period_text: "09-2026",
  concept_code: "P001",
  amount_text: "18500.00",
  status_code: "ALTA",
  pay_date_text: "30/09/2026",
  country_code: "MX",
};

const row = (over: Partial<typeof good> = {}, id = "r1"): LocalRawRow => ({ sourceRecordId: id, fields: { ...good, ...over } });
const run = (r: LocalRawRow) => normalizeLocal("mx_nomina_pay", [r], maps);

describe("normalizeLocal", () => {
  it("maps a valid legacy row to the common schema", () => {
    const { records, quarantined } = run(row());
    expect(quarantined).toHaveLength(0);
    expect(records[0]).toEqual({
      period: "2026-09-01",
      employeeGlobalId: "G-000001",
      countryCode: "MX",
      concept: "base_salary",
      amount: 18500,
      unit: "currency",
      sourceKind: "local",
      sourceSystemCode: "mx_nomina_pay",
      sourceRecordId: "r1",
      status: "active",
    });
  });

  it.each([
    [{ emp_code: "MX-NOM-9999" }, "unmapped_employee"],
    [{ country_code: "XX" }, "unmapped_country"],
    [{ country_code: "CL" }, "unmapped_country"],
    [{ pay_date_text: "2026-09-30" }, "invalid_date"],
    [{ period_text: "2026-09" }, "invalid_date"],
    [{ status_code: "BAJA" }, "unmapped_status"],
    [{ concept_code: "P999" }, "unmapped_concept"],
    [{ amount_text: "18,500.00" }, "invalid_amount"],
    [{ amount_text: "" }, "missing_field"],
  ])("quarantines %o as %s and never normalizes it", (over, reason) => {
    const { records, quarantined } = run(row(over));
    expect(records).toHaveLength(0);
    expect(quarantined[0].reason).toBe(reason);
    expect(quarantined[0].raw).toMatchObject(over);
  });

  it("keeps the resolvable key on quarantined rows so the global side is not reported as missing", () => {
    expect(run(row({ pay_date_text: "2026-09-30" })).quarantined[0].blockedKey).toBe("2026-09-01|G-000001|base_salary");
  });

  it("has no key when the employee cannot be resolved", () => {
    expect(run(row({ emp_code: "MX-NOM-9999" })).quarantined[0].blockedKey).toBeNull();
  });
});
