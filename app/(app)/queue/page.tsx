import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Inbox, ShieldAlert } from "lucide-react";
import { AiPrioritizeButton } from "@/components/AiPrioritizeButton";
import { ClaimRoleForm } from "@/components/ClaimRoleForm";
import { QueueFilters } from "@/components/QueueFilters";
import { QueueList } from "@/components/QueueList";
import { QueueSummary } from "@/components/QueueSummary";
import { defaultMode, FALLBACK_MESSAGE, orderQueue, type OrderMode } from "@/lib/ai/order";
import { formatPeriod } from "@/lib/format";
import { summarize } from "@/lib/summary";
import type { DiscrepancyType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { listVisibleCountries } from "@/services/countries";
import { DISCREPANCY_STATUSES, DISCREPANCY_TYPES, listQueue, type DiscrepancyStatus } from "@/services/discrepancies";
import { isDemoSelfAssignEnabled } from "@/services/demo";
import { getLastOwnRun, listInsights } from "@/services/insights";
import { getCurrentProfile } from "@/services/profile";

export const metadata: Metadata = { title: "Cola priorizada" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const sp = await searchParams;
  const countryParam = one(sp.country)?.toUpperCase() || undefined;
  const typeParam = one(sp.type);
  const statusParam = one(sp.status) ?? "open";
  const type = DISCREPANCY_TYPES.includes(typeParam as DiscrepancyType) ? (typeParam as DiscrepancyType) : undefined;
  const status = DISCREPANCY_STATUSES.includes(statusParam as DiscrepancyStatus)
    ? (statusParam as DiscrepancyStatus)
    : undefined;

  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);
  if (profile.error) return <QueueError message={profile.error} />;
  if (!profile.data) return <NoProfile canPick={await isDemoSelfAssignEnabled(supabase)} defaultName="" />;

  const countries = await listVisibleCountries(supabase);
  if (countries.error || !countries.data) return <QueueError message={countries.error ?? "Sin países"} />;

  // A country outside the user's scope gets the same empty answer as a country with no rows.
  // RLS would return nothing anyway; this check only leaves evidence of the attempt.
  const country = countryParam ? countries.data.find((c) => c.code === countryParam) : undefined;
  const outOfScope = Boolean(countryParam && !country);
  const filters = { country: countryParam, type, status };

  let items: Awaited<ReturnType<typeof listQueue>>["data"] = [];
  if (outOfScope) {
    await logEvent(supabase, {
      action: "view_queue",
      resource: "discrepancies",
      result: "denied",
      reason: "country outside user scope",
      metadata: { requested_country: countryParam },
    });
  } else {
    const res = await listQueue(supabase, { countryId: country?.id, type, status });
    if (res.error || !res.data) return <QueueError message={res.error ?? "Respuesta vacía"} />;
    items = res.data;
    await logEvent(supabase, {
      action: "view_queue",
      resource: "discrepancies",
      result: "allowed",
      metadata: { filters, returned_ids: items.map((i) => i.id) },
    });
  }

  // AI suggestions are optional: if reading them fails, the queue still works by rules.
  // Summary over the whole scope (all statuses, no list filters). If it fails, the list still works.
  const scopeAll = await listQueue(supabase, {});
  const summary = scopeAll.data ? summarize(scopeAll.data) : null;

  const [insightsRes, lastRun] = await Promise.all([
    listInsights(supabase, items.map((i) => i.id)),
    getLastOwnRun(supabase, profile.data.userId),
  ]);
  const insights = insightsRes.data ?? new Map();
  const requested = one(sp.orden);
  const mode: OrderMode = requested === "ia" || requested === "reglas" ? requested : defaultMode(insights, items);
  const rows = orderQueue(items, insights, mode);
  const lastRunFailed = lastRun.data !== null && lastRun.data.status !== "valid";
  const aiCount = rows.filter((r) => r.source === "ia").length;
  const orderHref = (m: OrderMode) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "orden" && typeof v === "string") q.set(k, v);
    q.set("orden", m);
    return `/queue?${q.toString()}`;
  };
  const periods = [...new Set(items.map((i) => i.period))].sort();
  const closing = periods.at(-1);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            {closing ? `Cierre de ${formatPeriod(closing)}` : "Cierre de planilla"}
          </p>
          <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
            {items.length === 0
              ? "Nada pendiente con estos filtros"
              : `${items.length} ${items.length === 1 ? "diferencia" : "diferencias"} en esta lista`}
          </h1>
        </div>
        <AiPrioritizeButton disabled={items.length === 0} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-ink-muted">
          {mode === "ia" && aiCount > 0
            ? `Orden sugerido por la IA para ${aiCount} de ${rows.length} casos. Los demás siguen las reglas fijas. Las cifras las calcula el sistema y la decisión es tuya.`
            : "Orden por reglas fijas: primero archivos faltantes y pagos sin registro global, luego la varianza más alta frente a su umbral."}
        </p>
        <nav aria-label="Orden de la lista" className="flex border border-line text-sm">
          {(["ia", "reglas"] as const).map((m) => (
            <Link
              key={m}
              href={orderHref(m)}
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

      {lastRunFailed && lastRun.data && (
        <p role="status" className="mt-4 flex items-start gap-2 border border-variance bg-surface px-4 py-3 text-sm text-variance">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Tu último análisis de IA no se pudo usar. {FALLBACK_MESSAGE[lastRun.data.status] ?? "La IA no respondió."} La lista
            se muestra con el orden por reglas.
          </span>
        </p>
      )}

      {summary && summary.total > 0 && (
        <div className="mt-8">
          <QueueSummary summary={summary} />
        </div>
      )}

      <div className="mt-8 border-y border-line py-6">
        <QueueFilters countries={countries.data} selected={{ country: countryParam, type, status: statusParam }} />
      </div>

      <div className="mt-8">{items.length === 0 ? <EmptyQueue /> : <QueueList rows={rows} />}</div>
    </main>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line bg-surface px-4 py-16 text-center">
      <Inbox aria-hidden className="size-6 text-ink-muted" />
      <p className="text-lg font-medium">No hay discrepancias con estos filtros</p>
      <p className="max-w-md text-sm text-ink-muted">
        Prueba con &quot;Todos los estados&quot; para ver también las que ya se aprobaron o corrigieron.
      </p>
    </div>
  );
}

function NoProfile({ canPick, defaultName }: { canPick: boolean; defaultName: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex gap-4 border border-line bg-surface p-6">
        <ShieldAlert aria-hidden className="size-6 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold">Tu cuenta todavía no tiene un rol asignado</h1>
          {canPick ? (
            <>
              <p className="mt-2 text-base text-ink-muted">
                Modo de revisión: elige el rol que quieres probar. El de administrador solo lo asigna otro administrador.
              </p>
              <div className="mt-6">
                <ClaimRoleForm defaultName={defaultName} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-base text-ink-muted">
              Tu cuenta ya existe, pero sin rol no puedes ver ningún registro. Pide al administrador que te asigne un rol
              (analista, líder regional o gerente global) y tu país o región. Después, recarga esta página.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function QueueError({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div role="alert" className="border border-variance bg-surface p-6">
        <h1 className="font-display text-lg font-semibold text-variance">No pudimos cargar la cola</h1>
        <p className="mt-2 text-base text-ink-muted">Recarga la página. Si sigue fallando, avisa al administrador con este detalle:</p>
        <p className="mt-3 font-mono text-sm">{message}</p>
      </div>
    </main>
  );
}
