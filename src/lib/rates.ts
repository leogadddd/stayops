import { addDaysLocal } from "@/lib/dates";

/**
 * Nightly rates that differ by day of the week, e.g. Friday and Saturday
 * nights at a weekend price. Keys are JavaScript weekdays ("0" = Sunday);
 * a missing day uses the unit's regular nightly rate. A night is priced by
 * the day it starts: a Friday check-in's first night is a Friday night.
 */
export type Weekday = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type DayRates = Partial<Record<Weekday, number>>;

/** Monday first, the way operators think about a week. */
export const WEEKDAYS: { key: Weekday; short: string; long: string }[] = [
  { key: "1", short: "Mon", long: "Monday" },
  { key: "2", short: "Tue", long: "Tuesday" },
  { key: "3", short: "Wed", long: "Wednesday" },
  { key: "4", short: "Thu", long: "Thursday" },
  { key: "5", short: "Fri", long: "Friday" },
  { key: "6", short: "Sat", long: "Saturday" },
  { key: "0", short: "Sun", long: "Sunday" },
];
const SHORT_NAME = new Map(WEEKDAYS.map((day) => [day.key, day.short]));

export function weekdayOf(date: string): Weekday {
  return String(new Date(`${date}T00:00:00Z`).getUTCDay()) as Weekday;
}

/** Only the days whose rate differs from the regular one. */
export function effectiveDayRates(baseCents: number, dayRates: DayRates | null | undefined): DayRates {
  const result: DayRates = {};
  for (const [key, cents] of Object.entries(dayRates ?? {}) as [Weekday, number][]) {
    if (typeof cents === "number" && cents !== baseCents) result[key] = cents;
  }
  return result;
}

export function hasDayRates(baseCents: number, dayRates: DayRates | null | undefined): boolean {
  return Object.keys(effectiveDayRates(baseCents, dayRates)).length > 0;
}

export function nightlyRateFor(date: string, baseCents: number, dayRates: DayRates | null | undefined): number {
  return dayRates?.[weekdayOf(date)] ?? baseCents;
}

export interface AccommodationLine {
  description: string;
  quantity: number;
  unitAmountCents: number;
}

/**
 * Accommodation charge lines for a stay: one line per distinct rate, in the
 * order the rates first appear. Without day rates this is the single
 * "Accommodation (N nights)" line.
 */
export function accommodationLines(input: {
  checkIn: string;
  nights: number;
  baseCents: number;
  dayRates?: DayRates | null;
}): AccommodationLine[] {
  const groups = new Map<number, { nights: number; days: Set<Weekday> }>();
  for (let i = 0; i < input.nights; i++) {
    const date = addDaysLocal(input.checkIn, i);
    const cents = nightlyRateFor(date, input.baseCents, input.dayRates);
    const group = groups.get(cents) ?? { nights: 0, days: new Set<Weekday>() };
    group.nights++;
    group.days.add(weekdayOf(date));
    groups.set(cents, group);
  }
  const nightsLabel = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
  if (groups.size <= 1) {
    const [cents = input.baseCents] = groups.keys();
    return [{ description: `Accommodation (${nightsLabel(input.nights)})`, quantity: input.nights, unitAmountCents: cents }];
  }
  return [...groups].map(([cents, group]) => {
    const days = WEEKDAYS.filter((day) => group.days.has(day.key)).map((day) => SHORT_NAME.get(day.key));
    return {
      description: `Accommodation · ${days.join(", ")} (${nightsLabel(group.nights)})`,
      quantity: group.nights,
      unitAmountCents: cents,
    };
  });
}

export function accommodationTotal(input: Parameters<typeof accommodationLines>[0]): number {
  return accommodationLines(input).reduce((sum, line) => sum + line.quantity * line.unitAmountCents, 0);
}

/**
 * "Fri, Sat ₱7,000" style summaries of the days that differ, grouped by
 * rate, for rate displays. `format` turns centavos into text.
 */
export function dayRateSummary(
  baseCents: number,
  dayRates: DayRates | null | undefined,
  format: (cents: number) => string,
): string[] {
  const byRate = new Map<number, string[]>();
  for (const day of WEEKDAYS) {
    const cents = effectiveDayRates(baseCents, dayRates)[day.key];
    if (cents === undefined) continue;
    byRate.set(cents, [...(byRate.get(cents) ?? []), day.short]);
  }
  return [...byRate].map(([cents, days]) => `${days.join(", ")} ${format(cents)}`);
}
