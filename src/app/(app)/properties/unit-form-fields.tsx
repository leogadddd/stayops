import Link from "next/link";
import type { UnitStatus } from "@/lib/db/schema";
import { UNIT_STATUSES } from "@/lib/db/schema";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { AmenityPicker, type AmenityOption } from "./amenity-picker";

export interface UnitFormValues {
  name: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  /** Whole-pesos strings for the money inputs. */
  nightlyRate: string;
  cleaningFee: string;
  securityDeposit: string;
  checkInTime: string;
  checkOutTime: string;
  status: UnitStatus;
  imageUrl?: string | null;
}

/** The sections shared by the add-unit and edit-unit forms. */
export function UnitFormFields({ values, error, pending, cancelHref, submitLabel, pendingLabel, editing, amenityOptions = [], selectedAmenityIds = [] }: {
  values: UnitFormValues;
  amenityOptions?: AmenityOption[];
  selectedAmenityIds?: string[];
  error?: string;
  pending: boolean;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  editing: boolean;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Unit details</h2>
          <p className="text-sm text-ink/60">Name the independently bookable space.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="unit-name">Unit name</Label>
            <Input id="unit-name" name="name" defaultValue={values.name} required minLength={2} maxLength={80} placeholder="Unit 12B" />
          </div>
          <div>
            <Label htmlFor="unit-image">Cover photo</Label>
            <Input id="unit-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
            <p className="mt-1 text-xs text-ink/50">JPG, PNG, or WebP · up to 4 MB.{values.imageUrl ? " Leave blank to keep the current photo." : ""}</p>
            {values.imageUrl ? <img src={values.imageUrl} alt="Current unit cover" className="mt-3 h-32 w-48 rounded-lg object-cover" /> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Availability</h2>
        </CardHeader>
        <CardBody>
          <div className="max-w-xs">
            <Label htmlFor="unit-status">Status</Label>
            <Select id="unit-status" name="status" defaultValue={values.status}>
              {UNIT_STATUSES.map((status) => <option key={status} value={status}>{UNIT_STATUS_LABELS[status]}</option>)}
            </Select>
          </div>
          <p className="mt-1.5 text-xs text-ink/50">
            Only Active units accept new holds and reservations.{editing ? " Changing the status never cancels existing bookings." : ""}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Capacity &amp; rooms</h2>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="unit-capacity">Guests (capacity)</Label>
            <Input id="unit-capacity" name="capacity" type="number" min={1} max={50} defaultValue={values.capacity} required />
          </div>
          <div>
            <Label htmlFor="unit-bedrooms">Bedrooms</Label>
            <Input id="unit-bedrooms" name="bedrooms" type="number" min={0} max={20} defaultValue={values.bedrooms} required />
          </div>
          <div>
            <Label htmlFor="unit-bathrooms">Bathrooms</Label>
            <Input id="unit-bathrooms" name="bathrooms" type="number" min={0.5} max={20} step={0.5} defaultValue={values.bathrooms} required />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Stay times</h2>
          <p className="text-sm text-ink/60">Fixed arrival and departure times for this unit. Turnover cleaning starts at check-out.</p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="unit-check-in">Check-in</Label>
            <Input id="unit-check-in" name="checkInTime" type="time" defaultValue={values.checkInTime} required />
          </div>
          <div>
            <Label htmlFor="unit-check-out">Check-out</Label>
            <Input id="unit-check-out" name="checkOutTime" type="time" defaultValue={values.checkOutTime} required />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Pricing &amp; fees</h2>
          <p className="text-sm text-ink/60">Defaults for new reservations. Each booking&apos;s charges can still be adjusted.</p>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="unit-rate">Nightly rate (₱)</Label>
            <Input id="unit-rate" name="nightlyRate" inputMode="decimal" defaultValue={values.nightlyRate} placeholder="5500" />
          </div>
          <div>
            <Label htmlFor="unit-cleaning">Cleaning fee (₱, optional)</Label>
            <Input id="unit-cleaning" name="cleaningFee" inputMode="decimal" defaultValue={values.cleaningFee} placeholder="500" />
          </div>
          <div>
            <Label htmlFor="unit-deposit">Security deposit (₱, optional)</Label>
            <Input id="unit-deposit" name="securityDeposit" inputMode="decimal" defaultValue={values.securityDeposit} placeholder="2000" />
            <p className="mt-1 text-xs text-ink/50">Refundable.</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-display text-lg text-pine">Unit amenities</h2>
          <p className="text-sm text-ink/60">What guests get inside the unit, like towels, toiletries, and kitchen tools.</p>
        </CardHeader>
        <CardBody>
          <AmenityPicker scope="unit" options={amenityOptions} defaultSelected={selectedAmenityIds} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="font-display text-lg text-pine">{editing ? "Save changes" : "Save unit"}</h2></CardHeader>
        <CardBody className="space-y-4">
          <FieldError message={error} />
          <div className="flex flex-wrap gap-3">
            <Link href={cancelHref} className={buttonClassName("outline", "md")}>Cancel</Link>
            <Button type="submit" variant="clay" disabled={pending}>{pending ? pendingLabel : submitLabel}</Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
