"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import {
  submitPaymentProofAction,
  type GuestProofFormState,
} from "./actions";

export function SubmitProofForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<GuestProofFormState, FormData>(
    submitPaymentProofAction.bind(null, token),
    {},
  );

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Reference sent — your host will verify it against their account.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="proof-reference">Reference number or sender name</Label>
        <Input
          id="proof-reference"
          name="reference"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. GCash transaction ref or your full name"
        />
      </div>
      <div>
        <Label htmlFor="proof-note">Note (optional)</Label>
        <Textarea
          id="proof-note"
          name="note"
          maxLength={500}
          placeholder="e.g. Sent ₱3,000 via GCash on Sep 25."
          className="min-h-16"
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send reference"}
      </Button>
    </form>
  );
}
