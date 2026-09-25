"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/input";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveOrganizationRegion, type OrgFormState } from "./actions";
import { SettingsSaveBar } from "./settings-save-bar";

export function RegionForm({ defaultTimezone }: { defaultTimezone: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    saveOrganizationRegion,
    {},
  );
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState(defaultTimezone);
  const [savedTimezone, setSavedTimezone] = useState(defaultTimezone);
  useActionFeedback(state, { success: "Region updated." });
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);
  const saveBarVisible = dirty || pending || Boolean(state.error);

  return (
    <form action={formAction} onSubmit={() => { setDirty(false); setSavedTimezone(selectedTimezone); }} className={saveBarVisible ? "space-y-6 pb-24" : "space-y-6"}>
      <div>
        <Label htmlFor="defaultTimezone">Organization timezone</Label>
        <TimezonePicker
          id="defaultTimezone"
          name="defaultTimezone"
          defaultValue={defaultTimezone}
          required
          onValueChange={(timezone) => {
            setSelectedTimezone(timezone);
            setDirty(timezone !== savedTimezone);
          }}
        />
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          Used for organization-wide timestamps and as the default when you
          create a property. Properties retain their own timezone for calendars,
          stays, and operations.
        </p>
      </div>
      <SettingsSaveBar visible={saveBarVisible} pending={pending} error={state.error} />
    </form>
  );
}
