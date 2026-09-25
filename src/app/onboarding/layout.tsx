import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/session";
import { OnboardingProgress, OnboardingStepCount } from "./onboarding-steps";

export const metadata: Metadata = { title: "Get started" };

/** Light, centred setup layout: logo and progress bar on top, one step below. */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b border-pine/8 bg-paper/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 pb-4 pt-5 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Logo className="h-8 w-32" />
            <OnboardingStepCount />
          </div>
          <OnboardingProgress />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
