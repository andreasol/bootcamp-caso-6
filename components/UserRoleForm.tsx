"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { assignRoleAction, revokeRoleAction, type RoleFormState } from "@/lib/admin/actions";
import { ROLE_LABEL } from "@/lib/format";
import type { AppRole } from "@/services/profile";
import type { ManagedUser } from "@/services/users";

const initial: RoleFormState = { error: null, saved: false };
const ROLES: AppRole[] = ["analyst", "regional_lead", "global_manager", "admin"];

const field =
  "mt-1 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm hover:border-ink-muted " +
  "focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

interface Props {
  user: ManagedUser;
  countries: { code: string; name: string }[];
  regions: { code: string; name: string }[];
  isSelf: boolean;
}

export function UserRoleForm({ user, countries, regions, isSelf }: Props) {
  const [state, action, pending] = useActionState(assignRoleAction, initial);
  const [revokeState, revoke, revoking] = useActionState(revokeRoleAction, initial);
  const [role, setRole] = useState<AppRole | "">(user.role ?? "");
  const busy = pending || revoking;
  const error = state.error ?? revokeState.error;

  if (isSelf) {
    return <p className="text-sm text-ink-muted">Es tu cuenta: otro administrador debe cambiar tu rol.</p>;
  }

  return (
    <div className="space-y-3">
      <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end">
        <input type="hidden" name="userId" value={user.userId} />
        <label className="text-sm font-medium">
          Nombre
          <input name="fullName" defaultValue={user.fullName} required disabled={busy} className={field} />
        </label>
        <label className="text-sm font-medium">
          Rol
          <select name="role" value={role} onChange={(e) => setRole(e.target.value as AppRole)} required disabled={busy} className={field}>
            <option value="" disabled>Elige un rol</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
        {role === "analyst" && (
          <label className="text-sm font-medium">
            País
            <select name="countryCode" defaultValue={user.countryCode ?? ""} required disabled={busy} className={field}>
              <option value="" disabled>Elige un país</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </label>
        )}
        {role === "regional_lead" && (
          <label className="text-sm font-medium">
            Región
            <select name="regionCode" defaultValue={user.regionCode ?? ""} required disabled={busy} className={field}>
              <option value="" disabled>Elige una región</option>
              {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
          </label>
        )}
        {(role === "" || role === "global_manager" || role === "admin") && (
          <p className="self-center text-sm text-ink-muted">{role ? "Ve todos los países." : ""}</p>
        )}
        <button
          type="submit"
          disabled={busy || role === ""}
          className="flex items-center justify-center gap-2 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          {user.role ? "Guardar rol" : "Asignar rol"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        {error && (
          <p role="alert" className="flex items-center gap-2 text-variance">
            <AlertCircle aria-hidden className="size-4" />
            {error}
          </p>
        )}
        {!error && (state.saved || revokeState.saved) && (
          <p role="status" className="flex items-center gap-2 text-accent">
            <Check aria-hidden className="size-4" />
            {revokeState.saved ? "Acceso quitado." : "Rol guardado."}
          </p>
        )}
        {user.role && (
          <form action={revoke} className="ml-auto">
            <input type="hidden" name="userId" value={user.userId} />
            <button
              type="submit"
              disabled={busy}
              className="text-sm font-medium text-variance underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
            >
              {revoking ? "Quitando…" : "Quitar acceso"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
