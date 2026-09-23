"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  addUnitBlockAction,
  removeUnitBlockAction,
  type BlockFormState,
} from "./block-actions";

export interface BlockListItem {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export function BlockForms({
  propertyId,
  unitId,
  blocks,
}: {
  propertyId: string;
  unitId: string;
  blocks: BlockListItem[];
}) {
  const [state, formAction, pending] = useActionState<BlockFormState, FormData>(
    addUnitBlockAction.bind(null, propertyId, unitId),
    {},
  );
  const [removing, startRemove] = useTransition();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg text-pine">
          Out-of-service blocks
        </h3>
        <p className="mt-1 text-sm text-ink/55">
          Block dates while a unit is being repaired or prepared. The end date
          is exclusive — a block Sep 5–7 covers the nights of the 5th and 6th.
        </p>

        {blocks.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">
            No upcoming blocks. The unit is bookable whenever its status is
            Active.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-pine/10 rounded-xl border border-pine/10">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-pine">
                    {block.startDate} → {block.endDate}
                  </p>
                  <p className="text-sm text-ink/55">{block.reason}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing}
                  onClick={() =>
                    startRemove(() =>
                      removeUnitBlockAction(propertyId, unitId, block.id),
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={formAction} className="space-y-4">
        <h3 className="font-display text-lg text-pine">Add a block</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="block-start">Start date (first blocked night)</Label>
            <Input id="block-start" name="startDate" type="date" required />
          </div>
          <div>
            <Label htmlFor="block-end">
              End date (first bookable night, exclusive)
            </Label>
            <Input id="block-end" name="endDate" type="date" required />
          </div>
        </div>
        <div>
          <Label htmlFor="block-reason">Reason (shown on the calendar)</Label>
          <Input
            id="block-reason"
            name="reason"
            required
            minLength={2}
            maxLength={200}
            placeholder="AC repair, repainting, deep clean…"
          />
        </div>

        <FieldError message={state.error} />
        {state.success ? (
          <p className="text-sm text-pine" role="status">
            Block added.
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add block"}
        </Button>
      </form>
    </div>
  );
}
