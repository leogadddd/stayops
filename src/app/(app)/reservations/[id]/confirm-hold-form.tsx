"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { formatPHP } from "@/lib/money";
import { confirmHoldAction, type ReservationFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

/**
 * Confirms a hold. With the unit's reservation fee paid it's one click;
 * otherwise the owner records why they're confirming without it.
 */
export function ConfirmHoldForm({
  reservationId,
  fee,
}: {
  reservationId: string;
  fee: { requiredCents: number; outstandingCents: number } | null;
}) {
  const save = useReservationSaved(confirmHoldAction.bind(null, reservationId), reservationId, "Hold confirmed.");
  const [state, formAction, pending] = useActionState<ReservationFormState, FormData>(save, {});
  useActionFeedback(state);

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Hold confirmed.
      </p>
    );
  }

  const feePaid = fee !== null && fee.outstandingCents === 0;

  return (
    <form action={formAction} className="space-y-3">
      {feePaid ? (
        <p className="inline-flex items-center gap-1.5 rounded-xl bg-sage/60 px-3 py-2 text-sm text-pine-deep">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Reservation fee of {formatPHP(fee.requiredCents)} paid.
        </p>
      ) : (
        <>
          {fee ? (
            <p className="rounded-xl bg-clay-mist/60 px-3 py-2 text-sm text-clay-deep">
              {formatPHP(fee.outstandingCents)} of the {formatPHP(fee.requiredCents)} reservation fee is unpaid.{" "}
              <Link href={`/reservations/${reservationId}/payments/new`} className="font-medium underline underline-offset-4">
                Record the payment
              </Link>{" "}
              to confirm, or give a reason below.
            </p>
          ) : null}
          <div>
            <Label htmlFor="confirm-reason">
              {fee ? "Why confirm without the reservation fee?" : "Why confirm without a recorded payment?"}
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
        </>
      )}
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Confirming…" : "Confirm hold"}
      </Button>
    </form>
  );
}
