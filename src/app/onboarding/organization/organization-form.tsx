"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveOrganizationAction, type OnboardingFormState } from "../actions";
import { StepNav } from "../step-nav";

export function OrganizationForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<OnboardingFormState, FormData>(
    saveOrganizationAction,
    {},
  );
  useActionFeedback(state, { errorTitle: "Couldn’t save your business name" });
  const router = useRouter();
  useEffect(() => {
    if (!state.success) return;
    router.push("/onboarding/property");
    router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction}>
      <Label htmlFor="name">Business name</Label>
      <Input
        id="name"
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={defaultName}
        placeholder="e.g. Dela Cruz Stays"
        autoFocus
        className="h-12 px-4 text-base"
      />
      <FieldError message={state.error} />

      <StepNav backHref="/onboarding">
        <Button type="submit" variant="clay" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Next"}
          {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </StepNav>
    </form>
  );
}
