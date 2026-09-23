/**
 * StayOps uses date-only night semantics in the property's local timezone
 * (default Asia/Manila). A stay Sep 28–30 occupies the nights of the 28th
 * and 29th; the check-out date is exclusive. Check-in/check-out travel as
 * `yyyy-mm-dd` strings — never as UTC timestamps divided by 24.
 */

export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m! - 1 &&
    date.getUTCDate() === d
  );
}

export function compareLocalDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Half-open interval check: does [startA, endA) intersect [startB, endB)? */
export function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA < endB && startB < endA;
}

/**
 * Nights occupied by a stay as a count. Requires check-out > check-in.
 * Throws on invalid ranges rather than returning a misleading number.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!isLocalDate(checkIn) || !isLocalDate(checkOut)) {
    throw new Error("Check-in and check-out must be yyyy-mm-dd dates.");
  }
  if (checkOut <= checkIn) {
    throw new Error("Check-out must be after check-in.");
  }
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** The individual occupied nights (check-in inclusive, check-out exclusive). */
export function listNights(checkIn: string, checkOut: string): string[] {
  const count = nightsBetween(checkIn, checkOut);
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    nights.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

/** Shift a local date by a number of days. */
export function addDaysLocal(date: string, days: number): string {
  if (!isLocalDate(date)) {
    throw new Error("Expected a yyyy-mm-dd date.");
  }
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/** Today's date in a given IANA timezone, as yyyy-mm-dd. */
export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Convert a `datetime-local` value ("yyyy-mm-ddTHH:mm", the wall clock in the
 * given IANA timezone) to a UTC Date. Returns null for malformed input.
 */
export function localDateTimeToUtc(
  value: string,
  timeZone: string,
): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const wallAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const wallDate = new Date(wallAsUtc);
  if (
    wallDate.getUTCFullYear() !== Number(year) ||
    wallDate.getUTCMonth() !== Number(month) - 1 ||
    wallDate.getUTCDate() !== Number(day) ||
    wallDate.getUTCHours() !== Number(hour) ||
    wallDate.getUTCMinutes() !== Number(minute)
  ) {
    return null;
  }
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(wallAsUtc))) {
    parts[part.type] = part.value;
  }
  const zoneWallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  return new Date(wallAsUtc - (zoneWallAsUtc - wallAsUtc));
}

/** yyyy-mm format for month navigation. */
export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Move a yyyy-mm month forward or backward, wrapping years. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const cursor = new Date(
    Date.UTC(year!, (monthNumber ?? 1) - 1 + delta, 1),
  );
  return cursor.toISOString().slice(0, 7);
}

/** Half-open night range covering an entire yyyy-mm month. */
export function monthNightRange(month: string): {
  start: string;
  end: string;
} {
  return { start: `${month}-01`, end: shiftMonth(month, 1) + "-01" };
}
