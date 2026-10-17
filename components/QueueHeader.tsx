// Title, AI button and the order switch (AI / rules) of the queue.
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { FALLBACK_MESSAGE, type OrderMode } from "@/lib/ai/order";
import { AiPrioritizeButton } from "./AiPrioritizeButton";

interface Props {
  closingLabel: string;
  shown: number;
  total: number;
  highByRules: number;
  mode: OrderMode;
  aiCount: number;
  hrefs: Record<OrderMode, string>;
  lastRunFailureStatus: string | null;
}

export function QueueHeader({ closingLabel, shown, total, highByRules, mode, aiCount, hrefs, lastRunFailureStatus }: Props) {
  const truncated = total > shown;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">{closingLabel}</p>
          <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
            {total === 0
              ? "Nada que revisar con estos filtros"
              : `${total} ${total === 1 ? "diferencia" : "diferencias"} en esta lista`}
          </h1>
          {total > 0 && (
            <p className="mt-1 text-base text-ink-muted">
              {highByRules} de prioridad alta (por reglas)
              {truncated && ` · mostrando las primeras ${shown}; afina los filtros para ver el resto`}
            </p>
          )}
        </div>
        <AiPrioritizeButton disabled={shown === 0} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-ink-muted">
          {mode === "ia" && aiCount > 0
            ? `Orden sugerido por la IA para ${aiCount} de ${shown} casos. Los demás siguen las reglas fijas. Las cifras las calcula el sistema y la decisión es tuya.`
            : "Orden por reglas fijas: primero archivos faltantes y pagos sin registro global, luego la varianza más alta frente a su umbral."}
        </p>
        <nav aria-label="Orden de la lista" className="flex border border-line text-sm">
          {(["ia", "reglas"] as const).map((m) => (
            <Link
              key={m}
              href={hrefs[m]}
              aria-current={mode === m ? "true" : undefined}
              className={`px-3 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                mode === m ? "bg-ink text-white" : "text-ink-muted hover:bg-ledger"
              }`}
            >
              {m === "ia" ? "Orden de la IA" : "Orden por reglas"}
            </Link>
          ))}
        </nav>
      </div>

      {lastRunFailureStatus && (
        <p role="status" className="mt-4 flex items-start gap-2 border border-variance bg-surface px-4 py-3 text-sm text-variance">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Tu último análisis de IA no se pudo usar. {FALLBACK_MESSAGE[lastRunFailureStatus] ?? "La IA no respondió."} {mode === "ia"
              ? "Estás viendo las sugerencias de un análisis anterior."
              : "La lista se muestra con el orden por reglas."}
          </span>
        </p>
      )}
    </>
  );
}
