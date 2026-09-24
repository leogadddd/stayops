"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { recordProofPaymentAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

const PAYMENT_ALLOCATIONS = ["booking", "security_deposit"] as const;
const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;

export function RecordProofForm({ reservationId, proofId, reference }: {
  reservationId: string;
  proofId: string;
  reference: string;
}) {
  const save = useReservationSaved(recordProofPaymentAction.bind(null, reservationId, proofId), reservationId, "Payment proof recorded.");
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state);

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Payment recorded and reference marked as used.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="proof-amount">Amount received (₱)</Label>
          <Input id="proof-amount" name="amountPesos" inputMode="decimal" required />
        </div>
        <div>
          <Label htmlFor="proof-allocation">Towards</Label>
          <Select id="proof-allocation" name="allocation" defaultValue="booking">
            {PAYMENT_ALLOCATIONS.map((allocation) => <option key={allocation} value={allocation}>{PAYMENT_ALLOCATION_LABELS[allocation]}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="proof-method">Method</Label>
          <Select id="proof-method" name="method" defaultValue="gcash">
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="proof-reference">Reference</Label>
          <Input id="proof-reference" name="reference" maxLength={120} defaultValue={reference} />
        </div>
      </div>
      <p className="text-xs text-ink/55">Verify the money arrived in your account. A guest-submitted reference is not a verified payment.</p>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" disabled={pending}>{pending ? "Recording…" : "Record against this reference"}</Button>
    </form>
  );
}
