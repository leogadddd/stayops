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
    <form action={formAction} className="space-y-6">
      <section className="rounded-xl border border-pine/15 bg-linen p-4 sm:p-5">
        <div className="mb-4"><h2 className="font-display text-xl text-pine">Unit details</h2><p className="mt-1 text-sm text-ink/55">Name the independently bookable space and set its availability.</p></div>
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
        </div>
        <div className="mt-4">
          <Label htmlFor="unit-image">Cover photo</Label>
          <Input id="unit-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          <p className="mt-1 text-xs text-ink/55">JPG, PNG, or WebP · up to 4 MB.</p>
        </div>
      </section>

      <section className="rounded-xl border border-pine/15 bg-linen p-4 sm:p-5">
        <div className="mb-4"><h2 className="font-display text-xl text-pine">Capacity & stay times</h2><p className="mt-1 text-sm text-ink/55">These fixed arrival and departure times apply to this unit.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="unit-check-in">Fixed check-in</Label>
            <Input id="unit-check-in" name="checkInTime" type="time" defaultValue="15:00" required />
          </div>
          <div>
            <Label htmlFor="unit-check-out">Fixed check-out</Label>
            <Input id="unit-check-out" name="checkOutTime" type="time" defaultValue="11:00" required />
          </div>
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-pine/15 bg-linen p-4 sm:p-5">
        <div className="mb-4"><h2 className="font-display text-xl text-pine">Base pricing & fees</h2><p className="mt-1 text-sm text-ink/55">Set the standard nightly price. Date and weekend rules can adjust it later.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="unit-rate">Nightly rate (₱)</Label>
            <Input id="unit-rate" name="nightlyRate" inputMode="decimal" placeholder="5500" />
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
      </section>

      <section className="rounded-xl border border-dashed border-pine/20 bg-sage/20 p-4 sm:p-5">
        <h2 className="font-display text-xl text-pine">Amenities, add-ons & pricing rules</h2>
        <p className="mt-1 text-sm text-ink/60">Save the unit first, then manage its amenities, per-stay add-ons, and weekday or date-specific price rules from the unit page.</p>
      </section>

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
