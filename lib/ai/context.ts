// Minimal context sent to the model. Rows already passed RLS for the requesting user.
// No person names and no employee ids: a per-run alias (E1, E2…) still lets the model notice
// that several discrepancies belong to the same employee.
import type { QueueItem } from "@/services/discrepancies";

export interface ContextItem {
  id: string;
  type: QueueItem["type"];
  concept: string | null;
  country: string;
  currency: string;
  period: string;
  unit: QueueItem["unit"];
  employee_ref: string | null;
  source_system: string | null;
  local_value: number | null;
  global_value: number | null;
  variance: number | null;
  variance_pct: number | null;
  threshold_abs: number | null;
  threshold_pct: number | null;
  rule_priority: 1 | 2 | 3;
  rule_reason: string;
}

export const MAX_CONTEXT_ITEMS = 50;

export function buildContext(items: QueueItem[]): ContextItem[] {
  const aliases = new Map<string, string>();
  const alias = (globalId: string) => {
    if (!aliases.has(globalId)) aliases.set(globalId, `E${aliases.size + 1}`);
    return aliases.get(globalId)!;
  };
  return items.slice(0, MAX_CONTEXT_ITEMS).map((i) => ({
    id: i.id,
    type: i.type,
    concept: i.concept,
    country: i.country.code,
    currency: i.country.currency,
    period: i.period,
    unit: i.unit,
    employee_ref: i.employee ? alias(i.employee.globalId) : null,
    source_system: i.sourceSystemName,
    local_value: i.localValue,
    global_value: i.globalValue,
    variance: i.variance,
    variance_pct: i.variancePct,
    threshold_abs: i.thresholdAbs,
    threshold_pct: i.thresholdPct,
    rule_priority: i.rulePriority,
    rule_reason: i.ruleReason,
  }));
}
