import { describe, expect, it } from "vitest";
import { formatAmount, formatPeriod, parseAmount, parseDate, parsePeriod } from "@/lib/integration/formats";
import { readLocalCsv, writeLocalCsv } from "@/lib/integration/csv";
import { getLocalFormat } from "@/lib/integration/formats";

describe("parseDate (DD/MM/YYYY)", () => {
  it("accepts a valid date", () => {
    expect(parseDate("30/09/2026", "DD/MM/YYYY")).toBe("2026-09-30");
  });
  it("rejects impossible calendar dates", () => {
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
  });
  it("rejects ISO dates (format change in an export)", () => {
    expect(parseDate("2026-09-30", "DD/MM/YYYY")).toBeNull();
  });
  it("rejects US-style dates when the day is > 12", () => {
    expect(parseDate("09/30/2026", "DD/MM/YYYY")).toBeNull();
  });
});

describe("parsePeriod", () => {
  it.each([
    ["09/2026", "MM/YYYY"],
    ["202609", "YYYYMM"],
    ["09-2026", "MM-YYYY"],
  ] as const)("parses %s as %s", (text, fmt) => {
    expect(parsePeriod(text, fmt)).toBe("2026-09-01");
  });
  it("rejects month 13", () => {
    expect(parsePeriod("13/2026", "MM/YYYY")).toBeNull();
  });
  it("round-trips with formatPeriod", () => {
    expect(parsePeriod(formatPeriod("2026-08-01", "YYYYMM"), "YYYYMM")).toBe("2026-08-01");
  });
});

describe("amount styles", () => {
  it.each([
    ["1.234.567", "dot_thousands", 1234567],
    ["4,512.30", "comma_thousands_dot_decimal", 4512.3],
    ["18500.00", "plain_dot_decimal", 18500],
    ["12,5", "comma_decimal", 12.5],
    ["-900.00", "plain_dot_decimal", -900],
  ] as const)("parses %s (%s)", (text, style, value) => {
    expect(parseAmount(text, style)).toBe(value);
  });

  it.each([
    ["1,234,567", "dot_thousands"],
    ["4512,30", "comma_thousands_dot_decimal"],
    ["18.500,00", "plain_dot_decimal"],
    ["abc", "comma_decimal"],
    ["", "plain_dot_decimal"],
  ] as const)("rejects %s for %s", (text, style) => {
    expect(parseAmount(text, style)).toBeNull();
  });

  it.each([
    [1234567, "dot_thousands"],
    [4512.3, "comma_thousands_dot_decimal"],
    [13.75, "comma_decimal"],
    [13, "comma_decimal"],
  ] as const)("round-trips %s (%s)", (value, style) => {
    expect(parseAmount(formatAmount(value, style), style)).toBe(value);
  });
});

describe("legacy CSV", () => {
  it("writes system headers and reads back our field names", () => {
    const f = getLocalFormat("cl_remu_pay");
    const csv = writeLocalCsv(f, [
      { emp_code: "CL-00001", period_text: "09/2026", concept_code: "SB", amount_text: "1.000.000", status_code: "A", pay_date_text: "30/09/2026", country_code: "CL" },
    ]);
    expect(csv.split("\n")[0]).toBe("RUT_INT;PERIODO;COD_CONC;MONTO;EST;F_PAGO;PAIS");
    const [row] = readLocalCsv(f, csv);
    expect(row).toMatchObject({ line_number: "1", emp_code: "CL-00001", amount_text: "1.000.000" });
  });

  it("fails loudly on unknown headers", () => {
    expect(() => readLocalCsv(getLocalFormat("cl_remu_pay"), "FOO;BAR\n1;2\n")).toThrow(/unexpected header/);
  });
});
