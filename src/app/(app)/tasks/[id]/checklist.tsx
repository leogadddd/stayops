"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { setTaskItemCompletedAction } from "../actions";

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export function Checklist({
  taskId,
  items,
  editable,
}: {
  taskId: string;
  items: ChecklistItem[];
  editable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (item: ChecklistItem) => {
    setError(null);
    startTransition(async () => {
      const result = await setTaskItemCompletedAction(
        taskId,
        item.id,
        !item.completed,
      );
      if (result.error) {
        setError(result.error);
        toast.error("Checklist wasn’t updated", { description: result.error });
        return;
      }
      toast.success(item.completed ? "Checklist item reopened." : "Checklist item completed.");
    });
  };

  return (
    <div>
      <ul className="space-y-1">
        {items.map((item) => {
          const row = (
            <>
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-sage" aria-hidden />
              ) : (
                <Circle
                  className={`h-5 w-5 shrink-0 ${item.required ? "text-clay" : "text-pine/30"}`}
                  aria-hidden
                />
              )}
              <span
                className={
                  item.completed
                    ? "text-ink/50 line-through"
                    : item.required
                      ? "text-pine"
                      : "text-ink/70"
                }
              >
                {item.label}
                {item.required ? "" : " (optional)"}
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {editable ? (
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  disabled={pending}
                  aria-pressed={item.completed}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-pine-mist/50 disabled:opacity-60"
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-2 py-2 text-sm">
                  {row}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="mt-2 text-sm text-clay-deep" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
