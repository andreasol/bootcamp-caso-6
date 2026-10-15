"use client";

import { useActionState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { claimRoleAction, type ClaimState } from "@/lib/auth/claim";
import { RoleFields } from "./RoleFields";

const initial: ClaimState = { error: null };

export function ClaimRoleForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(claimRoleAction, initial);
  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="fullName" className="text-sm font-medium">Nombre completo</label>
        <input
          id="fullName"
          name="fullName"
          required
          defaultValue={defaultName}
          disabled={pending}
          className="mt-2 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-base hover:border-ink-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60"
        />
      </div>
      <RoleFields disabled={pending} />
      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-variance">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-base font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
        {pending ? "Asignando…" : "Usar este rol"}
      </button>
    </form>
  );
}
