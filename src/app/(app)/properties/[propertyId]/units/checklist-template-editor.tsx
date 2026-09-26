"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import {
  updateChecklistTemplateAction,
  type InventoryFormState,
} from "../../actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useSaveAndReturn } from "@/hooks/use-save-and-return";

interface TemplateRow {
  label: string;
  required: boolean;
}

export function ChecklistTemplateEditor({
  propertyId,
  unitId,
  items,
}: {
  propertyId: string;
  unitId: string;
  items: TemplateRow[];
}) {
  const save = useSaveAndReturn(
    updateChecklistTemplateAction.bind(null, propertyId, unitId),
    `/properties/${propertyId}/units/${unitId}`,
    "Turnover checklist updated.",
  );
  const [state, formAction, pending] = useActionState<InventoryFormState, FormData>(save, {});
  useActionFeedback(state);
  const [rows, setRows] = useState<TemplateRow[]>(items);

  const updateRow = (index: number, patch: Partial<TemplateRow>) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
  };

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="templateJson" value={JSON.stringify(rows)} />
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              aria-label={`Checklist item ${index + 1}`}
              value={row.label}
              onChange={(event) => updateRow(index, { label: event.target.value })}
              maxLength={120}
              className="flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink/60">
              <input
                type="checkbox"
                checked={row.required}
                onChange={(event) =>
                  updateRow(index, { required: event.target.checked })
                }
                className="h-4 w-4 accent-pine"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
              aria-label={`Remove item ${index + 1}`}
              className="rounded-lg p-1.5 text-ink/40 hover:bg-clay-mist/60 hover:text-clay-deep disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((current) => [...current, { label: "", required: true }])}
        disabled={rows.length >= 30}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add item
      </Button>
      <FieldError message={state.error} />
      <Button type="submit" variant="clay" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? "Saving…" : "Save checklist"}
      </Button>
    </form>
  );
}
