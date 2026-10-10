import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/SignUpForm";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-12 px-4 py-12 md:grid-cols-[1fr_360px] md:items-center md:px-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Grupo Altamar · Planilla</p>
        <h1 className="mt-4 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
          Tu cuenta no ve datos hasta que el administrador te asigne un rol.
        </h1>
        <p className="mt-6 max-w-prose text-base text-ink-muted">
          Después de crearla, pide al administrador que te asigne rol y país o región. Hasta entonces, la cola aparece
          vacía.
        </p>
      </section>

      <section aria-labelledby="signup-title" className="border border-line bg-surface p-6 md:p-8">
        <h2 id="signup-title" className="font-display text-lg font-semibold">
          Crear cuenta
        </h2>
        <div className="mt-6">
          <SignUpForm />
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
