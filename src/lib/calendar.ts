import { addDaysLocal, listNights, monthNightRange } from "@/lib/dates";
import type { OccupancySegment } from "@/server/inventory/availability";

export interface CalendarInterval {
  id: string;
  startDate: string;
  endDate: string; // Exclusive, including for one-day checkout markers.
}

export interface CalendarEvent extends CalendarInterval {
  unitId: string;
  kind: "stay" | "hold" | "checkout" | "block" | "unavailable";
  title: string;
  description?: string;
  reservationId?: string;
  status?: "hold" | "confirmed" | "checked_in" | "checked_out";
  expiresAt?: Date | null;
}

/** Complete Sunday–Saturday weeks, including the adjacent month's dates. */
export function monthGridRange(month: string) {
  const { start, end } = monthNightRange(month);
  const startWeekday = new Date(`${start}T00:00:00Z`).getUTCDay();
  const endWeekday = new Date(`${end}T00:00:00Z`).getUTCDay();
  return {
    start: addDaysLocal(start, -startWeekday),
    end: addDaysLocal(end, (7 - endWeekday) % 7),
  };
}

/** Checkout is a separate marker, never an additional occupied night. */
export function calendarEventsForUnit(
  unitId: string,
  segments: readonly OccupancySegment[],
): CalendarEvent[] {
  return segments.flatMap((segment): CalendarEvent[] => {
    if (segment.kind === "block") {
      return [{
        id: `block:${segment.id}`,
        unitId,
        kind: "block",
        startDate: segment.startDate,
        endDate: segment.endDate,
        title: "Unit unavailable",
        description: segment.reason,
      }];
    }
    const stay: CalendarEvent = {
      id: `stay:${segment.id}`,
      unitId,
      kind: segment.status === "hold" ? "hold" : "stay",
      startDate: segment.startDate,
      endDate: segment.endDate,
      title: segment.guestName,
      reservationId: segment.id,
      status: segment.status,
      expiresAt: segment.expiresAt,
    };
    return segment.status === "hold" ? [stay] : [stay, {
      ...stay,
      id: `checkout:${segment.id}`,
      kind: "checkout",
      startDate: segment.endDate,
      endDate: addDaysLocal(segment.endDate, 1),
    }];
  });
}

export interface WeekEvent<T extends CalendarInterval> {
  event: T;
  startColumn: number; // Zero-based Sunday column.
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

// Busy calendars grow vertically rather than hiding overlapping stays.
export function layoutMonthEvents<T extends CalendarInterval>(
  month: string,
  events: readonly T[],
) {
  const range = monthGridRange(month);
  const days = listNights(range.start, range.end);
  const weeks = [];
  for (let offset = 0; offset < days.length; offset += 7) {
    const weekDays = days.slice(offset, offset + 7);
    const start = weekDays[0]!;
    const end = addDaysLocal(start, 7);
    const candidates = events
      .filter((event) => event.startDate < event.endDate && event.startDate < end && event.endDate > start)
      .map((event) => ({
        event,
        clippedStart: event.startDate < start ? start : event.startDate,
        clippedEnd: event.endDate > end ? end : event.endDate,
      }))
      .sort((a, b) =>
        a.clippedStart.localeCompare(b.clippedStart) ||
        b.clippedEnd.localeCompare(a.clippedEnd) ||
        a.event.id.localeCompare(b.event.id),
      );
    const laneEnds: string[] = [];
    const placements: WeekEvent<T>[] = candidates.map(({ event, clippedStart, clippedEnd }) => {
      let lane = laneEnds.findIndex((lastEnd) => lastEnd <= clippedStart);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = clippedEnd;
      return {
        event,
        startColumn: weekDays.indexOf(clippedStart),
        span: listNights(clippedStart, clippedEnd).length,
        lane,
        continuesBefore: event.startDate < start,
        continuesAfter: event.endDate > end,
      };
    });
    weeks.push({ start, days: weekDays, events: placements, laneCount: laneEnds.length });
  }
  return weeks;
}
