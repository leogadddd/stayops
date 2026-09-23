import { describe, expect, it } from "vitest";
import {
  assessReady,
  DEFAULT_CHECKLIST,
  normalizeChecklistTemplate,
} from "@/lib/turnover";

describe("DEFAULT_CHECKLIST", () => {
  it("carries the ten PRD §3.5 defaults including damage inspection", () => {
    expect(DEFAULT_CHECKLIST).toHaveLength(10);
    const labels = DEFAULT_CHECKLIST.map((item) => item.label.toLowerCase());
    for (const expected of [
      "bedsheets",
      "towels",
      "bathroom",
      "kitchen",
      "fridge",
      "rubbish",
      "toiletries",
      "wi-fi",
      "aircon",
    ]) {
      expect(labels.some((label) => label.includes(expected))).toBe(true);
    }
    expect(labels.some((label) => label.includes("damage"))).toBe(true);
    expect(DEFAULT_CHECKLIST.every((item) => item.required)).toBe(true);
  });
});

describe("normalizeChecklistTemplate", () => {
  it("passes a valid stored template through", () => {
    const template = [
      { label: "Sweep balcony", required: false },
      { label: "Clean bathroom", required: true },
    ];
    expect(normalizeChecklistTemplate(template)).toEqual(template);
  });

  it("falls back to the PRD default for null or malformed jsonb", () => {
    expect(normalizeChecklistTemplate(null)).toEqual(DEFAULT_CHECKLIST);
    expect(normalizeChecklistTemplate("nonsense")).toEqual(DEFAULT_CHECKLIST);
    expect(normalizeChecklistTemplate([{ label: "  ", required: true }])).toEqual(
      DEFAULT_CHECKLIST,
    );
    expect(normalizeChecklistTemplate([])).toEqual(DEFAULT_CHECKLIST);
  });
});

describe("assessReady", () => {
  const items = [
    { label: "Change bedsheets", required: true, completed: true },
    { label: "Damage inspection", required: true, completed: false },
    { label: "Restock minibar", required: false, completed: false },
  ];

  it("blocks ready while a required item is incomplete, ignoring optional ones", () => {
    const result = assessReady(items, 0);
    expect(result.canMarkReady).toBe(false);
    expect(result.canOverrideDamage).toBe(false);
    expect(result.missingRequired).toEqual(["Damage inspection"]);
  });

  it("allows ready when required items are done and no damage is open", () => {
    const result = assessReady(
      items.map((item) => ({ ...item, completed: true })),
      0,
    );
    expect(result.canMarkReady).toBe(true);
    expect(result.canOverrideDamage).toBe(false);
    expect(result.missingRequired).toEqual([]);
  });

  it("blocks ready on open damage reports and exposes the override path", () => {
    const done = items.map((item) => ({ ...item, completed: true }));
    const result = assessReady(done, 2);
    expect(result.canMarkReady).toBe(false);
    expect(result.canOverrideDamage).toBe(true);
    expect(result.openDamageCount).toBe(2);
  });

  it("never lets the damage override excuse missing required items", () => {
    const result = assessReady(items, 1);
    expect(result.canMarkReady).toBe(false);
    expect(result.canOverrideDamage).toBe(false);
  });
});
