"use client";

import { useActionState, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Banknote, Bath, BedDouble, CalendarCheck, Check, CircleAlert, CircleCheck, Clock, Landmark, LoaderCircle, Minus, Pencil, Plus, Receipt, RotateCcw, ShieldCheck, Smartphone, Sparkles, Tag, Trash2, UserPlus, UserRound, Users, X } from "lucide-react";
import type { ChargeType } from "@/lib/db/schema";
import { CHARGE_TYPES } from "@/lib/db/schema";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import {
  buildDefaultCharges,
  CHARGE_TYPE_LABELS,
  computeTotals,
  type ChargeLineValues,
} from "@/lib/charges";
import type { DayRates } from "@/lib/rates";
import { addDaysLocal, nightsBetween } from "@/lib/dates";
import {
  centavosToPesosInput,
  formatPHP,
  pesosToCentavos,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/select-menu";
import { ChoiceCards, type ChoiceCardOption } from "@/components/ui/choice-cards";
import { createReservationAction, updateReservationAction, type ReservationFormState } from "../actions";
import { checkStayAvailabilityAction, type StayAvailability } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { dayLabel, plural, timeLabel, UnitPhoto } from "../../calendar/availability/stay-display";
import { ReservationSummary } from "./reservation-summary";
import { StayRangeCalendar } from "./stay-range-calendar";
import { DateInput } from "@/components/ui/date-input";
import { TimeInput } from "@/components/ui/time-input";

export interface UnitOption {
  id: string;
  label: string;
  name: string;
  propertyName: string | null;
  imageUrl: string | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  checkInTime: string;
  checkOutTime: string;
  nightlyRateCents: number | null;
  /** Weekday rates that differ from the nightly rate; owners only. */
  dayRates: DayRates | null;
  cleaningFeeCents: number | null;
  securityDepositCents: number | null;
}

interface ChargeDraft {
  key: string;
  type: ChargeType;
  description: string;
  quantity: string;
  amountInput: string;
}

type StepId = "stay" | "guests" | "charges" | "review";
const STEP_LABELS: Record<StepId, string> = { stay: "Stay", guests: "Guests", charges: "Charges & payment", review: "Review" };

function toDraft(lines: ChargeLineValues[]): ChargeDraft[] {
  return lines.map((line) => ({
    key: crypto.randomUUID(),
    type: line.type,
    description: line.description,
    quantity: String(line.quantity),
    amountInput: centavosToPesosInput(line.unitAmountCents),
  }));
}

function parseDraft(draft: ChargeDraft): ChargeLineValues | null {
  const description = draft.description.trim();
  const quantity = Number(draft.quantity);
  if (description.length < 2) return null;
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  try {
    return {
      type: draft.type,
      description,
      quantity,
      unitAmountCents: pesosToCentavos(draft.amountInput || "0"),
    };
  } catch {
    return null;
  }
}

function parsePayment(input: string): number | null {
  if (!input.trim()) return null;
  try {
    return pesosToCentavos(input);
  } catch {
    return null;
  }
}

const HOLD_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "240", label: "4 hours" },
  { value: "1440", label: "24 hours" },
];
const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type PaymentAllocation = "booking" | "security_deposit";

const CHARGE_TYPE_OPTIONS: SelectMenuOption<ChargeType>[] = CHARGE_TYPES.map((type) => ({
  value: type,
  label: CHARGE_TYPE_LABELS[type],
  icon: { accommodation: BedDouble, cleaning: Sparkles, fee: Receipt, discount: Tag, security_deposit: ShieldCheck }[type],
  description: {
    accommodation: "Nightly rate for the stay",
    cleaning: "One-off turnover cleaning",
    fee: "Anything else: extra bed, late checkout…",
    discount: "Negative amount off the booking",
    security_deposit: "Held and returned after checkout",
  }[type],
}));

const PAYMENT_METHOD_OPTIONS: ChoiceCardOption<PaymentMethod>[] = PAYMENT_METHODS.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
  icon: { gcash: Smartphone, maya: Smartphone, bank_transfer: Landmark, cash: Banknote }[method],
}));

/** The description a charge type gets when picked; blank means "write your own". */
function autoDescription(type: ChargeType, nights: number | null) {
  switch (type) {
    case "accommodation": return nights ? `Accommodation (${plural(nights, "night")})` : "Accommodation";
    case "cleaning": return "Cleaning fee";
    case "security_deposit": return "Refundable security deposit";
    default: return "";
  }
}

/** What editing an existing reservation starts from. */
export interface ReservationEdit {
  reservationId: string;
  guestId: string;
  occupants: string[];
  charges: ChargeLineValues[];
  /** Already recorded on the ledger; editing never changes payments. */
  paid: { bookingCents: number; depositCents: number };
}

/**
 * The reservation flow, in steps: stay → guests → charges (owner) → review.
 * Used to create a reservation and, with `edit`, to change one. Every field
 * lives in state so steps can unmount; the review step submits one FormData
 * to the create or update action. The current step is in `?step=` so the
 * browser's back button walks back through the steps.
 */
