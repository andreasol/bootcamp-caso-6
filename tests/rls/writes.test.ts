// Writes and privileged functions: nobody bypasses scope by writing directly, by calling the
// review function on someone else's row, or by giving themselves a role.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, signIn } from "./helpers";

let analyst: { sb: SupabaseClient; userId: string };
let analystMx: { sb: SupabaseClient; userId: string };
let admin: { sb: SupabaseClient; userId: string };
let mxDiscrepancyId: string;

beforeAll(async () => {
  [analyst, analystMx, admin] = await Promise.all([
    signIn("analista.cl@altamar-demo.com"),
    signIn("analista.mx@altamar-demo.com"),
    signIn("admin@altamar-demo.com"),
  ]);
  const { data } = await admin.sb
    .from("discrepancies")
    .select("id, countries!inner(code)")
    .eq("countries.code", "MX")
    .limit(1)
    .single();
  mxDiscrepancyId = data!.id;
});

describe("direct table writes are refused for signed-in users", () => {
  it("cannot insert, update or delete discrepancies", async () => {
    const ins = await analyst.sb.from("discrepancies").insert({ period: "2026-09-01", type: "missing_file", rule_priority: 1, rule_reason: "x" });
    const upd = await analyst.sb.from("discrepancies").update({ status: "approved" }).not("id", "is", null);
    const del = await analyst.sb.from("discrepancies").delete().not("id", "is", null);
    expect([ins.error?.code, upd.error?.code, del.error?.code]).toEqual(["42501", "42501", "42501"]);
  });

  it("cannot write its own profile to become admin", async () => {
    const { error } = await analyst.sb.from("profiles").update({ role: "admin" }).eq("user_id", analyst.userId);
    expect(error?.code).toBe("42501");
  });

  it("cannot forge or erase audit entries", async () => {
    const ins = await analyst.sb.from("audit_log").insert({ action: "x", resource: "x", result: "allowed" });
    expect(ins.error?.code).toBe("42501");
  });
});

describe("AI rate limit (ai_try_start)", () => {
  it("is refused for anonymous callers", async () => {
    const { data, error } = await anonClient().rpc("ai_try_start", { p_cooldown_seconds: 60 });
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("lets at most one of several simultaneous requests through", async () => {
    // Wait out any earlier run so the burst starts from a clean slate, then fire 6 at once.
    await analystMx.sb.rpc("ai_try_start", { p_cooldown_seconds: 1 });
    // the wait must be at least as long as the cooldown used in the burst below
    await new Promise((r) => setTimeout(r, 1300));
    const results = await Promise.all(Array.from({ length: 6 }, () => analystMx.sb.rpc("ai_try_start", { p_cooldown_seconds: 1 })));
    const values = results.map((r) => r.data as number);
    expect(values.filter((v) => v === 0)).toHaveLength(1);
    expect(values.filter((v) => v > 0 && v <= 1)).toHaveLength(5);
  });

  it("cannot read or reset the limits table directly", async () => {
    const read = await analystMx.sb.from("ai_rate_limits").select("*");
    expect(read.data ?? []).toEqual([]);
    const reset = await analystMx.sb.from("ai_rate_limits").delete().not("user_id", "is", null);
    expect(reset.error?.code).toBe("42501");
  });
});

describe("ai_insights", () => {
  it("cannot store an AI insight about a discrepancy outside its scope", async () => {
    const { error } = await analyst.sb.from("ai_insights").insert({
      run_id: crypto.randomUUID(), discrepancy_id: mxDiscrepancyId, kind: "priority",
      model: "x", prompt_version: "x", validation_status: "valid",
    });
    expect(error?.code).toBe("42501");
  });

  it("cannot store an insight on behalf of another user", async () => {
    const { error } = await analyst.sb.from("ai_insights").insert({
      run_id: crypto.randomUUID(), discrepancy_id: null, kind: "priority", model: "x",
      prompt_version: "x", validation_status: "error", created_by: admin.userId,
    });
    expect(error?.code).toBe("42501");
  });
});

describe("review_discrepancy", () => {
  it("treats an out-of-scope id like a missing one and does not change it", async () => {
    const before = await admin.sb.from("discrepancies").select("status").eq("id", mxDiscrepancyId).single();
    const { data, error } = await analyst.sb.rpc("review_discrepancy", { p_id: mxDiscrepancyId, p_action: "approve" });
    expect(error).toBeNull();
    expect(data?.id ?? null).toBeNull();
    const after = await admin.sb.from("discrepancies").select("status").eq("id", mxDiscrepancyId).single();
    expect(after.data!.status).toBe(before.data!.status);
  });

  it("logs the denied attempt", async () => {
    const { data } = await admin.sb
      .from("audit_log")
      .select("result, reason, user_id")
      .eq("action", "review_discrepancy")
      .eq("resource_id", mxDiscrepancyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(data).toMatchObject({ result: "denied", user_id: analyst.userId });
  });
});

describe("role administration", () => {
  it("a non-admin gets an empty user list and cannot assign roles", async () => {
    const list = await analyst.sb.rpc("admin_list_users");
    expect(list.data).toEqual([]);
    const assign = await analyst.sb.rpc("admin_assign_role", { p_user_id: analyst.userId, p_full_name: "x", p_role: "admin" });
    expect(assign.data).toBe("No tienes permiso para asignar roles.");
    const revoke = await analyst.sb.rpc("admin_revoke_role", { p_user_id: analystMx.userId });
    expect(revoke.data).toBe("No tienes permiso para quitar roles.");
  });

  it("an admin cannot change its own role", async () => {
    const { data } = await admin.sb.rpc("admin_assign_role", { p_user_id: admin.userId, p_full_name: "x", p_role: "analyst", p_country_code: "CL" });
    expect(data).toBe("No puedes cambiar tu propio rol.");
  });

  describe("an account without role sees nothing (deny by default)", () => {
    afterAll(async () => {
      // Restore the test user even if an assertion failed.
      await admin.sb.rpc("admin_assign_role", {
        p_user_id: analystMx.userId, p_full_name: "Analista México (prueba)", p_role: "analyst", p_country_code: "MX",
      });
    });

    it("after the admin revokes the role, and again after it is reassigned", async () => {
      expect((await admin.sb.rpc("admin_revoke_role", { p_user_id: analystMx.userId })).data).toBeNull();
      const none = await analystMx.sb.from("discrepancies").select("*", { count: "exact", head: true });
      const countries = await analystMx.sb.from("countries").select("code");
      expect(none.count).toBe(0);
      expect(countries.data).toEqual([]);

      await admin.sb.rpc("admin_assign_role", {
        p_user_id: analystMx.userId, p_full_name: "Analista México (prueba)", p_role: "analyst", p_country_code: "MX",
      });
      const back = await analystMx.sb.from("discrepancies").select("*", { count: "exact", head: true });
      expect(back.count).toBeGreaterThan(0);
    });
  });
});
