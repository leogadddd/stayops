"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { checkOutAction, type ReservationFormState } from "../actions";

export function CheckOutForm({ reservationId }: { reservationId: string }) {
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(
    checkOutAction.bind(null, reservationId),
    {},
  );

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Checked out. The turnover checklist is open under Tasks.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="check-out-note">Note (optional)</Label>
        <Textarea
          id="check-out-note"
          name="note"
          maxLength={500}
          placeholder="e.g. Left at 11 AM, unit in good shape."
          className="min-h-16"
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Checking out…" : "Check out & start turnover"}
      </Button>
    </form>
  );
}
