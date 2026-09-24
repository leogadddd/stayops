"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { updateTaskNotesAction, type TaskFormState } from "../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function TaskNotesForm({
  taskId,
  notes,
  editable,
}: {
  taskId: string;
  notes: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    async (previous, formData) => {
      const result = await updateTaskNotesAction(taskId, previous, formData);
      if (result.success) {
        toast.success("Turnover notes saved.");
        router.push(`/tasks/${taskId}`);
        router.refresh();
      }
      return result;
    },
    {},
  );
  useActionFeedback(state);

  if (!editable) {
    return notes ? (
      <p className="text-sm text-ink/70">{notes}</p>
    ) : (
      <p className="text-sm text-ink/45">No notes.</p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="task-notes">Turnover notes</Label>
        <Textarea
          id="task-notes"
          name="notes"
          maxLength={1000}
          defaultValue={notes}
          placeholder="e.g. Extra deep clean needed; left spare key with guard."
          className="min-h-20"
        />
      </div>
      <FieldError message={state.error} />
      {state.success ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-pine" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Notes saved.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="clay" disabled={pending}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
          <Link href={`/tasks/${taskId}`} className="text-sm text-pine hover:underline">Cancel</Link>
        </div>
      )}
    </form>
  );
}
