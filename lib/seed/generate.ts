// Deterministic synthetic dataset + ground truth of every planted defect.
// The ground truth is written from the planting decisions, never from running detection.
import { LEAVE_CONCEPT, type FileRef, type QuarantineReason, type RecordStatus, type SourceSystem } from "@/lib/domain/types";
import { formatAmount, formatDate, formatPeriod, LOCAL_FORMATS, round2, type LocalFormat } from "@/lib/integration/formats";
import { writeLocalCsv } from "@/lib/integration/csv";
import { localRecordId } from "@/lib/integration/adapter";
import { createRng } from "./rng";
import {
  COUNTRIES,
  DEFECT_PERIOD,
  FIRST_NAMES,
  GLOBAL_SYSTEMS,
  LAST_NAMES,
  LOCAL_CONCEPT_CODES,
  LOCAL_STATUS_CODES,
  localEmployeeCode,
  PERIODS,
  REGIONS,
  SEED,
  THRESHOLDS,
} from "./reference";

export interface Employee {
  globalId: string;
  countryCode: string;
  fullName: string;
  index: number; // position within its country
}

export interface GlobalPayrollRow {
  recordId: string;
  globalId: string;
  countryCode: string;
  period: string;
  concept: string;
  amount: number;
  currency: string;
  payDate: string;
  status: RecordStatus;
}

export interface GlobalLeaveRow {
  recordId: string;
  globalId: string;
  countryCode: string;
  period: string;
  leaveType: "vacation";
  balanceDays: number;
  asOf: string;
  status: RecordStatus;
}

export interface Batch extends FileRef {
  fileName: string;
  rowCount: number;
  receivedAt: string;
}

export interface LocalFile {
  systemCode: string;
  period: string;
  fileName: string;
  content: string;
}

export interface GroundTruthDiscrepancy {
  type: string;
  period: string;
  countryCode: string;
  employeeGlobalId: string | null;
  concept: string | null;
  sourceSystemCode: string | null;
  note: string;
}

export interface GroundTruth {
  seed: number;
  periods: string[];
  discrepancies: GroundTruthDiscrepancy[];
  quarantine: { sourceSystemCode: string; sourceRecordId: string; reason: QuarantineReason; note: string }[];
  // planted differences that must NOT be flagged (false-positive traps)
  belowThreshold: { period: string; employeeGlobalId: string; concept: string; note: string }[];
}

export interface Dataset {
  regions: typeof REGIONS;
  countries: typeof COUNTRIES;
  systems: SourceSystem[];
  employees: Employee[];
  employeeMaps: { systemCode: string; localCode: string; globalId: string }[];
  statusMaps: { systemCode: string; localCode: string; status: RecordStatus }[];
  conceptMaps: { systemCode: string; localCode: string; concept: string }[];
  thresholds: typeof THRESHOLDS;
  expected: FileRef[];
  batches: Batch[];
  globalPayroll: GlobalPayrollRow[];
  globalLeave: GlobalLeaveRow[];
  localFiles: LocalFile[];
  groundTruth: GroundTruth;
}

// Planted defects, by country and employee index (all in DEFECT_PERIOD).
const PLANT = {
  missingFile: { systemCode: "mx_nomina_leave", countryCode: "MX" },
  amountMismatch: [
    { country: "CL", index: 3, delta: 350_000 },
    { country: "CL", index: 11, delta: 8_000 },
    { country: "PE", index: 4, delta: -900 },
    { country: "PE", index: 9, delta: 35 },
    { country: "MX", index: 6, delta: 2_500 },
  ],
  nearMiss: { country: "CL", index: 5, delta: 4_000 },
  leaveMismatch: [
    { index: 2, delta: 1 },
    { index: 15, delta: 10 },
    { index: 20, delta: 2.5 },
  ],
  missingInGlobal: [{ country: "CL", index: 30 }, { country: "CL", index: 31 }],
  missingInLocal: [{ country: "MX", index: 10 }, { country: "PE", index: 12 }],
  unmappedEmployees: [
    { systemCode: "cl_remu_pay", localCode: "CL-09901", amount: 1_250_000 },
    { systemCode: "cl_remu_pay", localCode: "CL-09902", amount: 980_000 },
    { systemCode: "pe_planilla_pay", localCode: "PE9901", amount: 3_150 },
  ],
  unmappedCountry: { country: "MX", index: 20, wrongCode: "XX" },
  isoDateRows: { country: "MX", indexes: [25, 26, 27] },
  // rounding noise of ±0.01 on ~10% of Peru payroll rows: must stay below threshold
  noise: { country: "PE", probability: 0.1 },
};

const lastDayOfMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const yyyymm = (period: string) => period.slice(0, 7).replace("-", "");

