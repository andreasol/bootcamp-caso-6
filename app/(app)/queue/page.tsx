import type { Metadata } from "next";
import { Inbox, ShieldAlert } from "lucide-react";
import { QueueFilters } from "@/components/QueueFilters";
import { QueueList } from "@/components/QueueList";
import { formatPeriod } from "@/lib/format";
import type { DiscrepancyType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { listVisibleCountries } from "@/services/countries";
import { DISCREPANCY_STATUSES, DISCREPANCY_TYPES, listQueue, type DiscrepancyStatus } from "@/services/discrepancies";
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
  if (!profile.data) return <NoProfile />;

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

  const high = items.filter((i) => i.rulePriority === 1).length;
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
              : `${items.length} ${items.length === 1 ? "diferencia" : "diferencias"}, ${high} de prioridad alta`}
          </h1>
        </div>
        <p className="max-w-sm text-sm text-ink-muted">
          Orden por reglas fijas: primero archivos faltantes y pagos sin registro global, luego la varianza más alta
          frente a su umbral.
        </p>
      </div>

      <div className="mt-8 border-y border-line py-6">
        <QueueFilters countries={countries.data} selected={{ country: countryParam, type, status: statusParam }} />
      </div>

      <div className="mt-8">{items.length === 0 ? <EmptyQueue /> : <QueueList items={items} />}</div>
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

function NoProfile() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="flex gap-4 border border-line bg-surface p-6">
        <ShieldAlert aria-hidden className="size-6 shrink-0 text-accent" />
        <div>
          <h1 className="font-display text-lg font-semibold">Tu cuenta todavía no tiene un rol asignado</h1>
          <p className="mt-2 text-base text-ink-muted">
            Sin rol ni país asignado no puedes ver ningún registro. Pide al administrador que te asigne un rol (analista,
            líder regional o gerente global) y tu país o región.
          </p>
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
