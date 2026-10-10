// Per-system file formats of the legacy local systems, plus strict parsers/formatters.
// The generator uses the formatters; the adapter uses the parsers. Anything that does not
// match the declared format exactly is rejected (and later quarantined), never guessed.

export type PeriodFormat = "MM/YYYY" | "YYYYMM" | "MM-YYYY";
export type DateFormat = "DD/MM/YYYY";
export type AmountStyle =
  | "dot_thousands" // 1.234.567       (no decimals)
  | "comma_thousands_dot_decimal" // 4,512.30
  | "plain_dot_decimal" // 18500.00
  | "comma_decimal"; // 12,5

export type Domain = "payroll" | "leave";

// Raw column names in our database, independent of each system's CSV headers.
export const PAYROLL_FIELDS = [
  "emp_code",
  "period_text",
  "concept_code",
  "amount_text",
  "status_code",
  "pay_date_text",
  "country_code",
] as const;
export const LEAVE_FIELDS = [
  "emp_code",
  "period_text",
  "leave_type_code",
  "balance_text",
  "status_code",
  "as_of_text",
  "country_code",
] as const;

export type PayrollField = (typeof PAYROLL_FIELDS)[number];
export type LeaveField = (typeof LEAVE_FIELDS)[number];

export interface LocalFormat {
  systemCode: string;
  systemName: string;
  domain: Domain;
  countryCode: string;
  delimiter: string;
  // raw field -> CSV header, in file column order
  headers: Record<string, string>;
  periodFormat: PeriodFormat;
  dateFormat: DateFormat;
  amountStyle: AmountStyle;
}

export const LOCAL_FORMATS: LocalFormat[] = [
  {
    systemCode: "cl_remu_pay",
    systemName: "RemuChile (remuneraciones)",
    domain: "payroll",
    countryCode: "CL",
    delimiter: ";",
    headers: {
      emp_code: "RUT_INT",
      period_text: "PERIODO",
      concept_code: "COD_CONC",
      amount_text: "MONTO",
      status_code: "EST",
      pay_date_text: "F_PAGO",
      country_code: "PAIS",
    },
    periodFormat: "MM/YYYY",
    dateFormat: "DD/MM/YYYY",
    amountStyle: "dot_thousands",
  },
  {
    systemCode: "cl_remu_leave",
    systemName: "RemuChile (vacaciones)",
    domain: "leave",
    countryCode: "CL",
    delimiter: ";",
    headers: {
      emp_code: "RUT_INT",
      period_text: "PERIODO",
      leave_type_code: "TIPO",
      balance_text: "SALDO",
      status_code: "EST",
      as_of_text: "F_CORTE",
      country_code: "PAIS",
    },
    periodFormat: "MM/YYYY",
    dateFormat: "DD/MM/YYYY",
    amountStyle: "comma_decimal",
  },
  {
    systemCode: "pe_planilla_pay",
    systemName: "PlanillaPE",
    domain: "payroll",
    countryCode: "PE",
    delimiter: "|",
    headers: {
      emp_code: "COD_TRAB",
      period_text: "PERIODO",
      concept_code: "CONCEPTO",
      amount_text: "IMPORTE",
      status_code: "ESTADO",
      pay_date_text: "FEC_PAGO",
      country_code: "PAIS",
    },
    periodFormat: "YYYYMM",
    dateFormat: "DD/MM/YYYY",
    amountStyle: "comma_thousands_dot_decimal",
  },
  {
    systemCode: "mx_nomina_pay",
    systemName: "NóminaMX (percepciones)",
    domain: "payroll",
    countryCode: "MX",
    delimiter: ",",
    headers: {
      emp_code: "NUM_EMP",
      period_text: "PERIODO",
      concept_code: "CVE_PERC",
      amount_text: "IMPORTE",
      status_code: "STATUS",
      pay_date_text: "FECHA_PAGO",
      country_code: "PAIS",
    },
    periodFormat: "MM-YYYY",
    dateFormat: "DD/MM/YYYY",
    amountStyle: "plain_dot_decimal",
  },
  {
    systemCode: "mx_nomina_leave",
    systemName: "NóminaMX (vacaciones)",
    domain: "leave",
    countryCode: "MX",
    delimiter: ",",
    headers: {
      emp_code: "NUM_EMP",
      period_text: "PERIODO",
      leave_type_code: "TIPO",
      balance_text: "DIAS",
      status_code: "STATUS",
      as_of_text: "FECHA_CORTE",
      country_code: "PAIS",
    },
    periodFormat: "MM-YYYY",
    dateFormat: "DD/MM/YYYY",
    amountStyle: "plain_dot_decimal",
  },
];

export function getLocalFormat(systemCode: string): LocalFormat {
  const f = LOCAL_FORMATS.find((x) => x.systemCode === systemCode);
  if (!f) throw new Error(`Unknown local system: ${systemCode}`);
  return f;
}

// period is always ISO first-of-month: "2026-09-01"
export function formatPeriod(period: string, fmt: PeriodFormat): string {
  const [y, m] = period.split("-");
  if (fmt === "MM/YYYY") return `${m}/${y}`;
  if (fmt === "YYYYMM") return `${y}${m}`;
  return `${m}-${y}`;
}

export function parsePeriod(text: string, fmt: PeriodFormat): string | null {
  const re = { "MM/YYYY": /^(\d{2})\/(\d{4})$/, YYYYMM: /^(\d{4})(\d{2})$/, "MM-YYYY": /^(\d{2})-(\d{4})$/ }[fmt];
  const m = re.exec(text.trim());
  if (!m) return null;
  const [year, month] = fmt === "YYYYMM" ? [m[1], m[2]] : [m[2], m[1]];
  const mm = Number(month);
  if (mm < 1 || mm > 12) return null;
  return `${year}-${month}-01`;
}

export function formatDate(iso: string, fmt: DateFormat): string {
  void fmt; // only one local date format today; kept for symmetry with parseDate
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function parseDate(text: string, fmt: DateFormat): string | null {
  void fmt;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // rejects impossible dates like 31/02/2026
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) {
    return null;
  }
  return `${y}-${mo}-${d}`;
}

function groupThousands(intPart: string, sep: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatAmount(value: number, style: AmountStyle): string {
  const neg = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  switch (style) {
    case "dot_thousands":
      return neg + groupThousands(String(Math.round(abs)), ".");
    case "comma_thousands_dot_decimal": {
      const [i, d] = abs.toFixed(2).split(".");
      return `${neg}${groupThousands(i, ",")}.${d}`;
    }
    case "plain_dot_decimal":
      return neg + abs.toFixed(2);
    case "comma_decimal": {
      const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/0$/, "");
      return neg + s.replace(".", ",");
    }
  }
}

export function parseAmount(text: string, style: AmountStyle): number | null {
  const t = text.trim();
  const patterns: Record<AmountStyle, RegExp> = {
    dot_thousands: /^-?\d{1,3}(\.\d{3})*$/,
    comma_thousands_dot_decimal: /^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$/,
    plain_dot_decimal: /^-?\d+(\.\d{1,2})?$/,
    comma_decimal: /^-?\d+(,\d{1,2})?$/,
  };
  if (!patterns[style].test(t)) return null;
  const normalized =
    style === "dot_thousands"
      ? t.replace(/\./g, "")
      : style === "comma_thousands_dot_decimal"
        ? t.replace(/,/g, "")
        : style === "comma_decimal"
          ? t.replace(",", ".")
          : t;
  return round2(Number(normalized));
}

// Money and day balances are compared at 2 decimals to avoid float noise.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
