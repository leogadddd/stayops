"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUnitAction, type InventoryFormState } from "../../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { UnitFormFields, type UnitFormValues } from "../../unit-form-fields";
import type { AmenityOption } from "../../amenity-picker";

export type { UnitFormValues };

export function UnitEditForm({
  propertyId,
  unitId,
  values,
  amenityOptions,
  selectedAmenityIds,
}: {
  propertyId: string;
  unitId: string;
  values: UnitFormValues;
  amenityOptions?: AmenityOption[];
  selectedAmenityIds?: string[];
}) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(
    updateUnitAction.bind(null, propertyId, unitId),
    {},
  );
  useActionFeedback(state, { success: "Unit updated." });
  const router = useRouter();
  const unitHref = `/properties/${propertyId}/units/${unitId}`;
  useEffect(() => {
    if (state.success) {
      router.push(unitHref);
      router.refresh();
    }
  }, [state.success, unitHref, router]);

  return (
    <form action={formAction} className="space-y-6">
      <UnitFormFields
        values={values}
        error={state.error}
        pending={pending}
        cancelHref={unitHref}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        editing
        amenityOptions={amenityOptions}
        selectedAmenityIds={selectedAmenityIds}
      />
    </form>
  );
}
