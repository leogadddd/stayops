"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { addUnitBlockAction, removeUnitBlockAction, type BlockFormState } from "./block-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";

export function BlockForms({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const save = useSaveAndReturn(
    addUnitBlockAction.bind(null, propertyId, unitId),
    `/properties/${propertyId}/units/${unitId}`,
    "Blocked period added.",
  );
  const [state, formAction, pending] = useActionState<BlockFormState, FormData>(save, {});
  useActionFeedback(state);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink/60">The end date is exclusive: a block from September 5 to 7 covers the nights of the 5th and 6th.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="block-start">Start date (first blocked night)</Label>
          <Input id="block-start" name="startDate" type="date" required />
        </div>
        <div>
          <Label htmlFor="block-end">End date (first bookable night)</Label>
          <Input id="block-end" name="endDate" type="date" required />
        </div>
      </div>
      <div>
        <Label htmlFor="block-reason">Reason (shown on the calendar)</Label>
        <Input id="block-reason" name="reason" required minLength={2} maxLength={200} placeholder="AC repair, repainting, deep clean…" />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" className="w-full" disabled={pending}>{pending ? "Adding…" : "Add block"}</Button>
    </form>
  );
}

export function RemoveBlockButton({ propertyId, unitId, blockId, label }: { propertyId: string; unitId: string; blockId: string; label: string }) {
  return (
    <ConfirmationDialog
      title="Remove this blocked period?"
      description={`${label} will become bookable again unless another hold, reservation, or block covers those nights.`}
      confirmLabel="Remove block"
      successMessage="Blocked period removed."
      onConfirm={() => removeUnitBlockAction(propertyId, unitId, blockId)}
      trigger="Remove"
      triggerSize="sm"
      triggerAriaLabel={`Remove block ${label}`}
    />
  );
}
