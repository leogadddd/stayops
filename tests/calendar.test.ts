import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarEventsForUnit, layoutMonthEvents, monthGridRange, type CalendarInterval } from "@/lib/calendar";
import { listNights } from "@/lib/dates";
import { getOccupancySegments, listCalendarActivity, type OccupancySegment } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { requireMembership } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import CalendarPage from "@/app/(app)/calendar/page";
import { MonthCalendar } from "@/app/(app)/calendar/month-calendar";
import { TodayPanel } from "@/app/(app)/calendar/today-panel";

vi.mock("@/lib/auth/session", () => ({ requireMembership: vi.fn() }));
vi.mock("@/server/inventory/service", () => ({ listOrgUnits: vi.fn(), listProperties: vi.fn() }));
vi.mock("@/server/inventory/availability", () => ({ getOccupancySegments: vi.fn(), listCalendarActivity: vi.fn() }));
vi.mock("@/server/operations/service", () => ({ listTasks: vi.fn() }));
vi.mock("@/app/(app)/calendar/availability-check-form", () => ({ AvailabilityCheckForm: () => null }));
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return { ...actual, useRouter: vi.fn(() => ({ push: vi.fn() })) };
});

function reservation(startDate: string, endDate: string, status: "hold" | "confirmed" | "checked_in" | "checked_out" = "confirmed", id = "reservation-1"): OccupancySegment {
  return { kind: "reservation", id, startDate, endDate, guestName: "Santos", status, expiresAt: status === "hold" ? new Date("2026-09-30T12:00:00Z") : null };
}
const interval = (id: string, startDate: string, endDate: string): CalendarInterval => ({ id, startDate, endDate });

describe("monthGridRange", () => {
  it("includes leading and trailing dates in full Sun–Sat weeks", () => {
    expect(monthGridRange("2026-09")).toEqual({ start: "2026-08-30", end: "2026-10-04" });
    const weeks = layoutMonthEvents("2026-09", []);
    expect(weeks).toHaveLength(5);
    for (const week of weeks) {
      expect(week.days).toHaveLength(7);
      expect(new Date(`${week.days[0]}T00:00:00Z`).getUTCDay()).toBe(0);
      expect(new Date(`${week.days[6]}T00:00:00Z`).getUTCDay()).toBe(6);
    }
  });

  it("supports four- and six-week months without adding empty weeks", () => {
    expect(layoutMonthEvents("2026-02", [])).toHaveLength(4);
    expect(layoutMonthEvents("2026-08", [])).toHaveLength(6);
    expect(monthGridRange("2026-12")).toEqual({ start: "2026-11-29", end: "2027-01-03" });
  });
});

describe("calendarEventsForUnit", () => {
  it("keeps the checkout date exclusive and emits a separate one-day marker", () => {
    const [stay, checkout] = calendarEventsForUnit("unit-a", [reservation("2026-09-04", "2026-09-07")]);
    expect(stay).toMatchObject({ kind: "stay", unitId: "unit-a", startDate: "2026-09-04", endDate: "2026-09-07" });
    expect(listNights(stay!.startDate, stay!.endDate)).toEqual(["2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(checkout).toMatchObject({ kind: "checkout", startDate: "2026-09-07", endDate: "2026-09-08", reservationId: "reservation-1" });
  });

  it("does not turn holds or maintenance blocks into checkout events", () => {
    const events = calendarEventsForUnit("unit-a", [
      reservation("2026-09-04", "2026-09-07", "hold"),
      { kind: "block", id: "repair", startDate: "2026-09-08", endDate: "2026-09-10", reason: "AC repair" },
    ]);
    expect(events.map((event) => event.kind)).toEqual(["hold", "block"]);
    expect(events[0]?.expiresAt).toEqual(new Date("2026-09-30T12:00:00Z"));
    expect(events[1]?.description).toBe("AC repair");
  });

  it("retains historical checked-out stays and identifies units in all-unit events", () => {
    const events = calendarEventsForUnit("inactive-unit", [reservation("2025-09-01", "2025-09-04", "checked_out")]);
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.unitId === "inactive-unit")).toBe(true);
    expect(events[0]).toMatchObject({ kind: "stay", status: "checked_out" });
  });
});

