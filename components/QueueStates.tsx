// The non-happy screens of the queue: no role yet, nothing to show, and failures.
import Link from "next/link";
import { AlertTriangle, Inbox, ShieldAlert } from "lucide-react";
import { ClaimRoleForm } from "./ClaimRoleForm";

export function NoProfile({ canPick, defaultName }: { canPick: boolean; defaultName: string }) {
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

// Two different empty cases: filters hide everything, or the scope itself has no cases.
export function EmptyQueue({ scopeIsEmpty, orderParam }: { scopeIsEmpty: boolean; orderParam?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line bg-surface px-4 py-16 text-center">
      <Inbox aria-hidden className="size-6 text-ink-muted" />
      {scopeIsEmpty ? (
        <>
          <p className="text-lg font-medium">Todavía no hay diferencias en tu alcance</p>
          <p className="max-w-md text-sm text-ink-muted">
            Aparecerán aquí cuando se carguen los archivos del mes y el sistema los compare.
          </p>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">Ninguna diferencia coincide con estos filtros</p>
          <p className="max-w-md text-sm text-ink-muted">
            Prueba con &quot;Todos los estados&quot; para incluir las que ya se aprobaron o corrigieron.
          </p>
          <Link
            href={orderParam ? `/queue?orden=${orderParam}` : "/queue"}
            className="text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Limpiar los filtros
          </Link>
        </>
      )}
    </div>
  );
}

export function QueueError({ message }: { message: string }) {
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

// The summary is secondary: if it fails the list still works, but the user must be told.
export function SummaryUnavailable({ message }: { message: string }) {
  return (
    <p role="status" className="flex items-start gap-2 border border-variance bg-surface px-4 py-3 text-sm text-variance">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        No pudimos cargar el resumen del cierre. La lista de abajo sí está completa. Detalle: <span className="font-mono">{message}</span>
      </span>
    </p>
  );
}
