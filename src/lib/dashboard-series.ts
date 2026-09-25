import type { ReservationStatus, UnitStatus } from "@/lib/db/schema";
import { addDaysLocal, listNights, rangesOverlap, shiftMonth } from "@/lib/dates";

// Daily performance series for the dashboard. The server builds one day per
// row; the client regroups the same rows into the range the owner picks, so
// switching ranges never refetches. Occupancy follows the rules in
// src/lib/reporting.ts: active units only, blocked nights excluded.

const OCCUPIED: readonly ReservationStatus[] = ["confirmed", "checked_in", "checked_out"];

export interface DailyPoint {
  date: string;
  collectedCents: number;
  refundedCents: number;
  /** Operating expenses only; capital spending is not operating cash. */
  expensesCents: number;
  occupied: number;
  bookable: number;
}

export interface CategoryPoint {
  date: string;
  category: string;
  classification: "operating" | "capital";
  amountCents: number;
}

export interface PropertySeries {
  id: string;
  name: string;
  /** Aligned with DashboardSeries.days. */
  occupied: number[];
  bookable: number[];
}

export interface DashboardSeries {
  days: DailyPoint[];
  categories: CategoryPoint[];
  properties: PropertySeries[];
}

export interface SeriesInput {
  /** Half-open local date range: [from, to). */
  from: string;
  to: string;
  properties: readonly { id: string; name: string }[];
  units: readonly { id: string; propertyId: string; status: UnitStatus }[];
  blocks: readonly { unitId: string; startDate: string; endDate: string }[];
  stays: readonly { unitId: string; checkInDate: string; checkOutDate: string; status: ReservationStatus }[];
  /** Booking-allocation money, already summed per local date. */
  payments: readonly { date: string; amountCents: number }[];
  refunds: readonly { date: string; amountCents: number }[];
  expenses: readonly CategoryPoint[];
}

export function buildDashboardSeries(input: SeriesInput): DashboardSeries {
  const nights = listNights(input.from, input.to);
  const index = new Map(nights.map((night, position) => [night, position]));
  const days: DailyPoint[] = nights.map((date) => ({ date, collectedCents: 0, refundedCents: 0, expensesCents: 0, occupied: 0, bookable: 0 }));
  const properties = input.properties.map((property) => ({ id: property.id, name: property.name, occupied: nights.map(() => 0), bookable: nights.map(() => 0) }));
  const propertyById = new Map(properties.map((property) => [property.id, property]));

  const nightsIn = (start: string, end: string) => {
    if (!rangesOverlap(start, end, input.from, input.to)) return [];
    return listNights(start > input.from ? start : input.from, end < input.to ? end : input.to);
  };

  const blocked = new Map<string, Set<string>>();
  for (const block of input.blocks) {
    const set = blocked.get(block.unitId) ?? new Set<string>();
    for (const night of nightsIn(block.startDate, block.endDate)) set.add(night);
    blocked.set(block.unitId, set);
  }

  const activeUnits = new Map(input.units.filter((unit) => unit.status === "active").map((unit) => [unit.id, unit]));
  for (const unit of activeUnits.values()) {
    const property = propertyById.get(unit.propertyId);
    nights.forEach((night, position) => {
      if (blocked.get(unit.id)?.has(night)) return;
      days[position]!.bookable += 1;
      if (property) property.bookable[position]! += 1;
    });
  }

  for (const stay of input.stays) {
    const unit = activeUnits.get(stay.unitId);
    if (!unit || !OCCUPIED.includes(stay.status)) continue;
    const property = propertyById.get(unit.propertyId);
    for (const night of nightsIn(stay.checkInDate, stay.checkOutDate)) {
      if (blocked.get(unit.id)?.has(night)) continue;
      const position = index.get(night)!;
      days[position]!.occupied += 1;
      if (property) property.occupied[position]! += 1;
    }
  }

  const add = (rows: readonly { date: string; amountCents: number }[], field: "collectedCents" | "refundedCents" | "expensesCents") => {
    for (const row of rows) {
      const position = index.get(row.date);
      if (position !== undefined) days[position]![field] += row.amountCents;
    }
  };
  add(input.payments, "collectedCents");
  add(input.refunds, "refundedCents");
  add(input.expenses.filter((row) => row.classification === "operating"), "expensesCents");

  return {
    days,
    categories: input.expenses.filter((row) => index.has(row.date)),
    properties: properties.filter((property) => property.bookable.some(Boolean) || property.occupied.some(Boolean)),
  };
}

export const RANGE_KEYS = ["30d", "13w", "12m"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, { short: string; long: string }> = {
  "30d": { short: "30D", long: "Last 30 days" },
  "13w": { short: "13W", long: "Last 13 weeks" },
  "12m": { short: "12M", long: "Last 12 months" },
};

export interface Window { from: string; to: string }

/** The selected period ending today, and the equally long period before it. */
export function rangeWindows(range: RangeKey, today: string): { current: Window; previous: Window } {
  const to = addDaysLocal(today, 1);
  const from = range === "30d"
    ? addDaysLocal(to, -30)
    : range === "13w"
      ? addDaysLocal(to, -91)
      : `${shiftMonth(today.slice(0, 7), -11)}-01`;
  const length = listNights(from, to).length;
  return { current: { from, to }, previous: { from: addDaysLocal(from, -length), to: from } };
}

/** First night the series must cover so every range can show its previous period. */
export function seriesStart(today: string): string {
  return rangeWindows("12m", today).previous.from;
}

export interface Totals {
  collectedCents: number;
  refundedCents: number;
  expensesCents: number;
  netCents: number;
  occupied: number;
  bookable: number;
  occupancyRate: number | null;
}

export function sumDays(days: readonly DailyPoint[]): Totals {
  const totals = days.reduce(
    (sum, day) => ({
      collectedCents: sum.collectedCents + day.collectedCents,
      refundedCents: sum.refundedCents + day.refundedCents,
      expensesCents: sum.expensesCents + day.expensesCents,
      occupied: sum.occupied + day.occupied,
      bookable: sum.bookable + day.bookable,
    }),
    { collectedCents: 0, refundedCents: 0, expensesCents: 0, occupied: 0, bookable: 0 },
  );
  return {
    ...totals,
    netCents: totals.collectedCents - totals.refundedCents - totals.expensesCents,
    occupancyRate: totals.bookable === 0 ? null : totals.occupied / totals.bookable,
  };
}

export const inWindow = (window: Window) => (row: { date: string }) => row.date >= window.from && row.date < window.to;

export interface Bucket extends Totals {
  /** First night in the bucket; the bucket's label derives from it. */
  start: string;
  /** Last night in the bucket (inclusive). */
  end: string;
}

/** Days for 30D, 7-night weeks ending today for 13W, calendar months for 12M. */
export function bucketize(days: readonly DailyPoint[], range: RangeKey, today: string): Bucket[] {
  const { current } = rangeWindows(range, today);
  const scoped = days.filter(inWindow(current));
  const groups = new Map<string, DailyPoint[]>();
  scoped.forEach((day, position) => {
    const key = range === "30d"
      ? day.date
      : range === "13w"
        ? scoped[position - (position % 7)]!.date
        : day.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), day]);
  });
  return [...groups.values()].map((group) => ({ start: group[0]!.date, end: group.at(-1)!.date, ...sumDays(group) }));
}

/** Relative change against the previous period, or null without a positive base. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return (current - previous) / previous;
}
