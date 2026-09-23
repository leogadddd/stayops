"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
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
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg bg-sage/40 p-4 text-sm text-pine" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Reference sent — your host will verify it against their account.
        </p>
        <Link href={`/g/${encodeURIComponent(token)}`} prefetch={false} className={buttonClassName("clay", "md", "w-full")}>Back to your booking</Link>
      </div>
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
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="clay" disabled={pending}>
          {pending ? "Sending…" : "Send reference"}
        </Button>
        <Link href={`/g/${encodeURIComponent(token)}`} prefetch={false} className="text-sm text-pine hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
