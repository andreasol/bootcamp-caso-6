// Deterministic adapter: legacy raw rows -> common normalized schema.
// Every failure becomes a quarantined record with a reason; nothing is guessed or defaulted.
import {
  LEAVE_CONCEPT,
  recordKey,
  type NormalizedRecord,
  type QuarantineReason,
  type QuarantinedRecord,
  type RecordStatus,
} from "@/lib/domain/types";
import { getLocalFormat, parseAmount, parseDate, parsePeriod } from "./formats";

export interface MappedEmployee {
  globalId: string;
  countryCode: string;
}

export interface AdapterMaps {
  // per system: local code -> value
  employees: Map<string, Map<string, MappedEmployee>>;
  statuses: Map<string, Map<string, RecordStatus>>;
  concepts: Map<string, Map<string, string>>;
  knownCountries: Set<string>;
}

export interface LocalRawRow {
  sourceRecordId: string;
  fields: Record<string, string>;
}

export interface AdapterResult {
  records: NormalizedRecord[];
  quarantined: QuarantinedRecord[];
}

export function localRecordId(systemCode: string, period: string, lineNumber: number | string): string {
  return `${systemCode}/${period.slice(0, 7)}/L${String(lineNumber).padStart(4, "0")}`;
}

export function normalizeLocal(systemCode: string, rows: LocalRawRow[], maps: AdapterMaps): AdapterResult {
  const format = getLocalFormat(systemCode);
  const isLeave = format.domain === "leave";
  const sourceTable = isLeave ? "local_leave_raw" : "local_payroll_raw";
  const codeField = isLeave ? "leave_type_code" : "concept_code";
  const amountField = isLeave ? "balance_text" : "amount_text";
  const dateField = isLeave ? "as_of_text" : "pay_date_text";

  const empMap = maps.employees.get(systemCode) ?? new Map();
  const statusMap = maps.statuses.get(systemCode) ?? new Map();
  const conceptMap = maps.concepts.get(systemCode) ?? new Map();

  const records: NormalizedRecord[] = [];
  const quarantined: QuarantinedRecord[] = [];

  for (const row of rows) {
    const f = row.fields;
    // Resolved up front so a quarantined row still carries its key when possible.
    const period = parsePeriod(f.period_text ?? "", format.periodFormat);
    const employee: MappedEmployee | undefined = empMap.get(f.emp_code);
    const concept: string | undefined = conceptMap.get(f[codeField]);

    const reject = (reason: QuarantineReason, detail: string) => {
      quarantined.push({
        sourceSystemCode: systemCode,
        sourceTable,
        sourceRecordId: row.sourceRecordId,
        reason,
        detail,
        raw: f,
        blockedKey: period && employee && concept ? recordKey(period, employee.globalId, concept) : null,
      });
    };

    const required = ["emp_code", "period_text", codeField, amountField, "status_code", dateField, "country_code"];
    const missing = required.filter((k) => !f[k]?.trim());
    if (missing.length > 0) {
      reject("missing_field", `Campos vacíos: ${missing.join(", ")}`);
      continue;
    }

    // Country first: a row we cannot place in a country must never reach anyone but admin.
    if (!maps.knownCountries.has(f.country_code) || f.country_code !== format.countryCode) {
      reject("unmapped_country", `País "${f.country_code}" no corresponde al sistema ${format.countryCode}`);
      continue;
    }
    if (!employee) {
      reject("unmapped_employee", `Código local "${f.emp_code}" sin equivalencia global`);
      continue;
    }
    if (employee.countryCode !== format.countryCode) {
      reject("unmapped_country", `Empleado ${employee.globalId} pertenece a ${employee.countryCode}`);
      continue;
    }
    if (!period) {
      reject("invalid_date", `Período "${f.period_text}" no cumple ${format.periodFormat}`);
      continue;
    }
    if (!parseDate(f[dateField], format.dateFormat)) {
      reject("invalid_date", `Fecha "${f[dateField]}" no cumple ${format.dateFormat}`);
      continue;
    }
    const status = statusMap.get(f.status_code);
    if (!status) {
      reject("unmapped_status", `Estado "${f.status_code}" sin equivalencia`);
      continue;
    }
    if (!concept) {
      reject("unmapped_concept", `Concepto "${f[codeField]}" sin equivalencia`);
      continue;
    }
    if (isLeave !== (concept === LEAVE_CONCEPT)) {
      reject("unmapped_concept", `Concepto "${concept}" no corresponde al dominio ${format.domain}`);
      continue;
    }
    const amount = parseAmount(f[amountField], format.amountStyle);
    if (amount === null) {
      reject("invalid_amount", `Monto "${f[amountField]}" no cumple el formato ${format.amountStyle}`);
      continue;
    }

    records.push({
      period,
      employeeGlobalId: employee.globalId,
      countryCode: format.countryCode,
      concept,
      amount,
      unit: isLeave ? "days" : "currency",
      sourceKind: "local",
      sourceSystemCode: systemCode,
      sourceRecordId: row.sourceRecordId,
      status,
    });
  }

  return { records, quarantined };
}
