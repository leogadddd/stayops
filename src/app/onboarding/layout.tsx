import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { OnboardingProgress, OnboardingStepCount } from "./onboarding-steps";

export const metadata: Metadata = { title: "Get started" };

/**
 * Light, centred setup layout: logo and progress bar on top, one step below.
 * Each page signs the visitor in itself, so /onboarding can keep an
 * `?invite=` code when it sends them to log in.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b border-pine/8 bg-paper/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-5 pb-4 pt-5 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Logo className="h-8 w-32" />
            <Suspense><OnboardingStepCount /></Suspense>
          </div>
          <Suspense><OnboardingProgress /></Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
