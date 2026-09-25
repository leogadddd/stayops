"use server";

import { requireMembership } from "@/lib/auth/session";
import { isLocalDate, nightsBetween } from "@/lib/dates";
import { buildNightStatusMap, getOccupancySegments } from "@/server/inventory/availability";
import { unexpectedErrorMessage } from "@/lib/errors";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { explainUnitStay } from "@/server/inventory/stay-search";
import { InventoryError } from "@/server/inventory/validation";

export type StayAvailability =
  | { status: "available" }
  | { status: "unavailable"; reason: string }
  | { status: "error"; message: string };

/** Live availability for the new-reservation flow. Saving still runs the authoritative check. */
export async function checkStayAvailabilityAction(unitId: string, checkIn: string, checkOut: string, excludeReservationId?: string): Promise<StayAvailability> {
  const membership = await requireMembership();
  if (!isLocalDate(checkIn) || !isLocalDate(checkOut) || checkOut <= checkIn) {
    return { status: "error", message: "Pick a check-out after check-in." };
  }
  try {
    const unit = await getUnitOrThrow(membership.organizationId, unitId);
    const property = await getPropertyOrThrow(membership.organizationId, unit.propertyId);
    const result = await explainUnitStay(membership.organizationId, unit, property.timezone, { checkIn, checkOut }, excludeReservationId);
    return result.available ? { status: "available" } : { status: "unavailable", reason: result.reason };
  } catch (error) {
    if (error instanceof InventoryError) return { status: "error", message: error.message };
    return { status: "error", message: unexpectedErrorMessage(error, "availability") };
  }
}

export interface OccupiedNight {
  date: string;
  kind: "booked" | "held" | "blocked";
  label: string;
}

/** Most months the range calendar asks for at once (it shows two). */
const MAX_WINDOW_NIGHTS = 100;

/**
 * Occupied nights for one unit in [start, end), for the range calendar. Free
 * nights are left out. `excludeReservationId` hides the reservation being
 * edited so its own nights read as selectable.
 */
export async function getUnitOccupancyAction(unitId: string, start: string, end: string, excludeReservationId?: string): Promise<OccupiedNight[]> {
  const membership = await requireMembership();
  if (!isLocalDate(start) || !isLocalDate(end) || end <= start || nightsBetween(start, end) > MAX_WINDOW_NIGHTS) return [];
  try {
    // Confirms the unit belongs to this organization before reading its nights.
    await getUnitOrThrow(membership.organizationId, unitId);
    const segments = (await getOccupancySegments(membership.organizationId, [unitId], start, end)).get(unitId) ?? [];
    const own = (segment: (typeof segments)[number]) => Boolean(excludeReservationId) && (segment.kind === "reservation" ? segment.id === excludeReservationId : segment.kind === "turnover" && segment.reservationId === excludeReservationId);
    const nights: OccupiedNight[] = [];
    for (const [date, status] of buildNightStatusMap(start, end, segments.filter((segment) => !own(segment)))) {
      if (status.kind === "booked") nights.push({ date, kind: "booked", label: `Booked · ${status.guestName}` });
      else if (status.kind === "held") nights.push({ date, kind: "held", label: `Hold · ${status.guestName}` });
      else if (status.kind === "blocked") nights.push({ date, kind: "blocked", label: `Blocked · ${status.reason}` });
    }
    return nights;
  } catch (error) {
    if (error instanceof InventoryError) return [];
    throw error;
  }
}
