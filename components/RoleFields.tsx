"use client";

import { useState } from "react";
import { COUNTRIES, REGIONS } from "@/lib/seed/reference";

// Demo-mode role picker. 'admin' is not offered: only another admin can grant it.
const OPTIONS = [
  { value: "analyst", label: "Analista (ve un país)" },
  { value: "regional_lead", label: "Líder regional (ve una región)" },
  { value: "global_manager", label: "Gerente global (ve todos los países)" },
] as const;

const field =
  "mt-2 block w-full rounded-sm border border-line bg-surface px-3 py-2 text-base text-ink hover:border-ink-muted " +
  "focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

export function RoleFields({ disabled = false }: { disabled?: boolean }) {
  const [role, setRole] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="role" className="text-sm font-medium">Rol que quieres probar</label>
        <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled} className={field}>
          <option value="" disabled>Elige un rol</option>
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {role === "analyst" && (
        <div>
          <label htmlFor="countryCode" className="text-sm font-medium">País</label>
          <select id="countryCode" name="countryCode" required defaultValue="" disabled={disabled} className={field}>
            <option value="" disabled>Elige un país</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {role === "regional_lead" && (
        <div>
          <label htmlFor="regionCode" className="text-sm font-medium">Región</label>
          <select id="regionCode" name="regionCode" required defaultValue="" disabled={disabled} className={field}>
            <option value="" disabled>Elige una región</option>
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
