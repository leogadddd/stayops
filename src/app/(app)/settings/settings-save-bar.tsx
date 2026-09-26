"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";

/** A persistent save affordance for long settings forms. Render inside a form. */
export function SettingsSaveBar({
  visible,
  pending,
  error,
  label = "Save changes",
}: {
  visible: boolean;
  pending: boolean;
  error?: string;
  label?: string;
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-pine/15 bg-card/95 px-4 py-3 shadow-xl shadow-ink/15 backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-medium text-pine">{pending ? "Saving changes…" : "You have unsaved changes"}</p>
          <FieldError message={error} />
        </div>
        <Button type="submit" variant="clay" disabled={pending} className="shrink-0">
          <Save className="h-4 w-4" aria-hidden />
          {pending ? "Saving…" : label}
        </Button>
      </div>
    </div>
  );
}
