import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL } from "@/lib/format";
import type { CurrentProfile } from "@/services/profile";

function scopeLabel(p: CurrentProfile): string {
  if (p.role === "analyst") return p.country?.name ?? "Sin país";
  if (p.role === "regional_lead") return p.region?.name ?? "Sin región";
  if (p.role === "admin") return "Todos los países y cuarentena";
  return "Todos los países";
}

export function AppHeader({ profile, email }: { profile: CurrentProfile | null; email: string }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-8">
        <p className="font-display text-base font-bold [font-stretch:87.5%]">Cola de cierre</p>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="font-medium">{profile?.fullName ?? email}</p>
            <p className="text-ink-muted">
              {profile ? `${ROLE_LABEL[profile.role]} · ${scopeLabel(profile)}` : "Sin rol asignado"}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:border-ink-muted hover:bg-ledger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <LogOut aria-hidden className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
