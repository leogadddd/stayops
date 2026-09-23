"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import {
  PAYMENT_ALLOCATION_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import {
  dismissProofAction,
  recordProofPaymentAction,
  type PaymentFormState,
} from "./payment-actions";

export interface ProofItem {
  id: string;
  reference: string;
  note: string | null;
  createdAt: Date;
}

const TIME_LABEL = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const PAYMENT_ALLOCATIONS = ["booking", "security_deposit"] as const;
const PAYMENT_METHODS = ["gcash", "maya", "bank_transfer", "cash"] as const;

export function ProofQueue({
  reservationId,
  proofs,
}: {
  reservationId: string;
  proofs: ProofItem[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (proofs.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-ink">
        Payment references waiting for review ({proofs.length})
      </h3>
      <ul className="space-y-3">
        {proofs.map((proof) => (
          <li
            key={proof.id}
            className="rounded-xl border border-pine/15 bg-paper px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-pine">{proof.reference}</p>
                <p className="text-xs text-ink/50">
                  Sent {TIME_LABEL.format(proof.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setOpenId((current) => (current === proof.id ? null : proof.id))
                  }
                >
                  {openId === proof.id ? "Close" : "Record payment"}
                </Button>
                <DismissButton reservationId={reservationId} proofId={proof.id} />
              </div>
            </div>
            {proof.note ? (
              <p className="mt-2 text-xs text-ink/60">{proof.note}</p>
            ) : null}
            {openId === proof.id ? (
              <RecordProofForm
                reservationId={reservationId}
                proofId={proof.id}
                reference={proof.reference}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink/45">
        References are guest-submitted evidence — verify the money arrived in
        your account before recording.
      </p>
    </div>
  );
}

function DismissButton({
  reservationId,
  proofId,
}: {
  reservationId: string;
  proofId: string;
}) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    dismissProofAction.bind(null, reservationId, proofId),
    {},
  );

  if (state.success) return null;

  return (
    <form action={formAction}>
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "Dismissing…" : "Dismiss"}
      </Button>
    </form>
  );
}

function RecordProofForm({
  reservationId,
  proofId,
  reference,
}: {
  reservationId: string;
  proofId: string;
  reference: string;
}) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    recordProofPaymentAction.bind(null, reservationId, proofId),
    {},
  );

  if (state.success) {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Payment recorded and reference marked as used.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-pine/10 pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`proof-${proofId}-amount`}>Amount received (₱)</Label>
          <Input
            id={`proof-${proofId}-amount`}
            name="amountPesos"
            inputMode="decimal"
            required
          />
        </div>
        <div>
          <Label htmlFor={`proof-${proofId}-allocation`}>Towards</Label>
          <Select
            id={`proof-${proofId}-allocation`}
            name="allocation"
            defaultValue="booking"
          >
            {PAYMENT_ALLOCATIONS.map((allocation) => (
              <option key={allocation} value={allocation}>
                {PAYMENT_ALLOCATION_LABELS[allocation]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`proof-${proofId}-method`}>Method</Label>
          <Select id={`proof-${proofId}-method`} name="method" defaultValue="gcash">
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`proof-${proofId}-reference`}>Reference</Label>
          <Input
            id={`proof-${proofId}-reference`}
            name="reference"
            maxLength={120}
            defaultValue={reference}
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Recording…" : "Record against this reference"}
      </Button>
    </form>
  );
}
