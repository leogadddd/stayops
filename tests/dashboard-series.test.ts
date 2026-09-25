import { describe, expect, it } from "vitest";
import { bucketize, buildDashboardSeries, change, inWindow, rangeWindows, seriesStart, sumDays } from "@/lib/dashboard-series";

const base = {
  properties: [{ id: "p1", name: "North" }, { id: "p2", name: "South" }],
  units: [
    { id: "u1", propertyId: "p1", status: "active" as const },
    { id: "u2", propertyId: "p2", status: "active" as const },
    { id: "u3", propertyId: "p2", status: "inactive" as const },
  ],
  blocks: [],
  stays: [],
  payments: [],
  refunds: [],
  expenses: [],
};

describe("buildDashboardSeries", () => {
  it("counts occupancy like reports: active units only, blocked nights excluded, holds ignored", () => {
    const series = buildDashboardSeries({
      ...base,
      from: "2026-09-01",
      to: "2026-09-05",
      blocks: [{ unitId: "u2", startDate: "2026-09-03", endDate: "2026-09-04" }],
      stays: [
        { unitId: "u1", checkInDate: "2026-08-30", checkOutDate: "2026-09-03", status: "checked_out" },
        { unitId: "u2", checkInDate: "2026-09-02", checkOutDate: "2026-09-05", status: "confirmed" },
        { unitId: "u3", checkInDate: "2026-09-01", checkOutDate: "2026-09-05", status: "confirmed" },
        { unitId: "u1", checkInDate: "2026-09-03", checkOutDate: "2026-09-05", status: "hold" },
      ],
    });
    expect(series.days.map((day) => [day.occupied, day.bookable])).toEqual([[1, 2], [2, 2], [0, 1], [1, 2]]);
    expect(series.properties.find((property) => property.id === "p2")).toMatchObject({ occupied: [0, 1, 0, 1], bookable: [1, 1, 0, 1] });
  });

  it("places cash on its local date and keeps capital spending out of operating expenses", () => {
    const series = buildDashboardSeries({
      ...base,
      from: "2026-09-01",
      to: "2026-09-03",
      payments: [{ date: "2026-09-02", amountCents: 500_000 }, { date: "2026-08-31", amountCents: 1 }],
      refunds: [{ date: "2026-09-02", amountCents: 50_000 }],
      expenses: [
        { date: "2026-09-01", category: "cleaning", classification: "operating", amountCents: 20_000 },
        { date: "2026-09-01", category: "renovation", classification: "capital", amountCents: 900_000 },
      ],
    });
    expect(sumDays(series.days)).toMatchObject({ collectedCents: 500_000, refundedCents: 50_000, expensesCents: 20_000, netCents: 430_000 });
    expect(series.categories).toHaveLength(2);
  });
});

describe("ranges and buckets", () => {
  const today = "2026-09-25";

  it("compares each range with the equally long period before it", () => {
    expect(rangeWindows("30d", today)).toEqual({ current: { from: "2026-08-27", to: "2026-09-26" }, previous: { from: "2026-07-28", to: "2026-08-27" } });
    expect(rangeWindows("12m", today).current.from).toBe("2025-10-01");
    expect(seriesStart(today)).toBe(rangeWindows("12m", today).previous.from);
  });

  it("buckets days, 7-night weeks ending today, and calendar months", () => {
    const series = buildDashboardSeries({ ...base, from: seriesStart(today), to: "2026-09-26", payments: [{ date: today, amountCents: 100 }] });
    const days = bucketize(series.days, "30d", today);
    const weeks = bucketize(series.days, "13w", today);
    const months = bucketize(series.days, "12m", today);
    expect(days).toHaveLength(30);
    expect(weeks).toHaveLength(13);
    expect(weeks.at(-1)).toMatchObject({ start: "2026-09-19", end: today, collectedCents: 100 });
    expect(months).toHaveLength(12);
    expect(months[0]!.start).toBe("2025-10-01");
    expect(months.at(-1)).toMatchObject({ start: "2026-09-01", end: today });
    expect(series.days.filter(inWindow(rangeWindows("12m", today).previous)).length).toBeGreaterThan(300);
  });

  it("only reports change against a positive base", () => {
    expect(change(150, 100)).toBe(0.5);
    expect(change(150, 0)).toBeNull();
    expect(change(null, 100)).toBeNull();
  });
});

describe("pesoCompact", async () => {
  const { pesoCompact } = await import("@/app/(app)/dashboard/chart-kit");
  it("formats the same way on server and browser", () => {
    expect(pesoCompact(3_800_000)).toBe("₱38K");
    expect(pesoCompact(125_050)).toBe("₱1.3K");
    expect(pesoCompact(-45_000)).toBe("-₱450");
    expect(pesoCompact(250_000_000)).toBe("₱2.5M");
  });
});
