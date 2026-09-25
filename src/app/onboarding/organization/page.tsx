import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, guardOnboardingStep } from "../state";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Name your business" };

export default async function OnboardingOrganizationPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const redirectTo = guardOnboardingStep(state, "organization");
  if (redirectTo) redirect(redirectTo);

  return (
    <div>
      <h1 className="animate-rise font-display text-4xl text-pine">
        What’s your business called?
      </h1>
      <p
        className="animate-rise mt-3 max-w-xl text-sm leading-relaxed text-ink/60"
        style={{ animationDelay: "120ms" }}
      >
        You can add a logo and contact details later in Settings.
      </p>
      <div className="animate-rise mt-8" style={{ animationDelay: "180ms" }}>
        <OrganizationForm defaultName={state.membership?.organizationName ?? ""} />
      </div>
    </div>
  );
}
