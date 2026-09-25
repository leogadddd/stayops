import { addDaysLocal, listNights, monthNightRange } from "@/lib/dates";
import type { OccupancySegment } from "@/server/inventory/availability";

export interface CalendarInterval {
  id: string;
  startDate: string;
  endDate: string; // Exclusive calendar-day interval.
}

export interface CalendarEvent extends CalendarInterval {
  unitId: string;
  kind: "stay" | "hold" | "turnover" | "block" | "unavailable";
  title: string;
  description?: string;
  reservationId?: string;
  status?: "hold" | "confirmed" | "checked_in" | "checked_out";
  expiresAt?: Date | null;
  guestCount?: number;
  actualCheckoutAt?: Date | null;
  startTime?: string;
  endTime?: string;
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

/** Stays, manual blocks, and timestamped turnover windows are separate events. */
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
    if (segment.kind === "turnover") {
      return [{
        id: `turnover:${segment.id}`,
        unitId,
        kind: "turnover",
        startDate: segment.startDate,
        endDate: segment.endDate,
        title: "Turnover",
        description: `Turnover ${segment.startTime}–${segment.endTime}`,
        reservationId: segment.reservationId,
        startTime: segment.startTime,
        endTime: segment.endTime,
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
      guestCount: segment.guestCount,
      actualCheckoutAt: segment.actualCheckoutAt,
    };
    return [stay];
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

export interface BarInterval extends CalendarInterval {
  // Timed events (stays, holds) start at startTime on startDate and end at
  // endTime on endDate, so a 10:00 checkout and a 14:00 check-in on the same
  // day share a lane. Other events cover whole days with an exclusive endDate.
  timed?: boolean;
  startTime?: string;
  endTime?: string;
}

export interface WeekBar<T extends BarInterval> {
  event: T;
  start: number; // Days from the week's Sunday, fractional, 0–7.
  end: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function dayFraction(time: string | undefined): number {
  const match = time ? /^(\d{2}):(\d{2})/.exec(time) : null;
  return match ? Math.min(1, (Number(match[1]) * 60 + Number(match[2])) / 1440) : 0.5;
}

// Keeps a same-day early departure visible as a sliver.
const MIN_TIMED_WIDTH = 0.15;
// Every drawn piece is at least this wide (in days) so it can carry a name,
// including a stay's short tail at a week edge. Lanes are packed with the
// widened extent, so a widened bar never overlaps its neighbour.
export const MIN_BAR_WIDTH = 0.55;

/** Widen a short piece inside [0, 7], growing away from the week edge it's cut at. */
function widen(start: number, end: number, continuesBefore: boolean, continuesAfter: boolean) {
  if (end - start >= MIN_BAR_WIDTH) return { start, end };
  if (continuesAfter && !continuesBefore) return { start: Math.max(0, end - MIN_BAR_WIDTH), end };
  const grown = { start, end: start + MIN_BAR_WIDTH };
  return grown.end > 7 ? { start: 7 - MIN_BAR_WIDTH, end: 7 } : grown;
}

/** Month layout with time-accurate edges for stays and whole days for blocks. */
export function layoutMonthBars<T extends BarInterval>(month: string, events: readonly T[]) {
  const range = monthGridRange(month);
  const days = listNights(range.start, range.end);
  const spans = events.map((event) => {
    if (!event.timed) {
      return { event, start: daysFrom(range.start, event.startDate), end: daysFrom(range.start, event.endDate) };
    }
    const start = daysFrom(range.start, event.startDate) + dayFraction(event.startTime);
    const end = daysFrom(range.start, event.endDate) + dayFraction(event.endTime);
    return { event, start, end: Math.max(end, start + MIN_TIMED_WIDTH) };
  });
  const weeks = [];
  for (let offset = 0; offset < days.length; offset += 7) {
    const weekEnd = offset + 7;
    const candidates = spans
      .filter(({ start, end }) => start < end && start < weekEnd && end > offset)
      .map(({ event, start, end }) => {
        const continuesBefore = start < offset;
        const continuesAfter = end > weekEnd;
        const shown = widen(Math.max(start, offset) - offset, Math.min(end, weekEnd) - offset, continuesBefore, continuesAfter);
        return { event, ...shown, continuesBefore, continuesAfter };
      })
      .sort((a, b) => a.start - b.start || b.end - a.end || a.event.id.localeCompare(b.event.id));
    const laneEnds: number[] = [];
    const bars: WeekBar<T>[] = candidates.map((bar) => {
      let lane = laneEnds.findIndex((lastEnd) => lastEnd <= bar.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = bar.end;
      return { ...bar, lane };
    });
    weeks.push({ start: days[offset]!, days: days.slice(offset, offset + 7), bars, laneCount: laneEnds.length });
  }
  return weeks;
}
