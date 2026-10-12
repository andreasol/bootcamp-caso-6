// Every number here was computed by the deterministic engine and stored with the row.
import { formatPct, formatSigned, formatValue } from "@/lib/format";
import type { QueueItem } from "@/services/discrepancies";
import { VarianceRule } from "./VarianceRule";

function Fact({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-lg font-medium ${accent ? "text-variance" : ""}`}>{value}</dd>
    </div>
  );
}

export function DiscrepancyFacts({ item }: { item: QueueItem }) {
  const cur = item.country.currency;
  const thresholdText =
    item.thresholdAbs === null
      ? "—"
      : `${formatValue(item.thresholdAbs, item.unit, cur)} o ${formatPct(item.thresholdPct)}`;

  return (
    <section aria-labelledby="facts-title">
      <h2 id="facts-title" className="sr-only">
        Cifras calculadas
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        <Fact label="Sistema local" value={formatValue(item.localValue, item.unit, cur)} />
        <Fact label="Sistema global" value={formatValue(item.globalValue, item.unit, cur)} />
        <Fact
          label="Varianza (local − global)"
          value={item.variance === null ? "—" : `${formatSigned(item.variance, item.unit, cur)} ${formatPct(item.variancePct)}`}
          accent={item.variance !== null}
        />
        <Fact label="Umbral aplicado" value={thresholdText} />
      </dl>
      <div className="mt-6 max-w-xl">
        <VarianceRule item={item} />
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        Calculado por reglas fijas, no por IA. Cuenta como discrepancia si supera el umbral en valor absoluto o en
        porcentaje.
      </p>
    </section>
  );
}
