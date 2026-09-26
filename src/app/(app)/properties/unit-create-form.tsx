"use client";

import { createUnitAction } from "./actions";
import { UnitForm } from "./unit-form-fields";
import type { AmenityOption } from "./amenity-picker";

export function UnitCreateForm({ propertyId, propertyName, defaults, amenityOptions }: {
  propertyId: string;
  propertyName?: string;
  amenityOptions?: AmenityOption[];
  /** New units start from the property's default arrival and departure. */
  defaults?: { checkInTime: string; checkOutTime: string };
}) {
  const propertyHref = `/properties/${propertyId}`;
  return (
    <UnitForm
      action={createUnitAction.bind(null, propertyId)}
      destination={propertyHref}
      successMessage="Unit created."
      cancelHref={propertyHref}
      propertyName={propertyName}
      editing={false}
      amenityOptions={amenityOptions}
      values={{
        name: "", capacity: 2, bedrooms: 1, bathrooms: 1, nightlyRate: "", cleaningFee: "", securityDeposit: "",
        checkInTime: defaults?.checkInTime ?? "15:00", checkOutTime: defaults?.checkOutTime ?? "11:00",
        // New units are bookable straight away; the other statuses are one click away.
        status: "active",
      }}
    />
  );
}
