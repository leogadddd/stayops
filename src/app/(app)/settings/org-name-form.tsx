"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { renameOrganization, type OrgFormState } from "./actions";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { SettingsSaveBar } from "./settings-save-bar";

export function OrgNameForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    renameOrganization,
    {},
  );
  useActionFeedback(state, { success: "Organization name updated." });
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);
  const saveBarVisible = dirty || pending || Boolean(state.error);

  return (
    <form
      action={formAction}
      onChange={(event) =>
        setDirty(
          String(new FormData(event.currentTarget).get("name") ?? "") !==
            defaultName,
        )
      }
      onSubmit={() => setDirty(false)}
      className={saveBarVisible ? "space-y-4" : "space-y-4"}
    >
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
      </div>
      <SettingsSaveBar
        visible={saveBarVisible}
        pending={pending}
        error={state.error}
        label="Save name"
      />
    </form>
  );
}
