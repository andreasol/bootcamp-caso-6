// Fixed reference data for the fictitious company "Grupo Altamar". Country names are real;
// every person, ID and amount generated from here is synthetic.
import type { RecordStatus, SourceSystem, Threshold } from "@/lib/domain/types";

export const SEED = 20261010;
export const PERIODS = ["2026-08-01", "2026-09-01"] as const;
// Defects are planted only in the closing period; the previous one stays clean.
export const DEFECT_PERIOD = "2026-09-01";

export const REGIONS = [
  { code: "ANDINA", name: "Región Andina" },
  { code: "NORTE", name: "Norte y Centroamérica" },
  { code: "EUROPA", name: "Europa" },
] as const;

export interface CountrySpec {
  code: string;
  name: string;
  regionCode: string;
  currency: string;
  employees: number;
  baseSalary: [number, number];
  // CLP and CRC are paid in whole units
  wholeUnits: boolean;
}

export const COUNTRIES: CountrySpec[] = [
  { code: "CL", name: "Chile", regionCode: "ANDINA", currency: "CLP", employees: 60, baseSalary: [850_000, 3_200_000], wholeUnits: true },
  { code: "PE", name: "Perú", regionCode: "ANDINA", currency: "PEN", employees: 45, baseSalary: [2_200, 9_800], wholeUnits: false },
  { code: "MX", name: "México", regionCode: "NORTE", currency: "MXN", employees: 55, baseSalary: [14_000, 62_000], wholeUnits: false },
  { code: "CR", name: "Costa Rica", regionCode: "NORTE", currency: "CRC", employees: 30, baseSalary: [650_000, 2_400_000], wholeUnits: true },
  { code: "ES", name: "España", regionCode: "EUROPA", currency: "EUR", employees: 30, baseSalary: [1_900, 5_200], wholeUnits: false },
];

export const GLOBAL_SYSTEMS: SourceSystem[] = [
  { code: "gl_pay", name: "GlobalPay (pago)", kind: "global", domain: "payroll", countryCode: null },
  { code: "gl_leave", name: "GlobalLeave (vacaciones)", kind: "global", domain: "leave", countryCode: null },
];

export const PAYROLL_CONCEPTS = ["base_salary", "overtime", "bonus"] as const;

// Local code tables per system (these become employee/status/concept map rows).
export const LOCAL_STATUS_CODES: Record<string, Record<string, RecordStatus>> = {
  cl_remu_pay: { A: "active", C: "closed", P: "pending" },
  cl_remu_leave: { A: "active", C: "closed", P: "pending" },
  pe_planilla_pay: { ACT: "active", CES: "closed", PEN: "pending" },
  mx_nomina_pay: { ALTA: "active", BAJA: "closed", PEND: "pending" },
  mx_nomina_leave: { ALTA: "active", BAJA: "closed", PEND: "pending" },
};

export const LOCAL_CONCEPT_CODES: Record<string, Record<string, string>> = {
  cl_remu_pay: { SB: "base_salary", HE: "overtime", BN: "bonus" },
  cl_remu_leave: { VAC: "leave_balance" },
  pe_planilla_pay: { "0101": "base_salary", "0105": "overtime", "0120": "bonus" },
  mx_nomina_pay: { P001: "base_salary", P019: "overtime", P030: "bonus" },
  mx_nomina_leave: { VACAC: "leave_balance" },
};

export function localEmployeeCode(countryCode: string, index: number): string {
  const n = index + 1;
  if (countryCode === "CL") return `CL-${String(n).padStart(5, "0")}`;
  if (countryCode === "PE") return `PE${String(n).padStart(4, "0")}`;
  if (countryCode === "MX") return `MX-NOM-${String(n).padStart(4, "0")}`;
  throw new Error(`No local system for ${countryCode}`);
}

const CURRENCY_ABS: Record<string, number> = { CL: 5_000, PE: 20, MX: 100, CR: 3_000, ES: 5 };

export const THRESHOLDS: Threshold[] = [
  ...COUNTRIES.flatMap((c) =>
    PAYROLL_CONCEPTS.map((concept) => ({ countryCode: c.code, concept, abs: CURRENCY_ABS[c.code], pct: 0.005 })),
  ),
  { countryCode: null, concept: "leave_balance", abs: 0.5, pct: 0.05 },
];

export const FIRST_NAMES = [
  "Valentina", "Matías", "Camila", "Joaquín", "Renata", "Tomás", "Antonia", "Benjamín", "Isidora", "Vicente",
  "Florencia", "Agustín", "Martina", "Maximiliano", "Josefa", "Emilio", "Catalina", "Gaspar", "Amanda", "Facundo",
  "Daniela", "Rodrigo", "Ximena", "Iván", "Paola", "Leonel", "Mariela", "Ulises", "Noemí", "Esteban",
];

export const LAST_NAMES = [
  "Arancibia", "Bustamante", "Cifuentes", "Durán", "Echeverría", "Fajardo", "Galdames", "Herrera", "Ibarra", "Jaramillo",
  "Lagos", "Maturana", "Navarrete", "Olivares", "Poblete", "Quiroga", "Riquelme", "Saavedra", "Toledo", "Urrutia",
  "Valdivia", "Zamorano", "Barrientos", "Contreras", "Espinoza", "Gallardo", "Henríquez", "Leiva", "Montecinos", "Orellana",
];
