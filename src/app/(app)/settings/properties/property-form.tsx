"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import {
  createPropertyAction,
  updatePropertyAction,
  type InventoryFormState,
} from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { AmenityPicker, type AmenityOption } from "./amenity-picker";

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
  amenityOptions = [],
  selectedAmenityIds = [],
}: {
  /** Present → edit mode; absent → create mode. */
  propertyId?: string;
  initialValues?: PropertyFormValues;
  amenityOptions?: AmenityOption[];
  selectedAmenityIds?: string[];
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

  const cancelHref = propertyId ? `/settings/properties/${propertyId}` : "/settings/properties";

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Property details</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="name">Property name</Label>
            <Input id="name" name="name" defaultValue={values.name} required minLength={2} maxLength={120} placeholder="Riverside Condo, Tower A" />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={values.address} maxLength={300} placeholder="Street, barangay, city" />
            <p className="mt-1 text-xs text-ink/50">Private. Never shown to guests.</p>
          </div>
          <div>
            <Label htmlFor="property-image">Cover photo</Label>
            <Input id="property-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="mt-1 text-xs text-ink/50">JPG, PNG, or WebP · up to 4 MB.{values.imageUrl ? " Leave blank to keep the current photo." : ""}</p>
            {values.imageUrl ? <img src={values.imageUrl} alt="Current property cover" className="mt-3 h-32 w-48 rounded-lg object-cover" /> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Property amenities</h2>
          <p className="text-sm text-ink/60">Shared facilities of the building or compound, like a pool, parking, or gym.</p>
        </CardHeader>
        <CardBody>
          <AmenityPicker scope="property" options={amenityOptions} defaultSelected={selectedAmenityIds} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Stay defaults</h2>
          <p className="text-sm text-ink/60">Dates and times use this timezone. New units start with these arrival and departure times.</p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue={values.timezone} list="timezone-options" required />
            <datalist id="timezone-options">
              {COMMON_TIMEZONES.map((zone) => <option key={zone} value={zone} />)}
            </datalist>
          </div>
          <div>
            <Label htmlFor="checkInTime">Default check-in</Label>
            <Input id="checkInTime" name="checkInTime" type="time" defaultValue={values.checkInTime} required />
          </div>
          <div>
            <Label htmlFor="checkOutTime">Default check-out</Label>
            <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={values.checkOutTime} required />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Turnover</h2>
          <p className="text-sm text-ink/60">Time reserved for cleaning after each check-out.</p>
        </CardHeader>
        <CardBody className="grid max-w-sm grid-cols-2 gap-4">
          <div><Label htmlFor="turnoverHours">Hours</Label><Input id="turnoverHours" name="turnoverHours" type="number" min="0" max="24" defaultValue={Math.floor(values.turnoverDurationMinutes / 60)} required /></div>
          <div><Label htmlFor="turnoverMinutes">Minutes</Label><Input id="turnoverMinutes" name="turnoverMinutes" type="number" min="0" max="59" defaultValue={values.turnoverDurationMinutes % 60} required /></div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 id="house-rules-title" className="font-display text-lg text-pine">House rules</h2>
          <p className="text-sm text-ink/60">Shown to guests on their booking link.</p>
        </CardHeader>
        <CardBody>
          <Textarea id="houseRules" name="houseRules" aria-labelledby="house-rules-title" defaultValue={values.houseRules} maxLength={2000} placeholder="No smoking inside. Quiet hours after 10pm…" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-display text-lg text-pine">{propertyId ? "Save changes" : "Save property"}</h2></CardHeader>
        <CardBody className="space-y-4">
          <FieldError message={state.error} />
          <div className="flex flex-wrap gap-3">
            <Link href={cancelHref} className={buttonClassName("outline", "md")}>Cancel</Link>
            <Button type="submit" variant="clay" disabled={pending}>
              {pending ? "Saving…" : propertyId ? "Save changes" : "Add property"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
