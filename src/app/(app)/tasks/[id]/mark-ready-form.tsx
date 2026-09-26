"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { markTaskReadyAction, type TaskFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import type { RoleKey } from "@/lib/permissions";

export function MarkReadyForm({
  taskId,
  canMarkReady,
  openDamageCount,
  actorRole,
}: {
  taskId: string;
  canMarkReady: boolean;
  openDamageCount: number;
  actorRole: RoleKey;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    async (previous, formData) => {
      const result = await markTaskReadyAction(taskId, previous, formData);
      if (result.success) {
        toast.success("Unit marked ready.");
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
        Unit marked ready for the next guest.
      </p>
    );
  }

  if (!canMarkReady && openDamageCount === 0) {
    return (
      <p className="text-sm text-ink/60">
        Complete every required item first — then you can mark the unit ready.
      </p>
    );
  }

  const ownerCanOverride = actorRole === "owner";

  return (
    <form action={formAction} className="space-y-3">
      {!canMarkReady ? (
        <div>
          <Label htmlFor="override-reason">
            {ownerCanOverride
              ? "Damage is still open. Why mark ready anyway?"
              : "Reason (owner only)"}
          </Label>
          <Textarea
            id="override-reason"
            name="overrideReason"
            required={ownerCanOverride}
            minLength={2}
            maxLength={500}
            disabled={!ownerCanOverride}
            placeholder="e.g. Broken shelf scheduled for repair after the next checkout."
            className="min-h-16"
          />
          {!ownerCanOverride ? (
            <p className="mt-1 text-xs text-ink/50">
              Only the owner can mark a unit ready while damage is open.
            </p>
          ) : null}
        </div>
      ) : null}
      <FieldError message={state.error} />
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          variant="clay"
          disabled={pending || (!canMarkReady && !ownerCanOverride)}
        >
          {pending ? "Marking ready…" : canMarkReady ? "Mark unit ready" : "Mark ready anyway"}
        </Button>
        <Link href={`/tasks/${taskId}`} className="text-sm text-pine hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
