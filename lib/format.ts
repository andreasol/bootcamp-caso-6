// Spanish labels and number formatting for the UI. Display only: values are computed elsewhere.
import type { DiscrepancyType, Unit } from "@/lib/domain/types";
import type { AppRole } from "@/services/profile";

export const TYPE_LABEL: Record<DiscrepancyType, string> = {
  amount_mismatch: "Monto distinto",
  leave_balance_mismatch: "Saldo de vacaciones distinto",
  missing_in_global: "Falta en el sistema global",
  missing_in_local: "Falta en el sistema local",
  missing_file: "Archivo no recibido",
};

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pendientes",
  open: "Abierta",
  escalated: "Escalada",
  approved: "Aprobada",
  corrected: "Corregida",
};

export const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: "Alta", 2: "Media", 3: "Baja" };

const CONCEPT_LABEL: Record<string, string> = {
  base_salary: "Sueldo base",
  overtime: "Horas extra",
  bonus: "Bono",
  leave_balance: "Saldo de vacaciones",
};
export const conceptLabel = (c: string | null) => (c ? (CONCEPT_LABEL[c] ?? c) : "—");

export const ROLE_LABEL: Record<AppRole, string> = {
  analyst: "Analista",
  regional_lead: "Líder regional",
  global_manager: "Gerente global",
  admin: "Administrador",
};

const WHOLE_UNIT_CURRENCIES = new Set(["CLP", "CRC"]);

export function formatValue(value: number | null, unit: Unit | null, currency: string): string {
  if (value === null) return "—";
  if (unit === "days") {
    return `${value.toLocaleString("es", { maximumFractionDigits: 2 })} días`;
  }
  const digits = WHOLE_UNIT_CURRENCIES.has(currency) ? 0 : 2;
  return value.toLocaleString("es", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSigned(value: number, unit: Unit | null, currency: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return sign + formatValue(Math.abs(value), unit, currency);
}

export function formatPct(value: number | null): string {
  if (value === null) return "";
  return `${(value * 100).toLocaleString("es", { maximumFractionDigits: 1 })}%`;
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es", { month: "long", year: "numeric", timeZone: "UTC" });
}
