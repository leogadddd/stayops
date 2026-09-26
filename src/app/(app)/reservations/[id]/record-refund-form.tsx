"use client";

import { useActionState, useState, type ReactNode } from "react";
import { BedDouble, CheckCircle2, CircleCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { recordRefundAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";
import { AmountField, ChoiceCard, MethodPicker, parseAmount, Progress, type PaymentMethod } from "./money-inputs";

type Allocation = "booking" | "security_deposit";

/** How much of each source can still go back to the guest. */
export interface RefundAmounts {
  /** Booking payments received, net of booking refunds already made. */
  bookingRefundableCents: number;
  bookingPaidCents: number;
  /** Deposit collected and still held (net of refunds and deductions). */
  depositHeldCents: number;
  depositPaidCents: number;
}

const REASONS: Record<Allocation, string[]> = {
  booking: ["Guest cancelled", "Overpayment", "Shortened stay", "Goodwill gesture"],
  security_deposit: ["Deposit returned after checkout", "Deposit returned in full", "Partial deposit return"],
};

export function RecordRefundForm({ reservationId, canRefundBooking = true, canRefundDeposit = true, amounts }: {
  reservationId: string;
  /** Only money actually received can be refunded; the other source is disabled. */
  canRefundBooking?: boolean;
  canRefundDeposit?: boolean;
  amounts?: RefundAmounts;
}) {
  const save = useReservationSaved(recordRefundAction.bind(null, reservationId), reservationId, "Refund recorded.");
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state);

  const [allocation, setAllocation] = useState<Allocation>(canRefundBooking || !canRefundDeposit ? "booking" : "security_deposit");
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");

  const refundable = amounts ? (allocation === "booking" ? amounts.bookingRefundableCents : amounts.depositHeldCents) : 0;
  const amountCents = parseAmount(amountInput);
  const invalidAmount = amountInput.trim() !== "" && amountCents === null;
  // The server refuses refunds above what was received; stop it here first.
  const tooMuch = Boolean(amounts && amountCents !== null && amountCents > refundable);

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Refund recorded. Returning to reservation…
      </p>
    );
  }

  const source = allocation === "booking" ? "the booking payments received" : "the deposit held";
  let details: ReactNode;
  if (invalidAmount) details = <span className="text-clay-deep">Enter an amount like 1000 or 1,000.50.</span>;
  else if (tooMuch) details = <span className="text-clay-deep">That’s more than {source}. You can refund up to {formatPHP(refundable)}.</span>;
  else if (!amounts || amountCents === null) details = <span className="text-ink/55">{amounts ? `Up to ${formatPHP(refundable)} can be refunded from ${source}.` : "Enter the amount you returned."}</span>;
  else if (amountCents === refundable) details = <span className="flex items-center gap-1.5 font-medium text-pine"><CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />Refunds all of {source}.</span>;
  else details = <span className="text-ink/65">{formatPHP(refundable - amountCents)} of {source} stays with you after this refund.</span>;

  return (
    <form action={formAction} className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Refund from</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard name="allocation" value="booking" checked={allocation === "booking"} onSelect={() => setAllocation("booking")} icon={BedDouble} title="Booking payment" disabled={!canRefundBooking}>
            {!canRefundBooking ? <span className="text-xs text-ink/50">Nothing paid yet</span> : amounts ? <Progress label={`${formatPHP(amounts.bookingRefundableCents)} refundable of ${formatPHP(amounts.bookingPaidCents)} paid`} share={amounts.bookingPaidCents ? amounts.bookingRefundableCents / amounts.bookingPaidCents : 0} /> : null}
          </ChoiceCard>
          <ChoiceCard name="allocation" value="security_deposit" checked={allocation === "security_deposit"} onSelect={() => setAllocation("security_deposit")} icon={ShieldCheck} title="Security deposit" disabled={!canRefundDeposit}>
            {!canRefundDeposit ? <span className="text-xs text-ink/50">No deposit held</span> : amounts ? <Progress label={`${formatPHP(amounts.depositHeldCents)} held of ${formatPHP(amounts.depositPaidCents)} collected`} share={amounts.depositPaidCents ? amounts.depositHeldCents / amounts.depositPaidCents : 0} /> : null}
          </ChoiceCard>
        </div>
      </fieldset>

      <AmountField id="refund-amount" name="amountPesos" label="Amount refunded" value={amountInput} onChange={setAmountInput} base={refundable} invalid={invalidAmount || tooMuch} details={details} />

      <MethodPicker legend="Returned via" value={method} onChange={setMethod} />

      <div>
        <Label htmlFor="refund-reason">Reason</Label>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Common reasons">
          {REASONS[allocation].map((option) => (
            <button key={option} type="button" onClick={() => setReason(option)} aria-pressed={reason === option} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", reason === option ? "border-primary bg-primary text-white" : "border-pine/15 text-pine hover:border-pine/35")}>
              {option}
            </button>
          ))}
        </div>
        <Textarea id="refund-reason" name="reason" required minLength={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Guest cancelled, full refund per policy." className="min-h-20" />
        <p className="mt-1 text-xs text-ink/50">Shown in the payment history. Refunds are recorded with the current time.</p>
      </div>

      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" disabled={pending || invalidAmount || tooMuch} className="w-full">
        {pending ? "Recording…" : amountCents && !tooMuch ? `Record ${formatPHP(amountCents)} refund` : "Record refund"}
      </Button>
    </form>
  );
}
