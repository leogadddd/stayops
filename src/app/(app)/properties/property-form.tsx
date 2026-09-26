"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Building2, Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import {
  createPropertyAction,
  updatePropertyAction,
  type InventoryFormState,
} from "./actions";
import { AmenityPicker, type AmenityOption } from "./amenity-picker";
import { FormAside, FormLayout, FormSection, PhotoField, useFormValues } from "./form-kit";
import { timeLabel, UnitPhoto } from "../calendar/availability/stay-display";

export interface PropertyFormValues {
  name: string;
  address: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  turnoverDurationMinutes: number;
  houseRules: string;
  /** A browser-ready photo src (see photoSrc), not the stored key. */
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

function durationLabel(hours: string, minutes: string) {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  if (!h && !m) return "None";
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export function PropertyForm({
  propertyId,
  initialValues,
  defaultTimezone,
  amenityOptions = [],
  selectedAmenityIds = [],
}: {
  /** Present → edit mode; absent → create mode. */
  propertyId?: string;
  initialValues?: PropertyFormValues;
  defaultTimezone?: string;
  amenityOptions?: AmenityOption[];
  selectedAmenityIds?: string[];
}) {
  const editing = Boolean(propertyId);
  const save = useSaveAndReturn(
    propertyId ? updatePropertyAction.bind(null, propertyId) : createPropertyAction,
    (result) => (propertyId ? `/properties/${propertyId}` : result.id ? `/properties/${result.id}` : "/properties"),
    editing ? "Property updated." : "Property created.",
  );
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(save, {});
  useActionFeedback(state);
  const values = initialValues ?? { ...EMPTY, timezone: defaultTimezone ?? EMPTY.timezone };
  const formRef = useRef<HTMLFormElement>(null);
  const { values: live, read } = useFormValues(formRef);
  const [photo, setPhoto] = useState<string | null>(values.imageUrl ?? null);
  const onPreview = useCallback((src: string | null) => setPhoto(src), []);
  const cancelHref = propertyId ? `/properties/${propertyId}` : "/properties";

  const name = live.name?.trim() || values.name || "Your property";
  const address = live.address?.trim();

  return (
    <form ref={formRef} action={formAction} onInput={read} onChange={read} onClick={read}>
      <FormLayout
        aside={
          <FormAside
            preview={
              <>
                <UnitPhoto src={photo} className="aspect-[16/10]" />
                <div className="p-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-mist px-2.5 py-0.5 text-xs font-medium text-pine">
                    <Building2 className="h-3.5 w-3.5" aria-hidden />
                    Property
                  </span>
                  <p className="mt-3 truncate font-display text-2xl text-pine">{name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/55">
                    <MapPin className="h-4 w-4 shrink-0 text-pine/40" aria-hidden />
                    <span className="truncate">{address || "No address yet"}</span>
                  </p>
                  <dl className="mt-4 space-y-2 text-sm">
                    <PreviewRow icon={LogIn} label="Check-in from" value={timeLabel(live.checkInTime || values.checkInTime)} />
                    <PreviewRow icon={LogOut} label="Check-out by" value={timeLabel(live.checkOutTime || values.checkOutTime)} />
                    <PreviewRow
                      icon={Clock}
                      label="Turnover"
                      value={durationLabel(
                        live.turnoverHours ?? String(Math.floor(values.turnoverDurationMinutes / 60)),
                        live.turnoverMinutes ?? String(values.turnoverDurationMinutes % 60),
                      )}
                    />
                  </dl>
                </div>
              </>
            }
            error={state.error}
            pending={pending}
            submitLabel={editing ? "Save changes" : "Add property"}
            pendingLabel="Saving…"
            cancelHref={cancelHref}
            note={editing ? undefined : "You'll add its units next."}
          />
        }
      >
        <FormSection title="The basics" description="What your team calls this place and where it is.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Property name</Label>
              <Input id="name" name="name" defaultValue={values.name} required minLength={2} maxLength={120} placeholder="e.g. Riverside Condo, Tower A" />
            </div>
            <div>
              <Label htmlFor="address">
                Address <span className="font-normal text-ink/45">· private, never shown to guests</span>
              </Label>
              <Textarea id="address" name="address" defaultValue={values.address} maxLength={300} placeholder="Building, street, barangay, city" className="min-h-20" />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Cover photo</p>
              <PhotoField currentSrc={values.imageUrl ?? null} onPreview={onPreview} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Stay times" description="New units start with these times. Dates follow the property's timezone.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="checkInTime">Check-in from</Label>
              <Input id="checkInTime" name="checkInTime" type="time" defaultValue={values.checkInTime} required />
            </div>
            <div>
              <Label htmlFor="checkOutTime">Check-out by</Label>
              <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={values.checkOutTime} required />
            </div>
            <div>
              <Label htmlFor="turnoverHours">Turnover time</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Input id="turnoverHours" name="turnoverHours" type="number" min="0" max="24" defaultValue={Math.floor(values.turnoverDurationMinutes / 60)} required className="pr-9" aria-label="Turnover hours" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/45">h</span>
                </div>
                <div className="relative">
                  <Input id="turnoverMinutes" name="turnoverMinutes" type="number" min="0" max="59" step="5" defaultValue={values.turnoverDurationMinutes % 60} required className="pr-11" aria-label="Turnover minutes" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/45">min</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-ink/50">Kept free for cleaning after each check-out.</p>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <TimezonePicker id="timezone" name="timezone" defaultValue={values.timezone} onValueChange={() => read()} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Amenities" description="Shared facilities of the building or compound, like a pool, parking or gym.">
          <AmenityPicker scope="property" options={amenityOptions} defaultSelected={selectedAmenityIds} />
        </FormSection>

        <FormSection title="House rules" description="Shown to guests on their booking link.">
          <Textarea id="houseRules" name="houseRules" aria-label="House rules" defaultValue={values.houseRules} maxLength={2000} placeholder="No smoking inside. Quiet hours after 10 PM…" className="min-h-28" />
        </FormSection>
      </FormLayout>
    </form>
  );
}

function PreviewRow({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink/55">
        <Icon className="h-4 w-4 text-pine/40" aria-hidden />
        {label}
      </dt>
      <dd className="font-medium text-pine">{value}</dd>
    </div>
  );
}
