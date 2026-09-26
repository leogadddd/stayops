import { describe, expect, it } from "vitest";
import { summarizeUnitActivity } from "@/lib/unit-activity";
import type { OccupancySegment } from "@/server/inventory/availability";

const stay = (id: string, startDate: string, endDate: string, status: "hold" | "confirmed" | "checked_in" | "checked_out" = "confirmed"): OccupancySegment => ({
  kind: "reservation", id, startDate, endDate, status, guestName: id, expiresAt: null,
});

describe("summarizeUnitActivity", () => {
  const today = "2026-10-10";
  const windowEnd = "2026-10-20"; // 10 nights

  it("finds who is in tonight, who is next, and the upcoming list", () => {
    const activity = summarizeUnitActivity([
      stay("past", "2026-10-01", "2026-10-03", "checked_out"),
      stay("later", "2026-10-15", "2026-10-17"),
      stay("now", "2026-10-09", "2026-10-11", "checked_in"),
      stay("next", "2026-10-12", "2026-10-14", "hold"),
    ], today, windowEnd);
    expect(activity.current?.id).toBe("now");
    expect(activity.next?.id).toBe("next");
    expect(activity.upcoming.map((s) => s.id)).toEqual(["now", "next", "later"]);
  });

  it("does not count a stay checking out today as current", () => {
    const activity = summarizeUnitActivity([stay("leaving", "2026-10-08", "2026-10-10")], today, windowEnd);
    expect(activity.current).toBeNull();
    expect(activity.upcoming).toEqual([]);
  });

  it("counts booked nights only inside the window", () => {
    const activity = summarizeUnitActivity([
      stay("a", "2026-10-08", "2026-10-12"), // 2 nights in window
      stay("b", "2026-10-18", "2026-10-25"), // 2 nights in window
    ], today, windowEnd);
    expect(activity.bookedNights).toBe(4);
    expect(activity.windowNights).toBe(10);
  });

  it("reports a block covering tonight", () => {
    const activity = summarizeUnitActivity([
      { kind: "block", id: "b1", startDate: "2026-10-10", endDate: "2026-10-12", reason: "AC repair" },
    ], today, windowEnd);
    expect(activity.blockedNow?.reason).toBe("AC repair");
  });
});
