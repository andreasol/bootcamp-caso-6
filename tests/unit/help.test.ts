import { describe, expect, it } from "vitest";
import { FAQ_GROUPS, ROLE_SEES, ROLE_TABLE, TUTORIAL_STEPS, TYPE_COUNT, TYPE_GLOSSARY } from "@/lib/help/content";
import { HIGH_PRIORITY_MULTIPLE, rulePriority } from "@/lib/discrepancies/priority";
import { AI_MAX_WAIT, AI_WAIT_RANGE } from "@/lib/ai/constants";
import { TYPE_LABEL } from "@/lib/format";
import { slug } from "@/lib/help/slug";
import { isActive } from "@/lib/nav";

describe("help content", () => {
  it("explains every discrepancy type the product can show", () => {
    expect(Object.keys(TYPE_GLOSSARY).sort()).toEqual(Object.keys(TYPE_LABEL).sort());
  });

  it("has unique FAQ ids (they are used as anchors) and no empty answers", () => {
    const items = FAQ_GROUPS.flatMap((g) => g.items);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of items) {
      expect(item.q.trim().endsWith("?")).toBe(true);
      expect(item.a.length).toBeGreaterThan(0);
      expect(item.a.every((p) => p.trim().length > 0)).toBe(true);
    }
  });

  it("covers every role in the role table and the popup summary", () => {
    const roles = ROLE_TABLE.map((r) => r.role).sort();
    expect(roles).toEqual(["admin", "analyst", "global_manager", "regional_lead"]);
    expect(Object.keys(ROLE_SEES).sort()).toEqual(roles);
  });

  it("has a title and body for every tutorial step", () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(5);
    for (const s of TUTORIAL_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });
});

// The FAQ states priority rules in prose. These tests pin every claim to the real rule, so the
// copy cannot silently drift when priority.ts changes.
describe("FAQ priority claims match rulePriority", () => {
  const faq = FAQ_GROUPS.flatMap((g) => g.items).find((i) => i.id === "prioridad-reglas")!.a.join(" ");
  const below = HIGH_PRIORITY_MULTIPLE - 0.1;

  it("quotes the real multiple", () => {
    expect(faq).toContain(`${HIGH_PRIORITY_MULTIPLE} veces el umbral`);
  });
  it("high: missing file, local payment without global record, variance at the multiple", () => {
    expect(rulePriority({ type: "missing_file", unit: null, thresholdMultiple: null }).priority).toBe(1);
    expect(rulePriority({ type: "missing_in_global", unit: "currency", thresholdMultiple: null }).priority).toBe(1);
    expect(rulePriority({ type: "amount_mismatch", unit: "currency", thresholdMultiple: HIGH_PRIORITY_MULTIPLE }).priority).toBe(1);
    expect(rulePriority({ type: "leave_balance_mismatch", unit: "days", thresholdMultiple: HIGH_PRIORITY_MULTIPLE }).priority).toBe(1);
  });
  it("medium: amount below the multiple, missing in local, leave balance without global record", () => {
    expect(rulePriority({ type: "amount_mismatch", unit: "currency", thresholdMultiple: below }).priority).toBe(2);
    expect(rulePriority({ type: "missing_in_local", unit: "currency", thresholdMultiple: null }).priority).toBe(2);
    expect(rulePriority({ type: "missing_in_global", unit: "days", thresholdMultiple: null }).priority).toBe(2);
  });
  it("low: leave balance below the multiple", () => {
    expect(rulePriority({ type: "leave_balance_mismatch", unit: "days", thresholdMultiple: below }).priority).toBe(3);
  });
});

describe("copy derived from code", () => {
  const all = [
    ...TUTORIAL_STEPS.flatMap((s) => [s.body, s.tip ?? ""]),
    ...FAQ_GROUPS.flatMap((g) => g.items.flatMap((i) => i.a)),
  ].join(" ");

  it("states the number of discrepancy types that actually exist", () => {
    expect(TYPE_COUNT).toBe(Object.keys(TYPE_LABEL).length);
    expect(FAQ_GROUPS.flatMap((g) => g.items).find((i) => i.id === "tipos")!.a[0]).toMatch(/^Hay cinco:/);
  });
  it("uses the shared AI wait text, not its own number", () => {
    expect(all).toContain(AI_WAIT_RANGE);
    expect(AI_MAX_WAIT).toContain("40");
  });
});

describe("FAQ anchors", () => {
  it("has unique group anchors that are valid, accent-free ids", () => {
    const ids = FAQ_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it("slug strips accents and punctuation", () => {
    expect(slug("Cuentas y roles")).toBe("cuentas-y-roles");
    expect(slug("La inteligencia artificial")).toBe("la-inteligencia-artificial");
    expect(slug("¿Qué pasó? Sí/No")).toBe("que-paso-si-no");
  });
});

describe("isActive (nav)", () => {
  it("matches the path itself and its children", () => {
    expect(isActive("/queue", "/queue")).toBe(true);
    expect(isActive("/queue/abc", "/queue")).toBe(true);
  });
  it("does not match a path that only shares a prefix", () => {
    expect(isActive("/faq-admin", "/faq")).toBe(false);
    expect(isActive("/queue-archive", "/queue")).toBe(false);
    expect(isActive("/tutorials", "/tutorial")).toBe(false);
  });
});
