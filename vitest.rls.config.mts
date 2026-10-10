// RLS suite: hits the real Supabase project with test-user sessions (needs .env.local).
// Kept apart from the unit tests so CI can run those without secrets.
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // files share test users (writes.test.ts revokes and restores one), so run them in order
    fileParallelism: false,
    silent: false,
  },
});
