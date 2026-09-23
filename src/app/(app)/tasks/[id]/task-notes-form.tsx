"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Textarea } from "@/components/ui/input";
import { updateTaskNotesAction, type TaskFormState } from "../actions";

export function TaskNotesForm({
  taskId,
  notes,
  editable,
}: {
  taskId: string;
  notes: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    updateTaskNotesAction.bind(null, taskId),
    {},
  );

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
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save notes"}
        </Button>
      )}
    </form>
  );
}
