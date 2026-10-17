import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL } from "@/lib/format";
import { ROLE_SEES } from "@/lib/help/content";
import { HelpPopup } from "./HelpPopup";
import { NavLinks } from "./NavLinks";
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
      {/* On phones the sections get their own scrollable row so the header never grows taller. */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 md:px-8">
        <p className="order-1 whitespace-nowrap font-display text-base font-bold [font-stretch:87.5%]">Cola de cierre</p>

        <div className="order-3 -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 md:order-2 md:mx-0 md:w-auto md:flex-1 md:overflow-visible md:px-0">
          <NavLinks
            links={[
              { href: "/queue", label: "Cola" },
              { href: "/tutorial", label: "Tutorial" },
              { href: "/faq", label: "Preguntas frecuentes" },
              ...(profile?.role === "admin" ? [{ href: "/admin/users", label: "Usuarios" }] : []),
            ]}
          />
        </div>

        <div className="order-2 flex min-w-0 items-center gap-2 md:order-3 md:gap-4">
          <HelpPopup roleLabel={profile ? ROLE_LABEL[profile.role] : null} sees={profile ? ROLE_SEES[profile.role] : null} />
          <div className="min-w-0 max-w-[7.5rem] text-right text-sm sm:max-w-none">
            {/* the full name needs room; on phones only the role and scope line is shown */}
            <p className="hidden truncate font-medium sm:block">{profile?.fullName ?? email}</p>
            <p className="truncate text-ink-muted">
              {profile ? `${ROLE_LABEL[profile.role]} · ${scopeLabel(profile)}` : "Sin rol asignado"}
            </p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm hover:border-ink-muted hover:bg-ledger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <LogOut aria-hidden className="size-4" />
              <span className="sr-only sm:not-sr-only">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
