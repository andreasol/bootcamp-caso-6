// Queue ordering with optional AI suggestions. Pure code: the AI only contributes a number
// between 1 and 3; this module decides what is shown and in which order.
import type { QueueItem } from "@/services/discrepancies";

export type OrderMode = "ia" | "reglas";

export interface InsightView {
  priority: 1 | 2 | 3;
  explanation: string;
  suggestedAction: string;
  confidence: number;
  relatedIds: string[];
  model: string;
  createdAt: string;
}

export interface QueueRow {
  item: QueueItem;
  // priority actually displayed, and where it comes from
  priority: 1 | 2 | 3;
  source: "ia" | "reglas";
  // set only when the AI disagrees with the rules, so the person can see both
  rulesPriority: 1 | 2 | 3 | null;
}

// `items` arrives in rule order (priority, then variance). Array.sort is stable, so ties
// keep that rule order, and the fallback is exactly the rule order.
export function orderQueue(items: QueueItem[], insights: Map<string, InsightView>, mode: OrderMode): QueueRow[] {
  const rows = items.map((item): QueueRow => {
    const insight = mode === "ia" ? insights.get(item.id) : undefined;
    if (!insight) return { item, priority: item.rulePriority, source: "reglas", rulesPriority: null };
    return {
      item,
      priority: insight.priority,
      source: "ia",
      rulesPriority: insight.priority === item.rulePriority ? null : item.rulePriority,
    };
  });
  return mode === "ia" ? [...rows].sort((a, b) => a.priority - b.priority) : rows;
}

export function defaultMode(insights: Map<string, InsightView>, items: QueueItem[]): OrderMode {
  return items.some((i) => insights.has(i.id)) ? "ia" : "reglas";
}

// Spanish explanation for each way a run can fall back to rules.
export const FALLBACK_MESSAGE: Record<string, string> = {
  timeout: "La IA tardó demasiado en responder.",
  error: "No pudimos comunicarnos con la IA.",
  invalid_json: "La IA respondió en un formato que no se puede leer.",
  invalid_schema: "La respuesta de la IA no cumple el formato esperado.",
  unknown_id: "La IA citó un registro que no le enviamos, así que descartamos toda su respuesta.",
};
