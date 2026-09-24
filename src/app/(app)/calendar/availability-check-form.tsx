"use client";

import { useActionState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/input";
import {
  checkAvailabilityAction,
  type AvailabilityFormState,
} from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export interface AvailabilityUnitOption {
  id: string;
  name: string;
}

export function AvailabilityCheckForm({
  units,
}: {
  units: AvailabilityUnitOption[];
}) {
  const [state, formAction, pending] = useActionState<AvailabilityFormState, FormData>(
    checkAvailabilityAction,
    {},
  );
  useActionFeedback(state, {
    getInformation: (current) => current.result ? {
      type: current.result.available ? "success" : "warning",
      message: current.result.available ? "Unit is available" : "Unit is not available",
      description: current.result.available
        ? `${current.result.unitName} · ${current.result.nights} night${current.result.nights === 1 ? "" : "s"}`
        : `${current.result.unitName} · ${current.result.conflictReason}`,
    } : null,
  });

  return (
    <div className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      <h2 className="font-display text-lg text-pine">Quick availability</h2>
      <form
        action={formAction}
        className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <div>
          <Label htmlFor="check-unit" className="sr-only">
            Unit
          </Label>
          <Select id="check-unit" name="unitId" required defaultValue="">
            <option value="" disabled>
              Choose a unit…
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="check-in" className="sr-only">
            Check-in
          </Label>
          <Input id="check-in" name="checkIn" type="date" required />
        </div>
        <div>
          <Label htmlFor="check-out" className="sr-only">
            Check-out
          </Label>
          <Input id="check-out" name="checkOut" type="date" required />
        </div>
        <Button type="submit" disabled={pending || units.length === 0}>
          <Search className="h-4 w-4" aria-hidden />
          {pending ? "Checking…" : "Check"}
        </Button>
      </form>

      <FieldError message={state.error} />
      {state.result ? (
        <p
          className={
            state.result.available
              ? "mt-3 text-sm font-medium text-pine"
              : "mt-3 text-sm font-medium text-clay-deep"
          }
          role="status"
        >
          {state.result.available
            ? `${state.result.unitName} is available ${state.result.checkIn} → ${state.result.checkOut} (${state.result.nights} night${state.result.nights === 1 ? "" : "s"}).`
            : `${state.result.unitName} is not available ${state.result.checkIn} → ${state.result.checkOut}: ${state.result.conflictReason} (${state.result.conflictRange}).`}
        </p>
      ) : null}
    </div>
  );
}
