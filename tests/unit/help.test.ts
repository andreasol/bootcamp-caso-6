import { describe, expect, it } from "vitest";
import { FAQ_GROUPS, ROLE_SEES, ROLE_TABLE, TUTORIAL_STEPS, TYPE_GLOSSARY } from "@/lib/help/content";
import { TYPE_LABEL } from "@/lib/format";

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
