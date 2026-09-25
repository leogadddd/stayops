"use server";

import { z } from "zod";
import { requireMembership } from "@/lib/auth/session";
import {
  checkIntervalAvailability,
  findTurnoverArrivalConflict,
  getOccupancySegments,
} from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listNights, localDateTimeToUtc } from "@/lib/dates";
import { unexpectedErrorMessage } from "@/lib/errors";

export interface AvailabilityFormState {
  error?: string;
  result?: {
    checkIn: string;
    checkOut: string;
    guestCount: number;
    nights: number;
    availableUnits: { id: string; name: string; capacity: number; imageUrl: string | null; calendarHref: string; bookHref: string }[];
  };
}

export async function checkAvailabilityAction(
  _prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const membership = await requireMembership();

  const parsed = z
    .object({
      guestCount: z.coerce.number().int().min(1).max(50),
      checkIn: z.string(),
      checkOut: z.string(),
    })
    .safeParse({
      guestCount: formData.get("guestCount"),
      checkIn: String(formData.get("checkIn") ?? ""),
      checkOut: String(formData.get("checkOut") ?? ""),
    });
  if (!parsed.success) {
    return { error: "Enter a guest count and both dates." };
  }

  const { checkIn, checkOut, guestCount } = parsed.data;
  if (checkOut <= checkIn) {
    return { error: "Check-out must be after check-in." };
  }

  let availableUnits: NonNullable<AvailabilityFormState["result"]>["availableUnits"];
  try {
    const [units, properties] = await Promise.all([listOrgUnits(membership.organizationId), listProperties(membership.organizationId)]);
    const candidates = units.filter((unit) => unit.status === "active" && unit.capacity >= guestCount);
    const propertyById = new Map(properties.map((property) => [property.id, property]));
    const segmentsByUnit = await getOccupancySegments(membership.organizationId, candidates.map((unit) => unit.id), checkIn, checkOut);
    availableUnits = candidates.flatMap((unit) => {
      const segments = segmentsByUnit.get(unit.id) ?? [];
      const check = checkIntervalAvailability(segments, checkIn, checkOut);
      const property = propertyById.get(unit.propertyId);
      const arrivalAt = property ? localDateTimeToUtc(`${checkIn}T${unit.checkInTime}`, property.timezone) : null;
      if (!check.available || (arrivalAt && findTurnoverArrivalConflict(segments, arrivalAt))) return [];
      const query = new URLSearchParams({ unit: unit.id, checkIn, checkOut });
      return [{ id: unit.id, name: properties.length > 1 && property ? `${property.name} · ${unit.name}` : unit.name, capacity: unit.capacity, imageUrl: unit.imageUrl, calendarHref: `/calendar?${new URLSearchParams({ unit: unit.id, month: checkIn.slice(0, 7) })}`, bookHref: `/reservations/new?${query}` }];
    });
  } catch (error) {
    return { error: unexpectedErrorMessage(error, "availability") };
  }
  return {
    result: {
      checkIn,
      checkOut,
      guestCount,
      nights: listNights(checkIn, checkOut).length,
      availableUnits,
    },
  };
}
