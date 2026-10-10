import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldX, UserPlus } from "lucide-react";
import { UserRoleForm } from "@/components/UserRoleForm";
import { ROLE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/services/audit";
import { getCurrentProfile } from "@/services/profile";
import { listUsers } from "@/services/users";

export const metadata: Metadata = { title: "Usuarios y roles" };

export default function UsersPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <Suspense fallback={<UsersLoading />}>
        <UsersContent />
      </Suspense>
    </main>
  );
}

async function UsersContent() {
  const supabase = await createClient();
  const profile = await getCurrentProfile(supabase);

  if (profile.data?.role !== "admin") {
    // The database also refuses; this only avoids rendering an empty admin screen.
    await logEvent(supabase, { action: "view_users", resource: "profiles", result: "denied", reason: "caller is not admin" });
    return (
      <div className="flex gap-4 border border-line bg-surface p-6">
        <ShieldX aria-hidden className="size-6 shrink-0 text-variance" />
        <div>
          <h1 className="font-display text-lg font-semibold">Esta sección es solo para administradores</h1>
          <p className="mt-2 text-base text-ink-muted">Tu rol no permite ver ni asignar roles.</p>
        </div>
      </div>
    );
  }

  const [users, countries, regions] = await Promise.all([
    listUsers(supabase),
    supabase.from("countries").select("code, name").order("name"),
    supabase.from("regions").select("code, name").order("name"),
  ]);
  const error = users.error ?? countries.error?.message ?? regions.error?.message;
  if (error || !users.data) {
    return (
      <div role="alert" className="border border-variance bg-surface p-6">
        <h1 className="font-display text-lg font-semibold text-variance">No pudimos cargar las cuentas</h1>
        <p className="mt-3 font-mono text-sm">{error}</p>
      </div>
    );
  }

  const pending = users.data.filter((u) => !u.role);
  const active = users.data.filter((u) => u.role);

  return (
    <>
      <p className="text-sm font-medium uppercase tracking-wide text-ink-muted">Administración</p>
      <h1 className="mt-2 font-display text-xl font-bold [font-stretch:87.5%] md:text-2xl">
        {pending.length === 0
          ? "Todas las cuentas tienen rol"
          : `${pending.length} ${pending.length === 1 ? "cuenta espera" : "cuentas esperan"} un rol`}
      </h1>
      <p className="mt-3 max-w-prose text-base text-ink-muted">
        Una cuenta sin rol puede iniciar sesión pero no ve ningún dato. El rol y el país o región deciden qué
        discrepancias ve cada persona.
      </p>

      <UserSection title="Sin rol asignado" empty="Nadie está esperando. Las cuentas nuevas aparecerán aquí.">
        {pending.map((u) => (
          <UserItem key={u.userId} user={u} isSelf={u.userId === profile.data!.userId} countries={countries.data!} regions={regions.data!} />
        ))}
      </UserSection>

      <UserSection title="Con acceso" empty="Todavía no hay cuentas con rol.">
        {active.map((u) => (
          <UserItem key={u.userId} user={u} isSelf={u.userId === profile.data!.userId} countries={countries.data!} regions={regions.data!} />
        ))}
      </UserSection>
    </>
  );
}

function UserSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 border border-dashed border-line bg-surface px-4 py-6 text-sm text-ink-muted">
          <UserPlus aria-hidden className="size-4" />
          {empty}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line border border-line bg-surface">{children}</ul>
      )}
    </section>
  );
}

function UserItem({
  user,
  isSelf,
  countries,
  regions,
}: React.ComponentProps<typeof UserRoleForm> & { isSelf: boolean }) {
  const scope = user.countryCode ?? user.regionCode ?? (user.role ? "Todos" : null);
  return (
    <li className="space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {user.email}
          {isSelf && <span className="ml-2 text-sm text-ink-muted">(tú)</span>}
        </p>
        <p className="text-sm text-ink-muted">
          {user.role ? `${ROLE_LABEL[user.role]} · ${scope}` : "Sin rol"} · creada el{" "}
          {new Date(user.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      <UserRoleForm user={user} countries={countries} regions={regions} isSelf={isSelf} />
    </li>
  );
}

function UsersLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando cuentas">
      <div className="h-10 w-full max-w-md animate-pulse bg-line motion-reduce:animate-none" />
      <div className="mt-10 h-40 w-full animate-pulse border border-line bg-surface motion-reduce:animate-none" />
    </div>
  );
}
