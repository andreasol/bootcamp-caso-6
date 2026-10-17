import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-16">
      <div className="flex gap-4 border border-line bg-surface p-6">
        <SearchX aria-hidden className="size-6 shrink-0 text-ink-muted" />
        <div>
          <h1 className="font-display text-lg font-semibold">No encontramos esta página</h1>
          <p className="mt-2 text-base text-ink-muted">El enlace puede estar mal escrito o la página ya no existe.</p>
          <Link
            href="/queue"
            className="mt-4 inline-block rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Ir a la cola
          </Link>
        </div>
      </div>
    </main>
  );
}
