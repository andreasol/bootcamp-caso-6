// Reads raw + global data from Supabase, runs the deterministic pipeline (adapter, quarantine,
// discrepancy engine) and writes the results back. Then checks them against the ground truth.
// Run: npm run db:pipeline   (LOCAL ONLY, uses service_role)
import { readFileSync } from "node:fs";
import type { RecordStatus, SourceSystem } from "@/lib/domain/types";
import { localRecordId, type LocalRawRow } from "@/lib/integration/adapter";
import { discrepancyKey, runPipeline } from "@/lib/pipeline/run";
import type { GroundTruth } from "@/lib/seed/generate";
import { insertAll, selectAll, wipe } from "./lib/admin";

type Row = Record<string, string | number | null>;

async function main() {
  const [countries, systems, employees, empMaps, statusMaps, conceptMaps, expected, batches, gPay, gLeave, thresholds, lPay, lLeave] =
    await Promise.all([
      selectAll<Row>("countries", "id, code"),
      selectAll<Row>("source_systems", "id, code, name, kind, domain, country_id"),
      selectAll<Row>("employees", "id, global_employee_id, country_id"),
      selectAll<Row>("employee_id_map", "id, source_system_id, local_code, employee_id"),
      selectAll<Row>("status_code_map", "id, source_system_id, local_code, normalized_status"),
      selectAll<Row>("concept_map", "id, source_system_id, local_code, concept"),
      selectAll<Row>("expected_sources", "id, period, country_id, source_system_id"),
      selectAll<Row>("source_batches", "id, period, country_id, source_system_id"),
      selectAll<Row>("global_payroll", "id, record_id, global_employee_id, country_id, period, concept, amount, status"),
      selectAll<Row>("global_leave", "id, record_id, global_employee_id, country_id, period, balance_days, status"),
      selectAll<Row>("thresholds", "id, country_id, concept, abs_threshold, pct_threshold"),
      selectAll<Row>("local_payroll_raw", "id, batch_id, line_number, emp_code, period_text, concept_code, amount_text, status_code, pay_date_text, country_code"),
      selectAll<Row>("local_leave_raw", "id, batch_id, line_number, emp_code, period_text, leave_type_code, balance_text, status_code, as_of_text, country_code"),
    ]);

  const byId = <T extends Row>(rows: T[]) => new Map(rows.map((r) => [r.id as string, r]));
  const countryCode = new Map(countries.map((c) => [c.id as string, c.code as string]));
  const countryIdByCode = new Map(countries.map((c) => [c.code as string, c.id as string]));
  const systemCode = new Map(systems.map((s) => [s.id as string, s.code as string]));
  const systemIdByCode = new Map(systems.map((s) => [s.code as string, s.id as string]));
  const empGlobal = new Map(employees.map((e) => [e.id as string, e.global_employee_id as string]));
  const empIdByGlobal = new Map(employees.map((e) => [e.global_employee_id as string, e.id as string]));
  const batchById = byId(batches);
  const fileRef = (r: Row) => ({
    period: r.period as string,
    countryCode: countryCode.get(r.country_id as string)!,
    systemCode: systemCode.get(r.source_system_id as string)!,
  });

  // Raw rows grouped by system; the record id is derived from the batch, as in the seed.
  const localRows = new Map<string, LocalRawRow[]>();
  for (const r of [...lPay, ...lLeave]) {
    const batch = batchById.get(r.batch_id as string)!;
    const code = systemCode.get(batch.source_system_id as string)!;
    const { id, batch_id, line_number, ...fields } = r;
    void id;
    void batch_id;
    const row: LocalRawRow = {
      sourceRecordId: localRecordId(code, batch.period as string, line_number as number),
      fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === null ? "" : String(v)])),
    };
    localRows.set(code, [...(localRows.get(code) ?? []), row]);
  }
  for (const rows of localRows.values()) rows.sort((a, b) => a.sourceRecordId.localeCompare(b.sourceRecordId));

  const out = runPipeline({
    systems: systems.map((s): SourceSystem => ({
      code: s.code as string, name: s.name as string, kind: s.kind as "local" | "global",
      domain: s.domain as "payroll" | "leave",
      countryCode: s.country_id ? countryCode.get(s.country_id as string)! : null,
    })),
    countries: countries.map((c) => c.code as string),
    employeeMaps: empMaps.map((m) => ({
      systemCode: systemCode.get(m.source_system_id as string)!, localCode: m.local_code as string,
      globalId: empGlobal.get(m.employee_id as string)!,
    })),
    employeeCountry: new Map(employees.map((e) => [e.global_employee_id as string, countryCode.get(e.country_id as string)!])),
    statusMaps: statusMaps.map((m) => ({
      systemCode: systemCode.get(m.source_system_id as string)!, localCode: m.local_code as string,
      status: m.normalized_status as RecordStatus,
    })),
    conceptMaps: conceptMaps.map((m) => ({
      systemCode: systemCode.get(m.source_system_id as string)!, localCode: m.local_code as string, concept: m.concept as string,
    })),
    localRows,
    globalPayroll: gPay.map((g) => ({
      recordId: g.record_id as string, globalId: g.global_employee_id as string, countryCode: countryCode.get(g.country_id as string)!,
      period: g.period as string, concept: g.concept as string, amount: Number(g.amount), status: g.status as RecordStatus,
    })),
    globalLeave: gLeave.map((g) => ({
      recordId: g.record_id as string, globalId: g.global_employee_id as string, countryCode: countryCode.get(g.country_id as string)!,
      period: g.period as string, balanceDays: Number(g.balance_days), status: g.status as RecordStatus,
    })),
    expected: expected.map(fileRef),
    received: batches.map(fileRef),
    thresholds: thresholds.map((t) => ({
      countryCode: t.country_id ? countryCode.get(t.country_id as string)! : null, concept: t.concept as string,
      abs: Number(t.abs_threshold), pct: Number(t.pct_threshold),
    })),
  });

  // Replace previous results (review_actions and ai_insights cascade with discrepancies;
  // run-level AI rows have no discrepancy, so they are cleared explicitly).
  await wipe("ai_insights");
  await wipe("discrepancies");
  await wipe("quarantine");
  await wipe("normalized_records");

  await insertAll("normalized_records", out.normalized.map((r) => ({
    period: r.period, employee_id: empIdByGlobal.get(r.employeeGlobalId), country_id: countryIdByCode.get(r.countryCode),
    concept: r.concept, amount: r.amount, unit: r.unit, source_kind: r.sourceKind,
    source_system_id: systemIdByCode.get(r.sourceSystemCode), source_record_id: r.sourceRecordId, status: r.status,
  })), "id");
  await insertAll("quarantine", out.quarantined.map((q) => ({
    source_system_id: systemIdByCode.get(q.sourceSystemCode), source_table: q.sourceTable,
    source_record_id: q.sourceRecordId, reason: q.reason, detail: q.detail, raw: q.raw,
  })), "id");
  await insertAll("discrepancies", out.discrepancies.map((d) => ({
    period: d.period, type: d.type, country_id: countryIdByCode.get(d.countryCode),
    employee_id: d.employeeGlobalId ? empIdByGlobal.get(d.employeeGlobalId) : null, concept: d.concept,
    source_system_id: d.sourceSystemCode ? systemIdByCode.get(d.sourceSystemCode) : null, unit: d.unit,
    local_value: d.localValue, global_value: d.globalValue, variance: d.variance, variance_pct: d.variancePct,
    threshold_abs: d.thresholdAbs, threshold_pct: d.thresholdPct, local_record_id: d.localRecordId,
    global_record_id: d.globalRecordId, rule_priority: d.rulePriority, rule_reason: d.ruleReason,
  })), "id");

  // Quality check against the ground truth written by the seed.
  const gt = JSON.parse(readFileSync("seed/ground_truth.json", "utf8")) as GroundTruth;
  const detected = new Set(out.discrepancies.map(discrepancyKey));
  const expectedKeys = new Set(gt.discrepancies.map(discrepancyKey));
  const tp = [...detected].filter((k) => expectedKeys.has(k)).length;
  const precision = detected.size ? tp / detected.size : 1;
  const recall = expectedKeys.size ? tp / expectedKeys.size : 1;
  const integrated = out.normalized.filter((r) => r.sourceKind === "local").length;

  console.log(
    `Pipeline listo: ${out.normalized.length} registros normalizados, ${out.quarantined.length} en cuarentena, ` +
      `${out.discrepancies.length} discrepancias.\n` +
      `Precisión ${(precision * 100).toFixed(1)}% · Recall ${(recall * 100).toFixed(1)}% · ` +
      `Locales integrados ${integrated}/${integrated + out.quarantined.length}`,
  );
  if (precision < 1 || recall < 1) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
