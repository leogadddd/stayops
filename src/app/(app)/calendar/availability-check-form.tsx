"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  checkAvailabilityAction,
  type AvailabilityFormState,
} from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function AvailabilityCheckForm() {
  const [state, formAction, pending] = useActionState<AvailabilityFormState, FormData>(
    checkAvailabilityAction,
    {},
  );
  const [guestCount, setGuestCount] = useState("2");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  useEffect(() => {
    if (!state.result) return;
    setGuestCount(String(state.result.guestCount));
    setCheckIn(state.result.checkIn);
    setCheckOut(state.result.checkOut);
  }, [state.result]);
  useActionFeedback(state, {
    getInformation: (current) => current.result ? {
      type: current.result.availableUnits.length ? "success" : "warning",
      message: current.result.availableUnits.length ? `${current.result.availableUnits.length} unit${current.result.availableUnits.length === 1 ? "" : "s"} available` : "No matching units",
      description: `${current.result.guestCount} guest${current.result.guestCount === 1 ? "" : "s"} · ${current.result.nights} night${current.result.nights === 1 ? "" : "s"}`,
    } : null,
  });

  return (
    <div className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      <h2 className="font-display text-lg text-pine">Find an available stay</h2>
      <p className="mt-1 text-sm text-ink/60">Search every active unit. We’ll exclude stays that don’t fit your guests or overlap a booking, hold, block, or turnover.</p>
      <form
        action={formAction}
        className="mt-4 grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-end"
      >
        <div>
          <Label htmlFor="guest-count">Guests</Label>
          <Input id="guest-count" name="guestCount" type="number" min={1} max={50} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="check-in">Check-in</Label>
          <Input id="check-in" name="checkIn" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} required />
        </div>
        <div>
          <Label htmlFor="check-out">Check-out</Label>
          <Input id="check-out" name="checkOut" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required />
        </div>
        <Button type="submit" disabled={pending}>
          <Search className="h-4 w-4" aria-hidden />
          {pending ? "Checking…" : "Check"}
        </Button>
      </form>

      <FieldError message={state.error} />
      {state.result ? (
        <div className="mt-5" role="status">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-xl text-pine">{state.result.availableUnits.length ? `${state.result.availableUnits.length} available unit${state.result.availableUnits.length === 1 ? "" : "s"}` : "No units available"}</h3><p className="text-sm text-ink/60">{state.result.checkIn} → {state.result.checkOut} · {state.result.nights} night{state.result.nights === 1 ? "" : "s"}</p></div>
          {state.result.availableUnits.length ? <ul className="mt-3 divide-y divide-pine/10 rounded-xl border border-pine/10">{state.result.availableUnits.map((unit) => (
            <li key={unit.id} className="flex flex-wrap items-center gap-3 p-4">
              {unit.imageUrl ? <img src={unit.imageUrl} alt="" className="h-14 w-16 rounded-lg object-cover" /> : <span className="flex h-14 w-16 items-center justify-center rounded-lg bg-sage/35 text-pine"><CalendarDays className="h-5 w-5" aria-hidden /></span>}
              <div className="min-w-40 flex-1"><p className="font-medium text-pine">{unit.name}</p><p className="mt-1 flex items-center gap-1 text-sm text-ink/60"><Users className="h-3.5 w-3.5" aria-hidden />Sleeps up to {unit.capacity}</p></div>
              <div className="flex gap-2"><Link href={unit.calendarHref} className="inline-flex h-9 items-center rounded-lg border border-pine/20 px-3 text-sm font-medium text-pine hover:bg-sage/20">View</Link><Link href={unit.bookHref} className="inline-flex h-9 items-center rounded-lg bg-clay px-3 text-sm font-medium text-white hover:bg-clay-deep">Book</Link></div>
            </li>
          ))}</ul> : <p className="mt-3 rounded-lg bg-linen p-4 text-sm text-ink/65">Try different dates or fewer guests. Units that are inactive, too small, or already occupied aren’t shown.</p>}
        </div>
      ) : null}
    </div>
  );
}
