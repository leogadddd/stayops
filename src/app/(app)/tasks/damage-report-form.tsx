"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { createDamageReportAction, type DamageFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function DamageReportForm({
  unitId,
  reservationId,
  returnHref,
}: {
  unitId: string;
  reservationId?: string;
  returnHref?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<DamageFormState, FormData>(
    async (previous, formData) => {
      const result = await createDamageReportAction(unitId, reservationId, previous, formData);
      if (result.success && returnHref) {
        toast.success("Damage report created.");
        router.push(returnHref);
        router.refresh();
      }
      return result;
    },
    {},
  );
  useActionFeedback(state, { success: returnHref ? undefined : "Damage report created." });

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Damage reported. It stays open until resolved.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor={reservationId ? "damage-description" : `damage-description-${unitId}`}>
          What was damaged?
        </Label>
        <Textarea
          id={reservationId ? "damage-description" : `damage-description-${unitId}`}
          name="description"
          required
          minLength={2}
          maxLength={1000}
          placeholder="e.g. Stained bedsheet, burn mark on the nightstand."
          className="min-h-16"
        />
      </div>
      <div>
        <Label htmlFor={reservationId ? "damage-estimate" : `damage-estimate-${unitId}`}>
          Estimated cost (₱, optional)
        </Label>
        <Input
          id={reservationId ? "damage-estimate" : `damage-estimate-${unitId}`}
          name="estimatedAmountPesos"
          inputMode="decimal"
          placeholder="e.g. 1,500"
        />
      </div>
      <FieldError message={state.error} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="clay" disabled={pending}>
          {pending ? "Reporting…" : "Report damage"}
        </Button>
        {returnHref ? <Link href={returnHref} className="text-sm text-pine hover:underline">Cancel</Link> : null}
      </div>
    </form>
  );
}