describe("layoutMonthEvents", () => {
  it("splits a Friday–Monday stay at Sunday without occupying checkout Monday", () => {
    const events = calendarEventsForUnit("unit-a", [reservation("2026-09-04", "2026-09-07")]);
    const weeks = layoutMonthEvents("2026-09", events);
    expect(weeks[0]?.events[0]).toMatchObject({ startColumn: 5, span: 2, continuesBefore: false, continuesAfter: true });
    expect(weeks[1]?.events.find(({ event }) => event.kind === "stay")).toMatchObject({ startColumn: 0, span: 1, continuesBefore: true, continuesAfter: false });
    expect(weeks[1]?.events.find(({ event }) => event.kind === "checkout")).toMatchObject({ startColumn: 1, span: 1 });
  });

  it("clips long bookings at month-grid boundaries while keeping all intermediate week splits", () => {
    const weeks = layoutMonthEvents("2026-09", [interval("long-stay", "2026-08-01", "2026-11-01")]);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.events[0]?.span === 7)).toBe(true);
    expect(weeks.every((week) => week.events[0]?.continuesBefore && week.events[0]?.continuesAfter)).toBe(true);
    expect(weeks.every((week) => week.events[0]?.lane === 0)).toBe(true);
  });

  it("shows checkout on the first grid day even when all occupied nights precede it", () => {
    const events = calendarEventsForUnit("unit-a", [reservation("2026-08-25", "2026-08-30")]);
    const placements = layoutMonthEvents("2026-09", events).flatMap((week) => week.events);
    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({ startColumn: 0, span: 1, event: { kind: "checkout" } });
  });

  it("splits a month-crossing stay and retains its checkout in the next month", () => {
    const events = calendarEventsForUnit("unit-a", [reservation("2026-09-28", "2026-10-02")]);
    const september = layoutMonthEvents("2026-09", events).at(-1)!;
    const october = layoutMonthEvents("2026-10", events)[0]!;
    expect(september.events).toEqual(october.events);
    expect(october.events.find(({ event }) => event.kind === "stay")).toMatchObject({ startColumn: 1, span: 4 });
    expect(october.events.find(({ event }) => event.kind === "checkout")).toMatchObject({ startColumn: 5, span: 1 });
  });

  it("reuses a lane for adjacent exclusive intervals", () => {
    const week = layoutMonthEvents("2026-09", [
      interval("first", "2026-09-01", "2026-09-03"),
      interval("second", "2026-09-03", "2026-09-05"),
    ])[0]!;
    expect(week.laneCount).toBe(1);
    expect(week.events.map((event) => event.lane)).toEqual([0, 0]);
  });

  it("uses separate lanes for checkout and a new booking on the same day", () => {
    const events = [
      ...calendarEventsForUnit("unit-a", [reservation("2026-09-01", "2026-09-03")]),
      ...calendarEventsForUnit("unit-a", [reservation("2026-09-03", "2026-09-05", "confirmed", "reservation-2")]),
    ];
    const week = layoutMonthEvents("2026-09", events)[0]!;
    const checkout = week.events.find(({ event }) => event.id === "checkout:reservation-1")!;
    const newStay = week.events.find(({ event }) => event.id === "stay:reservation-2")!;
    expect(checkout.startColumn).toBe(newStay.startColumn);
    expect(checkout.lane).not.toBe(newStay.lane);
  });

  it("keeps every overlapping all-unit event, including unavailable overlays", () => {
    const events = Array.from({ length: 18 }, (_, index) => interval(`unit-${index}`, "2026-09-01", "2026-09-04"));
    events.push(interval("unavailable-unit", "2026-08-30", "2026-10-04"));
    const week = layoutMonthEvents("2026-09", events)[0]!;
    expect(week.events).toHaveLength(19);
    expect(week.laneCount).toBe(19);
    expect(new Set(week.events.map((event) => event.lane)).size).toBe(19);
    expect(layoutMonthEvents("2026-09", [...events].reverse())).toEqual(layoutMonthEvents("2026-09", events));
  });

  it("never lets same-lane intervals overlap for mixed durations", () => {
    const events = [
      interval("a", "2026-08-30", "2026-09-02"), interval("b", "2026-09-01", "2026-09-05"),
      interval("c", "2026-09-02", "2026-09-03"), interval("d", "2026-09-03", "2026-09-06"),
      interval("e", "2026-09-04", "2026-09-07"),
    ];
    for (const week of layoutMonthEvents("2026-09", events)) {
      for (const left of week.events) {
        for (const right of week.events) {
          if (left === right || left.lane !== right.lane) continue;
          expect(left.startColumn + left.span <= right.startColumn || right.startColumn + right.span <= left.startColumn).toBe(true);
        }
      }
    }
  });

  it("ignores nonintersecting and empty intervals", () => {
    const events = [interval("before", "2026-08-01", "2026-08-30"), interval("after", "2026-10-04", "2026-10-10"), interval("empty", "2026-09-02", "2026-09-02")];
    expect(layoutMonthEvents("2026-09", events).flatMap((week) => week.events)).toEqual([]);
  });
});

