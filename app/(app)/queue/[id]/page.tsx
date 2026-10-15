import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, SearchX } from "lucide-react";
import { z } from "zod";
import { AiInsightPanel } from "@/components/AiInsightPanel";
import { DiscrepancyFacts } from "@/components/DiscrepancyFacts";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewHistory } from "@/components/ReviewHistory";
import { SourceRecords } from "@/components/SourceRecords";
import { conceptLabel, formatPeriod, PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { getDiscrepancy } from "@/services/discrepancies";
import { getInsight } from "@/services/insights";
import { listReviews, listSourceRecords } from "@/services/review";
import { DetailSkeleton } from "@/components/DetailSkeleton";

export const metadata: Metadata = { title: "Detalle de la diferencia" };

export default function DetailPage({ params }: PageProps<"/queue/[id]">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      <Link
        href="/queue"
        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Volver a la cola
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: { params: PageProps<"/queue/[id]">["params"] }) {
  const { id } = await params;
  const supabase = await createClient();
  const valid = z.string().uuid().safeParse(id).success;
  const res = valid ? await getDiscrepancy(supabase, id) : { data: null, error: null };

  if (res.error) return <DetailError message={res.error} />;
  if (!res.data) {
    // Same answer for "does not exist" and "outside your scope": nothing is revealed.
    await logEvent(supabase, { action: "view_discrepancy", resource: "discrepancies", resourceId: id, result: "denied", reason: "not found or out of scope" });
    return <NotFound />;
  }

  const item = res.data;
  const recordIds = [item.localRecordId, item.globalRecordId].filter((x): x is string => x !== null);
  const [records, reviews, insight, { data: auth }] = await Promise.all([
    listSourceRecords(supabase, recordIds),
    listReviews(supabase, item.id),
    getInsight(supabase, item.id),
    supabase.auth.getUser(),
  ]);
  if (records.error || reviews.error) return <DetailError message={(records.error ?? reviews.error)!} />;
  await logEvent(supabase, { action: "view_discrepancy", resource: "discrepancies", resourceId: id, result: "allowed" });

  const subject = item.employee ? `${item.employee.fullName} · ${item.employee.globalId}` : (item.sourceSystemName ?? "Archivo");

  return (
    <article className="mt-6 space-y-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
          {item.country.name} · {formatPeriod(item.period)} · Prioridad {PRIORITY_LABEL[item.rulePriority].toLowerCase()} ·{" "}
          {STATUS_LABEL[item.status]}
        </p>
        <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
          {TYPE_LABEL[item.type]}
          {item.concept ? `: ${conceptLabel(item.concept).toLowerCase()}` : ""}
        </h1>
        <p className="mt-2 text-lg">{subject}</p>
        <p className="mt-1 text-sm text-ink-muted">Regla aplicada: {item.ruleReason}</p>
      </header>

      <DiscrepancyFacts item={item} />

      <AiInsightPanel insight={insight.data} rulesPriority={item.rulePriority} />

      <section aria-labelledby="sources-title">
        <h2 id="sources-title" className="font-display text-lg font-semibold">Registros fuente citados</h2>
        <div className="mt-3">
          <SourceRecords
            records={records.data!}
            currency={item.country.currency}
            emptyText={item.type === "missing_file" ? "No hay registros: el archivo no llegó." : "Sin registros fuente visibles."}
          />
        </div>
      </section>

      <section aria-labelledby="decision-title" className="border border-line bg-surface p-4 md:p-6">
        <h2 id="decision-title" className="font-display text-lg font-semibold">Tu decisión</h2>
        <p className="mt-1 text-sm text-ink-muted">El estado solo cambia cuando una persona decide. Queda registrado con tu usuario.</p>
        <div className="mt-4">
          <ReviewForm id={item.id} status={item.status} />
        </div>
      </section>

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="font-display text-lg font-semibold">Historial</h2>
        <div className="mt-3">
          <ReviewHistory entries={reviews.data!} currentUserId={auth.user?.id ?? ""} />
        </div>
      </section>
    </article>
  );
}

function NotFound() {
  return (
    <div className="mt-6 flex gap-4 border border-line bg-surface p-6">
      <SearchX aria-hidden className="size-6 shrink-0 text-ink-muted" />
      <div>
        <h1 className="font-display text-lg font-semibold">No encontramos esta diferencia</h1>
        <p className="mt-2 text-base text-ink-muted">No existe o no está dentro de tu alcance.</p>
      </div>
    </div>
  );
}

function DetailError({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-6 border border-variance bg-surface p-6">
      <h1 className="font-display text-lg font-semibold text-variance">No pudimos cargar el detalle</h1>
      <p className="mt-3 font-mono text-sm">{message}</p>
    </div>
  );
}
