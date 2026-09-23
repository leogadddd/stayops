"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Save } from "lucide-react";
import { renameOrganization, type OrgFormState } from "./actions";

export function OrgNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    renameOrganization,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-3">
      <div className="min-w-56 flex-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          required
          minLength={2}
          maxLength={80}
        />
        <FieldError message={state.error} />
        {state.success ? (
          <p className="mt-1.5 text-sm text-pine" role="status">
            Saved.
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        <Save className="h-4 w-4" aria-hidden />
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
