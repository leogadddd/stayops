import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import AvailabilityPage from "@/app/(app)/calendar/availability/page";
import { buildDashboardSeries, seriesStart } from "@/lib/dashboard-series";
import { addDaysLocal, todayInTimeZone } from "@/lib/dates";
import { requireMembership, type MembershipContext } from "@/lib/auth/session";
import { getOccupancySegments, listCalendarActivity } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { findFreeUnitIds } from "@/server/inventory/stay-search";
import { listTasks } from "@/server/operations/service";
import { getDashboardSeries } from "@/server/reports/dashboard";
import { getReport } from "@/server/reports/service";

vi.mock("@/lib/auth/session", () => ({ requireMembership: vi.fn() }));
vi.mock("@/server/inventory/availability", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/inventory/availability")>()), listCalendarActivity: vi.fn(), getOccupancySegments: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({ listOrgUnits: vi.fn(), listProperties: vi.fn() }));
vi.mock("@/server/inventory/stay-search", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/inventory/stay-search")>()), findFreeUnitIds: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/operations/service", () => ({ listTasks: vi.fn() }));
vi.mock("@/server/reports/service", () => ({ getReport: vi.fn() }));
vi.mock("@/server/reports/dashboard", () => ({ getDashboardSeries: vi.fn() }));

const owner: MembershipContext = {
  organizationId: "org-a",
  organizationName: "Riverside Stays",
  organizationSlug: "riverside-stays",
  userId: "user-a",
  role: "owner",
};
const property = {
  id: "property-a",
  organizationId: "org-a",
  name: "Riverside Residences",
  address: "Manila",
  timezone: "Asia/Manila",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  turnoverDurationMinutes: 120,
  houseRules: null,
  imageUrl: null,
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
};
const unit = {
  id: "unit-a",
  organizationId: "org-a",
  propertyId: "property-a",
  name: "Unit 12B",
  status: "active" as const,
  imageUrl: null,
  capacity: 2,
  bedrooms: 1,
  bathrooms: 1,
  defaultNightlyRateCents: 550_000,
  dayRates: {},
  cleaningFeeCents: 50_000,
  securityDepositCents: 200_000,
  checkInTime: "15:00", checkOutTime: "11:00",
  checklistTemplate: [],
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  deletedAt: null,
};
const report = {
  summary: {
    from: "2026-09-01", to: "2026-10-01", activeUnitCount: 1,
    bookedValueCents: 1_200_000, accommodationBookedCents: 1_100_000,
    oneTimeBookedCents: 100_000, occupiedNights: 12, bookableNights: 30,
    occupancyRate: 0.4, avgAccommodationRateCents: 91_667,
    bookingCollectedCents: 900_000, depositCollectedCents: 200_000,
    bookingRefundedCents: 50_000, depositRefundedCents: 0,
    depositsRetainedCents: 0, depositsHeldCents: 200_000,
    operatingExpensesCents: 125_000, capitalSpendingCents: 0,
    netOperatingCashCents: 725_000, propertyBreakdown: [],
  },
  properties: [{ id: "property-a", name: "Riverside Residences" }],
  propertyNames: new Map([["property-a", "Riverside Residences"]]),
  timezone: "Asia/Manila",
};

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMembership).mockResolvedValue(owner);
  vi.mocked(listProperties).mockResolvedValue([property]);
  vi.mocked(listOrgUnits).mockResolvedValue([unit]);
  vi.mocked(listCalendarActivity).mockResolvedValue([]);
  vi.mocked(listTasks).mockResolvedValue([]);
  vi.mocked(getOccupancySegments).mockImplementation(async (_org, _units, start) => new Map([["unit-a", [
    { kind: "reservation", id: "stay-a", startDate: start, endDate: addDaysLocal(start, 3), status: "confirmed", guestName: "Ana Cruz", expiresAt: null },
  ]]]));
  vi.mocked(getReport).mockResolvedValue(report);
  const today = todayInTimeZone("Asia/Manila");
  vi.mocked(getDashboardSeries).mockResolvedValue(buildDashboardSeries({
    from: seriesStart(today),
    to: addDaysLocal(today, 1),
    properties: [{ id: "property-a", name: "Riverside Residences" }],
    units: [{ id: "unit-a", propertyId: "property-a", status: "active" }],
    blocks: [],
    stays: [{ unitId: "unit-a", checkInDate: addDaysLocal(today, -2), checkOutDate: addDaysLocal(today, 1), status: "checked_in" }],
    payments: [{ date: today, amountCents: 900_000 }, { date: addDaysLocal(today, -40), amountCents: 600_000 }],
    refunds: [],
    expenses: [{ date: today, category: "cleaning", classification: "operating", amountCents: 125_000 }],
  }));
});

