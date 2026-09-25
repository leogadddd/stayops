import type { Unit } from "@/lib/db/schema";
import type { UnitOption } from "./reservation-form";

/** A unit as the reservation form shows it. Rates are only sent to owners. */
export function toUnitOption(
  unit: Unit,
  property: { name: string; imageUrl: string | null } | undefined,
  { multipleProperties, isOwner }: { multipleProperties: boolean; isOwner: boolean },
): UnitOption {
  return {
    id: unit.id,
    label: multipleProperties && property ? `${property.name} · ${unit.name}` : unit.name,
    name: unit.name,
    propertyName: property?.name ?? null,
    imageUrl: unit.imageUrl ?? property?.imageUrl ?? null,
    capacity: unit.capacity,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    checkInTime: unit.checkInTime,
    checkOutTime: unit.checkOutTime,
    nightlyRateCents: isOwner ? unit.defaultNightlyRateCents : null,
    cleaningFeeCents: isOwner ? unit.cleaningFeeCents : null,
    securityDepositCents: isOwner ? unit.securityDepositCents : null,
  };
}
