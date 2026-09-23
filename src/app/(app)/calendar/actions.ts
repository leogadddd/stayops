"use server";

import { z } from "zod";
import { requireMembership } from "@/lib/auth/session";
import { InventoryError } from "@/server/inventory/validation";
import {
  checkIntervalAvailability,
  getOccupancySegments,
} from "@/server/inventory/availability";
import { getUnitOrThrow } from "@/server/inventory/service";

export interface AvailabilityFormState {
  error?: string;
  result?: {
    unitName: string;
    checkIn: string;
    checkOut: string;
    available: boolean;
    nights?: number;
    conflictReason?: string;
    conflictRange?: string;
  };
}

export async function checkAvailabilityAction(
  _prev: AvailabilityFormState,
  formData: FormData,
): Promise<AvailabilityFormState> {
  const membership = await requireMembership();

  const parsed = z
    .object({
      unitId: z.string().uuid("Choose a unit."),
      checkIn: z.string(),
      checkOut: z.string(),
    })
    .safeParse({
      unitId: String(formData.get("unitId") ?? ""),
      checkIn: String(formData.get("checkIn") ?? ""),
      checkOut: String(formData.get("checkOut") ?? ""),
    });
  if (!parsed.success) {
    return { error: "Choose a unit and both dates." };
  }

  let unit;
  try {
    unit = await getUnitOrThrow(membership.organizationId, parsed.data.unitId);
  } catch (error) {
    if (error instanceof InventoryError) {
      return { error: "Choose a unit." };
    }
    throw error;
  }

  const { checkIn, checkOut } = parsed.data;
  if (checkOut <= checkIn) {
    return { error: "Check-out must be after check-in." };
  }

  const segments = (
    await getOccupancySegments(
      membership.organizationId,
      [unit.id],
      checkIn,
      checkOut,
    )
  ).get(unit.id) ?? [];

  const check = checkIntervalAvailability(segments, checkIn, checkOut);
  if (!check.available) {
    return {
      result: {
        unitName: unit.name,
        checkIn,
        checkOut,
        available: false,
        conflictReason: check.conflict.reason,
        conflictRange: `${check.conflict.startDate} → ${check.conflict.endDate}`,
      },
    };
  }
  return {
    result: {
      unitName: unit.name,
      checkIn,
      checkOut,
      available: true,
      nights: check.nights.length,
    },
  };
}
