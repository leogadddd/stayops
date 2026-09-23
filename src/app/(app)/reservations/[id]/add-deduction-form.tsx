"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { addDeductionAction, type PaymentFormState } from "./payment-actions";

export function AddDeductionForm({ reservationId }: { reservationId: string }) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    addDeductionAction.bind(null, reservationId),
    {},
  );
  const [formKey, setFormKey] = useState(0);
  const [recordAnother, setRecordAnother] = useState(false);

  return (
    <div className="space-y-3">
      {state.success && !recordAnother ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Deduction recorded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFormKey((key) => key + 1);
              setRecordAnother(true);
            }}
          >
            Record another deduction
          </Button>
        </div>
      ) : (
        <form
          key={formKey}
          action={formAction}
          onSubmit={() => setRecordAnother(false)}
          className="space-y-3"
        >
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
          <FieldError message={state.error} />
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Recording…" : "Record deduction"}
          </Button>
        </form>
      )}
    </div>
  );
}
