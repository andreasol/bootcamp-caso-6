// Generates the synthetic dataset, writes the legacy CSVs + ground truth to disk, and loads
// everything into Supabase. Users and profiles are NOT touched (they are managed elsewhere).
// Run: npm run db:seed   (LOCAL ONLY, uses service_role)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateDataset } from "@/lib/seed/generate";
import { localFileToRows } from "@/lib/seed/to-pipeline";
import { admin, insertAll, wipe } from "./lib/admin";

const DATA_DIR = path.join("seed", "data");
const fileKey = (period: string, country: string, system: string) => `${period}|${country}|${system}`;

async function upsertByCode<T extends { code: string }>(table: string, rows: T[]): Promise<Map<string, string>> {
  const { data, error } = await admin.from(table).upsert(rows, { onConflict: "code" }).select("id, code");
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.code as string, r.id as string]));
}

async function main() {
  const ds = generateDataset();

  // 1. Files on disk: the loader below reads these, like a real monthly drop.
  mkdirSync(DATA_DIR, { recursive: true });
  for (const f of ds.localFiles) writeFileSync(path.join(DATA_DIR, f.fileName), f.content, "utf8");
  writeFileSync(path.join("seed", "ground_truth.json"), JSON.stringify(ds.groundTruth, null, 2) + "\n", "utf8");

  // 2. Clear generated data (children first). audit_log is append-only and is kept.
  for (const t of [
    "review_actions", "discrepancies", "quarantine", "normalized_records", "thresholds",
    "concept_map", "status_code_map", "employee_id_map", "local_payroll_raw", "local_leave_raw",
    "global_payroll", "global_leave", "source_batches", "expected_sources", "employees",
  ]) {
    await wipe(t);
  }

  // 3. Reference data is upserted so existing profiles keep pointing at valid rows.
  const regionId = await upsertByCode("regions", ds.regions.map(({ code, name }) => ({ code, name })));
  const countryId = await upsertByCode(
    "countries",
    ds.countries.map((c) => ({ code: c.code, name: c.name, region_id: regionId.get(c.regionCode), currency: c.currency })),
  );
  const systemId = await upsertByCode(
    "source_systems",
    ds.systems.map((s) => ({
      code: s.code, name: s.name, kind: s.kind, domain: s.domain,
      country_id: s.countryCode ? countryId.get(s.countryCode) : null,
    })),
  );

  const employees = await insertAll(
    "employees",
    ds.employees.map((e) => ({ global_employee_id: e.globalId, country_id: countryId.get(e.countryCode), full_name: e.fullName })),
    "id, global_employee_id",
  );
  const employeeId = new Map(employees.map((r) => [r.global_employee_id as string, r.id as string]));

  await insertAll("employee_id_map", ds.employeeMaps.map((m) => ({
    source_system_id: systemId.get(m.systemCode), local_code: m.localCode, employee_id: employeeId.get(m.globalId),
  })));
  await insertAll("status_code_map", ds.statusMaps.map((m) => ({
    source_system_id: systemId.get(m.systemCode), local_code: m.localCode, normalized_status: m.status,
  })));
  await insertAll("concept_map", ds.conceptMaps.map((m) => ({
    source_system_id: systemId.get(m.systemCode), local_code: m.localCode, concept: m.concept,
  })));
  await insertAll("thresholds", ds.thresholds.map((t) => ({
    country_id: t.countryCode ? countryId.get(t.countryCode) : null, concept: t.concept,
    abs_threshold: t.abs, pct_threshold: t.pct,
  })));
  await insertAll("expected_sources", ds.expected.map((e) => ({
    period: e.period, country_id: countryId.get(e.countryCode), source_system_id: systemId.get(e.systemCode),
  })));

  const batches = await insertAll(
    "source_batches",
    ds.batches.map((b) => ({
      period: b.period, country_id: countryId.get(b.countryCode), source_system_id: systemId.get(b.systemCode),
      file_name: b.fileName, row_count: b.rowCount, received_at: b.receivedAt,
    })),
    "id, period, country_id, source_system_id",
  );
  const codeOf = (m: Map<string, string>, id: unknown) => [...m].find(([, v]) => v === id)![0];
  const batchId = new Map(
    batches.map((b) => [fileKey(b.period as string, codeOf(countryId, b.country_id), codeOf(systemId, b.source_system_id)), b.id as string]),
  );
  const batchFor = (period: string, country: string, system: string) => {
    const id = batchId.get(fileKey(period, country, system));
    if (!id) throw new Error(`No batch for ${period} ${country} ${system}`);
    return id;
  };

  await insertAll("global_payroll", ds.globalPayroll.map((g) => ({
    record_id: g.recordId, batch_id: batchFor(g.period, g.countryCode, "gl_pay"), global_employee_id: g.globalId,
    country_id: countryId.get(g.countryCode), period: g.period, concept: g.concept, amount: g.amount,
    currency: g.currency, pay_date: g.payDate, status: g.status,
  })));
  await insertAll("global_leave", ds.globalLeave.map((g) => ({
    record_id: g.recordId, batch_id: batchFor(g.period, g.countryCode, "gl_leave"), global_employee_id: g.globalId,
    country_id: countryId.get(g.countryCode), period: g.period, leave_type: g.leaveType, balance_days: g.balanceDays,
    as_of: g.asOf, status: g.status,
  })));

  // 4. CSV loader: raw text exactly as in the files.
  let rawCount = 0;
  for (const f of ds.localFiles) {
    const sys = ds.systems.find((s) => s.code === f.systemCode)!;
    const content = readFileSync(path.join(DATA_DIR, f.fileName), "utf8");
    const rows = localFileToRows(f.systemCode, f.period, content);
    const batch = batchFor(f.period, sys.countryCode!, f.systemCode);
    await insertAll(
      sys.domain === "payroll" ? "local_payroll_raw" : "local_leave_raw",
      rows.map((r, i) => ({ batch_id: batch, line_number: i + 1, ...r.fields })),
      "id",
    );
    rawCount += rows.length;
  }

  console.log(
    `Seed listo: ${ds.employees.length} empleados, ${ds.globalPayroll.length + ds.globalLeave.length} registros globales, ` +
      `${rawCount} filas locales en ${ds.localFiles.length} archivos, ${ds.groundTruth.discrepancies.length} discrepancias ` +
      `y ${ds.groundTruth.quarantine.length} cuarentenas plantadas (seed/ground_truth.json).`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