function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as React.ReactNode)];
}
function propsFor<T extends React.ElementType>(tree: React.ReactNode, component: T) {
  return elements(tree).find((node) => node.type === component)!.props as React.ComponentProps<T>;
}

describe("calendar page data boundaries", () => {
  beforeEach(() => vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>));
  beforeAll(() => {
    vi.stubGlobal("React", React);
    vi.useFakeTimers();
    // It is September in Manila, but still August in Los Angeles.
    vi.setSystemTime(new Date("2026-09-01T01:00:00Z"));
  });
  afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMembership).mockResolvedValue({ organizationId: "org-a", organizationName: "Stays", organizationSlug: "stays", userId: "staff-a", role: "staff" });
    vi.mocked(listProperties).mockResolvedValue([
      { id: "property-a", name: "Manila", timezone: "Asia/Manila", checkInTime: "15:00", checkOutTime: "11:00" },
      { id: "property-b", name: "LA", timezone: "America/Los_Angeles", checkInTime: "14:00", checkOutTime: "10:00" },
    ] as Awaited<ReturnType<typeof listProperties>>);
    vi.mocked(listOrgUnits).mockResolvedValue([
      { id: "unit-a", propertyId: "property-a", name: "Apartment 01", status: "active", defaultNightlyRateCents: 987654, cleaningFeeCents: 456789 },
      { id: "unit-b", propertyId: "property-b", name: "Apartment 02", status: "maintenance", defaultNightlyRateCents: 987654, cleaningFeeCents: 456789 },
    ] as Awaited<ReturnType<typeof listOrgUnits>>);
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map());
    vi.mocked(listCalendarActivity).mockResolvedValue([
      { id: "arrival-a", unitId: "unit-a", startDate: "2026-09-01", endDate: "2026-09-04", status: "confirmed", guestName: "Santos", guestCount: 2, expiresAt: null },
      { id: "arrival-b", unitId: "unit-b", startDate: "2026-08-31", endDate: "2026-09-04", status: "confirmed", guestName: "Cruz", guestCount: 1, expiresAt: null },
      { id: "future-hold", unitId: "unit-a", startDate: "2027-01-01", endDate: "2027-01-03", status: "hold", guestName: "Garcia", guestCount: 2, expiresAt: new Date("2026-09-02T01:00:00Z") },
    ]);
    vi.mocked(listTasks).mockResolvedValue([
      { id: "task-a", unitId: "unit-a", reservationId: "prior-stay", status: "open", totalItems: 6, doneItems: 2 },
      { id: "task-b", unitId: "unit-b", reservationId: null, status: "open", totalItems: 4, doneItems: 0 },
    ] as Awaited<ReturnType<typeof listTasks>>);
  });

  it("uses the selected property's local date and scopes reads to that unit", async () => {
    vi.mocked(listCalendarActivity).mockResolvedValue([]);
    const tree = await CalendarPage({ searchParams: Promise.resolve({ unit: "unit-b" }) });
    const calendar = propsFor(tree, MonthCalendar);
    const panel = propsFor(tree, TodayPanel);
    expect(calendar.month).toBe("2026-08");
    expect(calendar.today).toBe("2026-08-31");
    expect(panel.timezone).toBe("America/Los_Angeles");
    expect(panel.openTasks.map((task) => task.id)).toEqual(["task-b"]);
    expect(calendar.newReservationHref).toBeNull();
    expect(listCalendarActivity).toHaveBeenCalledWith("org-a", [{ unitId: "unit-b", today: "2026-08-31" }]);
    expect(getOccupancySegments).toHaveBeenCalledWith("org-a", ["unit-b"], "2026-07-25", "2026-09-06");
  });

  it("keeps Today independent of a past month and counts real all-unit arrivals, holds, and tasks", async () => {
    const tree = await CalendarPage({ searchParams: Promise.resolve({ month: "2025-01" }) });
    const calendar = propsFor(tree, MonthCalendar);
    const panel = propsFor(tree, TodayPanel);
    expect(calendar.month).toBe("2025-01");
    expect(panel.today).toBe("2026-09-01");
    expect(panel.arrivals.map((item) => item.id)).toEqual(["arrival-a", "arrival-b"]);
    expect(panel.activeHolds.map((item) => item.id)).toEqual(["future-hold"]);
    expect(panel.openTasks).toHaveLength(2);
    expect(listTasks).toHaveBeenCalledWith("org-a", { status: "open" });
    expect(calendar.events.filter((event) => event.kind === "unavailable")).toHaveLength(0);
  });

  it("retains inactive-unit history and does not expose prices in staff component props", async () => {
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map([["unit-b", [reservation("2025-01-02", "2025-01-05", "checked_out")]]]));
    const tree = await CalendarPage({ searchParams: Promise.resolve({ unit: "unit-b", month: "2025-01" }) });
    const calendar = propsFor(tree, MonthCalendar);
    expect(calendar.events.map((event) => event.kind)).toEqual(["stay", "checkout"]);
    expect(calendar.events.every((event) => event.unitLabel === "LA · Apartment 02")).toBe(true);
    const serialized = JSON.stringify(tree, (_key, value) => React.isValidElement(value) ? value.props : value);
    for (const privateValue of ["987654", "456789", "defaultNightlyRateCents", "cleaningFeeCents"]) expect(serialized).not.toContain(privateValue);
  });

  it("keeps inventory events read-only for staff while reservation links remain available", async () => {
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map([["unit-a", [
      reservation("2026-09-01", "2026-09-03"),
      { kind: "block", id: "block-a", startDate: "2026-09-05", endDate: "2026-09-06", reason: "Repairs" },
    ]]]));
    const tree = await CalendarPage({ searchParams: Promise.resolve({}) });
    const calendar = propsFor(tree, MonthCalendar);
    expect(calendar.events.find((event) => event.kind === "stay")?.href).toBe("/reservations/reservation-1");
    for (const event of calendar.events.filter((event) => event.kind === "block" || event.kind === "unavailable")) expect(event.href).toBeUndefined();
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain('href="/settings/');
    expect(html).toContain('href="/reservations/reservation-1"');
    expect(html).toContain("Repairs");
  });

  it("does not turn an inactive unit status into a calendar event", async () => {
    vi.mocked(requireMembership).mockResolvedValue({ organizationId: "org-a", organizationName: "Stays", organizationSlug: "stays", userId: "owner-a", role: "owner" });
    vi.mocked(listCalendarActivity).mockResolvedValue([]);
    const tree = await CalendarPage({ searchParams: Promise.resolve({ unit: "unit-b" }) });
    expect(propsFor(tree, MonthCalendar).events.find((event) => event.kind === "unavailable")).toBeUndefined();
  });

  it.each(["properties", "units"])("does not link staff to settings when %s are empty", async (empty) => {
    if (empty === "properties") vi.mocked(listProperties).mockResolvedValue([]);
    vi.mocked(listOrgUnits).mockResolvedValue([]);
    vi.mocked(listCalendarActivity).mockResolvedValue([]);
    const html = renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain('href="/settings/');
  });

  it("keeps active-unit date links prefilled and ignores unauthorized unit IDs", async () => {
    const tree = await CalendarPage({ searchParams: Promise.resolve({ unit: "unit-a" }) });
    const calendar = propsFor(tree, MonthCalendar);
    expect(calendar.newReservationHref!("2026-09-12")).toBe("/reservations/new?checkIn=2026-09-12&checkOut=2026-09-13&unit=unit-a");
    vi.clearAllMocks();
    await CalendarPage({ searchParams: Promise.resolve({ unit: "other-org-unit" }) });
    expect(getOccupancySegments).toHaveBeenCalledWith("org-a", ["unit-a", "unit-b"], expect.any(String), expect.any(String));
  });
});
