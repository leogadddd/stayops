"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import {
  createPropertyAction,
  updatePropertyAction,
  type InventoryFormState,
} from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const COMMON_TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Dubai",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export interface PropertyFormValues {
  name: string;
  address: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  turnoverDurationMinutes: number;
  houseRules: string;
  imageUrl?: string | null;
}

const EMPTY: PropertyFormValues = {
  name: "",
  address: "",
  timezone: "Asia/Manila",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  turnoverDurationMinutes: 120,
  houseRules: "",
};

export function PropertyForm({
  propertyId,
  initialValues,
}: {
  /** Present → edit mode; absent → create mode. */
  propertyId?: string;
  initialValues?: PropertyFormValues;
}) {
  const action = propertyId
    ? updatePropertyAction.bind(null, propertyId)
    : createPropertyAction;
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(
    action,
    {},
  );
  useActionFeedback(state, {
    success: propertyId ? "Property updated." : "Property created.",
  });
  const values = initialValues ?? EMPTY;
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push(propertyId ? `/settings/properties/${propertyId}` : "/settings/properties");
      router.refresh();
    }
  }, [state.success, propertyId, router]);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-4">
      <div>
        <Label htmlFor="name">Property name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={values.name}
          required
          minLength={2}
          maxLength={120}
          placeholder="Riverside Condo, Tower A"
        />
      </div>

      <div>
        <Label htmlFor="address">Address (private, never shown to guests)</Label>
        <Textarea
          id="address"
          name="address"
          defaultValue={values.address}
          maxLength={300}
          placeholder="Street, barangay, city"
        />
      </div>

      <div>
        <Label htmlFor="property-image">Cover photo</Label>
        <Input id="property-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="mt-1 text-xs text-ink/55">JPG, PNG, or WebP · up to 5 MB. Leave blank to keep the current photo.</p>
        {values.imageUrl ? <img src={values.imageUrl} alt="Current property cover" className="mt-3 h-32 w-48 rounded-lg object-cover" /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue={values.timezone}
            list="timezone-options"
            required
          />
          <datalist id="timezone-options">
            {COMMON_TIMEZONES.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="checkInTime">Default arrival time (all units)</Label>
          <Input
            id="checkInTime"
            name="checkInTime"
            type="time"
            defaultValue={values.checkInTime}
            required
          />
        </div>
        <div>
          <Label htmlFor="checkOutTime">Default departure time (all units)</Label>
          <Input
            id="checkOutTime"
            name="checkOutTime"
            type="time"
            defaultValue={values.checkOutTime}
            required
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Default turnover duration</legend>
        <p className="mt-1 text-xs text-ink/60">Time reserved for cleaning after each checkout. Units may support overrides later.</p>
        <div className="mt-2 grid max-w-sm grid-cols-2 gap-3">
          <div><Label htmlFor="turnoverHours">Hours</Label><Input id="turnoverHours" name="turnoverHours" type="number" min="0" max="24" defaultValue={Math.floor(values.turnoverDurationMinutes / 60)} required /></div>
          <div><Label htmlFor="turnoverMinutes">Minutes</Label><Input id="turnoverMinutes" name="turnoverMinutes" type="number" min="0" max="59" defaultValue={values.turnoverDurationMinutes % 60} required /></div>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="houseRules">House rules (shown to guests)</Label>
        <Textarea
          id="houseRules"
          name="houseRules"
          defaultValue={values.houseRules}
          maxLength={2000}
          placeholder="No smoking inside. Quiet hours after 10pm…"
        />
      </div>

      <FieldError message={state.error} />
      {state.success ? (
        <p className="text-sm text-pine" role="status">
          Saved.
        </p>
      ) : null}

      <Button type="submit" variant={propertyId ? "primary" : "clay"} disabled={pending}>
        {pending ? "Saving…" : propertyId ? "Save property" : "Add property"}
      </Button>
    </form>
  );
}
