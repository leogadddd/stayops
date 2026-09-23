"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { cancelReservationAction, type ReservationFormState } from "../actions";

export function CancelReservationForm({
  reservationId,
  label = "Cancel reservation",
}: {
  reservationId: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(
    cancelReservationAction.bind(null, reservationId),
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="cancel-reason">Reason for cancelling</Label>
        <Textarea
          id="cancel-reason"
          name="reason"
          required
          minLength={2}
          maxLength={500}
          placeholder="e.g. Guest asked to move to next month."
          className="min-h-16"
        />
      </div>
      <FieldError message={state.error} />
      {state.success ? (
        <p className="text-sm text-pine" role="status">
          Cancelled. The dates are free again.
        </p>
      ) : (
        <Button type="submit" variant="clay" disabled={pending}>
          {pending ? "Cancelling…" : label}
        </Button>
      )}
    </form>
  );
}
