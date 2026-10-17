"use client";

import { useRef } from "react";
import Link from "next/link";
import { BookOpen, CircleHelp, MessageCircleQuestion, X } from "lucide-react";

interface Props {
  roleLabel: string | null;
  sees: string | null;
}

const linkClass =
  "flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm font-medium text-accent hover:border-accent " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Native <dialog>: focus trap, Escape to close and screen-reader semantics come with it.
export function HelpPopup({ roleLabel, sees }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        aria-label="Cómo funciona esta herramienta"
        title="Cómo funciona"
        className="flex size-10 items-center justify-center rounded-sm border border-line text-ink-muted hover:border-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <CircleHelp aria-hidden className="size-5" />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="help-title"
        // a click on the backdrop (the dialog element itself) closes it
        onClick={(e) => e.target === ref.current && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="help-title" className="font-display text-lg font-semibold">
              Cómo funciona
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar la ayuda"
              className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <p className="mt-3 text-base">
            Cada mes compara la planilla de cada país con los sistemas globales de pago y vacaciones, encuentra lo que no
            cuadra y lo ordena por urgencia antes del cierre.
          </p>

          <ol className="mt-5 space-y-4 border-l-2 border-line pl-4">
            <li>
              <p className="font-medium">El sistema calcula</p>
              <p className="text-sm text-ink-muted">
                Compara montos y saldos, calcula la varianza y la prioridad con reglas fijas. Aquí no interviene la IA.
              </p>
            </li>
            <li>
              <p className="font-medium">La IA sugiere (si se lo pides)</p>
              <p className="text-sm text-ink-muted">
                Con «Priorizar con IA» propone un orden y explica la causa probable. Solo sugiere: no calcula ni decide.
              </p>
            </li>
            <li>
              <p className="font-medium">Tú decides</p>
              <p className="text-sm text-ink-muted">
                Aprueba, corrige o escala cada diferencia, con comentario. Todo queda registrado.
              </p>
            </li>
          </ol>

          {roleLabel && sees && (
            <p className="mt-5 border border-line bg-ledger px-3 py-2 text-sm">
              Estás como <span className="font-medium">{roleLabel}</span>: ves <span className="font-medium">{sees}</span>. La
              base de datos no entrega nada fuera de tu alcance.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/tutorial" onClick={close} className={linkClass}>
              <BookOpen aria-hidden className="size-4" />
              Ver el tutorial
            </Link>
            <Link href="/faq" onClick={close} className={linkClass}>
              <MessageCircleQuestion aria-hidden className="size-4" />
              Preguntas frecuentes
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
