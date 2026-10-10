// Minimal delimited-file reader/writer for the legacy exports. Fields never contain the
// delimiter by construction (each system picks one that does not clash with its formats).
import type { LocalFormat } from "./formats";

export type RawRow = Record<string, string> & { line_number: string };

export function writeLocalCsv(format: LocalFormat, rows: Record<string, string>[]): string {
  const fields = Object.keys(format.headers);
  const header = fields.map((f) => format.headers[f]).join(format.delimiter);
  const lines = rows.map((r) => fields.map((f) => r[f] ?? "").join(format.delimiter));
  return [header, ...lines].join("\n") + "\n";
}

// Returns rows keyed by our raw field names. line_number is the 1-based data line.
export function readLocalCsv(format: LocalFormat, text: string): RawRow[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headerCells = lines[0].split(format.delimiter);
  const fieldByHeader = new Map(Object.entries(format.headers).map(([field, h]) => [h, field]));
  const fields = headerCells.map((h) => {
    const f = fieldByHeader.get(h.trim());
    if (!f) throw new Error(`${format.systemCode}: unexpected header "${h}"`);
    return f;
  });
  return lines.slice(1).map((line, i) => {
    const cells = line.split(format.delimiter);
    const row: Record<string, string> = { line_number: String(i + 1) };
    fields.forEach((f, idx) => (row[f] = (cells[idx] ?? "").trim()));
    return row as RawRow;
  });
}
