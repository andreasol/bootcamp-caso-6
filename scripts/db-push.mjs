// Applies supabase/migrations to the remote project using the DB password from .env.local.
// LOCAL USE ONLY. The password is passed to the CLI process and never printed.
import { loadEnvFile } from "node:process";
import { spawnSync } from "node:child_process";

loadEnvFile(".env.local");
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD ?? "");
const dbUrl = `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`;

const extra = process.argv.slice(2);
const res = spawnSync("npx", ["supabase", "db", "push", "--yes", "--db-url", dbUrl, ...extra], {
  stdio: "inherit",
  shell: true,
});
process.exit(res.status ?? 1);
