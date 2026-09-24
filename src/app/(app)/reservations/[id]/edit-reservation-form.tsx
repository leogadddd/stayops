"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { updateReservationAction, type ReservationFormState } from "../actions";
import { CHARGE_TYPES, type ChargeType } from "@/lib/db/schema";
import { CHARGE_TYPE_LABELS } from "@/lib/charges";
import { centavosToPesosInput } from "@/lib/money";

export function EditReservationForm({
  reservationId, unitId, capacity, checkIn, checkOut, guestCount, occupants, guestId, guests, units, charges,
}: {
  reservationId: string; unitId: string; capacity: number; checkIn: string; checkOut: string; guestCount: number; occupants: string[]; guestId: string;
  guests: { id: string; name: string }[]; units: { id: string; label: string; capacity: number }[];
  charges: { id: string; type: ChargeType; description: string; quantity: number; unitAmountCents: number }[];
}) {
  const router = useRouter();
  const [count, setCount] = useState(guestCount);
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(updateReservationAction.bind(null, reservationId), {});
  useActionFeedback(state, { success: "Reservation updated." });
  useEffect(() => { if (state.success) { router.push(`/reservations/${reservationId}`); router.refresh(); } }, [state.success, router, reservationId]);
  return <form action={formAction} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="edit-unit">Unit</Label><Select id="edit-unit" name="unitId" defaultValue={unitId}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label} · sleeps {unit.capacity}</option>)}</Select></div>
      <div><Label htmlFor="edit-guest">Primary guest</Label><Select id="edit-guest" name="guestId" defaultValue={guestId}>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}</Select><p className="mt-1 text-xs text-ink/50">Manage contact details from Guests.</p></div>
      <div><Label htmlFor="edit-check-in">Check-in</Label><Input id="edit-check-in" name="checkIn" type="date" defaultValue={checkIn} required /></div>
      <div><Label htmlFor="edit-check-out">Check-out</Label><Input id="edit-check-out" name="checkOut" type="date" defaultValue={checkOut} required /></div>
      <div><Label htmlFor="edit-guest-count">Guests</Label><Input id="edit-guest-count" name="guestCount" type="number" min={1} max={capacity} value={count} onChange={(event) => setCount(Number(event.target.value) || 1)} required /><p className="mt-1 text-xs text-ink/50">This unit sleeps up to {capacity}.</p></div>
    </div>
    {count > 1 ? <fieldset className="border-t border-pine/10 pt-4"><legend className="text-sm font-medium text-pine">Additional guests</legend><p className="mt-1 text-xs text-ink/55">The primary guest contact is unchanged.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{Array.from({ length: count - 1 }, (_, index) => <div key={index}><Label htmlFor={`edit-occupant-${index}`}>Additional guest {index + 1}</Label><Input id={`edit-occupant-${index}`} name="occupantName" defaultValue={occupants[index] ?? ""} required minLength={2} maxLength={120} /></div>)}</div></fieldset> : null}
    <fieldset className="border-t border-pine/10 pt-4"><legend className="text-sm font-medium text-pine">Charges</legend><p className="mt-1 text-xs text-ink/55">Updating charges changes the booking snapshot; payments already recorded remain immutable ledger entries.</p><div className="mt-3 space-y-3">{charges.map((charge) => <div key={charge.id} className="grid gap-3 rounded-lg border border-pine/10 p-3 sm:grid-cols-[10rem_1fr_5rem_8rem]"><div><Label>Type</Label><Select name="chargeType" defaultValue={charge.type}>{CHARGE_TYPES.map((type) => <option key={type} value={type}>{CHARGE_TYPE_LABELS[type]}</option>)}</Select></div><div><Label>Description</Label><Input name="chargeDescription" defaultValue={charge.description} required minLength={2} maxLength={200} /></div><div><Label>Qty</Label><Input name="chargeQuantity" type="number" min={1} defaultValue={charge.quantity} required /></div><div><Label>Amount (₱)</Label><Input name="chargeAmountPesos" inputMode="decimal" defaultValue={centavosToPesosInput(charge.unitAmountCents)} required /></div></div>)}</div></fieldset>
    <div className="rounded-lg border border-pine/10 bg-paper p-4 text-sm text-ink/65"><p className="font-medium text-pine">Payments</p><p className="mt-1">Payments are immutable ledger entries. Record another payment instead of editing an existing one.</p><Link href={`/reservations/${reservationId}/payments/new`} className={`${buttonClassName("outline", "sm", "mt-3")}`}>Record payment</Link></div>
    <FieldError message={state.error} />
    <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
  </form>;
}
