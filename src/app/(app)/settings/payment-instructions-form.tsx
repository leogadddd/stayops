"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label, Textarea } from "@/components/ui/input";
import { savePaymentInstructions, type OrgFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { SettingsSaveBar } from "./settings-save-bar";

export function PaymentInstructionsForm({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    savePaymentInstructions,
    {},
  );
  useActionFeedback(state, { success: "Payment instructions updated." });
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);
  const saveBarVisible = dirty || pending || Boolean(state.error);

  return (
    <form action={formAction} onChange={(event) => setDirty(String(new FormData(event.currentTarget).get("paymentInstructions") ?? "") !== defaultValue)} onSubmit={() => setDirty(false)} className={saveBarVisible ? "pb-24" : undefined}>
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
      <SettingsSaveBar visible={saveBarVisible} pending={pending} error={state.error} label="Save instructions" />
    </form>
  );
}
