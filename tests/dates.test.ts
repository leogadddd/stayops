import { describe, expect, it } from "vitest";
import {
  addDaysLocal,
  isLocalDate,
  listNights,
  nightsBetween,
  rangesOverlap,
} from "@/lib/dates";

describe("isLocalDate", () => {
  it("accepts valid yyyy-mm-dd dates", () => {
    expect(isLocalDate("2026-09-28")).toBe(true);
    expect(isLocalDate("2026-02-28")).toBe(true);
  });

  it("rejects invalid dates and shapes", () => {
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("28/09/2026")).toBe(false);
    expect(isLocalDate("2026-9-8")).toBe(false);
    expect(isLocalDate("not-a-date")).toBe(false);
  });
});

describe("nightsBetween", () => {
  it("counts occupied nights with exclusive checkout", () => {
    // The acceptance scenario: a stay Sep 28–30 occupies two nights.
    expect(nightsBetween("2026-09-28", "2026-09-30")).toBe(2);
    expect(nightsBetween("2026-09-28", "2026-09-29")).toBe(1);
  });

  it("rejects check-out on or before check-in", () => {
    expect(() => nightsBetween("2026-09-30", "2026-09-30")).toThrow();
    expect(() => nightsBetween("2026-10-01", "2026-09-30")).toThrow();
  });

  it("handles month and year boundaries", () => {
    expect(nightsBetween("2026-09-30", "2026-10-02")).toBe(2);
    expect(nightsBetween("2026-12-31", "2027-01-02")).toBe(2);
  });
});

describe("listNights", () => {
  it("lists each occupied night", () => {
    expect(listNights("2026-09-28", "2026-09-30")).toEqual([
      "2026-09-28",
      "2026-09-29",
    ]);
  });
});

describe("rangesOverlap", () => {
  it("detects intersecting half-open ranges", () => {
    // Existing stay Sep 28–30 conflicts with Sep 29–Oct 1…
    expect(rangesOverlap("2026-09-28", "2026-09-30", "2026-09-29", "2026-10-01")).toBe(true);
    // …but a stay starting on checkout day is fine.
    expect(rangesOverlap("2026-09-28", "2026-09-30", "2026-09-30", "2026-10-01")).toBe(false);
    expect(rangesOverlap("2026-09-28", "2026-09-30", "2026-09-26", "2026-09-28")).toBe(false);
  });

  it("treats nested ranges as overlapping", () => {
    expect(rangesOverlap("2026-09-01", "2026-09-30", "2026-09-10", "2026-09-12")).toBe(true);
  });
});

describe("addDaysLocal", () => {
  it("shifts across month boundaries", () => {
    expect(addDaysLocal("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysLocal("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("round-trips with nightsBetween", () => {
    expect(nightsBetween("2026-09-28", addDaysLocal("2026-09-28", 4))).toBe(4);
  });
});
