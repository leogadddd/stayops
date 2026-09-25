"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveFirstUnitAction, type OnboardingFormState } from "../actions";
import { StepNav } from "../step-nav";

export function UnitForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<OnboardingFormState, FormData>(
    saveFirstUnitAction,
    {},
  );
  useActionFeedback(state, { errorTitle: "Couldn’t save the unit" });
  const router = useRouter();
  useEffect(() => {
    if (!state.success) return;
    router.push("/onboarding/welcome");
    router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction}>
      <Label htmlFor="name">Unit name</Label>
      <Input
        id="name"
        name="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={defaultName}
        placeholder="e.g. Unit 12B"
        autoFocus
        className="h-12 px-4 text-base"
      />
      <FieldError message={state.error} />

      <StepNav backHref="/onboarding/property">
        <Link href="/onboarding/welcome" className={buttonClassName("ghost", "lg")}>
          Skip for now
        </Link>
        <Button type="submit" variant="clay" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Next"}
          {pending ? null : <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </StepNav>
    </form>
  );
}
