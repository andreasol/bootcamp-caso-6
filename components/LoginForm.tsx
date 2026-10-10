"use client";

import { useActionState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { signIn, type SignInState } from "@/lib/auth/actions";

const initial: SignInState = { error: null, email: "" };

const inputClass =
  "mt-2 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-base text-ink " +
  "placeholder:text-ink-muted/70 hover:border-ink-muted focus:border-accent focus:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="space-y-6" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          disabled={pending}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
          className={inputClass}
        />
      </div>

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
        {pending ? "Entrando…" : "Entrar a la cola"}
      </button>
    </form>
  );
}
