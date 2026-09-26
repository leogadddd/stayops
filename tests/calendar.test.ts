import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarEventsForUnit, layoutMonthBars, layoutMonthEvents, layoutTimelineBars, MIN_BAR_WIDTH, monthGridRange, type BarInterval, type CalendarInterval } from "@/lib/calendar";
import { listNights } from "@/lib/dates";
import { getOccupancySegments, listCalendarActivity, type OccupancySegment } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { requireMembership } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import CalendarPage from "@/app/(app)/calendar/page";
import { MonthCalendar } from "@/app/(app)/calendar/month-calendar";
import { TimelineCalendar } from "@/app/(app)/calendar/timeline-calendar";
import { TodayPanel } from "@/app/(app)/calendar/today-panel";
import { ViewSwitcher } from "@/app/(app)/calendar/view-switcher";
import { UnitFilter } from "@/app/(app)/calendar/unit-filter";

vi.mock("@/lib/auth/session", async () => (await import("./helpers/session-mock")).mockSessionModule());
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
  it("keeps the checkout date exclusive without emitting a standalone checkout marker", () => {
    const [stay] = calendarEventsForUnit("unit-a", [reservation("2026-09-04", "2026-09-07")]);
    expect(stay).toMatchObject({ kind: "stay", unitId: "unit-a", startDate: "2026-09-04", endDate: "2026-09-07" });
    expect(listNights(stay!.startDate, stay!.endDate)).toEqual(["2026-09-04", "2026-09-05", "2026-09-06"]);
    expect(calendarEventsForUnit("unit-a", [reservation("2026-09-04", "2026-09-07")])).toHaveLength(1);
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

  it("renders a persisted turnover as its own same-day, time-bound event", () => {
    const [turnover] = calendarEventsForUnit("unit-a", [{
      kind: "turnover", id: "turnover-1", reservationId: "reservation-1", taskId: "task-1",
      startDate: "2026-09-07", endDate: "2026-09-08", startTime: "11:00", endTime: "13:30",
      startsAt: new Date("2026-09-07T03:00:00Z"), endsAt: new Date("2026-09-07T05:30:00Z"),
    }]);
    expect(turnover).toMatchObject({ kind: "turnover", startDate: "2026-09-07", endDate: "2026-09-08", startTime: "11:00", endTime: "13:30", reservationId: "reservation-1" });
  });

  it("retains historical checked-out stays and identifies units in all-unit events", () => {
    const events = calendarEventsForUnit("inactive-unit", [reservation("2025-09-01", "2025-09-04", "checked_out")]);
    expect(events).toHaveLength(1);
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
    expect(weeks[1]?.events).toHaveLength(1);
  });

  it("clips long bookings at month-grid boundaries while keeping all intermediate week splits", () => {
    const weeks = layoutMonthEvents("2026-09", [interval("long-stay", "2026-08-01", "2026-11-01")]);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.events[0]?.span === 7)).toBe(true);
    expect(weeks.every((week) => week.events[0]?.continuesBefore && week.events[0]?.continuesAfter)).toBe(true);
    expect(weeks.every((week) => week.events[0]?.lane === 0)).toBe(true);
  });

  it("does not show a checkout event on the first grid day when all occupied nights precede it", () => {
    const events = calendarEventsForUnit("unit-a", [reservation("2026-08-25", "2026-08-30")]);
    const placements = layoutMonthEvents("2026-09", events).flatMap((week) => week.events);
    expect(placements).toHaveLength(0);
  });

  it("splits a month-crossing stay without adding a checkout event", () => {
    const events = calendarEventsForUnit("unit-a", [reservation("2026-09-28", "2026-10-02")]);
    const september = layoutMonthEvents("2026-09", events).at(-1)!;
    const october = layoutMonthEvents("2026-10", events)[0]!;
    expect(september.events).toEqual(october.events);
    expect(october.events.find(({ event }) => event.kind === "stay")).toMatchObject({ startColumn: 1, span: 4 });
    expect(october.events).toHaveLength(1);
  });

  it("reuses a lane for adjacent exclusive intervals", () => {
    const week = layoutMonthEvents("2026-09", [
      interval("first", "2026-09-01", "2026-09-03"),
      interval("second", "2026-09-03", "2026-09-05"),
    ])[0]!;
    expect(week.laneCount).toBe(1);
    expect(week.events.map((event) => event.lane)).toEqual([0, 0]);
  });

  it("reuses a lane for adjacent stays on the same day", () => {
    const events = [
      ...calendarEventsForUnit("unit-a", [reservation("2026-09-01", "2026-09-03")]),
      ...calendarEventsForUnit("unit-a", [reservation("2026-09-03", "2026-09-05", "confirmed", "reservation-2")]),
    ];
    const week = layoutMonthEvents("2026-09", events)[0]!;
    const newStay = week.events.find(({ event }) => event.id === "stay:reservation-2")!;
    expect(newStay.lane).toBe(0);
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

const stayBar = (id: string, startDate: string, endDate: string, startTime = "14:00", endTime = "10:00"): BarInterval =>
  ({ id, startDate, endDate, timed: true, startTime, endTime });

describe("layoutMonthBars", () => {
  it("places stay edges at the check-in and check-out times", () => {
    // Sep 2026 grid starts Sun Aug 30; Tue Sep 1 is column 2.
    const [week] = layoutMonthBars("2026-09", [stayBar("s", "2026-09-01", "2026-09-03", "12:00", "06:00")]);
    expect(week!.bars[0]).toMatchObject({ start: 2.5, end: 4.25, lane: 0, continuesBefore: false, continuesAfter: false });
  });

  it("puts a 10:00 checkout and 14:00 check-in on the same day in one lane", () => {
    const [week] = layoutMonthBars("2026-09", [
      stayBar("first", "2026-09-01", "2026-09-03"),
      stayBar("second", "2026-09-03", "2026-09-04"),
    ]);
    expect(week!.laneCount).toBe(1);
  });

  it("stacks stays whose times overlap on changeover day", () => {
    const [week] = layoutMonthBars("2026-09", [
      stayBar("late-out", "2026-09-01", "2026-09-03", "14:00", "16:00"),
      stayBar("next", "2026-09-03", "2026-09-04"),
    ]);
    expect(week!.bars.find((bar) => bar.event.id === "next")!.lane).toBe(1);
  });

  it("uses an actual checkout on another date as the bar's end", () => {
    const [week] = layoutMonthBars("2026-09", [stayBar("early", "2026-09-01", "2026-09-02", "14:00", "18:00")]);
    expect(week!.bars[0]!.end).toBeCloseTo(3.75);
  });

  it("keeps a same-day early departure visible", () => {
    const [week] = layoutMonthBars("2026-09", [stayBar("s", "2026-09-01", "2026-09-01", "14:00", "13:00")]);
    expect(week!.bars[0]!.end - week!.bars[0]!.start).toBeGreaterThan(0);
  });

  it("keeps whole-day blocks on day edges", () => {
    const [week] = layoutMonthBars("2026-09", [{ id: "block", startDate: "2026-09-04", endDate: "2026-09-06" }]);
    expect(week!.bars[0]).toMatchObject({ start: 5, end: 7 });
  });

  it("widens short pieces so every bar can carry a name", () => {
    // Checks in Sat Sep 5 at 20:00, out Mon Sep 7 at 09:00: a 0.17-day tail in week one.
    const weeks = layoutMonthBars("2026-09", [stayBar("late", "2026-09-05", "2026-09-07", "20:00", "09:00")]);
    const tail = weeks[0]!.bars[0]!;
    expect(tail.end).toBe(7);
    expect(tail.end - tail.start).toBeCloseTo(MIN_BAR_WIDTH);
    expect(tail.continuesAfter).toBe(true);
    // Its piece in the next week starts at the Sunday edge and grows rightward.
    const early = layoutMonthBars("2026-09", [stayBar("early", "2026-09-05", "2026-09-06", "14:00", "03:00")])[1]!.bars[0]!;
    expect(early).toMatchObject({ start: 0, continuesBefore: true });
    expect(early.end).toBeCloseTo(MIN_BAR_WIDTH);
  });

  it("packs lanes with the widened extent so short bars never overlap", () => {
    const [week] = layoutMonthBars("2026-09", [
      stayBar("blip", "2026-09-01", "2026-09-01", "10:00", "11:00"),
      stayBar("next", "2026-09-01", "2026-09-02", "12:00", "11:00"),
    ]);
    const [blip, next] = ["blip", "next"].map((id) => week!.bars.find((bar) => bar.event.id === id)!);
    expect(blip!.end - blip!.start).toBeCloseTo(MIN_BAR_WIDTH);
    expect(next!.lane).not.toBe(blip!.lane);
  });

  it("splits a stay across weeks", () => {
    const weeks = layoutMonthBars("2026-09", [stayBar("s", "2026-09-04", "2026-09-07", "12:00", "12:00")]);
    expect(weeks[0]!.bars[0]).toMatchObject({ start: 5.5, end: 7, continuesAfter: true });
    expect(weeks[1]!.bars[0]).toMatchObject({ start: 0, end: 1.5, continuesBefore: true, continuesAfter: false });
  });
});

describe("layoutTimelineBars", () => {
  const unitBar = (unitId: string, ...args: Parameters<typeof stayBar>) => ({ ...stayBar(...args), unitId });

  it("gives each unit its own row across the month's days", () => {
    const { days, rows } = layoutTimelineBars("2026-09", ["unit-a", "unit-b"], [
      unitBar("unit-a", "a", "2026-09-01", "2026-09-03", "12:00", "06:00"),
      unitBar("unit-b", "b", "2026-09-10", "2026-09-12"),
    ]);
    expect(days).toHaveLength(30);
    expect(rows.map((row) => row.unitId)).toEqual(["unit-a", "unit-b"]);
    expect(rows[0]!.bars.map((bar) => bar.event.id)).toEqual(["a"]);
    expect(rows[0]!.bars[0]).toMatchObject({ start: 0.5, end: 2.25, lane: 0 });
    expect(rows[1]!.bars.map((bar) => bar.event.id)).toEqual(["b"]);
  });

  it("clips at the month edges and stacks overlaps within a unit", () => {
    const { rows } = layoutTimelineBars("2026-09", ["unit-a"], [
      unitBar("unit-a", "across", "2026-08-28", "2026-10-03"),
      { id: "block", unitId: "unit-a", startDate: "2026-09-05", endDate: "2026-09-07" },
    ]);
    const across = rows[0]!.bars.find((bar) => bar.event.id === "across")!;
    expect(across).toMatchObject({ start: 0, end: 30, continuesBefore: true, continuesAfter: true });
    expect(rows[0]!.laneCount).toBe(2);
  });

  it("drops events outside the month", () => {
    const { rows } = layoutTimelineBars("2026-09", ["unit-a"], [unitBar("unit-a", "old", "2026-08-01", "2026-08-05")]);
    expect(rows[0]!.bars).toEqual([]);
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
      { id: "unit-a", propertyId: "property-a", name: "Apartment 01", status: "active", checkInTime: "15:00", checkOutTime: "11:00", defaultNightlyRateCents: 987654, cleaningFeeCents: 456789 },
      { id: "unit-b", propertyId: "property-b", name: "Apartment 02", status: "maintenance", checkInTime: "14:00", checkOutTime: "10:00", defaultNightlyRateCents: 987654, cleaningFeeCents: 456789 },
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
    expect(calendar.events.map((event) => event.kind)).toEqual(["stay"]);
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

  it("ends a stay at its actual checkout and exposes both times in the quick view", async () => {
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map([["unit-a", [
      // Checked out Sep 3 at 09:30 Manila (01:30 UTC), expected 11:00.
      { ...reservation("2026-09-01", "2026-09-03", "checked_out"), guestCount: 2, actualCheckoutAt: new Date("2026-09-03T01:30:00Z") },
      { ...reservation("2026-09-05", "2026-09-07", "confirmed", "reservation-2"), guestCount: 1, actualCheckoutAt: null },
    ]]]));
    const tree = await CalendarPage({ searchParams: Promise.resolve({ unit: "unit-a" }) });
    const [early, upcoming] = propsFor(tree, MonthCalendar).events;
    expect(early).toMatchObject({ timed: true, startTime: "15:00", endDate: "2026-09-03", endTime: "09:30" });
    expect(early!.quickView.checkOut).toMatchObject({ time: "9:30 AM", actual: true, expected: "Sep 3, 11:00 AM" });
    expect(early!.quickView.facts).toContainEqual({ label: "Guests", value: "2" });
    expect(early!.quickView.href).toBe("/reservations/reservation-1");
    expect(upcoming).toMatchObject({ endDate: "2026-09-07", endTime: "11:00", timeLabel: "3PM → 11AM" });
    expect(upcoming!.quickView.checkOut).toMatchObject({ actual: false });
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

  it("keeps the chosen view in every calendar link and renders the timeline", async () => {
    const tree = await CalendarPage({ searchParams: Promise.resolve({ view: "timeline", month: "2026-10" }) });
    const timeline = propsFor(tree, TimelineCalendar);
    expect(elements(tree).some((node) => node.type === MonthCalendar)).toBe(false);
    expect(timeline.units.map((unit) => [unit.id, unit.bookable])).toEqual([["unit-a", true], ["unit-b", false]]);
    expect(timeline.nextHref).toBe("/calendar?month=2026-11&view=timeline");
    expect(propsFor(tree, UnitFilter).hrefFor("unit-b")).toBe("/calendar?month=2026-10&unit=unit-b&view=timeline");
    const switcher = propsFor(timeline.viewSwitcher, ViewSwitcher);
    expect(switcher.view).toBe("timeline");
    expect(switcher.hrefFor("month")).toBe("/calendar?month=2026-10");
  });

  it("falls back to the month view for an unknown view", async () => {
    const tree = await CalendarPage({ searchParams: Promise.resolve({ view: "bogus" }) });
    expect(propsFor(tree, MonthCalendar).nextHref).toBe("/calendar?month=2026-10");
  });

  it("renders timeline rows with bars and drag-to-book only on bookable units", async () => {
    vi.mocked(getOccupancySegments).mockResolvedValue(new Map([["unit-a", [reservation("2026-09-03", "2026-09-06")]]]));
    const tree = await CalendarPage({ searchParams: Promise.resolve({ view: "timeline" }) });
    const html = renderToStaticMarkup(React.createElement(TimelineCalendar, propsFor(tree, TimelineCalendar)));
    expect(html).toContain('aria-label="Apartment 01"');
    expect(html).toContain("Santos");
    expect(html).toContain("Not bookable");
    expect(html).toContain('aria-current="page"');
  });
});
