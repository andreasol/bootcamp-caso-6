// Dashboard figures. Pure arithmetic over grouped counts that RLS already limited to the user's
// scope (view discrepancy_counts): no AI, no estimates.
// "Pending" = still needs a person (open or escalated). Priorities here are the rule-based
// ones, so the summary never changes with an AI run.
import type { DiscrepancyType } from "@/lib/domain/types";
import { PRIORITY_LABEL, TYPE_LABEL } from "@/lib/format";

// One group of the counts view: how many discrepancies share this country/type/status/priority.
export interface SummaryInput {
  count: number;
  status: "open" | "escalated" | "approved" | "corrected";
  type: DiscrepancyType;
  rulePriority: 1 | 2 | 3;
  country: { code: string; name: string };
}

export interface Bar {
  key: string;
  label: string;
  count: number;
}

export interface Summary {
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
  highPending: number;
  byPriority: Bar[];
  byType: Bar[];
  byCountry: Bar[];
}

const PRIORITY_ORDER = [1, 2, 3] as const;

// Biggest first; ties keep a stable alphabetical order so the layout does not jump.
function toBars(counts: Map<string, Bar>): Bar[] {
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function bump(map: Map<string, Bar>, key: string, label: string, n: number) {
  const bar = map.get(key) ?? { key, label, count: 0 };
  bar.count += n;
  map.set(key, bar);
}

const sum = (items: SummaryInput[]) => items.reduce((acc, i) => acc + i.count, 0);
const isPending = (i: SummaryInput) => i.status === "open" || i.status === "escalated";

export function summarize(items: SummaryInput[]): Summary {
  const pendingItems = items.filter(isPending);
  const type = new Map<string, Bar>();
  const country = new Map<string, Bar>();
  for (const i of pendingItems) {
    bump(type, i.type, TYPE_LABEL[i.type], i.count);
    bump(country, i.country.code, i.country.name, i.count);
  }

  return {
    total: sum(items),
    pending: sum(pendingItems),
    resolved: sum(items.filter((i) => i.status === "approved" || i.status === "corrected")),
    escalated: sum(items.filter((i) => i.status === "escalated")),
    highPending: sum(pendingItems.filter((i) => i.rulePriority === 1)),
    // fixed order (high, medium, low): it is a scale, not a ranking, and zeros stay visible
    byPriority: PRIORITY_ORDER.map((p) => ({
      key: String(p),
      label: PRIORITY_LABEL[p],
      count: sum(pendingItems.filter((i) => i.rulePriority === p)),
    })),
    byType: toBars(type),
    byCountry: toBars(country),
  };
}

export const percent = (count: number, of: number) => (of === 0 ? 0 : Math.round((count / of) * 100));
