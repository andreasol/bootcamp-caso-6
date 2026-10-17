// Simple, documented rules (docs/design.md §2). Used as the queue order and as
// the fallback whenever the AI ranking is unavailable or invalid.
import type { DiscrepancyType, Unit } from "@/lib/domain/types";

// A variance this many times the threshold (or more) is high priority. Shared with the help copy.
export const HIGH_PRIORITY_MULTIPLE = 3;

export interface PriorityInput {
  type: DiscrepancyType;
  unit: Unit | null;
  // how many times the exceeded threshold the variance is (null when not applicable)
  thresholdMultiple: number | null;
}

export function rulePriority({ type, unit, thresholdMultiple }: PriorityInput): {
  priority: 1 | 2 | 3;
  reason: string;
} {
  if (type === "missing_file") {
    return { priority: 1, reason: "Falta un archivo esperado del período" };
  }
  if (type === "missing_in_global") {
    return unit === "currency"
      ? { priority: 1, reason: "Pago local sin registro en el sistema global" }
      : { priority: 2, reason: "Saldo local sin registro en el sistema global" };
  }
  if (type === "missing_in_local") {
    return { priority: 2, reason: "Registro global sin contraparte local" };
  }
  const multiple = thresholdMultiple ?? 0;
  if (multiple >= HIGH_PRIORITY_MULTIPLE) {
    return { priority: 1, reason: `Varianza de ${multiple.toFixed(1)}× el umbral (≥ ${HIGH_PRIORITY_MULTIPLE}×)` };
  }
  if (type === "amount_mismatch") {
    return { priority: 2, reason: `Varianza de ${multiple.toFixed(1)}× el umbral` };
  }
  return { priority: 3, reason: `Diferencia de saldo de ${multiple.toFixed(1)}× el umbral; no bloquea el pago` };
}
