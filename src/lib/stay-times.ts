/**
 * Units have fixed check-in and check-out times; a stay is overnight, so
 * check-out falls on the next day. The stay length is the gap between the
 * two times, which is how the unit form fills in check-out from a length.
 */

export function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function fromMinutes(total: number): string {
  const minutes = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Hours from check-in to check-out the next day; equal times mean a full 24 hours. */
export function stayLengthHours(checkIn: string, checkOut: string): number | null {
  const start = toMinutes(checkIn);
  const end = toMinutes(checkOut);
  if (start === null || end === null) return null;
  return (((end - start + 1440) % 1440) || 1440) / 60;
}

export function stayLengthLabel(hours: number | null): string {
  if (hours === null) return "—";
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}-hour stay`;
}
