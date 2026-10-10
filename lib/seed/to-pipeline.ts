// Turns a generated Dataset into PipelineInput by going through the real CSV text, exactly
// as the loader does with files on disk.
import { readLocalCsv } from "@/lib/integration/csv";
import { getLocalFormat } from "@/lib/integration/formats";
import { localRecordId, type LocalRawRow } from "@/lib/integration/adapter";
import type { PipelineInput } from "@/lib/pipeline/run";
import type { Dataset } from "./generate";

export function localFileToRows(systemCode: string, period: string, content: string): LocalRawRow[] {
  return readLocalCsv(getLocalFormat(systemCode), content).map(({ line_number, ...fields }) => ({
    sourceRecordId: localRecordId(systemCode, period, line_number),
    fields,
  }));
}

export function datasetToPipelineInput(ds: Dataset): PipelineInput {
  const localRows = new Map<string, LocalRawRow[]>();
  for (const f of ds.localFiles) {
    const rows = localFileToRows(f.systemCode, f.period, f.content);
    localRows.set(f.systemCode, [...(localRows.get(f.systemCode) ?? []), ...rows]);
  }
  return {
    systems: ds.systems,
    countries: ds.countries.map((c) => c.code),
    employeeMaps: ds.employeeMaps,
    employeeCountry: new Map(ds.employees.map((e) => [e.globalId, e.countryCode])),
    statusMaps: ds.statusMaps,
    conceptMaps: ds.conceptMaps,
    localRows,
    globalPayroll: ds.globalPayroll,
    globalLeave: ds.globalLeave,
    expected: ds.expected,
    received: ds.batches.map(({ period, countryCode, systemCode }) => ({ period, countryCode, systemCode })),
    thresholds: ds.thresholds,
  };
}
