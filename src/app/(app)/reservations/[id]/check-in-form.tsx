"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { checkInAction, type ReservationFormState } from "../actions";
import { useReservationSaved } from "./use-reservation-saved";

export function CheckInForm({ reservationId }: { reservationId: string }) {
  const save = useReservationSaved(checkInAction.bind(null, reservationId), reservationId);
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(save, {});

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Guest checked in.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="check-in-note">Note (optional)</Label>
        <Textarea
          id="check-in-note"
          name="note"
          maxLength={500}
          placeholder="e.g. Arrived 2 PM, key handover done."
          className="min-h-16"
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Checking in…" : "Check in guest"}
      </Button>
    </form>
  );
}
