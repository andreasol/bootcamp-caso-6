"use client";

import { useActionState } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { reviewAction, type ReviewFormState } from "@/lib/review/actions";
import { STATUS_LABEL } from "@/lib/format";

const initial: ReviewFormState = { error: null, savedStatus: null };

const secondary =
  "flex items-center justify-center gap-2 rounded-sm border border-accent px-4 py-2 text-sm font-medium text-accent " +
  "hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function ReviewForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(reviewAction, initial);
  const closed = status === "approved" || status === "corrected";

  if (closed) {
    return (
      <p className="text-base text-ink-muted">
        Cerrada como <span className="font-medium text-ink">{STATUS_LABEL[status]}</span>. Ya no admite cambios.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm font-medium">
        Comentario
        <textarea
          name="comment"
          rows={3}
          maxLength={1000}
          disabled={pending}
          placeholder="Qué revisaste y por qué decides esto. Obligatorio para corregir o escalar."
          className="mt-1 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-base hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60"
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          name="action"
          value="approve"
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          Aprobar la diferencia
        </button>
        <button type="submit" name="action" value="correct" disabled={pending} className={secondary}>
          Marcar como corregida
        </button>
        <button type="submit" name="action" value="escalate" disabled={pending || status === "escalated"} className={secondary}>
          {status === "escalated" ? "Ya está escalada" : "Escalar"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-variance">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}
      {state.savedStatus && (
        <p role="status" className="flex items-center gap-2 text-sm text-accent">
          <Check aria-hidden className="size-4" />
          Decisión guardada: {STATUS_LABEL[state.savedStatus]}.
        </p>
      )}
    </form>
  );
}
