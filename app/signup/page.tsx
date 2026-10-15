import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "@/components/SignUpForm";
import { createClient } from "@/lib/supabase/server";
import { isDemoSelfAssignEnabled } from "@/services/demo";

export const metadata: Metadata = { title: "Crear cuenta" };

// The demo-mode flag lives in the database, so reading it streams in behind Suspense.
export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpLayout pickRole={false} loading />}>
      <SignUpWithFlag />
    </Suspense>
  );
}

async function SignUpWithFlag() {
  const pickRole = await isDemoSelfAssignEnabled(await createClient());
  return <SignUpLayout pickRole={pickRole} />;
}

function SignUpLayout({ pickRole, loading = false }: { pickRole: boolean; loading?: boolean }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-12 px-4 py-12 md:grid-cols-[1fr_360px] md:items-center md:px-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Grupo Altamar · Planilla</p>
        <h1 className="mt-4 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
          {pickRole ? "Elige el rol que quieres probar y entra a la cola." : "Tu cuenta no ve datos hasta que el administrador te asigne un rol."}
        </h1>
        <p className="mt-6 max-w-prose text-base text-ink-muted">
          {pickRole
            ? "Modo de revisión: puedes elegir tu rol y tu país o región. El rol de administrador solo lo asigna otro administrador."
            : "Después de crearla, pide al administrador que te asigne rol y país o región. Hasta entonces, la cola aparece vacía."}
        </p>
      </section>

      <section aria-labelledby="signup-title" className="border border-line bg-surface p-6 md:p-8">
        <h2 id="signup-title" className="font-display text-lg font-semibold">
          Crear cuenta
        </h2>
        <div className="mt-6">
          {loading ? <div aria-busy="true" aria-label="Cargando el formulario" className="h-72 animate-pulse bg-line/50 motion-reduce:animate-none" /> : <SignUpForm pickRole={pickRole} />}
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
