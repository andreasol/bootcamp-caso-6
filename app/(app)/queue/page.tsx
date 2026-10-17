import type { Metadata } from "next";
import { QueueFilters } from "@/components/QueueFilters";
import { QueueHeader } from "@/components/QueueHeader";
import { QueueList } from "@/components/QueueList";
import { EmptyQueue, NoProfile, QueueError, SummaryUnavailable } from "@/components/QueueStates";
import { QueueSummary } from "@/components/QueueSummary";
import { defaultMode, orderQueue, type OrderMode } from "@/lib/ai/order";
import type { DiscrepancyType } from "@/lib/domain/types";
import { formatPeriod } from "@/lib/format";
import { summarize } from "@/lib/summary";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { listVisibleCountries } from "@/services/countries";
import { isDemoSelfAssignEnabled } from "@/services/demo";
import { DISCREPANCY_TYPES, listQueue, STATUS_FILTERS, type QueueItem, type StatusFilter } from "@/services/discrepancies";
import { getLastOwnRun, listInsights } from "@/services/insights";
import { getCurrentProfile } from "@/services/profile";
import { listCounts } from "@/services/summary";

export const metadata: Metadata = { title: "Cola priorizada" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const sp = await searchParams;
  const countryParam = one(sp.country)?.toUpperCase() || undefined;
  const typeParam = one(sp.type);
  const statusParam = one(sp.status) ?? "pending";
  const type = DISCREPANCY_TYPES.includes(typeParam as DiscrepancyType) ? (typeParam as DiscrepancyType) : undefined;
  // "all" (or anything unknown) means no status filter
  const status = STATUS_FILTERS.includes(statusParam as StatusFilter) ? (statusParam as StatusFilter) : undefined;
  const rawOrder = one(sp.orden);
  const orderParam: OrderMode | undefined = rawOrder === "ia" || rawOrder === "reglas" ? rawOrder : undefined;

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (profile.error) return <QueueError message={profile.error} />;
  if (!profile.data) return <NoProfile canPick={await isDemoSelfAssignEnabled(supabase)} defaultName="" />;

  // The summary does not depend on the list, so it loads in parallel with it.
  const summaryRequest = listCounts(supabase);

  const countries = await listVisibleCountries(supabase);
  if (countries.error || !countries.data) return <QueueError message={countries.error ?? "Sin países"} />;

  // A country outside the user's scope gets the same empty answer as a country with no rows.
  // RLS would return nothing anyway; this check only leaves evidence of the attempt.
  const country = countryParam ? countries.data.find((c) => c.code === countryParam) : undefined;
  const outOfScope = Boolean(countryParam && !country);

  let items: QueueItem[] = [];
  let total = 0;
  if (!outOfScope) {
    const res = await listQueue(supabase, { countryId: country?.id, type, status });
    if (res.error || !res.data) return <QueueError message={res.error ?? "Respuesta vacía"} />;
    items = res.data;
    total = res.total;
  }

  // AI suggestions are optional: if reading them fails, the queue still works by rules.
  const [counts, insightsRes, lastRun] = await Promise.all([
    summaryRequest,
    listInsights(supabase, items.map((i) => i.id)),
    getLastOwnRun(supabase, profile.data.userId),
  ]);
  const summary = counts.data ? summarize(counts.data) : null;

  // One audit entry per view, covering both the list and the summary that was shown.
  await logEvent(supabase, {
    action: "view_queue",
    resource: "discrepancies",
    result: outOfScope ? "denied" : "allowed",
    reason: outOfScope ? "country outside user scope" : null,
    metadata: outOfScope
      ? { requested_country: countryParam }
      : {
          filters: { country: countryParam, type, status: statusParam },
          returned_ids: items.map((i) => i.id),
          list_total: total,
          summary_total: summary?.total ?? null,
        },
  });

  const insights = insightsRes.data ?? new Map();
  const lastRunFailed = lastRun.data !== null && lastRun.data.status !== "valid";
  // After a failed run the default is the rules order, so the screen never contradicts its notice.
  const mode: OrderMode = orderParam ?? (lastRunFailed ? "reglas" : defaultMode(insights, items));
  const rows = orderQueue(items, insights, mode);

  const hrefFor = (m: OrderMode) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "orden" && typeof v === "string") q.set(k, v);
    q.set("orden", m);
    return `/queue?${q.toString()}`;
  };
  const latestPeriod = [...new Set(items.map((i) => i.period))].sort().at(-1);
  const hasActiveFilters = Boolean(countryParam || type || statusParam !== "pending");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <QueueHeader
        closingLabel={latestPeriod ? `Cierre de ${formatPeriod(latestPeriod)}` : "Cierre de planilla"}
        shown={items.length}
        total={total}
        highByRules={items.filter((i) => i.rulePriority === 1).length}
        mode={mode}
        aiCount={rows.filter((r) => r.source === "ia").length}
        hrefs={{ ia: hrefFor("ia"), reglas: hrefFor("reglas") }}
        lastRunFailureStatus={lastRunFailed ? (lastRun.data?.status ?? null) : null}
      />

      <div className="mt-8">
        {summary ? (
          summary.total > 0 && <QueueSummary summary={summary} />
        ) : (
          <SummaryUnavailable message={counts.error ?? "sin detalle"} />
        )}
      </div>

      <div className="mt-8 border-y border-line py-6">
        <QueueFilters
          countries={countries.data}
          selected={{ country: countryParam, type, status: statusParam }}
          order={orderParam}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyQueue scopeIsEmpty={summary?.total === 0} orderParam={orderParam} />
        ) : (
          <QueueList rows={rows} />
        )}
      </div>
    </main>
  );
}
