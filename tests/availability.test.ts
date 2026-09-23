import { describe, expect, it } from "vitest";
import {
  buildNightStatusMap,
  checkIntervalAvailability,
  type OccupancySegment,
} from "@/server/inventory/availability";

const block = (
  startDate: string,
  endDate: string,
  reason = "maintenance",
): OccupancySegment => ({ kind: "block", id: `${startDate}-${endDate}`, startDate, endDate, reason });

describe("buildNightStatusMap", () => {
  it("marks every night available with no segments", () => {
    const map = buildNightStatusMap("2026-09-28", "2026-10-01", []);
    expect(map.get("2026-09-28")).toEqual({ kind: "available" });
    expect(map.get("2026-09-29")).toEqual({ kind: "available" });
    expect(map.get("2026-09-30")).toEqual({ kind: "available" });
  });

  it("blocks nights inside a half-open segment range", () => {
    const map = buildNightStatusMap("2026-09-04", "2026-09-08", [
      block("2026-09-05", "2026-09-07", "AC repair"),
    ]);
    expect(map.get("2026-09-04")).toEqual({ kind: "available" });
    expect(map.get("2026-09-05")).toEqual({
      kind: "blocked",
      reason: "AC repair",
      segmentId: "2026-09-05-2026-09-07",
    });
    expect(map.get("2026-09-06")).toMatchObject({ kind: "blocked" });
    // End date is exclusive: the night of the 7th is bookable.
    expect(map.get("2026-09-07")).toEqual({ kind: "available" });
  });

  it("clips segments that extend past the requested range", () => {
    const map = buildNightStatusMap("2026-09-10", "2026-09-13", [
      block("2026-09-01", "2026-09-12"),
    ]);
    expect(map.get("2026-09-10")).toMatchObject({ kind: "blocked" });
    expect(map.get("2026-09-11")).toMatchObject({ kind: "blocked" });
    expect(map.get("2026-09-12")).toEqual({ kind: "available" });
  });

  it("lets the earliest starting segment win a contested night", () => {
    const map = buildNightStatusMap("2026-09-01", "2026-09-05", [
      block("2026-09-02", "2026-09-04", "first"),
      block("2026-09-03", "2026-09-05", "second"),
    ]);
    expect(map.get("2026-09-03")).toMatchObject({ reason: "first" });
  });
});

describe("checkIntervalAvailability", () => {
  const segments = [block("2026-09-05", "2026-09-07", "AC repair")];

  it("reports available with the night list when clear", () => {
    const check = checkIntervalAvailability(segments, "2026-09-07", "2026-09-10");
    expect(check.available).toBe(true);
    if (check.available) {
      expect(check.nights).toEqual(["2026-09-07", "2026-09-08", "2026-09-09"]);
    }
  });

  it("conflicts when the range intersects a block", () => {
    const check = checkIntervalAvailability(segments, "2026-09-04", "2026-09-06");
    expect(check.available).toBe(false);
    if (!check.available) {
      expect(check.conflict.reason).toBe("AC repair");
    }
  });

  it("treats a stay starting on the block's end date as available", () => {
    // Checkout-exclusive semantics: block covers nights of the 5th and 6th.
    const check = checkIntervalAvailability(segments, "2026-09-07", "2026-09-08");
    expect(check.available).toBe(true);
  });

  it("treats a stay ending on the block's start date as available", () => {
    const check = checkIntervalAvailability(segments, "2026-09-03", "2026-09-05");
    expect(check.available).toBe(true);
  });
});
