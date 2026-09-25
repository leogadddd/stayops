"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/input";
import { TimezonePicker } from "@/components/ui/timezone-picker";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveOrganizationRegion, type OrgFormState } from "./actions";

export function RegionForm({ defaultTimezone }: { defaultTimezone: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    saveOrganizationRegion,
    {},
  );
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  useActionFeedback(state, { success: "Region updated." });
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="defaultTimezone">Organization timezone</Label>
        <TimezonePicker
          id="defaultTimezone"
          name="defaultTimezone"
          defaultValue={defaultTimezone}
          required
          onValueChange={(timezone) => setDirty(timezone !== defaultTimezone)}
        />
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          Used for organization-wide timestamps and as the default when you
          create a property. Properties retain their own timezone for calendars,
          stays, and operations.
        </p>
      </div>
      {dirty || pending || state.error ? <div className="border-t border-pine/10 pt-5"><FieldError message={state.error} /><Button type="submit" variant="clay" disabled={pending}><Save className="h-4 w-4" aria-hidden />{pending ? "Saving…" : "Save changes"}</Button></div> : null}
    </form>
  );
}
