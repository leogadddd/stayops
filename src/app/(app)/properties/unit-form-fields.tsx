"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Clock, LogIn, LogOut, Users, Wallet } from "lucide-react";
import type { UnitStatus } from "@/lib/db/schema";
import { UNIT_STATUSES } from "@/lib/db/schema";
import { UNIT_STATUS_DESCRIPTIONS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { formatPHP, MoneyParseError, pesosToCentavos } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import type { InventoryFormState } from "./actions";
import { AmenityPicker, type AmenityOption } from "./amenity-picker";
import { FormAside, FormLayout, FormSection, PesoInput, PhotoField, useFormValues } from "./form-kit";
import { DayRatesFields, ReservationFeeFields, StayTimesFields, type ReservationFeeChoice } from "./unit-pricing-fields";
import { stayLengthHours, stayLengthLabel } from "@/lib/stay-times";
import { dayRateSummary, WEEKDAYS, type DayRates, type Weekday } from "@/lib/rates";
import { UnitStatusBadge } from "./inventory-display";
import { timeLabel, UnitPhoto } from "../calendar/availability/stay-display";

export interface UnitFormValues {
  name: string;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  /** Whole-pesos strings for the money inputs. */
  nightlyRate: string;
  cleaningFee: string;
  securityDeposit: string;
  reservationFeeType: ReservationFeeChoice;
  /** Pesos for a fixed fee, a percent for a percentage. */
  reservationFeeAmount: string;
  /** Weekday rates in pesos, only for days that differ. */
  dayRates?: Partial<Record<Weekday, string>>;
  checkInTime: string;
  checkOutTime: string;
  status: UnitStatus;
  /** A browser-ready photo src (see photoSrc), not the stored key. */
  imageUrl?: string | null;
}

function pesosLabel(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return formatPHP(pesosToCentavos(value));
  } catch (error) {
    if (error instanceof MoneyParseError) return null;
    throw error;
  }
}

