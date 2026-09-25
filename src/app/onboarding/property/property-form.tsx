"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { saveFirstPropertyAction, type OnboardingFormState } from "../actions";
import { StepNav } from "../step-nav";

export function PropertyForm({ defaults }: { defaults: { name: string; address: string } }) {
  const [state, formAction, pending] = useActionState<OnboardingFormState, FormData>(
    saveFirstPropertyAction,
    {},
  );
  useActionFeedback(state, { errorTitle: "Couldn’t save the property" });
  const router = useRouter();
  useEffect(() => {
    if (!state.success) return;
    router.push("/onboarding/unit");
    router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name">Property name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={defaults.name}
          placeholder="e.g. Makati Suites"
          autoFocus
          className="h-12 px-4 text-base"
        />
      </div>
      <div>
        <Label htmlFor="address">
          Address <span className="font-normal text-ink/45">(optional)</span>
        </Label>
        <Input
          id="address"
          name="address"
          maxLength={300}
          defaultValue={defaults.address}
          placeholder="Building, street, barangay, city"
          className="h-12 px-4 text-base"
        />
      </div>
      <FieldError message={state.error} />

      <StepNav backHref="/onboarding/organization">
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
