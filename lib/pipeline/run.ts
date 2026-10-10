// End-to-end deterministic pipeline: raw local rows + global rows -> normalized, quarantine,
// discrepancies. Pure function: the seed script and the tests both call it.
import type {
  Discrepancy,
  FileRef,
  NormalizedRecord,
  QuarantinedRecord,
  RecordStatus,
  SourceSystem,
  Threshold,
} from "@/lib/domain/types";
import { LEAVE_CONCEPT, recordKey } from "@/lib/domain/types";
import { normalizeLocal, type AdapterMaps, type LocalRawRow, type MappedEmployee } from "@/lib/integration/adapter";
import { detectDiscrepancies } from "@/lib/discrepancies/detect";

export interface GlobalPayrollInput {
  recordId: string;
  globalId: string;
  countryCode: string;
  period: string;
  concept: string;
  amount: number;
  status: RecordStatus;
}

export interface GlobalLeaveInput {
  recordId: string;
  globalId: string;
  countryCode: string;
  period: string;
  balanceDays: number;
  status: RecordStatus;
}

export interface PipelineInput {
  systems: SourceSystem[];
  countries: string[];
  employeeMaps: { systemCode: string; localCode: string; globalId: string }[];
  employeeCountry: Map<string, string>; // globalId -> country
  statusMaps: { systemCode: string; localCode: string; status: RecordStatus }[];
  conceptMaps: { systemCode: string; localCode: string; concept: string }[];
  localRows: Map<string, LocalRawRow[]>; // systemCode -> rows
  globalPayroll: GlobalPayrollInput[];
  globalLeave: GlobalLeaveInput[];
  expected: FileRef[];
  received: FileRef[];
  thresholds: Threshold[];
}

export interface PipelineOutput {
  normalized: NormalizedRecord[];
  quarantined: QuarantinedRecord[];
  discrepancies: Discrepancy[];
}

function nestedMap<R extends { systemCode: string; localCode: string }, V>(rows: R[], value: (r: R) => V) {
  const m = new Map<string, Map<string, V>>();
  for (const r of rows) {
    if (!m.has(r.systemCode)) m.set(r.systemCode, new Map());
    m.get(r.systemCode)!.set(r.localCode, value(r));
  }
  return m;
}

export function buildAdapterMaps(input: PipelineInput): AdapterMaps {
  return {
    employees: nestedMap(input.employeeMaps, (r): MappedEmployee => {
      const countryCode = input.employeeCountry.get(r.globalId);
      if (!countryCode) throw new Error(`Map points to unknown employee ${r.globalId}`);
      return { globalId: r.globalId, countryCode };
    }),
    statuses: nestedMap(input.statusMaps, (r) => r.status),
    concepts: nestedMap(input.conceptMaps, (r) => r.concept),
    knownCountries: new Set(input.countries),
  };
}

export function globalToNormalized(input: Pick<PipelineInput, "globalPayroll" | "globalLeave">): NormalizedRecord[] {
  return [
    ...input.globalPayroll.map((g) => ({
      period: g.period,
      employeeGlobalId: g.globalId,
      countryCode: g.countryCode,
      concept: g.concept,
      amount: g.amount,
      unit: "currency" as const,
      sourceKind: "global" as const,
      sourceSystemCode: "gl_pay",
      sourceRecordId: g.recordId,
      status: g.status,
    })),
    ...input.globalLeave.map((g) => ({
      period: g.period,
      employeeGlobalId: g.globalId,
      countryCode: g.countryCode,
      concept: LEAVE_CONCEPT,
      amount: g.balanceDays,
      unit: "days" as const,
      sourceKind: "global" as const,
      sourceSystemCode: "gl_leave",
      sourceRecordId: g.recordId,
      status: g.status,
    })),
  ];
}

export function runPipeline(input: PipelineInput): PipelineOutput {
  const maps = buildAdapterMaps(input);
  const local: NormalizedRecord[] = [];
  const quarantined: QuarantinedRecord[] = [];
  for (const [systemCode, rows] of [...input.localRows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const res = normalizeLocal(systemCode, rows, maps);
    local.push(...res.records);
    quarantined.push(...res.quarantined);
  }
  const global = globalToNormalized(input);
  const blockedKeys = new Set(quarantined.map((q) => q.blockedKey).filter((k): k is string => k !== null));

  const discrepancies = detectDiscrepancies({
    local,
    global,
    systems: input.systems,
    expected: input.expected,
    received: input.received,
    thresholds: input.thresholds,
    blockedKeys,
  });

  return { normalized: [...local, ...global], quarantined, discrepancies };
}

// Stable identity used to compare detected discrepancies against the ground truth.
export const discrepancyKey = (d: {
  type: string;
  period: string;
  countryCode: string;
  employeeGlobalId: string | null;
  concept: string | null;
  sourceSystemCode: string | null;
}) => [d.type, d.period, d.countryCode, d.employeeGlobalId ?? "-", d.concept ?? "-", d.sourceSystemCode ?? "-"].join("|");

export { recordKey };
