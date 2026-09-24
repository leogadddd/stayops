"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { addDeductionAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

interface DamageOption {
  id: string;
  description: string;
}

export function AddDeductionForm({
  reservationId,
  damageReports = [],
}: {
  reservationId: string;
  damageReports?: DamageOption[];
}) {
  const save = useReservationSaved(addDeductionAction.bind(null, reservationId), reservationId, "Deposit deduction recorded.");
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state);

  return (
    <div className="space-y-3">
      {state.success ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Deduction recorded. Returning to reservation…
        </p>
      ) : (
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="deduction-amount">Amount kept from deposit (₱)</Label>
            <Input
              id="deduction-amount"
              name="amountPesos"
              inputMode="decimal"
              placeholder="e.g. 800"
              required
            />
          </div>
          <div>
            <Label htmlFor="deduction-reason">What is it for?</Label>
            <Textarea
              id="deduction-reason"
              name="reason"
              required
              minLength={2}
              maxLength={500}
              placeholder="e.g. Stained linens — replacement cost."
              className="min-h-16"
            />
          </div>
          {damageReports.length > 0 ? (
            <div>
              <Label htmlFor="deduction-damage">Link to a damage report (optional)</Label>
              <select
                id="deduction-damage"
                name="damageReportId"
                className="mt-1 w-full rounded-xl border border-pine/20 bg-cream px-3 py-2 text-sm text-pine focus:outline-none focus:ring-2 focus:ring-pine/30"
                defaultValue=""
              >
                <option value="">No link</option>
                {damageReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.description}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <FieldError message={state.error} />
          <Button type="submit" variant="clay" disabled={pending}>
            {pending ? "Recording…" : "Record deduction"}
          </Button>
        </form>
      )}
    </div>
  );
}
