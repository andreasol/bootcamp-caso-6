"use client";

import { useActionState } from "react";
import { AlertCircle, LoaderCircle, MailCheck } from "lucide-react";
import { signUp, type SignUpState } from "@/lib/auth/actions";
import { RoleFields } from "./RoleFields";

const initial: SignUpState = { error: null, email: "", fullName: "", pendingConfirmation: false };

const inputClass =
  "mt-2 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-base text-ink " +
  "hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

export function SignUpForm({ pickRole }: { pickRole: boolean }) {
  const [state, action, pending] = useActionState(signUp, initial);

  if (state.pendingConfirmation) {
    return (
      <p role="status" className="flex items-start gap-2 text-base">
        <MailCheck aria-hidden className="mt-1 size-4 shrink-0 text-accent" />
        Cuenta creada. Supabase pide confirmar el correo: revisa {state.email} y luego inicia sesión.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-6" noValidate>
      <div>
        <label htmlFor="fullName" className="text-sm font-medium">Nombre completo</label>
        <input id="fullName" name="fullName" autoComplete="name" required defaultValue={state.fullName} disabled={pending} className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} disabled={pending} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} disabled={pending} className={inputClass} aria-describedby="password-hint" />
        <p id="password-hint" className="mt-1 text-sm text-ink-muted">Mínimo 10 caracteres.</p>
      </div>
      {pickRole && <RoleFields disabled={pending} />}

      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-variance">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-base font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
