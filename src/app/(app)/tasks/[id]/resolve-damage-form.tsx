"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { resolveDamageReportAction, type DamageFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function ResolveDamageForm({ taskId, damageReportId }: { taskId: string; damageReportId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<DamageFormState, FormData>(
    async (previous, formData) => {
      const result = await resolveDamageReportAction(taskId, damageReportId, previous, formData);
      if (result.success) {
        toast.success("Damage report resolved.");
        router.push(`/tasks/${taskId}`);
        router.refresh();
      }
      return result;
    },
    {},
  );
  useActionFeedback(state);

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
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="clay" disabled={pending}>
          {pending ? "Resolving…" : "Mark resolved"}
        </Button>
        <Link href={`/tasks/${taskId}`} className="text-sm text-pine hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
