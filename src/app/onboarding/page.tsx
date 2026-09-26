import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BrushCleaning,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  UsersRound,
} from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getOnboardingState, listPendingJoinRequests } from "./state";
import { StepNav } from "./step-nav";
import { InvitationAcceptance } from "./invitation-acceptance";

const FEATURES = [
  { label: "Calendar", icon: CalendarDays },
  { label: "Reservations & payments", icon: CalendarCheck },
  { label: "Turnovers", icon: BrushCleaning },
  { label: "Reports", icon: ChartNoAxesCombined },
];

const CHOICES = [
  {
    href: "/onboarding/organization",
    title: "Create a new organization",
    description: "Set up your business, first property and first unit. You’ll be its owner.",
    icon: Building2,
  },
  {
    href: "/onboarding/join",
    title: "Join an existing organization",
    description: "Enter the organization join code you were given. The owner approves your request.",
    icon: UsersRound,
  },
];

export default async function OnboardingIntroPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite: inviteParam } = await searchParams;
  const invite = (Array.isArray(inviteParam) ? inviteParam[0] : inviteParam)?.trim() || undefined;
  const session = await getSession();
  if (!session) {
    redirect(invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login");
  }
  if (invite) {
    return <InvitationAcceptance code={invite} email={session.user.email} />;
  }

  const state = await getOnboardingState(session.user.id);
  if (state.membership && state.membership.role !== "owner") redirect("/dashboard");
  const pendingRequests = state.membership ? [] : await listPendingJoinRequests(session.user.id);

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

      {state.membership ? (
        // An owner partway through setup picks up where they left off.
        <StepNav>
          <Link href="/onboarding/organization" className={buttonClassName("clay", "lg")}>
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </StepNav>
      ) : (
        <section
          aria-labelledby="onboarding-choice-title"
          className="animate-rise mt-10 border-t border-pine/10 pt-8"
          style={{ animationDelay: "220ms" }}
        >
          <h2 id="onboarding-choice-title" className="font-display text-2xl text-pine">
            How would you like to start?
          </h2>
          {pendingRequests.length > 0 ? (
            <Link
              href="/onboarding/join"
              className="mt-4 flex items-start gap-3 rounded-xl border border-pine/15 bg-sage/35 p-4 text-sm text-pine hover:border-pine/30"
            >
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Your request to join <strong className="font-semibold">{pendingRequests[0]!.organizationName}</strong>
                {pendingRequests.length > 1 ? ` and ${pendingRequests.length - 1} more` : ""} is waiting for owner
                approval. <span className="underline underline-offset-4">View status</span>
              </span>
            </Link>
          ) : null}
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {CHOICES.map(({ href, title, description, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex h-full flex-col rounded-xl border border-pine/15 bg-linen p-5 transition-colors hover:border-pine/40 hover:bg-pine-mist/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage/60 text-pine">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="mt-4 flex items-center gap-1.5 font-medium text-pine">
                    {title}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-1.5 text-sm leading-relaxed text-ink/60">{description}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-relaxed text-ink/55">
            Were you sent an invitation link? Open that link while signed in with the invited email address to join
            directly.
          </p>
        </section>
      )}
    </div>
  );
}
