"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { UNIT_STATUSES, type UnitStatus } from "@/lib/db/schema";
import { UNIT_STATUS_DESCRIPTIONS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";
import { updateUnitStatusAction, type InventoryFormState } from "../../actions";

export function UnitStatusForm({
  propertyId,
  unitId,
  current,
}: {
  propertyId: string;
  unitId: string;
  current: UnitStatus;
}) {
  const save = useSaveAndReturn(
    updateUnitStatusAction.bind(null, propertyId, unitId),
    `/properties/${propertyId}/units/${unitId}`,
    "Unit status updated.",
  );
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(save, {});
  useActionFeedback(state);
  const [status, setStatus] = useState<UnitStatus>(current);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset>
        <legend className="sr-only">Unit status</legend>
        <div className="space-y-2">
          {UNIT_STATUSES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                status === value
                  ? "border-pine bg-pine-mist/60"
                  : "border-pine/12 hover:border-pine/30",
              )}
            >
              <input
                type="radio"
                name="status"
                value={value}
                checked={status === value}
                onChange={() => setStatus(value)}
                className="mt-1 accent-pine"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-pine">
                  {UNIT_STATUS_LABELS[value]}
                  {value === current ? <span className="font-normal text-ink/45"> · current</span> : null}
                </span>
                <span className="block text-xs text-ink/55">{UNIT_STATUS_DESCRIPTIONS[value]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" className="w-full" disabled={pending || status === current}>
        {pending ? "Saving…" : "Save status"}
      </Button>
    </form>
  );
}
