import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, guardOnboardingStep } from "../state";
import { PropertyForm } from "./property-form";

export const metadata: Metadata = { title: "Add your first property" };

export default async function OnboardingPropertyPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const redirectTo = guardOnboardingStep(state, "property");
  if (redirectTo) redirect(redirectTo);

  return (
    <div>
      <h1 className="animate-rise font-display text-4xl text-pine">
        Add your first property
      </h1>
      <p
        className="animate-rise mt-3 max-w-xl text-sm leading-relaxed text-ink/60"
        style={{ animationDelay: "80ms" }}
      >
        The building or place your guests stay at.
      </p>
      <div className="animate-rise mt-8" style={{ animationDelay: "160ms" }}>
        <PropertyForm
          defaults={{
            name: state.property?.name ?? "",
            address: state.property?.address ?? "",
          }}
        />
      </div>
    </div>
  );
}
