// The AI block of the detail page. Visually separate from the computed figures: this is a
// suggestion to read, never a decision, and it says which model produced it.
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { InsightView } from "@/lib/ai/order";
import { PRIORITY_LABEL } from "@/lib/format";

export function AiInsightPanel({ insight, rulesPriority }: { insight: InsightView | null; rulesPriority: 1 | 2 | 3 }) {
  if (!insight) {
    return (
      <section aria-labelledby="ai-title" className="border border-dashed border-line bg-surface p-4 md:p-6">
        <h2 id="ai-title" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles aria-hidden className="size-4 text-accent" />
          Sugerencia de la IA
        </h2>
        <p className="mt-2 text-base text-ink-muted">
          Todavía no hay análisis de IA para esta diferencia. En la cola, pulsa &quot;Priorizar con IA&quot;.
        </p>
      </section>
    );
  }

  const differs = insight.priority !== rulesPriority;
  return (
    <section aria-labelledby="ai-title" className="border border-accent/40 bg-surface p-4 md:p-6">
      <h2 id="ai-title" className="flex items-center gap-2 font-display text-lg font-semibold">
        <Sparkles aria-hidden className="size-4 text-accent" />
        Sugerencia de la IA
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Es una propuesta, no una decisión. Las cifras de arriba las calcula el sistema; la IA solo las interpreta.
      </p>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm text-ink-muted">Prioridad sugerida</dt>
          <dd className="mt-1 text-base font-medium">
            {PRIORITY_LABEL[insight.priority]}
            {differs && <span className="font-normal text-ink-muted"> · las reglas dicen {PRIORITY_LABEL[rulesPriority].toLowerCase()}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Por qué puede pasar</dt>
          <dd className="mt-1 text-base">{insight.explanation}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Qué haría el analista</dt>
          <dd className="mt-1 text-base">{insight.suggestedAction}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-muted">Confianza de la IA</dt>
          <dd className="mt-1 flex items-center gap-3 text-base">
            <span className="font-medium">{Math.round(insight.confidence * 100)}%</span>
            <span aria-hidden className="h-2 w-32 bg-line">
              <span className="block h-2 bg-accent" style={{ width: `${Math.round(insight.confidence * 100)}%` }} />
            </span>
          </dd>
        </div>
        {insight.relatedIds.length > 0 && (
          <div>
            <dt className="text-sm text-ink-muted">Podría tener la misma causa</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {insight.relatedIds.map((id, i) => (
                <Link
                  key={id}
                  href={`/queue/${id}`}
                  className="border border-line px-2 py-1 text-sm text-accent hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Caso relacionado {i + 1}
                </Link>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-sm text-ink-muted">
        Generado por {insight.model} el{" "}
        {new Date(insight.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}.
      </p>
    </section>
  );
}
