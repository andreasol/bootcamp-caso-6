// Shared shapes for the deterministic pipeline. Codes (country "CL", employee "G-000123",
// system "cl_remu_pay") are used here; scripts translate them to database uuids.

export type Unit = "currency" | "days";
export type RecordStatus = "active" | "closed" | "pending";
export type SourceKind = "local" | "global";

export interface NormalizedRecord {
  period: string; // "2026-09-01"
  employeeGlobalId: string;
  countryCode: string;
  concept: string;
  amount: number;
  unit: Unit;
  sourceKind: SourceKind;
  sourceSystemCode: string;
  sourceRecordId: string;
  status: RecordStatus;
}

export type QuarantineReason =
  | "unmapped_employee"
  | "unmapped_country"
  | "unmapped_status"
  | "unmapped_concept"
  | "invalid_date"
  | "invalid_amount"
  | "missing_field";

export interface QuarantinedRecord {
  sourceSystemCode: string;
  sourceTable: "local_payroll_raw" | "local_leave_raw";
  sourceRecordId: string;
  reason: QuarantineReason;
  detail: string;
  raw: Record<string, string>;
  // period|employee|concept when it could still be resolved: lets detection avoid reporting
  // the global side as missing_in_local while the local row sits in quarantine
  blockedKey: string | null;
}

export type DiscrepancyType =
  | "amount_mismatch"
  | "leave_balance_mismatch"
  | "missing_in_global"
  | "missing_in_local"
  | "missing_file";

export interface Discrepancy {
  type: DiscrepancyType;
  period: string;
  countryCode: string;
  employeeGlobalId: string | null;
  concept: string | null;
  sourceSystemCode: string | null;
  unit: Unit | null;
  localValue: number | null;
  globalValue: number | null;
  variance: number | null;
  variancePct: number | null;
  thresholdAbs: number | null;
  thresholdPct: number | null;
  localRecordId: string | null;
  globalRecordId: string | null;
  rulePriority: 1 | 2 | 3;
  ruleReason: string;
}

export interface SourceSystem {
  code: string;
  name: string;
  kind: SourceKind;
  domain: "payroll" | "leave";
  countryCode: string | null;
}

export interface FileRef {
  period: string;
  countryCode: string;
  systemCode: string;
}

export interface Threshold {
  countryCode: string | null;
  concept: string;
  abs: number;
  pct: number;
}

export const LEAVE_CONCEPT = "leave_balance";

export const recordKey = (period: string, employeeGlobalId: string, concept: string) =>
  `${period}|${employeeGlobalId}|${concept}`;
