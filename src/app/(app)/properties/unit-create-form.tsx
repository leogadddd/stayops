"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUnitAction, type InventoryFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { UnitFormFields } from "./unit-form-fields";
import type { AmenityOption } from "./amenity-picker";

export function UnitCreateForm({ propertyId, defaults, amenityOptions }: {
  propertyId: string;
  amenityOptions?: AmenityOption[];
  /** New units start from the property's default arrival and departure. */
  defaults?: { checkInTime: string; checkOutTime: string };
}) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(
    createUnitAction.bind(null, propertyId),
    {},
  );
  useActionFeedback(state, { success: "Unit created." });
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    }
  }, [state.success, propertyId, router]);

  return (
    <form action={formAction} className="space-y-6">
      <UnitFormFields
        values={{
          name: "", capacity: 2, bedrooms: 0, bathrooms: 1, nightlyRate: "", cleaningFee: "", securityDeposit: "",
          checkInTime: defaults?.checkInTime ?? "15:00", checkOutTime: defaults?.checkOutTime ?? "11:00", status: "renovating",
        }}
        error={state.error}
        pending={pending}
        cancelHref={`/properties/${propertyId}`}
        submitLabel="Add unit"
        pendingLabel="Adding…"
        editing={false}
        amenityOptions={amenityOptions}
      />
    </form>
  );
}
