"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import { PAYMENT_ALLOCATION_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { recordPaymentAction, type PaymentFormState } from "./payment-actions";
import { useReservationSaved } from "./use-reservation-saved";

export function RecordPaymentForm({ reservationId }: { reservationId: string }) {
  const save = useReservationSaved(recordPaymentAction.bind(null, reservationId), reservationId);
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <div className="space-y-3">
      {state.success ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Payment recorded. Returning to reservation…
        </p>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <div>
            <Label htmlFor="payment-amount">Amount received (₱)</Label>
            <Input
              id="payment-amount"
              name="amountPesos"
              inputMode="decimal"
              placeholder="e.g. 3,000"
              required
            />
          </div>
          <div>
            <Label htmlFor="payment-allocation">Towards</Label>
            <Select id="payment-allocation" name="allocation" defaultValue="booking">
              {PAYMENT_ALLOCATIONS.map((allocation) => (
                <option key={allocation} value={allocation}>
                  {PAYMENT_ALLOCATION_LABELS[allocation]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-method">Method</Label>
            <Select id="payment-method" name="method" defaultValue="gcash">
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Input
              id="payment-reference"
              name="reference"
              maxLength={120}
              placeholder="e.g. GCash ref no. or sender name"
            />
          </div>
          <div>
            <Label htmlFor="payment-received-at">Received (optional)</Label>
            <Input
              id="payment-received-at"
              name="receivedAt"
              type="datetime-local"
            />
            <p className="mt-1 text-xs text-ink/45">
              Leave blank for right now. Times use the property&apos;s timezone.
            </p>
          </div>
          <FieldError message={state.error} />
          <Button type="submit" variant="clay" disabled={pending}>
            {pending ? "Recording…" : "Record payment"}
          </Button>
        </form>
      )}
    </div>
  );
}

const PAYMENT_ALLOCATIONS = ["booking", "security_deposit"] as const;
const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;
