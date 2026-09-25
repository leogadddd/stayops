import { describe, expect, it } from "vitest";
import { createHold, confirmHold } from "@/server/reservations/service";
import { recordPayment } from "@/server/payments/service";
import { createExpense } from "@/server/expenses/service";
import { getDashboardSeries } from "@/server/reports/dashboard";
import { getReport } from "@/server/reports/service";
import { sumDays } from "@/lib/dashboard-series";
import { createActiveUnit, createTestOrg, createTestProperty, stayDates } from "./helpers";

describe("dashboard series", () => {
  it("reconciles with the report for the same period", async () => {
    const { org, owner } = await createTestOrg("dash-series");
    const property = await createTestProperty(org.id, owner.id);
    const unit = await createActiveUnit(org.id, owner.id, property.id);
    const { checkIn, checkOut } = stayDates(40);
    const hold = await createHold({
      organizationId: org.id, actorUserId: owner.id,
      guest: { newGuest: { name: "Series Guest", email: "series@example.com" } },
      data: { unitId: unit.id, checkIn, checkOut, guestCount: 1, holdMinutes: 30, charges: [{ type: "accommodation", description: "Nightly rate", quantity: 2, unitAmountCents: 250_000 }] },
    });
    await recordPayment({
      organizationId: org.id, actorUserId: owner.id, reservationId: hold.id,
      data: { amountPesos: "3000", allocation: "booking", method: "cash", receivedAt: `${checkIn}T00:30` },
    });
    await confirmHold({ organizationId: org.id, actorUserId: owner.id, reservationId: hold.id, reason: "Paid in cash" });
    await createExpense({
      organizationId: org.id, actorUserId: owner.id,
      data: { propertyId: property.id, category: "cleaning", amountPesos: "450", description: "Deep clean", classification: "operating", paidDate: checkIn },
    });

    const range = { from: checkIn, to: checkOut };
    const [series, report] = await Promise.all([getDashboardSeries(org.id, range), getReport(org.id, range)]);
    const totals = sumDays(series.days);
    expect(totals.collectedCents).toBe(report.summary.bookingCollectedCents);
    expect(totals.expensesCents).toBe(report.summary.operatingExpensesCents);
    expect(totals.netCents).toBe(report.summary.netOperatingCashCents);
    expect(totals.occupied).toBe(report.summary.occupiedNights);
    expect(totals.bookable).toBe(report.summary.bookableNights);
    expect(totals.collectedCents).toBe(300_000);
    expect(series.categories).toEqual([{ date: checkIn, category: "cleaning", classification: "operating", amountCents: 45_000 }]);
  });
});