describe("operations dashboard", () => {
  it("shows owners today, the outlook and interactive performance", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Today&#x27;s schedule");
    // Nothing is waiting, so this month's calendar takes the attention card's place.
    expect(html).not.toContain("Needs attention");
    expect(html).toContain("Open calendar");
    expect(html).toContain(', 1 booking"');
    expect(html).toContain('href="/calendar/availability"');
    expect(html).not.toContain("Next 14 days");
    expect(html).toContain("Bookings this month");
    expect(html).toContain("How your stays are doing");
    expect(html).toContain("₱9,000");
    expect(html).toContain("50%");
    expect(html).toContain("Spending by category");
    expect(html).toContain("Cleaning");
    expect(html).toContain("Security deposits held");
    expect(html).toContain("₱2,000");
    expect(getDashboardSeries).toHaveBeenCalledWith(owner.organizationId, { from: expect.any(String), to: expect.any(String) });
  });

  it("shows needs attention instead of the calendar when a hold is waiting", async () => {
    vi.mocked(listCalendarActivity).mockResolvedValue([
      {
        id: "hold-a", unitId: "unit-a", status: "hold", guestName: "Ben Reyes", guestCount: 2,
        startDate: addDaysLocal(todayInTimeZone("Asia/Manila"), 5),
        endDate: addDaysLocal(todayInTimeZone("Asia/Manila"), 7),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    ] as Awaited<ReturnType<typeof listCalendarActivity>>);
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Needs attention");
    expect(html).toContain("Ben Reyes");
    expect(html).not.toContain("Open calendar");
    // Needs attention now sits before today's schedule.
    expect(html.indexOf("Needs attention")).toBeLessThan(html.indexOf("Today&#x27;s schedule"));
  });

  it("counts this month's confirmed bookings but not holds", async () => {
    const month = todayInTimeZone("Asia/Manila").slice(0, 7);
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map([["unit-a", [
      { kind: "reservation", id: "stay-a", startDate: `${month}-01`, endDate: `${month}-04`, status: "confirmed", guestName: "Ana Cruz", expiresAt: null },
      { kind: "reservation", id: "stay-b", startDate: `${month}-10`, endDate: `${month}-12`, status: "checked_out", guestName: "Ben Reyes", expiresAt: null },
      { kind: "reservation", id: "hold-a", startDate: `${month}-15`, endDate: `${month}-16`, status: "hold", guestName: "Cara Lim", expiresAt: null },
    ]]]) as Awaited<ReturnType<typeof getOccupancySegments>>);
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toMatch(/Bookings this month<\/p><p[^>]*>2<\/p>/);
    expect(html).toContain("5 nights booked");
  });

  it("keeps the operations dashboard when performance data fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getDashboardSeries).mockRejectedValue(new Error("db down"));
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain("Today&#x27;s schedule");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("keeps financial reporting out of the staff dashboard", async () => {
    vi.mocked(requireMembership).mockResolvedValue({ ...owner, role: "staff" });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Today&#x27;s schedule");
    expect(html).toContain("Bookings this month");
    expect(html).not.toContain("How your stays are doing");
    expect(html).not.toContain("Spending by category");
    expect(html).not.toContain("₱");
    expect(getDashboardSeries).not.toHaveBeenCalled();
    expect(getReport).not.toHaveBeenCalled();
  });
});

describe("availability page", () => {
  it("keeps the availability form off the calendar surface on its own route", async () => {
    const html = renderToStaticMarkup(await AvailabilityPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Check availability");
    expect(html).toContain("Guests");
    expect(html).toContain('href="/calendar"');
    expect(html).toContain('name="checkIn"');
    expect(html).toContain('name="checkOut"');
    expect(html).toContain("Where can they stay?");
  });

  it("renders results from URL params and carries the search to the stay page", async () => {
    vi.mocked(findFreeUnitIds).mockResolvedValue(new Set(["unit-a"]));
    const html = renderToStaticMarkup(await AvailabilityPage({ searchParams: Promise.resolve({ checkIn: "2026-10-01", checkOut: "2026-10-03", guests: "2" }) }));
    expect(html).toContain("1 stay available");
    expect(html).toContain('href="/calendar/availability/unit-a?checkIn=2026-10-01&amp;checkOut=2026-10-03&amp;guests=2"');
    expect(html).toContain("₱11,500 total");
    expect(html).toContain('value="2026-10-01"');
  });

  it("leaves out units too small for the guest count and hides rates from staff", async () => {
    vi.mocked(requireMembership).mockResolvedValue({ ...owner, role: "staff" });
    vi.mocked(findFreeUnitIds).mockResolvedValue(new Set());
    const html = renderToStaticMarkup(await AvailabilityPage({ searchParams: Promise.resolve({ checkIn: "2026-10-01", checkOut: "2026-10-03", guests: "3" }) }));
    expect(html).toContain("No stays available");
    expect(html).toContain("1 too small");
    expect(html).not.toContain("₱");
  });

  it("shows an error for an invalid range instead of searching", async () => {
    const html = renderToStaticMarkup(await AvailabilityPage({ searchParams: Promise.resolve({ checkIn: "2026-10-03", checkOut: "2026-10-01", guests: "2" }) }));
    expect(html).toContain("Check-out must be after check-in.");
    expect(findFreeUnitIds).not.toHaveBeenCalled();
  });
});
