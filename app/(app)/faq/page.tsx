import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { FAQ_GROUPS } from "@/lib/help/content";

export const metadata: Metadata = { title: "Preguntas frecuentes" };

export default function FaqPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Ayuda</p>
      <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">Preguntas frecuentes</h1>
      <p className="mt-4 text-base text-ink-muted">
        Pulsa una pregunta para ver la respuesta. Si prefieres una guía de principio a fin, mira el{" "}
        <Link href="/tutorial" className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
          tutorial
        </Link>
        .
      </p>

      {/* quick jump between topics */}
      <nav aria-label="Temas" className="mt-6 flex flex-wrap gap-2">
        {FAQ_GROUPS.map((g) => (
          <a
            key={g.title}
            href={`#${g.id}`}
            className="border border-line px-3 py-1.5 text-sm text-ink-muted hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {g.title}
          </a>
        ))}
      </nav>

      {FAQ_GROUPS.map((group) => (
        <section key={group.title} id={group.id} aria-labelledby={`${group.id}-title`} className="mt-12 scroll-mt-6">
          <h2 id={`${group.id}-title`} className="font-display text-lg font-semibold">
            {group.title}
          </h2>
          <div className="mt-3 border-t border-line">
            {group.items.map((item) => (
              <details key={item.id} id={item.id} className="group scroll-mt-6 border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-base font-medium hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <div className="space-y-3 pb-5 text-base text-ink">
                  {item.a.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-14 border-t border-line pt-6 text-sm text-ink-muted">
        ¿Algo no está aquí? Pregunta al administrador de la herramienta.
      </p>
    </main>
  );
}

