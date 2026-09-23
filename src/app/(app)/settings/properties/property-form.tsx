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
  houseRules: string;
}

const EMPTY: PropertyFormValues = {
  name: "",
  address: "",
  timezone: "Asia/Manila",
  checkInTime: "15:00",
  checkOutTime: "11:00",
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
  const values = initialValues ?? EMPTY;
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push(propertyId ? `/settings/properties/${propertyId}` : "/settings/properties");
      router.refresh();
    }
  }, [state.success, propertyId, router]);

  return (
    <form action={formAction} className="space-y-4">
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
          <Label htmlFor="checkInTime">Check-in time</Label>
          <Input
            id="checkInTime"
            name="checkInTime"
            type="time"
            defaultValue={values.checkInTime}
            required
          />
        </div>
        <div>
          <Label htmlFor="checkOutTime">Check-out time</Label>
          <Input
            id="checkOutTime"
            name="checkOutTime"
            type="time"
            defaultValue={values.checkOutTime}
            required
          />
        </div>
      </div>

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
