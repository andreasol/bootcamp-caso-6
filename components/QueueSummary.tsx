// Closing summary above the list. Figures only: everything is counted in code from the rows
// RLS allowed, so it never shows anything outside the user's scope.
import { percent, type Bar, type Summary } from "@/lib/summary";

function Figure({ label, value, hint, meterPct }: { label: string; value: number; hint?: string; meterPct?: number }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-ink-muted">{label}</dt>
      {/* proportional figures at display size; tabular is reserved for columns */}
      <dd className="mt-1 font-sans text-xl font-semibold [font-variant-numeric:proportional-nums]">{value}</dd>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {meterPct !== undefined && (
        // Meter: the track is a lighter step of the same blue
        <div className="mt-2 h-2 bg-accent/15" aria-hidden>
          <div className="h-2 rounded-r-[4px] bg-accent" style={{ width: `${meterPct}%` }} />
        </div>
      )}
    </div>
  );
}

// Single series, so no legend: the heading says what is counted. All charts share the same
// scale (the pending total) so bar lengths are comparable across them.
function Bars({ id, title, bars, of }: { id: string; title: string; bars: Bar[]; of: number }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-sm font-medium text-ink-muted">
        {title}
        <span className="block font-normal">% sobre {of} pendientes</span>
      </h3>
      {bars.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Sin pendientes.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {bars.map((b) => (
            <li key={b.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{b.label}</span>
                <span className="tabular-nums">
                  <span className="font-medium">{b.count}</span>
                  <span className="text-ink-muted"> · {percent(b.count, of)}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 bg-line/40" aria-hidden>
                <div className="h-2 rounded-r-[4px] bg-accent" style={{ width: `${percent(b.count, of)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function QueueSummary({ summary }: { summary: Summary }) {
  const { total, pending, resolved, escalated, highPending } = summary;
  const resolvedPct = percent(resolved, total);

  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary-title" className="sr-only">
        Resumen del cierre
      </h2>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Figure label="Pendientes" value={pending} hint={`de ${total} en tu alcance (todos los estados)`} />
        <Figure label="Prioridad alta" value={highPending} hint="de las pendientes, según las reglas" />
        <Figure label="Escaladas" value={escalated} hint="esperan otra revisión" />
        <Figure label="Resueltas" value={resolved} hint={`${resolvedPct}% de las ${total} del alcance`} meterPct={resolvedPct} />
      </dl>

      <div className={`mt-8 grid gap-8 ${summary.byCountry.length > 1 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <Bars id="bars-priority" title="Pendientes por prioridad" bars={summary.byPriority} of={pending} />
        <Bars id="bars-type" title="Pendientes por tipo" bars={summary.byType} of={pending} />
        {summary.byCountry.length > 1 && <Bars id="bars-country" title="Pendientes por país" bars={summary.byCountry} of={pending} />}
      </div>
    </section>
  );
}