/** The add-unit and edit-unit form: sections on the left, a live preview on the right. */
export function UnitForm({
  action,
  destination,
  successMessage,
  values,
  editing,
  cancelHref,
  propertyName,
  amenityOptions = [],
  selectedAmenityIds = [],
}: {
  action: (state: InventoryFormState, formData: FormData) => Promise<InventoryFormState>;
  destination: string;
  successMessage: string;
  values: UnitFormValues;
  editing: boolean;
  cancelHref: string;
  propertyName?: string;
  amenityOptions?: AmenityOption[];
  selectedAmenityIds?: string[];
}) {
  const save = useSaveAndReturn(action, destination, successMessage);
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(save, {});
  useActionFeedback(state);
  const formRef = useRef<HTMLFormElement>(null);
  const { values: live, read } = useFormValues(formRef);
  const [photo, setPhoto] = useState<string | null>(values.imageUrl ?? null);
  const onPreview = useCallback((src: string | null) => setPhoto(src), []);
  const [status, setStatus] = useState<UnitStatus>(values.status);

  const name = live.name?.trim() || values.name || "New unit";
  const capacity = live.capacity || String(values.capacity);
  const bedrooms = live.bedrooms || String(values.bedrooms);
  const bathrooms = live.bathrooms || String(values.bathrooms);
  const rate = pesosLabel(live.nightlyRate ?? values.nightlyRate);
  const cleaning = pesosLabel(live.cleaningFee ?? values.cleaningFee);
  const checkIn = live.checkInTime || values.checkInTime;
  const checkOut = live.checkOutTime || values.checkOutTime;
  const liveDayRates: DayRates = {};
  for (const { key } of WEEKDAYS) {
    const typed = live[`dayRate-${key}`];
    if (!typed?.trim()) continue;
    try {
      liveDayRates[key] = pesosToCentavos(typed);
    } catch (error) {
      if (!(error instanceof MoneyParseError)) throw error;
    }
  }
  let regularCents = 0;
  try {
    regularCents = pesosToCentavos(live.nightlyRate ?? values.nightlyRate ?? "") || 0;
  } catch (error) {
    if (!(error instanceof MoneyParseError)) throw error;
  }
  const dayRateLines = dayRateSummary(regularCents, liveDayRates, formatPHP);

  return (
    <form ref={formRef} action={formAction} onInput={read} onChange={read} onClick={read}>
      <FormLayout
        aside={
          <FormAside
            preview={
              <>
                <UnitPhoto src={photo} className="aspect-[16/10]" />
                <div className="p-5">
                  <UnitStatusBadge status={status} />
                  <p className="mt-3 truncate font-display text-2xl text-pine">{name}</p>
                  {propertyName ? <p className="mt-0.5 truncate text-sm text-ink/55">{propertyName}</p> : null}
                  <dl className="mt-4 space-y-2 text-sm">
                    <PreviewRow icon={Users} label="Sleeps" value={`${capacity} · ${bedrooms} bed · ${bathrooms} bath`} />
                    <PreviewRow
                      icon={Wallet}
                      label="Per night"
                      value={rate ?? "Not set"}
                      detail={[...dayRateLines, cleaning ? `+ ${cleaning} cleaning` : ""].filter(Boolean).join(" · ") || undefined}
                    />
                    <PreviewRow icon={LogIn} label="Check-in from" value={timeLabel(checkIn)} />
                    <PreviewRow icon={LogOut} label="Check-out by" value={timeLabel(checkOut)} detail="Next day" />
                    <PreviewRow icon={Clock} label="Stay" value={stayLengthLabel(stayLengthHours(checkIn, checkOut))} />
                  </dl>
                </div>
              </>
            }
            error={state.error}
            pending={pending}
            submitLabel={editing ? "Save changes" : "Add unit"}
            pendingLabel={editing ? "Saving…" : "Adding…"}
            cancelHref={cancelHref}
          />
        }
      >
        <FormSection title="The basics" description="A room, studio or villa that guests book on its own.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit-name">Unit name</Label>
              <Input id="unit-name" name="name" defaultValue={values.name} required minLength={2} maxLength={80} placeholder="e.g. Unit 12B" />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Cover photo</p>
              <PhotoField currentSrc={values.imageUrl ?? null} onPreview={onPreview} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Status" description={editing ? "Changing the status never cancels existing bookings." : "Only active units take new holds and reservations."}>
          <fieldset>
            <legend className="sr-only">Unit status</legend>
            <div className="flex flex-wrap gap-2">
              {UNIT_STATUSES.map((value) => (
                <label
                  key={value}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clay",
                    status === value ? "border-primary bg-primary text-white" : "border-pine/15 bg-surface text-pine hover:border-pine/35",
                  )}
                >
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                    className="sr-only"
                  />
                  {UNIT_STATUS_LABELS[value]}
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink/60">{UNIT_STATUS_DESCRIPTIONS[status]}</p>
          </fieldset>
        </FormSection>

        <FormSection title="Space" description="How many people it sleeps and its rooms.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="unit-capacity">Guests</Label>
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
          </div>
        </FormSection>

        <FormSection title="Pricing" description="Defaults for new reservations. Each booking's charges can still be adjusted.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="unit-rate">Nightly rate</Label>
              <PesoInput id="unit-rate" name="nightlyRate" defaultValue={values.nightlyRate} placeholder="5,500" />
            </div>
            <div>
              <Label htmlFor="unit-cleaning">
                Cleaning fee <span className="font-normal text-ink/45">(optional)</span>
              </Label>
              <PesoInput id="unit-cleaning" name="cleaningFee" defaultValue={values.cleaningFee} placeholder="500" />
            </div>
            <div>
              <Label htmlFor="unit-deposit">
                Deposit <span className="font-normal text-ink/45">(refundable)</span>
              </Label>
              <PesoInput id="unit-deposit" name="securityDeposit" defaultValue={values.securityDeposit} placeholder="2,000" />
            </div>
          </div>
          <div className="mt-4">
            <DayRatesFields defaults={values.dayRates ?? {}} regularRate={live.nightlyRate ?? values.nightlyRate} />
          </div>
          <div className="mt-4">
            <ReservationFeeFields defaultType={values.reservationFeeType} defaultAmount={values.reservationFeeAmount} />
          </div>
        </FormSection>

        <FormSection title="Stay times" description="Set the check-in time and how long a stay lasts; check-out fills itself in. Turnover cleaning starts at check-out.">
          <StayTimesFields defaultCheckIn={values.checkInTime} defaultCheckOut={values.checkOutTime} />
        </FormSection>

        <FormSection title="Amenities" description="What guests get inside the unit, like towels, toiletries and kitchen tools.">
          <AmenityPicker scope="unit" options={amenityOptions} defaultSelected={selectedAmenityIds} />
        </FormSection>
      </FormLayout>
    </form>
  );
}

function PreviewRow({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-2 text-ink/55">
        <Icon className="h-4 w-4 text-pine/40" aria-hidden />
        {label}
      </dt>
      <dd className="text-right">
        <span className="font-medium text-pine">{value}</span>
        {detail ? <span className="block text-xs text-ink/50">{detail}</span> : null}
      </dd>
    </div>
  );
}
