"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { updateReservationAction, type ReservationFormState } from "../actions";
import { Plus, Trash2, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CHARGE_TYPES, type ChargeType } from "@/lib/db/schema";
import { CHARGE_TYPE_LABELS, computeTotals } from "@/lib/charges";
import { centavosToPesosInput, formatPHP, pesosToCentavos } from "@/lib/money";

interface GuestOption { id: string; name: string; email: string | null; phone: string | null }

export function EditReservationForm({
  reservationId, unitId, checkIn, checkOut, guestCount, occupants, guestId, guests, units, charges,
}: {
  reservationId: string; unitId: string; capacity: number; checkIn: string; checkOut: string; guestCount: number; occupants: string[]; guestId: string;
  guests: GuestOption[]; units: { id: string; label: string; capacity: number }[];
  charges: { id: string; type: ChargeType; description: string; quantity: number; unitAmountCents: number }[];
}) {
  const router = useRouter();
  const [selectedUnitId, setSelectedUnitId] = useState(unitId);
  const capacity = units.find((unit) => unit.id === selectedUnitId)?.capacity ?? 1;
  const [primaryId, setPrimaryId] = useState(guestId);
  const original = guests.find((guest) => guest.id === primaryId);
  const [contact, setContact] = useState(() => contactOf(guests.find((guest) => guest.id === guestId)));
  const [additional, setAdditional] = useState(() => Array.from({ length: Math.max(guestCount - 1, 0) }, (_, index) => occupants[index] ?? ""));
  const total = 1 + additional.length;
  const overCapacity = total > capacity;
  const profileChanged = original ? (Object.keys(contact) as (keyof typeof contact)[]).some((key) => contact[key] !== contactOf(original)[key]) : false;
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(updateReservationAction.bind(null, reservationId), {});
  useActionFeedback(state, { success: "Reservation updated." });
  useEffect(() => { if (state.success) { router.push(`/reservations/${reservationId}`); router.refresh(); } }, [state.success, router, reservationId]);

  const [chargeDrafts, setChargeDrafts] = useState(() => charges.map((charge) => ({ key: charge.id, type: charge.type, description: charge.description, quantity: String(charge.quantity), amountInput: centavosToPesosInput(charge.unitAmountCents) })));
  const chargeLines = chargeDrafts.map((draft) => ({ draft, line: parseCharge(draft) }));
  const totals = computeTotals(chargeLines.flatMap(({ line }) => line ? [line] : []));
  const updateCharge = (key: string, patch: Partial<ChargeDraft>) => setChargeDrafts(chargeDrafts.map((draft) => draft.key === key ? { ...draft, ...patch } : draft));

  return <form action={formAction} className="space-y-6">
    <Card>
      <CardHeader><h2 className="font-display text-lg text-pine">Stay details</h2></CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="edit-unit">Unit</Label><Select id="edit-unit" name="unitId" value={selectedUnitId} onChange={(event) => setSelectedUnitId(event.target.value)}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label} · sleeps {unit.capacity}</option>)}</Select></div>
        <div><Label htmlFor="edit-check-in">Check-in</Label><Input id="edit-check-in" name="checkIn" type="date" defaultValue={checkIn} required /></div>
        <div><Label htmlFor="edit-check-out">Check-out</Label><Input id="edit-check-out" name="checkOut" type="date" defaultValue={checkOut} required /><p className="mt-1 text-xs text-ink/50">The check-out day is free for the next guest.</p></div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader><h2 className="font-display text-lg text-pine">Primary guest</h2></CardHeader>
      <CardBody className="space-y-4">
        <div>
          <Label htmlFor="edit-guest">Guest profile</Label>
          <Select id="edit-guest" name="guestId" value={primaryId} onChange={(event) => { setPrimaryId(event.target.value); setContact(contactOf(guests.find((guest) => guest.id === event.target.value))); }}>
            {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
            <option value="new">+ New guest</option>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label htmlFor="edit-guest-name">Full name</Label><Input id="edit-guest-name" name="guestName" value={contact.name} onChange={(event) => setContact({ ...contact, name: event.target.value })} required minLength={2} maxLength={120} /></div>
          <div><Label htmlFor="edit-guest-email">Email</Label><Input id="edit-guest-email" name="guestEmail" type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} maxLength={200} placeholder="guest@example.com" /></div>
          <div><Label htmlFor="edit-guest-phone">Phone</Label><Input id="edit-guest-phone" name="guestPhone" type="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} maxLength={40} placeholder="+63 9xx xxx xxxx" /></div>
        </div>
        <p className="text-xs text-ink/50">
          {primaryId === "new"
            ? "A new guest profile is created when you save. Add at least one contact method — email or phone."
            : profileChanged
              ? `Saving also updates ${original?.name ?? "this guest"}'s profile on all of their reservations.`
              : "Add at least one contact method — email or phone."}
        </p>
      </CardBody>
    </Card>

    <Card>
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-pine">Additional guests</h2>
          <p className="text-sm text-ink/60">Names for entry letters or contracts. These do not create guest profiles.</p>
        </div>
        <span className={`text-xs ${overCapacity ? "font-medium text-clay-deep" : "text-ink/55"}`}>{total} of {capacity} guests</span>
      </CardHeader>
      <CardBody className="space-y-3">
        <input type="hidden" name="guestCount" value={total} />
        {additional.length ? (
          <ul className="space-y-2">
            {additional.map((name, index) => (
              <li key={index} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`edit-occupant-${index}`}>Additional guest {index + 1}</Label>
                  <Input id={`edit-occupant-${index}`} name="occupantName" value={name} onChange={(event) => setAdditional(additional.map((value, position) => position === index ? event.target.value : value))} required minLength={2} maxLength={120} placeholder="Full legal name" />
                </div>
                <button type="button" onClick={() => setAdditional(additional.filter((_, position) => position !== index))} aria-label={`Remove additional guest ${index + 1}`} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink/50 hover:bg-clay-mist hover:text-clay-deep">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ink/55">Only the primary guest is staying.</p>}
        {overCapacity ? (
          <p className="text-xs text-clay-deep" role="alert">This unit sleeps {capacity}. Remove {total - capacity} guest{total - capacity === 1 ? "" : "s"} or choose a larger unit.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={total >= capacity} onClick={() => setAdditional([...additional, ""])}>
            <Plus className="h-4 w-4" aria-hidden />Add guest
          </Button>
          {total >= capacity && !overCapacity ? <span className="text-xs text-ink/50">The unit is at capacity.</span> : null}
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader>
        <h2 className="font-display text-lg text-pine">Charges</h2>
        <p className="text-sm text-ink/60">Updating charges changes the booking snapshot; payments already recorded remain immutable ledger entries.</p>
      </CardHeader>
      <CardBody className="space-y-3">
        <ul className="space-y-3">
          {chargeLines.map(({ draft, line }) => (
            <li key={draft.key} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-pine/10 p-3 sm:grid-cols-[10rem_1fr_5rem_8rem_6rem_2rem]">
              <div><Label htmlFor={`charge-type-${draft.key}`}>Type</Label><Select id={`charge-type-${draft.key}`} name="chargeType" value={draft.type} onChange={(event) => updateCharge(draft.key, { type: event.target.value as ChargeType })}>{CHARGE_TYPES.map((type) => <option key={type} value={type}>{CHARGE_TYPE_LABELS[type]}</option>)}</Select></div>
              <div className="col-span-2 sm:col-span-1"><Label htmlFor={`charge-description-${draft.key}`}>Description</Label><Input id={`charge-description-${draft.key}`} name="chargeDescription" value={draft.description} onChange={(event) => updateCharge(draft.key, { description: event.target.value })} required minLength={2} maxLength={200} placeholder="Describe the charge" /></div>
              <div><Label htmlFor={`charge-quantity-${draft.key}`}>Qty</Label><Input id={`charge-quantity-${draft.key}`} name="chargeQuantity" inputMode="numeric" value={draft.quantity} onChange={(event) => updateCharge(draft.key, { quantity: event.target.value })} required /></div>
              <div><Label htmlFor={`charge-amount-${draft.key}`}>{draft.type === "discount" ? "Amount (₱, negative)" : "Amount (₱)"}</Label><Input id={`charge-amount-${draft.key}`} name="chargeAmountPesos" inputMode="decimal" value={draft.amountInput} onChange={(event) => updateCharge(draft.key, { amountInput: event.target.value })} required placeholder="5500" /></div>
              <p className="text-sm text-ink/70">{line ? formatPHP(line.quantity * line.unitAmountCents) : "—"}</p>
              <button type="button" onClick={() => setChargeDrafts(chargeDrafts.filter((candidate) => candidate.key !== draft.key))} disabled={chargeDrafts.length === 1} aria-label="Remove charge line" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-clay-deep hover:bg-clay-mist disabled:opacity-30 disabled:hover:bg-transparent">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={() => setChargeDrafts([...chargeDrafts, { key: crypto.randomUUID(), type: "fee", description: "", quantity: "1", amountInput: "" }])}>
          <Plus className="h-4 w-4" aria-hidden />Add charge line
        </Button>
        <dl className="space-y-1.5 border-t border-pine/10 pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink/60">Booking total (excl. deposit)</dt><dd className="font-medium text-pine">{formatPHP(totals.bookingTotalCents)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink/60">Refundable deposit</dt><dd className="font-medium text-pine">{formatPHP(totals.depositTotalCents)}</dd></div>
        </dl>
      </CardBody>
    </Card>

    <Card>
      <CardHeader>
        <h2 className="font-display text-lg text-pine">Payments</h2>
        <p className="text-sm text-ink/60">Payments are immutable ledger entries. Record another payment instead of editing an existing one.</p>
      </CardHeader>
      <CardBody>
        <Link href={`/reservations/${reservationId}/payments/new`} className={buttonClassName("outline", "sm")}>Record payment</Link>
      </CardBody>
    </Card>

    <Card>
      <CardHeader><h2 className="font-display text-lg text-pine">Save changes</h2></CardHeader>
      <CardBody className="space-y-4">
        <FieldError message={state.error} />
        <div className="flex flex-wrap gap-3">
          <Link href={`/reservations/${reservationId}`} className={buttonClassName("outline", "md")}>Cancel</Link>
          <Button type="submit" variant="clay" disabled={pending || overCapacity}>{pending ? "Saving…" : "Save changes"}</Button>
        </div>
      </CardBody>
    </Card>
  </form>;
}

interface ChargeDraft { key: string; type: ChargeType; description: string; quantity: string; amountInput: string }

function parseCharge(draft: ChargeDraft) {
  const quantity = Number(draft.quantity);
  if (draft.description.trim().length < 2 || !Number.isInteger(quantity) || quantity < 1) return null;
  try {
    return { type: draft.type, description: draft.description.trim(), quantity, unitAmountCents: pesosToCentavos(draft.amountInput || "0") };
  } catch {
    return null;
  }
}

function contactOf(guest: GuestOption | undefined) {
  return { name: guest?.name ?? "", email: guest?.email ?? "", phone: guest?.phone ?? "" };
}
