"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { recordRefundAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";

const PAYMENT_ALLOCATIONS = ["booking", "security_deposit"] as const;
const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;

export function RecordRefundForm({ reservationId }: { reservationId: string }) {
  const save = useReservationSaved(recordRefundAction.bind(null, reservationId), reservationId);
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state, { success: "Refund recorded." });

  return (
    <div className="space-y-3">
      {state.success ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Refund recorded. Returning to reservation…
        </p>
      ) : (
        <form action={formAction} className="space-y-3">
          <div>
            <Label htmlFor="refund-amount">Amount refunded (₱)</Label>
            <Input
              id="refund-amount"
              name="amountPesos"
              inputMode="decimal"
              placeholder="e.g. 1,000"
              required
            />
          </div>
          <div>
            <Label htmlFor="refund-allocation">From</Label>
            <Select id="refund-allocation" name="allocation" defaultValue="booking">
              {PAYMENT_ALLOCATIONS.map((allocation) => (
                <option key={allocation} value={allocation}>
                  {PAYMENT_ALLOCATION_LABELS[allocation]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="refund-method">Returned via</Label>
            <Select id="refund-method" name="method" defaultValue="gcash">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              name="reason"
              required
              minLength={2}
              maxLength={500}
              placeholder="e.g. Guest cancelled — full refund per policy."
              className="min-h-16"
            />
          </div>
          <FieldError message={state.error} />
          <Button type="submit" variant="clay" disabled={pending}>
            {pending ? "Recording…" : "Record refund"}
          </Button>
        </form>
      )}
    </div>
  );
}
