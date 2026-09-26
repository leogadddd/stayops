import { nightsBetween } from "@/lib/dates";
import type { OccupancySegment } from "@/server/inventory/availability";

export type StaySegment = Extract<OccupancySegment, { kind: "reservation" }>;
export type BlockSegment = Extract<OccupancySegment, { kind: "block" }>;

export interface UnitActivity {
  /** The stay covering tonight, if any (hold, confirmed or checked in). */
  current: StaySegment | null;
  /** The next stay arriving after tonight's. */
  next: StaySegment | null;
  /** Current and future stays, soonest first. Checked-out stays are left out. */
  upcoming: StaySegment[];
  /** A block covering tonight. */
  blockedNow: BlockSegment | null;
  /** Nights in [today, windowEnd) taken by holds or bookings. */
  bookedNights: number;
  windowNights: number;
}

function overlapNights(start: string, end: string, from: string, to: string) {
  const s = start > from ? start : from;
  const e = end < to ? end : to;
  return s < e ? nightsBetween(s, e) : 0;
}

/**
 * What a unit looks like from today: who is there, who is next, and how full
 * the window ahead is. Pure, so property and unit pages share one reading of
 * the occupancy segments.
 */
export function summarizeUnitActivity(
  segments: readonly OccupancySegment[],
  today: string,
  windowEnd: string,
): UnitActivity {
  const stays = segments
    .filter((segment): segment is StaySegment => segment.kind === "reservation")
    .filter((stay) => stay.status !== "checked_out" && stay.endDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const current = stays.find((stay) => stay.startDate <= today) ?? null;
  const next = stays.find((stay) => stay.startDate > today) ?? null;
  const blockedNow =
    segments.find(
      (segment): segment is BlockSegment =>
        segment.kind === "block" && segment.startDate <= today && today < segment.endDate,
    ) ?? null;
  const bookedNights = segments
    .filter((segment): segment is StaySegment => segment.kind === "reservation")
    .reduce(
      (sum, stay) => sum + overlapNights(stay.startDate, stay.endDate, today, windowEnd),
      0,
    );
  return {
    current,
    next,
    upcoming: stays,
    blockedNow,
    bookedNights,
    windowNights: nightsBetween(today, windowEnd),
  };
}
