"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { addUnitBlockAction, removeUnitBlockAction, type BlockFormState } from "./block-actions";

export function BlockForms({ propertyId, unitId }: { propertyId: string; unitId: string }) {
  const [state, formAction, pending] = useActionState<BlockFormState, FormData>(
    addUnitBlockAction.bind(null, propertyId, unitId),
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push(`/settings/properties/${propertyId}/units/${unitId}`);
      router.refresh();
    }
  }, [state.success, propertyId, unitId, router]);

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
      {state.success ? <p className="text-sm text-pine" role="status">Block added.</p> : null}
      <Button type="submit" variant="clay" disabled={pending}>{pending ? "Adding…" : "Add block"}</Button>
    </form>
  );
}

export function RemoveBlockButton({ propertyId, unitId, blockId, label }: { propertyId: string; unitId: string; blockId: string; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Remove block ${label}`}
      onClick={() => {
        if (window.confirm(`Remove the out-of-service block for ${label}?`)) {
          startTransition(() => removeUnitBlockAction(propertyId, unitId, blockId));
        }
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
