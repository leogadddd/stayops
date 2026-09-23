"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Save } from "lucide-react";
import { renameOrganization, type OrgFormState } from "./actions";

export function OrgNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    renameOrganization,
    {},
  );
  const router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.push("/settings");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
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
