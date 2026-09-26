"use client";

import { DateInput } from "@/components/ui/date-input";
import { addDaysLocal } from "@/lib/dates";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { addUnitBlockAction, removeUnitBlockAction, updateUnitBlockAction, type BlockFormState } from "./block-actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";

export function BlockForms({ propertyId, unitId, block }: {
  propertyId: string;
  unitId: string;
  /** Present → edit this block; absent → add a new one. */
  block?: { id: string; startDate: string; endDate: string; reason: string };
}) {
  const save = useSaveAndReturn(
    block
      ? updateUnitBlockAction.bind(null, propertyId, unitId, block.id)
      : addUnitBlockAction.bind(null, propertyId, unitId),
    `/properties/${propertyId}/units/${unitId}`,
    block ? "Blocked period updated." : "Blocked period added.",
  );
  const [state, formAction, pending] = useActionState<BlockFormState, FormData>(save, {});
  useActionFeedback(state);
  const [startDate, setStartDate] = useState(block?.startDate ?? "");
  const [endDate, setEndDate] = useState(block?.endDate ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-ink/60">The end date is exclusive: a block from September 5 to 7 covers the nights of the 5th and 6th.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="block-start">Start date (first blocked night)</Label>
          <DateInput
            id="block-start"
            name="startDate"
            value={startDate}
            onChange={(next) => {
              setStartDate(next);
              if (next && endDate <= next) setEndDate(addDaysLocal(next, 1));
            }}
            required
          />
        </div>
        <div>
          <Label htmlFor="block-end">End date (first bookable night)</Label>
          <DateInput
            id="block-end"
            name="endDate"
            value={endDate}
            min={startDate ? addDaysLocal(startDate, 1) : undefined}
            onChange={setEndDate}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="block-reason">Reason (shown on the calendar)</Label>
        <Input id="block-reason" name="reason" defaultValue={block?.reason} required minLength={2} maxLength={200} placeholder="AC repair, repainting, deep clean…" />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" className="w-full" disabled={pending}>{pending ? "Saving…" : block ? "Save changes" : "Add block"}</Button>
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
