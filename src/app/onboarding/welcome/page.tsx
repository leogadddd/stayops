import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleCheck } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, nextOnboardingPath } from "../state";
import { StepNav } from "../step-nav";

export const metadata: Metadata = { title: "Welcome to StayOps" };

export default async function OnboardingWelcomePage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (!state.membership) redirect("/onboarding/organization");
  if (state.membership.role !== "owner") redirect("/dashboard");

  const unit = state.unit;
  const firstName = user.name.trim().split(/\s+/)[0];

  return (
    <div>
      <CircleCheck className="animate-rise h-10 w-10 text-moss" strokeWidth={1.6} aria-hidden />
      <h1
        className="animate-rise mt-5 font-display text-4xl leading-tight text-pine sm:text-5xl"
        style={{ animationDelay: "60ms" }}
      >
        You’re all set{firstName ? `, ${firstName}` : ""}.
      </h1>
      <p
        className="animate-rise mt-3 max-w-xl text-base leading-relaxed text-ink/65"
        style={{ animationDelay: "120ms" }}
      >
        {unit
          ? `${unit.name} is ready for bookings.`
          : state.property
            ? "Add a unit whenever you’re ready."
            : "Add a property whenever you’re ready."}
      </p>

      <StepNav backHref={unit ? "/onboarding/unit" : nextOnboardingPath(state)}>
        <Link href="/dashboard" className={buttonClassName("clay", "lg")}>
          Go to dashboard
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </StepNav>
    </div>
  );
}
