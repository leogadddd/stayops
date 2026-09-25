import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, guardOnboardingStep } from "../state";
import { UnitForm } from "./unit-form";

export const metadata: Metadata = { title: "Add your first unit" };

export default async function OnboardingUnitPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  const redirectTo = guardOnboardingStep(state, "unit");
  if (redirectTo) redirect(redirectTo);

  return (
    <div>
      <h1 className="animate-rise font-display text-4xl text-pine">
        Add a unit to {state.property!.name}
      </h1>
      <p
        className="animate-rise mt-3 max-w-xl text-sm leading-relaxed text-ink/60"
        style={{ animationDelay: "80ms" }}
      >
        The room or space guests book, like a condo unit or villa.
      </p>
      <div className="animate-rise mt-8" style={{ animationDelay: "160ms" }}>
        <UnitForm defaultName={state.unit?.name ?? ""} />
      </div>
    </div>
  );
}
