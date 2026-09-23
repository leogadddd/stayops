"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { confirmHoldAction, type ReservationFormState } from "../actions";

export function ConfirmHoldForm({ reservationId }: { reservationId: string }) {
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(
    confirmHoldAction.bind(null, reservationId),
    {},
  );

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Hold confirmed.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="confirm-reason">
          Why confirm without a recorded payment?
        </Label>
        <Textarea
          id="confirm-reason"
          name="reason"
          required
          minLength={2}
          maxLength={500}
          placeholder="e.g. Guest paid via GCash — transfer screenshot saved."
          className="min-h-16"
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Confirming…" : "Confirm hold"}
      </Button>
    </form>
  );
}
