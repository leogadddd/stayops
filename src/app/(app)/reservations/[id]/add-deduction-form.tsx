"use client";

import { useActionState, useState, type ReactNode } from "react";
import { CheckCircle2, CircleCheck, FileWarning, ShieldCheck, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { formatPHP } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addDeductionAction, type PaymentFormState } from "./payment-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useReservationSaved } from "./use-reservation-saved";
import { AmountField, ChoiceCard, parseAmount } from "./money-inputs";

interface DamageOption {
  id: string;
  description: string;
}

const REASONS = ["Damaged item", "Missing item", "Extra cleaning", "Late checkout", "House rules broken"];

export function AddDeductionForm({
  reservationId,
  damageReports = [],
  depositHeldCents,
}: {
  reservationId: string;
  damageReports?: DamageOption[];
  /** Deposit still held; a deduction can't take more than this. */
  depositHeldCents?: number;
}) {
  const save = useReservationSaved(addDeductionAction.bind(null, reservationId), reservationId, "Deposit deduction recorded.");
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(save, {});
  useActionFeedback(state);

  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [damageReportId, setDamageReportId] = useState("");

  const held = depositHeldCents ?? 0;
  const known = depositHeldCents !== undefined;
  const amountCents = parseAmount(amountInput);
  const invalidAmount = amountInput.trim() !== "" && amountCents === null;
  // The server refuses deductions above the deposit held; stop it here first.
  const tooMuch = known && amountCents !== null && amountCents > held;

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Deduction recorded. Returning to reservation…
      </p>
    );
  }

  let details: ReactNode;
  if (invalidAmount) details = <span className="text-clay-deep">Enter an amount like 800 or 800.50.</span>;
  else if (tooMuch) details = <span className="text-clay-deep">That’s more than the deposit held. You can keep up to {formatPHP(held)}.</span>;
  else if (!known || amountCents === null) details = <span className="text-ink/55">{known ? `${formatPHP(held)} of deposit is held for this stay.` : "Enter the amount kept from the deposit."}</span>;
  else if (amountCents === held) details = <span className="flex items-center gap-1.5 font-medium text-pine"><CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />Keeps the whole deposit. Nothing goes back to the guest.</span>;
  else details = <span className="text-ink/65">{formatPHP(held - amountCents)} of the deposit is left to return to the guest.</span>;

  return (
    <form action={formAction} className="space-y-6">
      {known ? (
        <div className="flex items-center gap-3 rounded-xl bg-linen p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sage/60 text-pine"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Deposit held</p>
            <p className="font-display text-xl text-pine">{formatPHP(held)}</p>
          </div>
        </div>
      ) : null}

      <AmountField id="deduction-amount" name="amountPesos" label="Amount kept from deposit" value={amountInput} onChange={setAmountInput} base={held} invalid={invalidAmount || tooMuch} details={details} />

      <div>
        <Label htmlFor="deduction-reason">What is it for?</Label>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Common reasons">
          {REASONS.map((option) => (
            <button key={option} type="button" onClick={() => setReason(option)} aria-pressed={reason === option} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", reason === option ? "border-pine bg-pine text-white" : "border-pine/15 text-pine hover:border-pine/35")}>
              {option}
            </button>
          ))}
        </div>
        <Textarea id="deduction-reason" name="reason" required minLength={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Stained linens, replacement cost." className="min-h-20" />
        <p className="mt-1 text-xs text-ink/50">Shown with the deduction in the payment history.</p>
      </div>

      {damageReports.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Link to a damage report (optional)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard name="damageReportId" value="" checked={damageReportId === ""} onSelect={() => setDamageReportId("")} icon={Unlink} title="No link" />
            {damageReports.map((report) => (
              <ChoiceCard key={report.id} name="damageReportId" value={report.id} checked={damageReportId === report.id} onSelect={() => { setDamageReportId(report.id); if (!reason) setReason(report.description); }} icon={FileWarning} title={report.description} />
            ))}
          </div>
        </fieldset>
      ) : null}

      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" disabled={pending || invalidAmount || tooMuch} className="w-full">
        {pending ? "Recording…" : amountCents && !tooMuch ? `Keep ${formatPHP(amountCents)} from deposit` : "Record deduction"}
      </Button>
    </form>
  );
}
