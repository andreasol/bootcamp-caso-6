// Each role, through RLS with a real session, sees exactly its subset (rows and counts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, count, expectedFor, QUARANTINE_TOTAL, ROLES, signIn } from "./helpers";

const summary: Record<string, Record<string, string | number>> = {};

afterAll(() => {
  console.log("\nResultados RLS por rol (visto = esperado):");
  console.table(summary);
});

describe("anonymous visitor", () => {
  it.each(["discrepancies", "countries", "employees", "quarantine", "audit_log", "profiles", "discrepancy_counts", "app_settings"])(
    "cannot read %s",
    async (table) => {
      const { data, error } = await anonClient().from(table).select("*").limit(1);
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    },
  );
});

describe.each(ROLES)("$key ($role)", (r) => {
  let sb: SupabaseClient;
  const expected = expectedFor(r.countries);
  const isAdmin = r.role === "admin";

  beforeAll(async () => {
    ({ sb } = await signIn(r.email));
    summary[r.key] = {};
  });

  const record = (k: string, seen: unknown, exp: unknown) => {
    summary[r.key][k] = seen === exp ? `${seen}` : `${seen} ≠ ${exp}`;
  };

  it("sees exactly its countries", async () => {
    const { data } = await sb.from("countries").select("code");
    const codes = (data ?? []).map((c) => c.code).sort();
    record("países", codes.join(","), r.countries.join(","));
    expect(codes).toEqual(r.countries);
  });

  it("sees exactly its discrepancies, all inside its scope", async () => {
    const { data, error } = await sb.from("discrepancies").select("id, country:countries(code)");
    expect(error).toBeNull();
    const rows = (data ?? []) as unknown as { country: { code: string } }[];
    record("discrepancias", rows.length, expected.discrepancies);
    expect(rows.length).toBe(expected.discrepancies);
    expect(rows.every((d) => r.countries.includes(d.country.code))).toBe(true);
  });

  it("the summary counts view adds up to exactly its discrepancies, country by country", async () => {
    const { data, error } = await sb.from("discrepancy_counts").select("country_code, n");
    expect(error).toBeNull();
    const byCountry = new Map<string, number>();
    for (const row of data ?? []) byCountry.set(row.country_code, (byCountry.get(row.country_code) ?? 0) + row.n);
    expect([...byCountry.keys()].every((c) => r.countries.includes(c))).toBe(true);
    expect([...byCountry.values()].reduce((a, b) => a + b, 0)).toBe(expected.discrepancies);
  });

  it("counts (aggregates) are limited to its scope too", async () => {
    const counts = {
      employees: await count(sb, "employees"),
      normalized_records: await count(sb, "normalized_records"),
      global_payroll: await count(sb, "global_payroll"),
      source_batches: await count(sb, "source_batches"),
    };
    record("empleados", counts.employees, expected.employees);
    record("normalizados", counts.normalized_records, expected.normalized);
    expect(counts).toEqual({
      employees: expected.employees,
      normalized_records: expected.normalized,
      global_payroll: expected.globalPayroll,
      source_batches: expected.batches,
    });
  });

  it(isAdmin ? "reads quarantine, raw data, mappings and audit" : "cannot read quarantine, raw data, mappings or audit", async () => {
    const q = await count(sb, "quarantine");
    record("cuarentena", q, isAdmin ? QUARANTINE_TOTAL : 0);
    expect(q).toBe(isAdmin ? QUARANTINE_TOTAL : 0);
    for (const t of ["local_payroll_raw", "local_leave_raw", "employee_id_map", "status_code_map", "concept_map", "audit_log"]) {
      const n = await count(sb, t);
      if (isAdmin) expect(n, t).toBeGreaterThan(0);
      else expect(n, t).toBe(0);
    }
  });

  it(isAdmin ? "reads every profile" : "reads only its own profile", async () => {
    const n = await count(sb, "profiles");
    if (isAdmin) expect(n).toBeGreaterThanOrEqual(ROLES.length);
    else expect(n).toBe(1);
  });

  it("filtering by an out-of-scope country returns nothing", async () => {
    const outside = ["CL", "CR", "ES", "MX", "PE"].filter((c) => !r.countries.includes(c));
    for (const code of outside) {
      const { data } = await sb.from("discrepancies").select("id, countries!inner(code)").eq("countries.code", code);
      expect(data ?? [], code).toEqual([]);
    }
  });
});
