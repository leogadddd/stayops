"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveProfile, type ProfileFormState } from "./actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const [dirty, setDirty] = useState(false);
  useActionFeedback(state, { success: "Profile updated." });
  return (
    <form action={formAction} onChange={(event) => setDirty(new FormData(event.currentTarget).get("name") !== name)} className="space-y-5">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name} minLength={2} maxLength={80} required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="mt-1.5 text-xs text-ink/50">Email changes are not available yet.</p>
      </div>
      {dirty || pending || state.error ? <div className="border-t border-pine/10 pt-5"><FieldError message={state.error} /><Button type="submit" variant="clay" disabled={pending}><Save className="h-4 w-4" aria-hidden />{pending ? "Saving…" : "Save changes"}</Button></div> : null}
    </form>
  );
}
