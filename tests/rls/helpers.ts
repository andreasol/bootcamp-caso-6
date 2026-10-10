// Real sessions for the RLS suite: anon key + test user password, exactly like the browser.
// No service_role here: the point is to prove what each role can see through RLS.
import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateDataset } from "@/lib/seed/generate";
import { datasetToPipelineInput } from "@/lib/seed/to-pipeline";
import { runPipeline } from "@/lib/pipeline/run";
import type { GroundTruth } from "@/lib/seed/generate";

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const ALL = ["CL", "CR", "ES", "MX", "PE"];

export interface RoleCase {
  key: string;
  email: string;
  role: "analyst" | "regional_lead" | "global_manager" | "admin";
  countries: string[];
}

export const ROLES: RoleCase[] = [
  { key: "analista.cl", email: "analista.cl@altamar-demo.com", role: "analyst", countries: ["CL"] },
  { key: "analista.mx", email: "analista.mx@altamar-demo.com", role: "analyst", countries: ["MX"] },
  { key: "lider.andina", email: "lider.andina@altamar-demo.com", role: "regional_lead", countries: ["CL", "PE"] },
  { key: "gerente.global", email: "gerente.global@altamar-demo.com", role: "global_manager", countries: ALL },
  { key: "admin", email: "admin@altamar-demo.com", role: "admin", countries: ALL },
];

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function signIn(email: string): Promise<{ sb: SupabaseClient; userId: string }> {
  const password = process.env.SEED_TEST_PASSWORD;
  if (!password) throw new Error("SEED_TEST_PASSWORD missing in .env.local (run npm run db:users first)");
  const sb = anonClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { sb, userId: data.user.id };
}

export async function count(sb: SupabaseClient, table: string): Promise<number | "error"> {
  const { count: n, error } = await sb.from(table).select("*", { count: "exact", head: true });
  return error ? "error" : (n ?? 0);
}

// Expected values come from the synthetic dataset and the ground truth, not hand-typed numbers.
const ds = generateDataset();
const out = runPipeline(datasetToPipelineInput(ds));
const gt = JSON.parse(readFileSync("seed/ground_truth.json", "utf8")) as GroundTruth;

const inScope = (countries: string[]) => (code: string) => countries.includes(code);

export function expectedFor(countries: string[]) {
  const ok = inScope(countries);
  return {
    discrepancies: gt.discrepancies.filter((d) => ok(d.countryCode)).length,
    employees: ds.employees.filter((e) => ok(e.countryCode)).length,
    normalized: out.normalized.filter((r) => ok(r.countryCode)).length,
    globalPayroll: ds.globalPayroll.filter((r) => ok(r.countryCode)).length,
    batches: ds.batches.filter((b) => ok(b.countryCode)).length,
  };
}

export const QUARANTINE_TOTAL = gt.quarantine.length;