export function generateDataset(): Dataset {
  const rng = createRng(SEED);
  const systems: SourceSystem[] = [
    ...GLOBAL_SYSTEMS,
    ...LOCAL_FORMATS.map((f) => ({
      code: f.systemCode,
      name: f.systemName,
      kind: "local" as const,
      domain: f.domain,
      countryCode: f.countryCode,
    })),
  ];

  // Employees
  const employees: Employee[] = [];
  let seq = 0;
  const usedNames = new Set<string>();
  for (const c of COUNTRIES) {
    for (let i = 0; i < c.employees; i++) {
      let name: string;
      do {
        name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      } while (usedNames.has(name));
      usedNames.add(name);
      seq++;
      employees.push({ globalId: `G-${String(seq).padStart(6, "0")}`, countryCode: c.code, fullName: name, index: i });
    }
  }
  const byCountry = (code: string) => employees.filter((e) => e.countryCode === code);
  const emp = (country: string, index: number) => byCountry(country)[index];

  // Mapping tables
  const employeeMaps: Dataset["employeeMaps"] = [];
  for (const f of LOCAL_FORMATS) {
    for (const e of byCountry(f.countryCode)) {
      employeeMaps.push({ systemCode: f.systemCode, localCode: localEmployeeCode(e.countryCode, e.index), globalId: e.globalId });
    }
  }
  const statusMaps = Object.entries(LOCAL_STATUS_CODES).flatMap(([systemCode, m]) =>
    Object.entries(m).map(([localCode, status]) => ({ systemCode, localCode, status })),
  );
  const conceptMaps = Object.entries(LOCAL_CONCEPT_CODES).flatMap(([systemCode, m]) =>
    Object.entries(m).map(([localCode, concept]) => ({ systemCode, localCode, concept })),
  );

  // "True" values per employee and period
  const countrySpec = new Map(COUNTRIES.map((c) => [c.code, c]));
  const money = (country: string, v: number) => (countrySpec.get(country)!.wholeUnits ? Math.round(v) : round2(v));
  const baseSalary = new Map<string, number>();
  const leaveStart = new Map<string, number>();
  for (const e of employees) {
    const [lo, hi] = countrySpec.get(e.countryCode)!.baseSalary;
    const raw = rng.between(lo, hi);
    baseSalary.set(e.globalId, countrySpec.get(e.countryCode)!.wholeUnits ? Math.round(raw / 1000) * 1000 : round2(raw));
    leaveStart.set(e.globalId, rng.int(4, 44) / 2);
  }

  interface TruePay { e: Employee; period: string; concept: string; amount: number; status: RecordStatus }
  interface TrueLeave { e: Employee; period: string; balance: number; status: RecordStatus }
  const truePay: TruePay[] = [];
  const trueLeave: TrueLeave[] = [];
  for (const e of employees) {
    let balance = leaveStart.get(e.globalId)!;
    const status: RecordStatus = rng.chance(0.03) ? "pending" : "active";
    for (const period of PERIODS) {
      const base = baseSalary.get(e.globalId)!;
      truePay.push({ e, period, concept: "base_salary", amount: base, status });
      if (rng.chance(0.3)) truePay.push({ e, period, concept: "overtime", amount: money(e.countryCode, base * rng.between(0.03, 0.12)), status });
      if (rng.chance(0.15)) truePay.push({ e, period, concept: "bonus", amount: money(e.countryCode, base * rng.between(0.05, 0.2)), status });
      const used = rng.pick([0, 0, 0, 1, 1, 2, 3]);
      balance = Math.max(0, round2(balance + 1.25 - used));
      trueLeave.push({ e, period, balance, status });
    }
  }

  const gt: GroundTruth = { seed: SEED, periods: [...PERIODS], discrepancies: [], quarantine: [], belowThreshold: [] };
  const isDefect = (p: string) => p === DEFECT_PERIOD;
  const is = (e: Employee, list: { country: string; index: number }[]) =>
    list.some((x) => x.country === e.countryCode && x.index === e.index);

  // Global rows (the reference system)
  const globalPayroll: GlobalPayrollRow[] = [];
  const globalLeave: GlobalLeaveRow[] = [];
  const counters = new Map<string, number>();
  const nextId = (prefix: string, period: string) => {
    const k = `${prefix}${period}`;
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    return `${prefix}-${yyyymm(period)}-${String(n).padStart(6, "0")}`;
  };
  for (const t of truePay) {
    if (isDefect(t.period) && is(t.e, PLANT.missingInGlobal)) continue;
    globalPayroll.push({
      recordId: nextId("GP", t.period),
      globalId: t.e.globalId,
      countryCode: t.e.countryCode,
      period: t.period,
      concept: t.concept,
      amount: t.amount,
      currency: countrySpec.get(t.e.countryCode)!.currency,
      payDate: lastDayOfMonth(t.period),
      status: t.status,
    });
  }
  for (const t of trueLeave) {
    globalLeave.push({
      recordId: nextId("GL", t.period),
      globalId: t.e.globalId,
      countryCode: t.e.countryCode,
      period: t.period,
      leaveType: "vacation",
      balanceDays: t.balance,
      asOf: lastDayOfMonth(t.period),
      status: t.status,
    });
  }
  for (const x of PLANT.missingInGlobal) {
    for (const t of truePay.filter((p) => isDefect(p.period) && p.e === emp(x.country, x.index))) {
      gt.discrepancies.push({
        type: "missing_in_global", period: t.period, countryCode: t.e.countryCode, employeeGlobalId: t.e.globalId,
        concept: t.concept, sourceSystemCode: null, note: "Pago local sin registro global (alta no sincronizada)",
      });
    }
  }

  // Local files
  const localFiles: LocalFile[] = [];
  const expected: FileRef[] = [];
  const batches: Batch[] = [];
  const statusCode = (systemCode: string, status: RecordStatus) =>
    Object.entries(LOCAL_STATUS_CODES[systemCode]).find(([, s]) => s === status)![0];
  const conceptCode = (systemCode: string, concept: string) =>
    Object.entries(LOCAL_CONCEPT_CODES[systemCode]).find(([, c]) => c === concept)![0];

  for (const period of PERIODS) {
    for (const c of COUNTRIES) {
      for (const g of GLOBAL_SYSTEMS) expected.push({ period, countryCode: c.code, systemCode: g.code });
    }
    for (const f of LOCAL_FORMATS) {
      expected.push({ period, countryCode: f.countryCode, systemCode: f.systemCode });
      if (isDefect(period) && f.systemCode === PLANT.missingFile.systemCode) {
        gt.discrepancies.push({
          type: "missing_file", period, countryCode: f.countryCode, employeeGlobalId: null, concept: null,
          sourceSystemCode: f.systemCode, note: "El archivo de vacaciones local no llegó",
        });
        continue;
      }
      const rows = f.domain === "payroll" ? buildPayrollRows(f, period) : buildLeaveRows(f, period);
      const fileName = `${f.systemCode}_${yyyymm(period)}.csv`;
      localFiles.push({ systemCode: f.systemCode, period, fileName, content: writeLocalCsv(f, rows) });
    }
  }

  function buildPayrollRows(f: LocalFormat, period: string): Record<string, string>[] {
    const rows: Record<string, string>[] = [];
    const payDate = formatDate(lastDayOfMonth(period), f.dateFormat);
    for (const t of truePay.filter((p) => p.period === period && p.e.countryCode === f.countryCode)) {
      const d = isDefect(period);
      if (d && is(t.e, PLANT.missingInLocal)) continue;
      let amount = t.amount;
      let country = f.countryCode;
      let date = payDate;
      if (d && t.concept === "base_salary") {
        const mm = PLANT.amountMismatch.find((x) => x.country === f.countryCode && x.index === t.e.index);
        if (mm) {
          amount = money(f.countryCode, amount + mm.delta);
          gt.discrepancies.push({
            type: "amount_mismatch", period, countryCode: f.countryCode, employeeGlobalId: t.e.globalId,
            concept: t.concept, sourceSystemCode: null, note: `Monto local difiere en ${mm.delta}`,
          });
        }
        if (PLANT.nearMiss.country === f.countryCode && PLANT.nearMiss.index === t.e.index) {
          amount = money(f.countryCode, amount + PLANT.nearMiss.delta);
          gt.belowThreshold.push({ period, employeeGlobalId: t.e.globalId, concept: t.concept, note: "Diferencia bajo umbral absoluto y porcentual" });
        }
        if (PLANT.unmappedCountry.country === f.countryCode && PLANT.unmappedCountry.index === t.e.index) {
          country = PLANT.unmappedCountry.wrongCode;
        }
        if (PLANT.isoDateRows.country === f.countryCode && PLANT.isoDateRows.indexes.includes(t.e.index)) {
          date = lastDayOfMonth(period); // ISO instead of DD/MM/YYYY: format change in the export
        }
      }
      if (f.countryCode === PLANT.noise.country && rng.chance(PLANT.noise.probability)) {
        const protectedIdx = [...PLANT.amountMismatch, ...PLANT.missingInLocal].some(
          (x) => x.country === f.countryCode && x.index === t.e.index,
        );
        if (!protectedIdx) amount = round2(amount + (rng.chance(0.5) ? 0.01 : -0.01));
      }
      rows.push({
        emp_code: localEmployeeCode(f.countryCode, t.e.index),
        period_text: formatPeriod(period, f.periodFormat),
        concept_code: conceptCode(f.systemCode, t.concept),
        amount_text: formatAmount(amount, f.amountStyle),
        status_code: statusCode(f.systemCode, t.status),
        pay_date_text: date,
        country_code: country,
      });
    }
    if (isDefect(period)) {
      for (const u of PLANT.unmappedEmployees.filter((x) => x.systemCode === f.systemCode)) {
        rows.push({
          emp_code: u.localCode,
          period_text: formatPeriod(period, f.periodFormat),
          concept_code: conceptCode(f.systemCode, "base_salary"),
          amount_text: formatAmount(u.amount, f.amountStyle),
          status_code: statusCode(f.systemCode, "active"),
          pay_date_text: payDate,
          country_code: f.countryCode,
        });
      }
    }
    // Quarantine expectations need final line numbers, so they are recorded after ordering.
    rows.forEach((r, i) => {
      if (!isDefect(period)) return;
      const id = localRecordId(f.systemCode, period, i + 1);
      if (PLANT.unmappedEmployees.some((u) => u.systemCode === f.systemCode && u.localCode === r.emp_code)) {
        gt.quarantine.push({ sourceSystemCode: f.systemCode, sourceRecordId: id, reason: "unmapped_employee", note: "Código local sin equivalencia global" });
      } else if (r.country_code === PLANT.unmappedCountry.wrongCode) {
        gt.quarantine.push({ sourceSystemCode: f.systemCode, sourceRecordId: id, reason: "unmapped_country", note: "Código de país desconocido" });
      } else if (r.pay_date_text !== payDate) {
        gt.quarantine.push({ sourceSystemCode: f.systemCode, sourceRecordId: id, reason: "invalid_date", note: "Fecha en formato ISO en vez de DD/MM/YYYY" });
      }
    });
    return rows;
  }

  function buildLeaveRows(f: LocalFormat, period: string): Record<string, string>[] {
    const asOf = formatDate(lastDayOfMonth(period), f.dateFormat);
    return trueLeave
      .filter((t) => t.period === period && t.e.countryCode === f.countryCode)
      .map((t) => {
        let balance = t.balance;
        const lm = isDefect(period) && f.countryCode === "CL" ? PLANT.leaveMismatch.find((x) => x.index === t.e.index) : undefined;
        if (lm) {
          balance = round2(balance + lm.delta);
          gt.discrepancies.push({
            type: "leave_balance_mismatch", period, countryCode: f.countryCode, employeeGlobalId: t.e.globalId,
            concept: LEAVE_CONCEPT, sourceSystemCode: null, note: `Saldo local difiere en ${lm.delta} días`,
          });
        }
        return {
          emp_code: localEmployeeCode(f.countryCode, t.e.index),
          period_text: formatPeriod(period, f.periodFormat),
          leave_type_code: conceptCode(f.systemCode, LEAVE_CONCEPT),
          balance_text: formatAmount(balance, f.amountStyle),
          status_code: statusCode(f.systemCode, t.status),
          as_of_text: asOf,
          country_code: f.countryCode,
        };
      });
  }

  // missing_in_local: every global payroll row of those employees in the defect period
  for (const x of PLANT.missingInLocal) {
    for (const t of truePay.filter((p) => isDefect(p.period) && p.e === emp(x.country, x.index))) {
      gt.discrepancies.push({
        type: "missing_in_local", period: t.period, countryCode: t.e.countryCode, employeeGlobalId: t.e.globalId,
        concept: t.concept, sourceSystemCode: null, note: "Registro global sin contraparte local (baja no informada)",
      });
    }
  }

  // Batches: what arrived (global per country, local per file)
  const received = (period: string, day: number, hour: number) => {
    const [y, m] = period.split("-").map(Number);
    return new Date(Date.UTC(y, m, day, hour)).toISOString();
  };
  for (const exp of expected) {
    const local = localFiles.find((l) => l.systemCode === exp.systemCode && l.period === exp.period);
    if (exp.systemCode.startsWith("gl_")) {
      const rows = exp.systemCode === "gl_pay"
        ? globalPayroll.filter((r) => r.period === exp.period && r.countryCode === exp.countryCode).length
        : globalLeave.filter((r) => r.period === exp.period && r.countryCode === exp.countryCode).length;
      batches.push({ ...exp, fileName: `${exp.systemCode}_${exp.countryCode}_${yyyymm(exp.period)}.json`, rowCount: rows, receivedAt: received(exp.period, 1, 6) });
    } else if (local) {
      const rowCount = local.content.trim().split("\n").length - 1;
      batches.push({ ...exp, fileName: local.fileName, rowCount, receivedAt: received(exp.period, rng.int(2, 4), rng.int(8, 18)) });
    }
  }

  return {
    regions: REGIONS,
    countries: COUNTRIES,
    systems,
    employees,
    employeeMaps,
    statusMaps,
    conceptMaps,
    thresholds: THRESHOLDS,
    expected,
    batches,
    globalPayroll,
    globalLeave,
    localFiles,
    groundTruth: gt,
  };
}
