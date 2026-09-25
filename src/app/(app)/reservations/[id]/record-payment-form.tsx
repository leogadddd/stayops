"use client";

import { useActionState, useState, type ReactNode } from "react";
import { BedDouble, CheckCircle2, CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FieldError, Input, Label } from "@/components/ui/input";
import { formatPHP } from "@/lib/money";
import { recordPaymentAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";
import { AmountField, ChoiceCard, MethodPicker, parseAmount, Progress, type PaymentMethod } from "./money-inputs";

type Allocation = "booking" | "security_deposit";

/** What the ledger already holds, so the form can suggest amounts and show what's left. */
export interface PaymentAmounts {
  bookingTotalCents: number;
  /** Net of booking refunds. */
  bookingPaidCents: number;
  depositTotalCents: number;
  /** Deposit collected so far, net of deposit refunds. */
  depositPaidCents: number;
}

function progressLabel(remaining: number, total: number) {
  return remaining > 0 ? `${formatPHP(remaining)} left of ${formatPHP(total)}` : total > 0 ? `Fully paid · ${formatPHP(total)}` : "Nothing due";
}

export function RecordPaymentForm({ reservationId, depositRequired = true, amounts, timeZone = "Asia/Manila" }: {
  reservationId: string;
  /** Without a deposit on the reservation, payments can only go towards the booking. */
  depositRequired?: boolean;
  amounts?: PaymentAmounts;
  timeZone?: string;
}) {
  const save = useReservationSaved(recordPaymentAction.bind(null, reservationId), reservationId, "Payment recorded.");
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const bookingRemaining = amounts ? Math.max(0, amounts.bookingTotalCents - amounts.bookingPaidCents) : 0;
  const depositRemaining = amounts ? Math.max(0, amounts.depositTotalCents - amounts.depositPaidCents) : 0;
  const [allocation, setAllocation] = useState<Allocation>(() => (bookingRemaining === 0 && depositRequired && depositRemaining > 0 ? "security_deposit" : "booking"));
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [amountInput, setAmountInput] = useState("");

  const total = amounts ? (allocation === "booking" ? amounts.bookingTotalCents : amounts.depositTotalCents) : 0;
  const remaining = allocation === "booking" ? bookingRemaining : depositRemaining;
  const amountCents = parseAmount(amountInput);
  const invalidAmount = amountInput.trim() !== "" && amountCents === null;

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Payment recorded. Returning to reservation…
      </p>
    );
  }

  let details: ReactNode;
  if (invalidAmount) details = <span className="text-clay-deep">Enter an amount like 3000 or 3,000.50.</span>;
  else if (!amounts || amountCents === null) details = <span className="text-ink/55">{amounts && total > 0 ? `${formatPHP(remaining)} still due of ${formatPHP(total)}.` : "Enter the amount you received."}</span>;
  else if (amountCents > remaining) details = <span className="flex items-center gap-1.5 text-amber-800"><TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{formatPHP(amountCents - remaining)} more than what’s due. It will show as overpaid.</span>;
  else if (amountCents === remaining) details = <span className="flex items-center gap-1.5 font-medium text-pine"><CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />Pays it in full.</span>;
  else details = <span className="text-ink/65">{formatPHP(remaining - amountCents)} will still be due after this payment.</span>;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Towards</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="allocation" value="booking" checked={allocation === "booking"} onSelect={() => setAllocation("booking")} icon={BedDouble} title="Booking payment">
            {amounts ? <Progress label={progressLabel(bookingRemaining, amounts.bookingTotalCents)} share={amounts.bookingTotalCents ? amounts.bookingPaidCents / amounts.bookingTotalCents : 0} /> : null}
          </ChoiceCard>
          <ChoiceCard name="allocation" value="security_deposit" checked={allocation === "security_deposit"} onSelect={() => setAllocation("security_deposit")} icon={ShieldCheck} title="Security deposit" disabled={!depositRequired}>
            {!depositRequired ? <span className="text-xs text-ink/50">No deposit on this booking</span> : amounts ? <Progress label={progressLabel(depositRemaining, amounts.depositTotalCents)} share={amounts.depositTotalCents ? amounts.depositPaidCents / amounts.depositTotalCents : 0} /> : null}
          </ChoiceCard>
        </div>
      </fieldset>

      <AmountField id="payment-amount" name="amountPesos" label="Amount received" value={amountInput} onChange={setAmountInput} base={total} picks={remaining !== total ? [{ label: "Remaining", cents: remaining }] : []} invalid={invalidAmount} details={details} />

      <MethodPicker legend="Method" value={method} onChange={setMethod} />

      <div>
        <Label htmlFor="payment-reference">Reference (optional)</Label>
        <Input id="payment-reference" name="reference" maxLength={120} placeholder={method === "cash" ? "e.g. Received by front desk" : "e.g. GCash ref no. or sender name"} />
      </div>

      <DateTimeInput name="receivedAt" label="Received" timeZone={timeZone} hint="Use this when you’re recording it as it arrives." />

      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" disabled={pending || invalidAmount} className="w-full">
        {pending ? "Recording…" : amountCents ? `Record ${formatPHP(amountCents)} payment` : "Record payment"}
      </Button>
    </form>
  );
}
