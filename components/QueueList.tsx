import Link from "next/link";
import { conceptLabel, formatValue, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import type { QueueItem } from "@/services/discrepancies";
import { VarianceRule } from "./VarianceRule";

const PRIORITY_STYLE: Record<1 | 2 | 3, string> = {
  1: "border-ink bg-ink text-white",
  2: "border-ink text-ink",
  3: "border-line text-ink-muted",
};

function Priority({ value }: { value: 1 | 2 | 3 }) {
  return (
    <span className={`inline-flex w-16 justify-center border px-2 py-0.5 text-sm font-medium ${PRIORITY_STYLE[value]}`}>
      {PRIORITY_LABEL[value]}
    </span>
  );
}

// The subject is the link to the detail page, so each row has one clear, keyboard-reachable target.
function Subject({ item }: { item: QueueItem }) {
  const title = item.employee ? item.employee.fullName : (item.sourceSystemName ?? "Archivo");
  const sub = item.employee ? `${item.employee.globalId} · ${item.country.name}` : item.country.name;
  return (
    <>
      <Link
        href={`/queue/${item.id}`}
        className="font-medium text-ink underline decoration-line underline-offset-4 hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {title}
      </Link>
      <p className="text-sm text-ink-muted">{sub}</p>
    </>
  );
}

export function QueueList({ items }: { items: QueueItem[] }) {
  return (
    <>
      {/* Mobile: stacked rows */}
      <ol className="divide-y divide-line border-y border-line bg-surface md:hidden">
        {items.map((item) => (
          <li key={item.id} className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Subject item={item} />
              </div>
              <Priority value={item.rulePriority} />
            </div>
            <p className="text-sm">
              <span className="font-medium">{TYPE_LABEL[item.type]}</span>
              {item.concept && <span className="text-ink-muted"> · {conceptLabel(item.concept)}</span>}
            </p>
            <VarianceRule item={item} />
            <p className="text-sm text-ink-muted">
              {item.ruleReason} · {STATUS_LABEL[item.status]}
            </p>
          </li>
        ))}
      </ol>

      {/* Tablet and desktop: ledger table */}
      <div className="hidden overflow-x-auto border border-line bg-surface md:block">
        <table className="w-full min-w-[880px] text-left text-base">
          <thead className="border-b border-line text-sm text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Prioridad</th>
              <th scope="col" className="px-4 py-3 font-medium">Empleado o archivo</th>
              <th scope="col" className="px-4 py-3 font-medium">Diferencia</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Local</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Global</th>
              <th scope="col" className="w-56 px-4 py-3 font-medium">Varianza vs. umbral</th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.id} className="align-top hover:bg-ledger/60">
                <td className="px-4 py-4">
                  <Priority value={item.rulePriority} />
                </td>
                <td className="px-4 py-4">
                  <Subject item={item} />
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium">{TYPE_LABEL[item.type]}</p>
                  <p className="text-sm text-ink-muted">
                    {item.concept ? `${conceptLabel(item.concept)} · ` : ""}
                    {item.ruleReason}
                  </p>
                </td>
                <td className="px-4 py-4 text-right">{formatValue(item.localValue, item.unit, item.country.currency)}</td>
                <td className="px-4 py-4 text-right">{formatValue(item.globalValue, item.unit, item.country.currency)}</td>
                <td className="px-4 py-4">
                  <VarianceRule item={item} />
                </td>
                <td className="px-4 py-4 text-sm">{STATUS_LABEL[item.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
