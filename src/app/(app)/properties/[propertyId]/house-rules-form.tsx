"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Textarea } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import { updateHouseRulesAction, type InventoryFormState } from "../actions";

export function HouseRulesForm({ propertyId, defaultValue }: { propertyId: string; defaultValue: string }) {
  const save = useSaveAndReturn(
    updateHouseRulesAction.bind(null, propertyId),
    `/properties/${propertyId}`,
    "House rules updated.",
  );
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(save, {});
  useActionFeedback(state);

  return (
    <form action={formAction} className="space-y-4">
      <Textarea
        id="houseRules"
        name="houseRules"
        aria-label="House rules"
        defaultValue={defaultValue}
        maxLength={2000}
        placeholder="No smoking inside. Quiet hours after 10 PM…"
        className="min-h-64 leading-relaxed"
        autoFocus
      />
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save house rules"}
      </Button>
    </form>
  );
}
