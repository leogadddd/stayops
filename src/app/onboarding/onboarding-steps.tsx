"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const STEPS = [
  { href: "/onboarding", label: "Welcome" },
  { href: "/onboarding/organization", label: "Business" },
  { href: "/onboarding/property", label: "Property" },
  { href: "/onboarding/unit", label: "Unit" },
  { href: "/onboarding/welcome", label: "Ready" },
] as const;

function useCurrentStep() {
  const pathname = usePathname();
  return Math.max(0, STEPS.findLastIndex((step) => pathname.startsWith(step.href)));
}

/** "Step 2 of 5" for the header row. */
export function OnboardingStepCount() {
  const current = useCurrentStep();
  return (
    <p className="text-xs tabular-nums text-ink/50">
      Step <span className="font-medium text-pine">{current + 1}</span> of {STEPS.length}
    </p>
  );
}

/**
 * One segment per step with its label underneath: finished steps are moss,
 * the current step is clay, and upcoming steps stay faint.
 */
export function OnboardingProgress() {
  const current = useCurrentStep();
  return (
    <ol
      className="grid gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}
      aria-label="Setup progress"
    >
      {STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.href} aria-current={active ? "step" : undefined}>
            <span className="block h-1.5 overflow-hidden rounded-full bg-pine/10" aria-hidden>
              <span
                className={cn(
                  "block h-full origin-left rounded-full transition-transform duration-500 ease-out",
                  done ? "scale-x-100 bg-moss" : active ? "scale-x-100 bg-clay" : "scale-x-0",
                )}
              />
            </span>
            <span
              className={cn(
                "mt-2 block truncate text-[11px] transition-colors",
                active ? "font-medium text-pine" : done ? "text-ink/55" : "text-ink/30",
                // Small screens only name the current step.
                !active && "max-sm:invisible",
              )}
            >
              {done ? <span className="sr-only">Completed: </span> : null}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
