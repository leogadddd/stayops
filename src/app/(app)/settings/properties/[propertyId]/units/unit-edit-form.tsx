"use client";

import { useActionState } from "react";
import type { UnitStatus } from "@/lib/db/schema";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { updateUnitAction, type InventoryFormState } from "../../actions";

export interface UnitFormValues {
  name: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  /** Whole-pesos strings for the money inputs. */
  nightlyRate: string;
  cleaningFee: string;
  securityDeposit: string;
  status: UnitStatus;
}

export function UnitEditForm({
  propertyId,
  unitId,
  values,
}: {
  propertyId: string;
  unitId: string;
  values: UnitFormValues;
}) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(
    updateUnitAction.bind(null, propertyId, unitId),
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="unit-name">Unit name</Label>
          <Input
            id="unit-name"
            name="name"
            defaultValue={values.name}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="unit-status">Status</Label>
          <Select
            id="unit-status"
            name="status"
            defaultValue={values.status}
          >
            {(Object.keys(UNIT_STATUS_LABELS) as UnitStatus[]).map(
              (status) => (
                <option key={status} value={status}>
                  {UNIT_STATUS_LABELS[status]}
                </option>
              ),
            )}
          </Select>
          <p className="mt-1.5 text-xs text-ink/50">
            Only Active units accept new holds and reservations. Changing the
            status never cancels existing bookings.
          </p>
        </div>
        <div>
          <Label htmlFor="unit-capacity">Guests (capacity)</Label>
          <Input
            id="unit-capacity"
            name="capacity"
            type="number"
            min={1}
            max={50}
            defaultValue={values.capacity}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit-bedrooms">Bedrooms</Label>
            <Input
              id="unit-bedrooms"
              name="bedrooms"
              type="number"
              min={0}
              max={20}
              defaultValue={values.bedrooms}
              required
            />
          </div>
          <div>
            <Label htmlFor="unit-bathrooms">Bathrooms</Label>
            <Input
              id="unit-bathrooms"
              name="bathrooms"
              type="number"
              min={0.5}
              max={20}
              step={0.5}
              defaultValue={values.bathrooms}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="unit-rate">Nightly rate (₱)</Label>
          <Input
            id="unit-rate"
            name="nightlyRate"
            inputMode="decimal"
            defaultValue={values.nightlyRate}
            placeholder="5500"
          />
        </div>
        <div>
          <Label htmlFor="unit-cleaning">Cleaning fee (₱, optional)</Label>
          <Input
            id="unit-cleaning"
            name="cleaningFee"
            inputMode="decimal"
            defaultValue={values.cleaningFee}
          />
        </div>
        <div>
          <Label htmlFor="unit-deposit">
            Refundable security deposit (₱, optional)
          </Label>
          <Input
            id="unit-deposit"
            name="securityDeposit"
            inputMode="decimal"
            defaultValue={values.securityDeposit}
          />
        </div>
      </div>

      <FieldError message={state.error} />
      {state.success ? (
        <p className="text-sm text-pine" role="status">
          Saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save unit"}
      </Button>
    </form>
  );
}
