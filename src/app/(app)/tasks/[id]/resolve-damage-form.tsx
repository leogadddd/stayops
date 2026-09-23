"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { resolveDamageReportAction, type DamageFormState } from "../actions";

export function ResolveDamageForm({ damageReportId }: { damageReportId: string }) {
  const [state, formAction, pending] = useActionState<DamageFormState, FormData>(
    resolveDamageReportAction.bind(null, damageReportId),
    {},
  );

  if (state.success) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        Resolved.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <div>
        <Label htmlFor={`resolve-note-${damageReportId}`}>How was it resolved?</Label>
        <Textarea
          id={`resolve-note-${damageReportId}`}
          name="resolutionNote"
          required
          minLength={2}
          maxLength={500}
          placeholder="e.g. Replaced the sheet set; cost deducted from deposit."
          className="min-h-14"
        />
      </div>
      <div>
        <Label htmlFor={`resolve-actual-${damageReportId}`}>
          Actual cost (₱, optional)
        </Label>
        <Input
          id={`resolve-actual-${damageReportId}`}
          name="actualAmountPesos"
          inputMode="decimal"
          placeholder="e.g. 1,200"
        />
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Resolving…" : "Mark resolved"}
      </Button>
    </form>
  );
}
