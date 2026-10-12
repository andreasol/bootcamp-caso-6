import type { ServerSupabase } from "@/lib/supabase/server";
import type { DiscrepancyType, Unit } from "@/lib/domain/types";

export const DISCREPANCY_TYPES: DiscrepancyType[] = [
  "amount_mismatch",
  "leave_balance_mismatch",
  "missing_in_global",
  "missing_in_local",
  "missing_file",
];
export const DISCREPANCY_STATUSES = ["open", "escalated", "approved", "corrected"] as const;
export type DiscrepancyStatus = (typeof DISCREPANCY_STATUSES)[number];

export interface QueueItem {
  id: string;
  period: string;
  type: DiscrepancyType;
  concept: string | null;
  unit: Unit | null;
  localValue: number | null;
  globalValue: number | null;
  variance: number | null;
  variancePct: number | null;
  thresholdAbs: number | null;
  thresholdPct: number | null;
  rulePriority: 1 | 2 | 3;
  ruleReason: string;
  status: DiscrepancyStatus;
  localRecordId: string | null;
  globalRecordId: string | null;
  country: { code: string; name: string; currency: string };
  employee: { globalId: string; fullName: string } | null;
  sourceSystemName: string | null;
}

export interface QueueFilters {
  countryId?: string;
  type?: DiscrepancyType;
  status?: DiscrepancyStatus;
}

interface Row {
  id: string;
  period: string;
  type: DiscrepancyType;
  concept: string | null;
  unit: Unit | null;
  local_value: number | null;
  global_value: number | null;
  variance: number | null;
  variance_pct: number | null;
  threshold_abs: number | null;
  threshold_pct: number | null;
  rule_priority: 1 | 2 | 3;
  rule_reason: string;
  status: DiscrepancyStatus;
  local_record_id: string | null;
  global_record_id: string | null;
  country: { code: string; name: string; currency: string };
  employee: { global_employee_id: string; full_name: string } | null;
  source_system: { name: string } | null;
}

const SELECT =
  "id, period, type, concept, unit, local_value, global_value, variance, variance_pct, threshold_abs, " +
  "threshold_pct, rule_priority, rule_reason, status, local_record_id, global_record_id, " +
  "country:countries(code, name, currency), employee:employees(global_employee_id, full_name), " +
  "source_system:source_systems(name)";

const num = (v: number | null) => (v === null ? null : Number(v));

function toItem(r: Row): QueueItem {
  return {
    id: r.id,
    period: r.period,
    type: r.type,
    concept: r.concept,
    unit: r.unit,
    localValue: num(r.local_value),
    globalValue: num(r.global_value),
    variance: num(r.variance),
    variancePct: num(r.variance_pct),
    thresholdAbs: num(r.threshold_abs),
    thresholdPct: num(r.threshold_pct),
    rulePriority: r.rule_priority,
    ruleReason: r.rule_reason,
    status: r.status,
    localRecordId: r.local_record_id,
    globalRecordId: r.global_record_id,
    country: r.country,
    employee: r.employee ? { globalId: r.employee.global_employee_id, fullName: r.employee.full_name } : null,
    sourceSystemName: r.source_system?.name ?? null,
  };
}

// RLS limits the rows to the user's scope; filters only narrow that set further.
export async function listQueue(
  supabase: ServerSupabase,
  filters: QueueFilters,
): Promise<{ data: QueueItem[] | null; error: string | null }> {
  let query = supabase
    .from("discrepancies")
    .select(SELECT)
    .order("rule_priority", { ascending: true })
    .order("variance_pct", { ascending: false, nullsFirst: false })
    .order("id");

  if (filters.countryId) query = query.eq("country_id", filters.countryId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: (data as unknown as Row[]).map(toItem), error: null };
}

// data is null both when the id does not exist and when it is outside the user's scope.
export async function getDiscrepancy(
  supabase: ServerSupabase,
  id: string,
): Promise<{ data: QueueItem | null; error: string | null }> {
  const { data, error } = await supabase.from("discrepancies").select(SELECT).eq("id", id).maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data ? toItem(data as unknown as Row) : null, error: null };
}
