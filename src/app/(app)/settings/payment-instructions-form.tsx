"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { savePaymentInstructions, type OrgFormState } from "./actions";

export function PaymentInstructionsForm({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    savePaymentInstructions,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push("/settings");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction}>
      <Label htmlFor="paymentInstructions">
        Payment instructions shown to guests
      </Label>
      <Textarea
        id="paymentInstructions"
        name="paymentInstructions"
        defaultValue={defaultValue}
        maxLength={2000}
        placeholder={
          "e.g. Send GCash to 0917 000 0000 (Juan D.), then reply with the reference number."
        }
      />
      <p className="mt-1.5 text-xs text-ink/50">
        Guests see this on their private booking page — include account names
        and numbers for GCash, Maya or bank transfer.
      </p>
      <FieldError message={state.error} />
      {state.success ? (
        <p className="mt-1.5 text-sm text-pine" role="status">
          Saved.
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-3">
        <Save className="h-4 w-4" aria-hidden />
        {pending ? "Saving…" : "Save instructions"}
      </Button>
    </form>
  );
}
