"use client";

import { useActionState, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveProfile, type ProfileFormState } from "./actions";
import { SettingsSaveBar } from "../settings-save-bar";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(saveProfile, {});
  const [dirty, setDirty] = useState(false);
  useActionFeedback(state, { success: "Profile updated." });
  const saveBarVisible = dirty || pending || Boolean(state.error);
  return (
    <form
      action={formAction}
      onChange={(event) =>
        setDirty(new FormData(event.currentTarget).get("name") !== name)
      }
      onSubmit={() => setDirty(false)}
      className={saveBarVisible ? "space-y-5" : "space-y-5"}
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={80}
          required
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="mt-1.5 text-xs text-ink/50">
          Email changes are not available yet.
        </p>
      </div>
      <SettingsSaveBar
        visible={saveBarVisible}
        pending={pending}
        error={state.error}
      />
    </form>
  );
}
