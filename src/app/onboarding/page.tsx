import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BrushCleaning,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
} from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "./state";
import { StepNav } from "./step-nav";

const FEATURES = [
  { label: "Calendar", icon: CalendarDays },
  { label: "Reservations & payments", icon: CalendarCheck },
  { label: "Turnovers", icon: BrushCleaning },
  { label: "Reports", icon: ChartNoAxesCombined },
];

export default async function OnboardingIntroPage() {
  const user = await requireUser();
  const state = await getOnboardingState(user.id);
  if (state.membership && state.membership.role !== "owner") redirect("/dashboard");

  return (
    <div>
      <h1 className="animate-rise font-display text-4xl leading-tight text-pine sm:text-5xl">
        A calmer way to run your staycation.
      </h1>
      <p
        className="animate-rise mt-4 max-w-xl text-base leading-relaxed text-ink/65"
        style={{ animationDelay: "80ms" }}
      >
        StayOps keeps your bookings, payments, cleaning and expenses in one
        place.
      </p>
      <ul
        className="animate-rise mt-6 flex flex-wrap gap-2"
        style={{ animationDelay: "160ms" }}
      >
        {FEATURES.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-pine/12 bg-linen px-3 py-1.5 text-xs text-pine"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      <StepNav>
        <Link href="/onboarding/organization" className={buttonClassName("clay", "lg")}>
          Get started
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </StepNav>
    </div>
  );
}
