"use client";

import { useRef, type ComponentType } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChoiceCardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
}

/**
 * A radio group drawn as cards: for short lists where seeing every option
 * at once beats a dropdown. Arrow keys move and select, like native radios.
 */
export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly ChoiceCardOption<T>[];
  /** Columns from the `sm` breakpoint up; phones get two (one for 2-option groups with descriptions). */
  columns?: 2 | 3 | 4;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const enabled = options.filter((option) => !option.disabled);
  const focusable = enabled.some((option) => option.value === value) ? value : enabled[0]?.value;

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
        className,
      )}
      onKeyDown={(event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (step === undefined || !enabled.length) return;
        event.preventDefault();
        const index = enabled.findIndex((option) => option.value === value);
        const next = enabled[(index + step + enabled.length) % enabled.length]!;
        onChange(next.value);
        requestAnimationFrame(() => groupRef.current?.querySelector<HTMLButtonElement>(`[data-value='${next.value}']`)?.focus());
      }}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={active}
            disabled={option.disabled}
            tabIndex={option.value === focusable ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay disabled:cursor-not-allowed disabled:opacity-45",
              active ? "border-clay bg-clay-mist/40 ring-1 ring-clay" : "border-pine/15 bg-white hover:border-pine/35",
            )}
          >
            {Icon ? (
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors", active ? "bg-clay text-white" : "bg-sage/60 text-pine")}>
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1 self-center">
              <span className="block text-sm font-medium text-pine">{option.label}</span>
              {option.description ? <span className="mt-0.5 block text-xs text-ink/60">{option.description}</span> : null}
            </span>
            {active ? <Check className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-clay-deep" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
