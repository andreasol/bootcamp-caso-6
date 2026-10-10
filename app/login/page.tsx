import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl gap-12 px-4 py-12 md:grid-cols-[1fr_360px] md:items-center md:px-8">
      <section>
        <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Grupo Altamar · Planilla</p>
        <h1 className="mt-4 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
          Lo que no cuadra entre tu planilla local y la global, ordenado antes del cierre.
        </h1>
        <p className="mt-6 max-w-prose text-base text-ink-muted">
          Cada persona ve solo su país o región. La base de datos filtra el acceso antes de mostrar cualquier
          registro.
        </p>
      </section>

      <section aria-labelledby="login-title" className="border border-line bg-surface p-6 md:p-8">
        <h2 id="login-title" className="font-display text-lg font-semibold">
          Iniciar sesión
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Usa la cuenta que te asignó el administrador.</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
