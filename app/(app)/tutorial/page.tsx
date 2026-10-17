import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { VarianceRule } from "@/components/VarianceRule";
import { TYPE_LABEL } from "@/lib/format";
import { ROLE_TABLE, TUTORIAL_STEPS, TYPE_GLOSSARY } from "@/lib/help/content";
import type { DiscrepancyType } from "@/lib/domain/types";
import type { QueueItem } from "@/services/discrepancies";

export const metadata: Metadata = { title: "Tutorial" };

// Synthetic example so the bar can be read before the user has any real case open.
const EXAMPLE = {
  type: "amount_mismatch",
  unit: "currency",
  localValue: 1_013_000,
  globalValue: 1_000_000,
  variance: 13_000,
  variancePct: 0.013,
  thresholdAbs: 5000,
  thresholdPct: 0.005,
  country: { code: "CL", name: "Chile", currency: "CLP" },
} as unknown as QueueItem;

export default function TutorialPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Ayuda</p>
      <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
        Cómo usar la cola de cierre, paso a paso
      </h1>
      <p className="mt-4 max-w-prose text-base text-ink-muted">
        Son 6 pasos y se hacen en unos minutos. Si buscas una respuesta puntual, mira las{" "}
        <Link href="/faq" className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          preguntas frecuentes
        </Link>
        .
      </p>

      <ol className="mt-10 space-y-10">
        {TUTORIAL_STEPS.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[3rem_1fr] gap-4">
            <span aria-hidden className="font-display text-xl font-bold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-base">{step.body}</p>
              {step.tip && (
                <p className="mt-3 flex items-start gap-2 text-sm text-ink-muted">
                  <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{step.tip}</span>
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section aria-labelledby="bar-title" className="mt-14 border border-line bg-surface p-4 md:p-6">
        <h2 id="bar-title" className="font-display text-lg font-semibold">
          Cómo leer la barra de varianza
        </h2>
        <p className="mt-2 text-base">
          Es un ejemplo inventado: un sueldo base de 1.013.000 CLP en el sistema local contra 1.000.000 CLP en el global, con un umbral de 5.000 CLP.
        </p>
        <div className="mt-5 max-w-xl">
          <VarianceRule item={EXAMPLE} />
        </div>
        <ul className="mt-5 space-y-2 text-sm text-ink-muted">
          <li>La línea vertical negra es el valor del sistema global: el punto de partida.</li>
          <li>La banda gris es el umbral: hasta ahí la diferencia se tolera.</li>
          <li>La barra roja es cuánto se aleja el valor local. Si llega al borde de la banda o sale de ella, es una diferencia.</li>
          <li>Hacia la derecha, el local es mayor que el global; hacia la izquierda, es menor.</li>
        </ul>
      </section>

      <section aria-labelledby="types-title" className="mt-14">
        <h2 id="types-title" className="font-display text-lg font-semibold">
          Los 5 tipos de diferencia
        </h2>
        <div className="mt-4 overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                <th scope="col" className="px-4 py-3 font-medium">Qué significa</th>
                <th scope="col" className="px-4 py-3 font-medium">Qué suele convenir hacer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(Object.keys(TYPE_GLOSSARY) as DiscrepancyType[]).map((t) => (
                <tr key={t} className="align-top">
                  <th scope="row" className="px-4 py-3 font-medium">{TYPE_LABEL[t]}</th>
                  <td className="px-4 py-3">{TYPE_GLOSSARY[t].means}</td>
                  <td className="px-4 py-3">{TYPE_GLOSSARY[t].action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="roles-title" className="mt-14">
        <h2 id="roles-title" className="font-display text-lg font-semibold">
          Qué ve y qué puede hacer cada rol
        </h2>
        <div className="mt-4 overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Rol</th>
                <th scope="col" className="px-4 py-3 font-medium">Ve</th>
                <th scope="col" className="px-4 py-3 font-medium">Puede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROLE_TABLE.map((r) => (
                <tr key={r.role} className="align-top">
                  <th scope="row" className="px-4 py-3 font-medium">{r.label}</th>
                  <td className="px-4 py-3">{r.sees}</td>
                  <td className="px-4 py-3">{r.can}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-14 border-t border-line pt-6">
        <Link
          href="/queue"
          className="inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Ir a la cola
        </Link>
      </div>
    </main>
  );
}
