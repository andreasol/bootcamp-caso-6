// Signature element: a short ruler centered on the global value. The shaded band is the
// threshold that applies; the bar is the local value's distance from global. Anything that
// leaves the band is drawn in the variance color.
import { formatPct, formatSigned } from "@/lib/format";
import type { QueueItem } from "@/services/discrepancies";

const MISSING_TEXT: Partial<Record<QueueItem["type"], string>> = {
  missing_in_global: "Solo existe en el sistema local",
  missing_in_local: "Solo existe en el sistema global",
  missing_file: "Sin datos: el archivo no llegó",
};

export function VarianceRule({ item }: { item: QueueItem }) {
  const { variance, globalValue, thresholdAbs, thresholdPct, unit, country } = item;

  if (variance === null || globalValue === null || thresholdAbs === null) {
    return <p className="text-sm text-ink-muted">{MISSING_TEXT[item.type] ?? "—"}</p>;
  }

  // The tighter of the two thresholds is the one the variance crossed.
  const pctAsValue = thresholdPct !== null && globalValue !== 0 ? thresholdPct * Math.abs(globalValue) : Infinity;
  const threshold = Math.min(thresholdAbs, pctAsValue);
  const scale = Math.max(Math.abs(variance), threshold) * 1.25 || 1;
  const half = (v: number) => (Math.min(Math.abs(v), scale) / scale) * 50;
  const band = half(threshold);
  const bar = half(variance);
  const label = `${formatSigned(variance, unit, country.currency)} frente al global, umbral ${formatSigned(threshold, unit, country.currency).replace(/^\+/, "±")}`;

  return (
    <figure className="min-w-0" aria-label={label}>
      <div className="relative h-3 w-full" aria-hidden>
        <div className="absolute inset-y-1 left-0 right-0 border-y border-line" />
        <div className="absolute inset-y-0 bg-line/70" style={{ left: `${50 - band}%`, width: `${band * 2}%` }} />
        <div
          className="variance-bar absolute inset-y-0.5 bg-variance"
          style={
            variance >= 0
              ? { left: "50%", width: `${bar}%`, transformOrigin: "left" }
              : { right: "50%", width: `${bar}%`, transformOrigin: "right" }
          }
        />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink" />
      </div>
      <figcaption className="mt-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-variance">{formatSigned(variance, unit, country.currency)}</span>
        <span className="text-ink-muted">{formatPct(item.variancePct)}</span>
      </figcaption>
    </figure>
  );
}
