// service_role client for LOCAL scripts only (seed + pipeline). It bypasses RLS, so it must
// never be imported from app/, lib/ or anything that reaches Vercel (assumption A2).
import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHUNK = 500;
const PAGE = 1000;

export async function insertAll<T extends object>(table: string, rows: T[], select = "*"): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { data, error } = await admin.from(table).insert(rows.slice(i, i + CHUNK)).select(select);
    if (error) throw new Error(`insert ${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return out;
}

// PostgREST caps responses (1000 rows by default), so read in pages.
export async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

export async function wipe(table: string, key = "id"): Promise<void> {
  const { error } = await admin.from(table).delete().not(key, "is", null);
  if (error) throw new Error(`wipe ${table}: ${error.message}`);
}