export function ReservationForm({
  units,
  guests,
  defaultCheckIn,
  defaultCheckOut,
  requestedUnitId,
  defaultGuestCount = 1,
  canConfirm,
  canSetCharges,
  edit,
  today,
}: {
  /** Book straight to confirmed (needs reservations.update and payments.create). */
  canConfirm: boolean;
  /** Set charge lines and see prices (payments.create); others get the unit's standard rates. */
  canSetCharges: boolean;
  /** The first property's local date; the calendar can't book before it. */
  today: string;
  edit?: ReservationEdit;
  units: UnitOption[];
  guests: { id: string; name: string; email: string | null; phone: string | null }[];
  defaultCheckIn: string;
  defaultCheckOut: string;
  requestedUnitId?: string;
  /** From an availability search: opens one blank name row per extra guest. */
  defaultGuestCount?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [action] = useState(() => (edit ? updateReservationAction.bind(null, edit.reservationId) : createReservationAction));
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(action, {});
  const [, startTransition] = useTransition();

  // Stay
  const [unitId, setUnitId] = useState(
    requestedUnitId && units.some((unit) => unit.id === requestedUnitId)
      ? requestedUnitId
      : (units[0]?.id ?? ""),
  );
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [additional, setAdditional] = useState<string[]>(() => Array.from({ length: Math.max(0, defaultGuestCount - 1) }, (_, index) => edit?.occupants[index] ?? ""));
  // Guests: "new" creates a guest profile from the contact fields.
  const [guestId, setGuestId] = useState(edit?.guestId ?? guests[0]?.id ?? "new");
  const [newGuest, setNewGuest] = useState({ name: "", email: "", phone: "", notes: "" });
  // Editing lets the owner correct the existing guest's contact details too.
  const contactOf = (id: string) => {
    const guest = guests.find((candidate) => candidate.id === id);
    return { name: guest?.name ?? "", email: guest?.email ?? "", phone: guest?.phone ?? "" };
  };
  const [contact, setContact] = useState(() => contactOf(edit?.guestId ?? ""));
  // Charges: null = follow the unit/date defaults; any edit forks into a manual set.
  const [customCharges, setCustomCharges] = useState<ChargeDraft[] | null>(() => (edit ? toDraft(edit.charges) : null));
  const [noPayment, setNoPayment] = useState(false);
  const [payment, setPayment] = useState({ amount: "", allocation: "booking" as PaymentAllocation, method: "gcash" as PaymentMethod, reference: "", receivedAt: "" });
  // Checked: recorded as received now. Unchecked: the owner enters when.
  const [receivedNow, setReceivedNow] = useState(true);
  // Review
  const [submitMode, setSubmitMode] = useState<"hold" | "confirmed">(canConfirm ? "confirmed" : "hold");
  const [holdMinutes, setHoldMinutes] = useState("1440");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  useActionFeedback(state, {
    success: edit ? "Reservation updated." : submitMode === "hold"
      ? "Reservation hold created."
      : payment.amount.trim()
        ? "Reservation confirmed and payment recorded."
        : "Reservation confirmed.",
  });
  useEffect(() => {
    if (!state.success || !state.reservationId) return;
    if (edit) {
      router.push(`/reservations/${state.reservationId}`);
      router.refresh();
    } else {
      router.push(`/reservations/${state.reservationId}/confirmation`);
    }
  }, [state, router, edit]);

  const selectedUnit = units.find((unit) => unit.id === unitId);
  const capacity = selectedUnit?.capacity ?? 1;
  const guestCount = 1 + additional.length;
  const validRange = Boolean(checkIn && checkOut && checkOut > checkIn);
  const nights = validRange ? nightsBetween(checkIn, checkOut) : null;
  const guestMode = guestId === "new" ? "new" : "existing";
  const selectedGuest = guests.find((guest) => guest.id === guestId);
  const contactChanged = Boolean(edit && selectedGuest && (contact.name !== (selectedGuest.name ?? "") || contact.email !== (selectedGuest.email ?? "") || contact.phone !== (selectedGuest.phone ?? "")));
  function chooseGuest(id: string) {
    setGuestId(id);
    if (id !== "new") setContact(contactOf(id));
  }

  // Live availability, re-checked whenever the unit or dates change.
  const stayKey = `${unitId}:${checkIn}:${checkOut}`;
  // Editing without moving the stay: the dates are this reservation's own, so there's nothing to check.
  const unchangedStay = Boolean(edit) && unitId === requestedUnitId && checkIn === defaultCheckIn && checkOut === defaultCheckOut;
  const [availability, setAvailability] = useState<{ key: string; result: StayAvailability } | null>(null);
  useEffect(() => {
    if (!unitId || !validRange || unchangedStay) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkStayAvailabilityAction(unitId, checkIn, checkOut, edit?.reservationId)
        .then((result) => { if (!cancelled) setAvailability({ key: stayKey, result }); })
        .catch(() => { if (!cancelled) setAvailability({ key: stayKey, result: { status: "error", message: "Couldn’t check availability." } }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [unitId, checkIn, checkOut, stayKey, validRange, unchangedStay, edit?.reservationId]);
  const currentAvailability = validRange && availability?.key === stayKey ? availability.result : null;

  const defaultCharges = useMemo(() => {
    if (!selectedUnit || selectedUnit.nightlyRateCents === null || !nights) return [];
    return toDraft(buildDefaultCharges({
      nightlyRateCents: selectedUnit.nightlyRateCents,
      dayRates: selectedUnit.dayRates,
      checkIn,
      cleaningFeeCents: selectedUnit.cleaningFeeCents,
      securityDepositCents: selectedUnit.securityDepositCents,
      nights,
    }));
  }, [selectedUnit, nights, checkIn]);
  const charges = customCharges ?? defaultCharges;
  const parsed = useMemo(() => charges.map((draft) => ({ draft, line: parseDraft(draft) })), [charges]);
  const submittableLines = parsed.map((entry) => entry.line).filter((line): line is ChargeLineValues => line !== null);
  const totals = computeTotals(submittableLines);
  const paymentCents = noPayment ? null : parsePayment(payment.amount);

  // What blocks each step; the first step with a problem caps how far you can go.
  const stepIssues: Record<StepId, string | null> = {
    stay: !selectedUnit ? "Choose a unit."
      : !validRange ? "Check-out must be after check-in."
        : guestCount > capacity ? `This unit sleeps ${capacity}. Lower the guest count or choose a larger unit.`
          : currentAvailability?.status === "unavailable" ? `These dates aren’t free: ${currentAvailability.reason}.`
            : null,
    guests: guestMode === "existing" && !selectedGuest ? "Choose a guest."
      : edit && guestMode === "existing" && contact.name.trim().length < 2 ? "Enter the guest’s full name."
        : edit && guestMode === "existing" && !contact.email.trim() && !contact.phone.trim() ? "Add an email or phone number for the guest."
      : guestMode === "new" && newGuest.name.trim().length < 2 ? "Enter the guest’s full name."
        : guestMode === "new" && !newGuest.email.trim() && !newGuest.phone.trim() ? "Add an email or phone number for the guest."
          : additional.some((name) => name.trim().length < 2) ? "Enter each additional guest’s full name."
            : null,
    charges: !canSetCharges ? null
      : submittableLines.length === 0 ? "Add at least one charge with a description, quantity and amount."
        : parsed.some((entry) => entry.line === null) ? "Fix the highlighted charge lines. Amounts look like 5500 or 5,500.50."
          : !edit && payment.amount.trim() && paymentCents === null ? "Enter the payment like 3000 or 3,000.50."
            : !edit && paymentCents && !receivedNow && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(payment.receivedAt) ? "Enter the date and time the payment was received."
              : null,
    review: null,
  };
  const steps: StepId[] = canSetCharges ? ["stay", "guests", "charges", "review"] : ["stay", "guests", "review"];
  const firstBlocked = steps.findIndex((step) => stepIssues[step] !== null);
  const requested = steps.indexOf((searchParams.get("step") ?? "stay") as StepId);
  const stepIndex = Math.max(0, Math.min(requested === -1 ? 0 : requested, firstBlocked === -1 ? steps.length - 1 : firstBlocked));
  const step = steps[stepIndex]!;
  const [showIssue, setShowIssue] = useState(false);

  /** Moving forward adds a history entry (so browser back works); the Back button replaces it. */
  function goTo(target: StepId, replace = false) {
    const query = new URLSearchParams(searchParams.toString());
    if (target === "stay") query.delete("step"); else query.set("step", target);
    window.history[replace ? "replaceState" : "pushState"](null, "", `?${query}`);
    setShowIssue(false);
    setReviewError(null);
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }
  function next() {
    if (stepIssues[step]) { setShowIssue(true); return; }
    goTo(steps[stepIndex + 1]!);
  }

  function setGuestCount(count: number) {
    const clamped = Math.max(1, Math.min(50, count));
    setAdditional((current) => clamped - 1 <= current.length ? current.slice(0, clamped - 1) : [...current, ...Array.from({ length: clamped - 1 - current.length }, () => "")]);
  }
  function updateCharge(key: string, patch: Partial<ChargeDraft>) {
    setCustomCharges((current) => (current ?? defaultCharges).map((draft) => draft.key === key ? { ...draft, ...patch } : draft));
  }
  // Switching type fills in its description, unless the owner wrote their own.
  function changeChargeType(draft: ChargeDraft, type: ChargeType) {
    const untouched = !draft.description.trim() || draft.description === autoDescription(draft.type, nights);
    updateCharge(draft.key, { type, ...(untouched ? { description: autoDescription(type, nights) } : {}) });
  }

  function submitEdit() {
    const data = new FormData();
    data.set("unitId", unitId);
    data.set("checkIn", checkIn);
    data.set("checkOut", checkOut);
    data.set("guestCount", String(guestCount));
    for (const name of additional) data.append("occupantName", name.trim());
    // The update action edits the chosen profile's contact, or creates one for "new".
    const primary = guestMode === "new" ? newGuest : contact;
    data.set("guestId", guestMode === "new" ? "new" : guestId);
    data.set("guestName", primary.name.trim());
    data.set("guestEmail", primary.email.trim());
    data.set("guestPhone", primary.phone.trim());
    for (const { draft } of parsed.filter((entry) => entry.line !== null)) {
      data.append("chargeType", draft.type);
      data.append("chargeDescription", draft.description.trim());
      data.append("chargeQuantity", draft.quantity);
      data.append("chargeAmountPesos", draft.amountInput || "0");
    }
    startTransition(() => formAction(data));
  }

  function submit() {
    setReviewError(null);
    if (edit) { submitEdit(); return; }
    if (submitMode === "hold" && paymentCents) {
      setReviewError("An initial payment can be recorded only with a confirmed booking. Choose Confirm booking, or remove the payment to place a hold.");
      return;
    }
    if (submitMode === "confirmed" && totals.bookingTotalCents > 0 && !paymentCents && !noPayment) {
      setReviewError("Record the payment received, or mark “No payment received yet” in Charges & payment.");
      return;
    }
    const data = new FormData();
    data.set("mode", submitMode);
    data.set("idempotencyKey", idempotencyKey);
    data.set("unitId", unitId);
    data.set("checkIn", checkIn);
    data.set("checkOut", checkOut);
    data.set("guestCount", String(guestCount));
    for (const name of additional) data.append("occupantName", name.trim());
    data.set("guestMode", guestMode);
    if (guestMode === "existing") data.set("guestId", guestId);
    else {
      data.set("guestName", newGuest.name.trim());
      data.set("guestEmail", newGuest.email.trim());
      data.set("guestPhone", newGuest.phone.trim());
      data.set("guestNotes", newGuest.notes.trim());
    }
    data.set("chargesJson", JSON.stringify(submittableLines));
    data.set("holdMinutes", holdMinutes);
    if (noPayment) data.set("acknowledgeUnpaid", "on");
    if (paymentCents) {
      data.set("paymentAmountPesos", payment.amount.trim());
      data.set("paymentAllocation", payment.allocation);
      data.set("paymentMethod", payment.method);
      data.set("paymentReference", payment.reference.trim());
      data.set("paymentReceivedAt", receivedNow ? "" : payment.receivedAt);
    }
    startTransition(() => formAction(data));
  }

  if (units.length === 0) {
    return (
      <div className="rounded-2xl border border-pine/10 bg-white p-6 text-sm text-ink/70">
        No units are accepting bookings yet. Activate a unit first, then come back to place a hold or booking.
      </div>
    );
  }

  const guestLabel = guestMode === "existing" ? (edit ? contact.name.trim() : selectedGuest?.name) || null : newGuest.name.trim() || null;

  return (
    <div className="min-w-0 space-y-6">
      {/* The steps sit above both columns (at the form's width) so the form and the summary card start level. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Stepper steps={steps} current={stepIndex} firstBlocked={firstBlocked} onJump={goTo} />
      </div>

    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="min-w-0">
        <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
          {step === "stay" ? (
            <div className="space-y-8">
              <StepHeading title="Where and when" description="Pick the unit, the stay dates, and how many people are staying." />
              {units.length > 1 ? (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-ink">Unit</legend>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {units.map((unit) => {
                      const selected = unit.id === unitId;
                      return (
                        <label key={unit.id} className={cn("group flex min-w-0 cursor-pointer overflow-hidden rounded-xl border transition", selected ? "border-clay ring-2 ring-clay/30" : "border-pine/15 hover:border-pine/35")}>
                          <input type="radio" name="unit" value={unit.id} checked={selected} onChange={() => { setUnitId(unit.id); setCustomCharges(null); }} className="sr-only" />
                          <UnitPhoto src={unit.imageUrl} className="w-24 shrink-0" />
                          <span className="flex min-w-0 flex-1 flex-col justify-center p-3">
                            {unit.propertyName ? <span className="truncate text-[11px] font-medium uppercase tracking-wide text-clay-deep">{unit.propertyName}</span> : null}
                            <span className="truncate font-medium text-pine">{unit.name}</span>
                            <span className="mt-1 flex gap-3 text-xs text-ink/60"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{unit.capacity}</span><span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" aria-hidden />{unit.bedrooms || "Studio"}</span><span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" aria-hidden />{unit.bathrooms}</span></span>
                          </span>
                          {selected ? <span className="m-3 flex h-5 w-5 shrink-0 items-center justify-center self-start rounded-full bg-clay text-white"><Check className="h-3 w-3" aria-hidden /></span> : null}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}

              {selectedUnit ? (
                <StayRangeCalendar
                  // A new unit has different bookings; start its calendar fresh.
                  key={selectedUnit.id}
                  unitId={selectedUnit.id}
                  excludeReservationId={edit?.reservationId}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  today={today}
                  onChange={(nextCheckIn, nextCheckOut) => { setCheckIn(nextCheckIn); setCheckOut(nextCheckOut); }}
                />
              ) : null}

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,13rem)]">
                <div className="min-w-0">
                  <Label htmlFor="checkIn">Check-in</Label>
                  <DateInput id="checkIn" value={checkIn} today={today} size="lg" onChange={(next) => { setCheckIn(next); if (next && checkOut <= next) setCheckOut(addDaysLocal(next, 1)); }} />
                  {selectedUnit ? <p className="mt-1 text-xs text-ink/50">From {timeLabel(selectedUnit.checkInTime)}</p> : null}
                </div>
                <div className="min-w-0">
                  <Label htmlFor="checkOut">Check-out</Label>
                  <DateInput id="checkOut" value={checkOut} today={today} size="lg" min={checkIn ? addDaysLocal(checkIn, 1) : undefined} onChange={setCheckOut} />
                  {selectedUnit ? <p className="mt-1 text-xs text-ink/50">By {timeLabel(selectedUnit.checkOutTime)} · the check-out day is free for the next guest</p> : null}
                </div>
                <div className="min-w-0">
                  <Label htmlFor="guest-count">Guests</Label>
                  <div className="flex h-12 items-center rounded-xl border border-pine/20 bg-white">
                    <button type="button" aria-label="Fewer guests" onClick={() => setGuestCount(guestCount - 1)} disabled={guestCount <= 1} className="flex h-full w-11 items-center justify-center rounded-l-xl text-pine hover:bg-pine-mist/60 disabled:opacity-35"><Minus className="h-4 w-4" aria-hidden /></button>
                    <span id="guest-count" className="flex flex-1 items-center justify-center gap-1.5 text-sm font-medium text-ink"><Users className="h-4 w-4 text-pine/50" aria-hidden />{guestCount}</span>
                    <button type="button" aria-label="More guests" onClick={() => setGuestCount(guestCount + 1)} disabled={guestCount >= capacity} className="flex h-full w-11 items-center justify-center rounded-r-xl text-pine hover:bg-pine-mist/60 disabled:opacity-35"><Plus className="h-4 w-4" aria-hidden /></button>
                  </div>
                  <p className="mt-1 text-xs text-ink/50">This unit sleeps {capacity}.</p>
                </div>
              </div>

              <AvailabilityBanner valid={validRange} unitChosen={Boolean(selectedUnit)} result={currentAvailability} nights={nights} checkIn={checkIn} checkOut={checkOut} current={unchangedStay} changed={Boolean(edit)} />
            </div>
          ) : null}

          {step === "guests" ? (
            <div className="space-y-8">
              <StepHeading title="Who’s staying" description="The primary guest is who the reservation is for. Add names for everyone else staying." />
              <div>
                <div className="inline-flex rounded-xl bg-linen p-1" role="radiogroup" aria-label="Primary guest">
                  <SegmentButton active={guestMode === "existing"} disabled={!guests.length} onClick={() => chooseGuest(edit?.guestId ?? guests[0]?.id ?? "new")}><UserRound className="h-4 w-4" aria-hidden />Existing guest</SegmentButton>
                  <SegmentButton active={guestMode === "new"} onClick={() => setGuestId("new")}><UserPlus className="h-4 w-4" aria-hidden />New guest</SegmentButton>
                </div>
                {guestMode === "existing" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div>
                      <Label htmlFor="guestId">Guest profile</Label>
                      <Select id="guestId" value={guestId} onChange={(event) => chooseGuest(event.target.value)}>
                        {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
                      </Select>
                    </div>
                    {edit ? (
                      <div className="grid gap-4 sm:grid-cols-2 md:col-span-2 xl:grid-cols-3">
                        <div><Label htmlFor="contactName">Full name</Label><Input id="contactName" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} maxLength={120} /></div>
                        <div><Label htmlFor="contactEmail">Email</Label><Input id="contactEmail" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} maxLength={200} placeholder="guest@example.com" /></div>
                        <div><Label htmlFor="contactPhone">Phone</Label><Input id="contactPhone" type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} maxLength={40} placeholder="+63 9xx xxx xxxx" /></div>
                        <p className="text-xs text-ink/50 sm:col-span-2 xl:col-span-3">{contactChanged ? `Saving also updates ${selectedGuest?.name ?? "this guest"}’s profile on all of their reservations.` : "Add at least one contact method: email or phone."}</p>
                      </div>
                    ) : (
                      <dl className="grid gap-4 rounded-xl bg-linen px-4 py-3 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-ink/55">Email</dt><dd className="mt-0.5 break-words text-pine">{selectedGuest?.email || "—"}</dd></div>
                        <div><dt className="text-xs text-ink/55">Phone</dt><dd className="mt-0.5 text-pine">{selectedGuest?.phone || "—"}</dd></div>
                      </dl>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div><Label htmlFor="guestName">Full name</Label><Input id="guestName" value={newGuest.name} onChange={(event) => setNewGuest({ ...newGuest, name: event.target.value })} maxLength={120} /></div>
                    <div><Label htmlFor="guestEmail">Email</Label><Input id="guestEmail" type="email" value={newGuest.email} onChange={(event) => setNewGuest({ ...newGuest, email: event.target.value })} maxLength={200} placeholder="guest@example.com" /></div>
                    <div><Label htmlFor="guestPhone">Phone</Label><Input id="guestPhone" type="tel" value={newGuest.phone} onChange={(event) => setNewGuest({ ...newGuest, phone: event.target.value })} maxLength={40} placeholder="+63 9xx xxx xxxx" /></div>
                    {edit ? null : <div><Label htmlFor="guestNotes">Notes</Label><Input id="guestNotes" value={newGuest.notes} onChange={(event) => setNewGuest({ ...newGuest, notes: event.target.value })} maxLength={2000} placeholder="Optional" /></div>}
                    <p className="text-xs text-ink/50 md:col-span-2">A new guest profile is created when you save. Add at least one contact method: email or phone.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-pine/10 pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg text-pine">Additional guests</h3>
                  <span className="text-xs text-ink/55">{guestCount} of {capacity} guests</span>
                </div>
                <p className="text-sm text-ink/60">Names for entry letters or contracts. These don’t create guest profiles.</p>
                {additional.length ? (
                  <ul className="mt-4 grid gap-3 md:grid-cols-2">
                    {additional.map((name, index) => (
                      <li key={index} className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <Label htmlFor={`occupant-${index}`}>Guest {index + 2}</Label>
                          <Input id={`occupant-${index}`} value={name} onChange={(event) => setAdditional(additional.map((value, position) => position === index ? event.target.value : value))} maxLength={120} placeholder="Full legal name" />
                        </div>
                        <button type="button" onClick={() => setAdditional(additional.filter((_, position) => position !== index))} aria-label={`Remove guest ${index + 2}`} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink/50 hover:bg-clay-mist hover:text-clay-deep"><X className="h-4 w-4" aria-hidden /></button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-3 text-sm text-ink/55">Only the primary guest is staying.</p>}
                <Button type="button" variant="outline" size="sm" className="mt-4" disabled={guestCount >= capacity} onClick={() => setGuestCount(guestCount + 1)}><Plus className="h-4 w-4" aria-hidden />Add guest</Button>
              </div>
            </div>
          ) : null}

          {step === "charges" && canSetCharges ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <StepHeading title="Charges" description={edit ? "This reservation’s current charges. Edit any line, or reset to the unit’s rates for the new dates." : "Built from the unit’s rates. Edit any line for a negotiated price, fee, or discount."} />
                {customCharges !== null ? (
                  <button type="button" onClick={() => setCustomCharges(null)} className="inline-flex items-center gap-1.5 text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"><RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset to unit defaults</button>
                ) : null}
              </div>
              <div className="space-y-3">
                <ul className="space-y-3">
                  {parsed.map(({ draft, line }) => {
                    const quantity = Number(draft.quantity);
                    const subtotal = line && Number.isInteger(quantity) && quantity >= 1 ? line.quantity * line.unitAmountCents : null;
                    return (
                      <li key={draft.key} className={cn("grid grid-cols-2 items-end gap-3 rounded-xl border p-3 sm:grid-cols-[10rem_minmax(0,1fr)_5rem_8rem_6rem_2rem]", line ? "border-pine/10" : "border-clay/40 bg-clay-mist/30")}>
                        <div><Label htmlFor={`charge-type-${draft.key}`}>Type</Label><SelectMenu id={`charge-type-${draft.key}`} value={draft.type} options={CHARGE_TYPE_OPTIONS} onChange={(type) => changeChargeType(draft, type)} /></div>
                        <div className="col-span-2 sm:col-span-1"><Label>Description</Label><Input value={draft.description} onChange={(event) => updateCharge(draft.key, { description: event.target.value })} placeholder={draft.type === "accommodation" ? "Accommodation (3 nights)" : "Describe the charge"} /></div>
                        <div><Label>Qty</Label><Input value={draft.quantity} inputMode="numeric" onChange={(event) => updateCharge(draft.key, { quantity: event.target.value })} /></div>
                        <div><Label>{draft.type === "discount" ? "Amount (₱, negative)" : "Amount (₱)"}</Label><Input value={draft.amountInput} inputMode="decimal" placeholder="5500" onChange={(event) => updateCharge(draft.key, { amountInput: event.target.value })} /></div>
                        <p className="pb-2.5 text-sm text-ink/70">{subtotal === null ? "—" : formatPHP(subtotal)}</p>
                        <button type="button" onClick={() => setCustomCharges((current) => (current ?? defaultCharges).filter((item) => item.key !== draft.key))} aria-label="Remove charge line" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-clay-deep hover:bg-clay-mist"><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </li>
                    );
                  })}
                </ul>
                <Button type="button" variant="outline" size="sm" onClick={() => setCustomCharges((current) => [...(current ?? defaultCharges), { key: crypto.randomUUID(), type: "fee", description: "", quantity: "1", amountInput: "" }])}><Plus className="h-4 w-4" aria-hidden />Add charge line</Button>
              </div>

              {edit ? (
                <div className="border-t border-pine/10 pt-6">
                  <h3 className="font-display text-lg text-pine">Payments</h3>
                  <p className="text-sm text-ink/60">Payments are ledger entries and don’t change here. Changing charges changes what’s still due.</p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <ReviewItem label="Paid towards booking" value={formatPHP(edit.paid.bookingCents)} />
                    <ReviewItem label="Deposit collected" value={formatPHP(edit.paid.depositCents)} />
                    <ReviewItem label="Still due after this edit" value={formatPHP(Math.max(0, totals.bookingTotalCents - edit.paid.bookingCents))} />
                  </dl>
                  <Link href={`/reservations/${edit.reservationId}/payments/new`} className={buttonClassName("outline", "sm", "mt-4")}><Plus className="h-4 w-4" aria-hidden />Record payment</Link>
                </div>
              ) : (
              <div className="border-t border-pine/10 pt-6">
                <h3 className="font-display text-lg text-pine">Payment received</h3>
                <p className="text-sm text-ink/60">Optional. Recorded with a confirmed booking so the balance starts accurate.</p>
                <label className="mt-4 flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" className="mt-0.5 accent-pine" checked={noPayment} onChange={(event) => { setNoPayment(event.target.checked); if (event.target.checked) setPayment({ ...payment, amount: "" }); }} />
                  <span>No payment received yet</span>
                </label>
                {noPayment ? (
                  <p className="mt-3 rounded-xl bg-linen px-4 py-3 text-sm text-ink/70">The booking total of <strong>{formatPHP(totals.bookingTotalCents)}</strong> stays due from the guest. Record payments from the reservation once they arrive.</p>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><Label htmlFor="payment-amount">Amount received (₱)</Label><Input id="payment-amount" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} inputMode="decimal" placeholder="e.g. 3,000" /></div>
                      <div><Label htmlFor="payment-reference">Reference (optional)</Label><Input id="payment-reference" value={payment.reference} onChange={(event) => setPayment({ ...payment, reference: event.target.value })} maxLength={120} placeholder="GCash reference or sender" /></div>
                    </div>
                    <div>
                      <p id="payment-allocation" className="mb-1.5 text-sm font-medium text-ink">Towards</p>
                      <ChoiceCards
                        aria-labelledby="payment-allocation"
                        value={payment.allocation}
                        onChange={(allocation) => setPayment({ ...payment, allocation })}
                        options={[
                          { value: "booking", label: PAYMENT_ALLOCATION_LABELS.booking, icon: Receipt, description: `Counts toward the ${formatPHP(totals.bookingTotalCents)} booking total` },
                          {
                            value: "security_deposit",
                            label: PAYMENT_ALLOCATION_LABELS.security_deposit,
                            icon: ShieldCheck,
                            description: totals.depositTotalCents ? `Refundable ${formatPHP(totals.depositTotalCents)}, returned after checkout` : "Add a security deposit charge first",
                            disabled: !totals.depositTotalCents && payment.allocation !== "security_deposit",
                          },
                        ]}
                      />
                    </div>
                    <div>
                      <p id="payment-method" className="mb-1.5 text-sm font-medium text-ink">Method</p>
                      <ChoiceCards aria-labelledby="payment-method" columns={4} value={payment.method} onChange={(method) => setPayment({ ...payment, method })} options={PAYMENT_METHOD_OPTIONS} />
                    </div>
                    <div>
                      <label className="flex items-start gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-pine"
                          checked={receivedNow}
                          onChange={(event) => {
                            setReceivedNow(event.target.checked);
                            if (!event.target.checked && !payment.receivedAt) setPayment({ ...payment, receivedAt: `${today}T12:00` });
                          }}
                        />
                        <span>Received just now<span className="block text-xs text-ink/50">Uncheck to enter when it arrived, in the property timezone.</span></span>
                      </label>
                      {!receivedNow ? (
                        // Date and time kept together as YYYY-MM-DDTHH:mm.
                        <div className="mt-3 grid max-w-md grid-cols-[minmax(0,1fr)_7rem] gap-2">
                          <DateInput
                            aria-label="Date received"
                            value={payment.receivedAt.slice(0, 10)}
                            today={today}
                            max={today}
                            onChange={(date) => setPayment({ ...payment, receivedAt: `${date}T${payment.receivedAt.slice(11, 16) || "12:00"}` })}
                          />
                          <TimeInput
                            aria-label="Time received"
                            value={payment.receivedAt.slice(11, 16)}
                            onChange={(time) => setPayment({ ...payment, receivedAt: `${payment.receivedAt.slice(0, 10)}T${time}` })}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          ) : null}

          {step === "review" ? (
            <div className="space-y-6">
              <StepHeading title="Review and save" description="Check everything before saving. Saving runs the final conflict check." />
              <ReviewBlock title="Stay" onEdit={() => goTo("stay")}>
                <div className="flex min-w-0 gap-4">
                  <UnitPhoto src={selectedUnit?.imageUrl ?? null} className="hidden h-20 w-28 shrink-0 rounded-lg sm:block" />
                  <dl className="grid min-w-0 flex-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <ReviewItem label="Unit" value={selectedUnit?.label ?? "—"} />
                    <ReviewItem label="Check-in" value={`${dayLabel(checkIn)} · ${selectedUnit ? timeLabel(selectedUnit.checkInTime) : ""}`} />
                    <ReviewItem label="Check-out" value={`${dayLabel(checkOut)} · ${selectedUnit ? timeLabel(selectedUnit.checkOutTime) : ""}`} />
                    <ReviewItem label="Length" value={`${plural(nights ?? 0, "night")} · ${plural(guestCount, "guest")}`} />
                  </dl>
                </div>
                <AvailabilityBanner valid={validRange} unitChosen={Boolean(selectedUnit)} result={currentAvailability} nights={nights} checkIn={checkIn} checkOut={checkOut} current={unchangedStay} changed={Boolean(edit)} compact />
              </ReviewBlock>
              <ReviewBlock title="Guests" onEdit={() => goTo("guests")}>
                <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <ReviewItem label={guestMode === "new" ? "Primary guest (new)" : "Primary guest"} value={guestLabel ?? "—"} />
                  <ReviewItem label="Email" value={(guestMode === "new" ? newGuest.email : edit ? contact.email : selectedGuest?.email) || "—"} />
                  <ReviewItem label="Phone" value={(guestMode === "new" ? newGuest.phone : edit ? contact.phone : selectedGuest?.phone) || "—"} />
                  <ReviewItem label="Also staying" value={additional.length ? additional.map((name) => name.trim()).join(", ") : "No one else"} />
                </dl>
              </ReviewBlock>
              {canSetCharges ? (
                <ReviewBlock title="Charges & payment" onEdit={() => goTo("charges")}>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-pine/10">
                      {submittableLines.map((line, index) => (
                        <tr key={index}><td className="py-2 pr-3 text-ink/75">{line.description}<span className="text-ink/45"> · {CHARGE_TYPE_LABELS[line.type]}</span></td><td className="py-2 text-right text-ink/60">{line.quantity} × {formatPHP(line.unitAmountCents)}</td><td className="py-2 pl-3 text-right font-medium text-pine">{formatPHP(line.quantity * line.unitAmountCents)}</td></tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-pine/15">
                      <tr><td colSpan={2} className="pt-3 text-ink/60">Booking total</td><td className="pt-3 text-right font-display text-lg text-pine">{formatPHP(totals.bookingTotalCents)}</td></tr>
                      {totals.depositTotalCents ? <tr><td colSpan={2} className="text-ink/60">Refundable deposit</td><td className="text-right text-pine">{formatPHP(totals.depositTotalCents)}</td></tr> : null}
                    </tfoot>
                  </table>
                  <p className="mt-3 rounded-lg bg-linen px-3 py-2 text-sm text-ink/70">
                    {edit ? `${formatPHP(edit.paid.bookingCents)} paid so far · ${formatPHP(Math.max(0, totals.bookingTotalCents - edit.paid.bookingCents))} still due after this edit.` : paymentCents ? `${formatPHP(paymentCents)} received via ${PAYMENT_METHOD_LABELS[payment.method]} towards ${PAYMENT_ALLOCATION_LABELS[payment.allocation].toLowerCase()}${payment.reference.trim() ? ` · ref ${payment.reference.trim()}` : ""}.` : noPayment ? "No payment received yet." : "No payment entered."}
                  </p>
                </ReviewBlock>
              ) : null}

              {edit ? null : <fieldset>
                <legend className="mb-3 font-display text-lg text-pine">Save as</legend>
                <div className={cn("grid gap-3", canConfirm && "md:grid-cols-2")}>
                  {canConfirm ? (
                    <SaveOption active={submitMode === "confirmed"} onSelect={() => setSubmitMode("confirmed")} icon={ShieldCheck} title="Confirmed booking" description="Locks the dates for this guest and records any payment." />
                  ) : null}
                  <SaveOption active={submitMode === "hold"} onSelect={() => setSubmitMode("hold")} icon={Clock} title="Hold" description={canConfirm ? "Reserves the dates for a limited time while the guest pays." : "Reserves the dates for a limited time for someone who can confirm bookings."}>
                    <div className="mt-3 max-w-48" onClick={(event) => event.stopPropagation()}>
                      <Label htmlFor="holdMinutes">Hold for</Label>
                      <Select id="holdMinutes" value={holdMinutes} onChange={(event) => { setHoldMinutes(event.target.value); setSubmitMode("hold"); }}>{HOLD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
                    </div>
                  </SaveOption>
                </div>
              </fieldset>}
              <FieldError message={reviewError ?? state.error} />
            </div>
          ) : null}

          {showIssue && stepIssues[step] ? <p role="alert" className="mt-6 flex items-center gap-2 rounded-xl bg-clay-mist px-4 py-3 text-sm text-clay-deep"><CircleAlert className="h-4 w-4 shrink-0" aria-hidden />{stepIssues[step]}</p> : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-pine/10 pt-5">
            {stepIndex === 0
              ? <Link href={edit ? `/reservations/${edit.reservationId}` : "/reservations"} className={buttonClassName("ghost", "md")}>Cancel</Link>
              : <Button type="button" variant="outline" onClick={() => goTo(steps[stepIndex - 1]!, true)}><ArrowLeft className="h-4 w-4" aria-hidden />Back</Button>}
            {step === "review" ? (
              <Button type="button" variant="clay" size="lg" onClick={submit} disabled={pending}>
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                {pending ? "Saving…" : edit ? "Save changes" : submitMode === "hold" ? "Place hold" : "Confirm booking"}
              </Button>
            ) : (
              <Button type="button" variant="clay" size="lg" onClick={next}>Continue to {STEP_LABELS[steps[stepIndex + 1]!].toLowerCase()}<ArrowRight className="h-4 w-4" aria-hidden /></Button>
            )}
          </div>
        </section>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-0">
        <ReservationSummary
          unit={selectedUnit}
          checkIn={checkIn}
          checkOut={checkOut}
          nights={nights}
          guestCount={guestCount}
          guestName={guestLabel}
          lines={submittableLines}
          totals={totals}
          paymentCents={edit ? null : paymentCents}
          paymentAllocation={payment.allocation}
          alreadyPaid={edit?.paid}
          showPricing={canSetCharges}
        />
      </aside>
    </div>
    </div>
  );
}

function Stepper({ steps, current, firstBlocked, onJump }: { steps: StepId[]; current: number; firstBlocked: number; onJump: (step: StepId) => void }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Reservation steps">
      {steps.map((step, index) => {
        const done = index < current;
        const reachable = firstBlocked === -1 || index <= firstBlocked;
        return (
          <li key={step} className={cn("flex min-w-0 items-center", index === current ? "flex-1" : "shrink-0 sm:flex-1")}>
            <button
              type="button"
              onClick={() => onJump(step)}
              disabled={!reachable || index === current}
              aria-current={index === current ? "step" : undefined}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left text-sm transition-colors sm:px-3",
                index === current ? "border-clay bg-white font-medium text-pine shadow-[0_1px_2px_rgba(32,58,53,0.06)]" : done ? "border-pine/10 bg-white text-pine hover:border-pine/30" : "border-transparent text-ink/45",
              )}
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium", index === current ? "bg-clay text-white" : done ? "bg-sage/60 text-pine" : "bg-pine/10 text-ink/50")}>
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              <span className={cn("truncate", index !== current && "sr-only sm:not-sr-only")}>{STEP_LABELS[step]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-2xl text-pine">{title}</h2>
      <p className="mt-1 text-sm text-ink/60">{description}</p>
    </div>
  );
}

function AvailabilityBanner({ valid, unitChosen, result, nights, checkIn, checkOut, compact, current, changed }: {
  valid: boolean;
  /** Editing, with the reservation's own unit and dates: they're booked by it, not "free". */
  current?: boolean;
  /** Editing, with a different unit or dates than saved. */
  changed?: boolean;
  unitChosen: boolean;
  result: StayAvailability | null;
  nights: number | null;
  checkIn: string;
  checkOut: string;
  compact?: boolean;
}) {
  if (!unitChosen || !valid) return <p className="flex items-center gap-2 rounded-xl bg-clay-mist px-4 py-3 text-sm text-clay-deep"><CircleAlert className="h-4 w-4 shrink-0" aria-hidden />Pick a check-out after check-in.</p>;
  const range = `${dayLabel(checkIn)} → ${dayLabel(checkOut)} · ${plural(nights ?? 0, "night")}`;
  if (current) return <p className={cn("flex items-center gap-2 rounded-xl bg-pine-mist px-4 py-3 text-sm text-pine", compact && "mt-4")}><CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />Booked for this reservation: {range}. Change the unit or dates to check other availability.</p>;
  if (!result) return <p className={cn("flex items-center gap-2 rounded-xl bg-linen px-4 py-3 text-sm text-ink/60", compact && "mt-4")}><LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden />Checking {range}…</p>;
  if (result.status === "available") return <p className={cn("flex items-center gap-2 rounded-xl bg-sage/50 px-4 py-3 text-sm font-medium text-pine-deep", compact && "mt-4")}><CircleCheck className="h-4 w-4 shrink-0" aria-hidden />{changed ? `New dates are free: ${range}` : `Free for ${range}`}</p>;
  if (result.status === "unavailable") return <p className={cn("flex items-center gap-2 rounded-xl bg-clay-mist px-4 py-3 text-sm font-medium text-clay-deep", compact && "mt-4")}><CircleAlert className="h-4 w-4 shrink-0" aria-hidden />Not free: {result.reason}</p>;
  return <p className={cn("flex items-center gap-2 rounded-xl bg-linen px-4 py-3 text-sm text-ink/60", compact && "mt-4")}><CircleAlert className="h-4 w-4 shrink-0" aria-hidden />{result.message} Saving still runs the full check.</p>;
}

function SegmentButton({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} disabled={disabled} onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40", active ? "bg-white text-pine shadow-[0_1px_2px_rgba(32,58,53,0.1)]" : "text-ink/55 hover:text-pine")}>
      {children}
    </button>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-pine/10 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink/45">{title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-pine/70 hover:bg-pine-mist hover:text-pine"><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</button>
      </div>
      {children}
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink/50">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-pine">{value}</dd>
    </div>
  );
}

function SaveOption({ active, onSelect, icon: Icon, title, description, children }: { active: boolean; onSelect: () => void; icon: typeof Clock; title: string; description: string; children?: ReactNode }) {
  return (
    <div role="radio" aria-checked={active} tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }} className={cn("cursor-pointer rounded-xl border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay", active ? "border-clay bg-clay-mist/40 ring-1 ring-clay" : "border-pine/15 hover:border-pine/35")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", active ? "bg-clay text-white" : "bg-sage/60 text-pine")}><Icon className="h-4 w-4" aria-hidden /></span>
        <div className="min-w-0">
          <p className="font-medium text-pine">{title}</p>
          <p className="mt-0.5 text-sm text-ink/60">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
