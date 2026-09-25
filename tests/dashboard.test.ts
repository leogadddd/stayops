import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/(app)/dashboard/page";
import AvailabilityPage from "@/app/(app)/calendar/availability/page";
import { requireMembership, type MembershipContext } from "@/lib/auth/session";
import { listCalendarActivity } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { findFreeUnitIds } from "@/server/inventory/stay-search";
import { listTasks } from "@/server/operations/service";
import { getReport } from "@/server/reports/service";

vi.mock("@/lib/auth/session", () => ({ requireMembership: vi.fn() }));
vi.mock("@/server/inventory/availability", () => ({ listCalendarActivity: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({ listOrgUnits: vi.fn(), listProperties: vi.fn() }));
vi.mock("@/server/inventory/stay-search", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/inventory/stay-search")>()), findFreeUnitIds: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/operations/service", () => ({ listTasks: vi.fn() }));
vi.mock("@/server/reports/service", () => ({ getReport: vi.fn() }));

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
  vi.mocked(getReport).mockResolvedValue(report);
});

describe("operations dashboard", () => {
  it("shows owners real money, schedule and operations surfaces", async () => {
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).toContain("Money this month");
    expect(html).toContain("Cash movement");
    expect(html).toContain("Today&#x27;s schedule");
    expect(html).toContain("Operations watchlist");
    expect(html).toContain('href="/calendar/availability"');
    expect(getReport).toHaveBeenCalledWith(owner.organizationId, expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
  });

  it("keeps financial reporting out of the staff dashboard", async () => {
    vi.mocked(requireMembership).mockResolvedValue({ ...owner, role: "staff" });
    const html = renderToStaticMarkup(await DashboardPage());
    expect(html).not.toContain("Money this month");
    expect(html).not.toContain("Cash movement");
    expect(html).toContain("Today&#x27;s schedule");
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
