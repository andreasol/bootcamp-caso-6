"use client";

import { RotateCw } from "lucide-react";

// Unexpected failures (network, server). Expected query errors are rendered by the page itself.
export default function QueueErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div role="alert" className="border border-variance bg-surface p-6">
        <h1 className="font-display text-lg font-semibold text-variance">No pudimos cargar la cola</h1>
        <p className="mt-2 text-base text-ink-muted">Puede ser un problema de conexión con la base de datos.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 flex items-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <RotateCw aria-hidden className="size-4" />
          Reintentar
        </button>
      </div>
    </main>
  );
}
