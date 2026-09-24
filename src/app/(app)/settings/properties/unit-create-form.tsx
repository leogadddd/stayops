"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UNIT_STATUSES } from "@/lib/db/schema";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { createUnitAction, type InventoryFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function UnitCreateForm({ propertyId }: { propertyId: string }) {
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(
    createUnitAction.bind(null, propertyId),
    {},
  );
  useActionFeedback(state, { success: "Unit created." });
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push(`/settings/properties/${propertyId}`);
      router.refresh();
    }
  }, [state.success, propertyId, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="unit-name">Unit name</Label>
          <Input
            id="unit-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Unit 12B"
          />
        </div>
        <div>
          <Label htmlFor="unit-status">Status</Label>
          <Select id="unit-status" name="status" defaultValue="renovating">
            {UNIT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {UNIT_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="unit-capacity">Guests (capacity)</Label>
          <Input
            id="unit-capacity"
            name="capacity"
            type="number"
            min={1}
            max={50}
            defaultValue={2}
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
              defaultValue={0}
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
              defaultValue={1}
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
            placeholder="5500"
          />
        </div>
        <div>
          <Label htmlFor="unit-cleaning">Cleaning fee (₱, optional)</Label>
          <Input
            id="unit-cleaning"
            name="cleaningFee"
            inputMode="decimal"
            placeholder="500"
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
            placeholder="2000"
          />
        </div>
      </div>

      <FieldError message={state.error} />
      {state.success ? (
        <p className="text-sm text-pine" role="status">
          Unit added.
        </p>
      ) : null}

      <Button type="submit" variant="clay" disabled={pending}>
        {pending ? "Adding…" : "Add unit"}
      </Button>
    </form>
  );
}
