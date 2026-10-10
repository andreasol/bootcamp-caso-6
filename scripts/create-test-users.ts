// Creates the development test users, already confirmed (no confirmation email is sent),
// and assigns each one its role and scope in profiles. Idempotent: re-running recreates them.
// Run: npm run db:users   (LOCAL ONLY, uses service_role; password from SEED_TEST_PASSWORD)
import { admin } from "./lib/admin";

interface TestUser {
  email: string;
  fullName: string;
  role: "analyst" | "regional_lead" | "global_manager" | "admin";
  countryCode?: string;
  regionCode?: string;
}

export const TEST_USERS: TestUser[] = [
  { email: "analista.cl@altamar-demo.com", fullName: "Analista Chile (prueba)", role: "analyst", countryCode: "CL" },
  { email: "analista.mx@altamar-demo.com", fullName: "Analista México (prueba)", role: "analyst", countryCode: "MX" },
  { email: "lider.andina@altamar-demo.com", fullName: "Líder Región Andina (prueba)", role: "regional_lead", regionCode: "ANDINA" },
  { email: "gerente.global@altamar-demo.com", fullName: "Gerente Global (prueba)", role: "global_manager" },
  { email: "admin@altamar-demo.com", fullName: "Administrador (prueba)", role: "admin" },
];

async function main() {
  const password = process.env.SEED_TEST_PASSWORD;
  if (!password || password.length < 12) throw new Error("Set SEED_TEST_PASSWORD (12+ chars) in .env.local");

  const [{ data: countries, error: cErr }, { data: regions, error: rErr }] = await Promise.all([
    admin.from("countries").select("id, code"),
    admin.from("regions").select("id, code"),
  ]);
  if (cErr || rErr) throw new Error((cErr ?? rErr)!.message);
  const countryId = new Map(countries!.map((c) => [c.code, c.id]));
  const regionId = new Map(regions!.map((r) => [r.code, r.id]));

  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw new Error(listErr.message);

  for (const u of TEST_USERS) {
    const existing = list.users.find((x) => x.email === u.email);
    if (existing) {
      // profiles and review_actions cascade with the user
      const { error } = await admin.auth.admin.deleteUser(existing.id);
      if (error) throw new Error(`delete ${u.email}: ${error.message}`);
    }
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`create ${u.email}: ${error?.message}`);

    const { error: pErr } = await admin.from("profiles").insert({
      user_id: data.user.id,
      full_name: u.fullName,
      role: u.role,
      country_id: u.countryCode ? countryId.get(u.countryCode) : null,
      region_id: u.regionCode ? regionId.get(u.regionCode) : null,
    });
    if (pErr) throw new Error(`profile ${u.email}: ${pErr.message}`);
    console.log(`✓ ${u.email} (${u.role}${u.countryCode ? " " + u.countryCode : ""}${u.regionCode ? " " + u.regionCode : ""})`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
