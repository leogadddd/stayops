"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { UserPlus, X } from "lucide-react";
import { inviteStaffAction, removeStaffAction, type OrgFormState } from "./actions";

export function InviteStaffForm() {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    inviteStaffAction,
    {},
  );

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-3">
      <div className="min-w-56 flex-1">
        <Label htmlFor="staff-email">Email address</Label>
        <Input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          required
        />
        <FieldError message={state.error} />
        {state.success ? (
          <p className="mt-1.5 text-sm text-pine" role="status">
            Added. They can now sign in and work with your properties.
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        <UserPlus className="h-4 w-4" aria-hidden />
        {pending ? "Adding…" : "Add staff"}
      </Button>
    </form>
  );
}

export function RemoveStaffButton({
  membershipId,
  name,
}: {
  membershipId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() => {
        if (window.confirm(`Remove ${name} from the organization?`)) {
          startTransition(async () => {
            await removeStaffAction(membershipId);
          });
        }
      }}
    >
      <X className="h-4 w-4" aria-hidden />
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
