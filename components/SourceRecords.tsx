import { formatValue, STATUS_LABEL } from "@/lib/format";
import type { SourceRecord } from "@/services/review";

const RECORD_STATUS: Record<string, string> = { active: "Activo", closed: "Cerrado", pending: "Pendiente" };

export function SourceRecords({ records, currency, emptyText }: { records: SourceRecord[]; currency: string; emptyText: string }) {
  if (records.length === 0) {
    return <p className="border border-dashed border-line bg-surface px-4 py-4 text-sm text-ink-muted">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-line text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Origen</th>
            <th scope="col" className="px-4 py-2 font-medium">ID del registro</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
            <th scope="col" className="px-4 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.map((r) => (
            <tr key={r.sourceRecordId}>
              <td className="px-4 py-3">{r.systemName}</td>
              <td className="px-4 py-3 font-mono">{r.sourceRecordId}</td>
              <td className="px-4 py-3 text-right">{formatValue(r.amount, r.unit, currency)}</td>
              <td className="px-4 py-3">{RECORD_STATUS[r.status] ?? STATUS_LABEL[r.status] ?? r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
