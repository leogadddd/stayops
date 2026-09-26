"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Brand palette for charts, as theme variables so they follow dark mode (see globals.css). */
export const CHART = {
  pine: "var(--color-chart-primary)",
  pineSoft: "var(--color-pine-soft)",
  moss: "var(--color-moss)",
  sage: "var(--color-sage)",
  sageDeep: "var(--color-sage-deep)",
  clay: "var(--color-clay)",
  sand: "var(--color-sand-deep)",
  mist: "var(--color-pine-mist)",
  grid: "color-mix(in oklab, var(--color-pine) 8%, transparent)",
  axis: "color-mix(in oklab, var(--color-ink) 50%, transparent)",
  font: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
} as const;

/** Stable category order; a category keeps its color whatever the range. */
export const CATEGORY_COLORS: Record<string, string> = {
  cleaning: CHART.pine,
  utilities: CHART.moss,
  supplies: CHART.sageDeep,
  maintenance: CHART.sand,
  internet: CHART.pineSoft,
  platform_fees: CHART.clay,
  renovation: "var(--color-chart-renovation)",
  other: "var(--color-chart-other)",
};

export const axisTick = { fill: CHART.axis, fontSize: 11, fontFamily: CHART.font };

const PESO = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export const peso = (cents: number) => PESO.format(cents / 100);
/**
 * "₱38K", "₱1.2M". Hand-rolled because Intl compact notation differs between
 * Node and browsers ("₱38.0K" vs "₱38K"), which breaks hydration.
 */
export function pesoCompact(cents: number) {
  const pesos = Math.abs(cents / 100);
  const [divisor, suffix] = pesos >= 1_000_000 ? [1_000_000, "M"] : pesos >= 1_000 ? [1_000, "K"] : [1, ""];
  return `${cents < 0 ? "-" : ""}₱${Math.round((pesos / divisor) * 10) / 10}${suffix}`;
}
export const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

const DAY = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAY_DAY = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

export const dayLabel = (date: string) => DAY.format(utc(date));
export const weekdayLabel = (date: string) => WEEKDAY_DAY.format(utc(date));
export const monthLabel = (date: string) => MONTH.format(utc(date));
export const monthYearLabel = (date: string) => MONTH_YEAR.format(utc(date));

/** Branded tooltip card shared by every chart. */
export function TooltipCard({ title, rows, footer }: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  footer?: ReactNode;
}) {
  return (
    <div className="min-w-44 rounded-xl border border-pine/12 bg-linen/95 px-3.5 py-3 text-xs shadow-[0_12px_32px_rgba(22,41,37,0.14)] backdrop-blur">
      <p className="font-display text-sm text-pine">{title}</p>
      <dl className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-ink/60">{row.color ? <span className="h-2 w-2 rounded-sm" style={{ background: row.color }} aria-hidden /> : null}{row.label}</dt>
            <dd className="font-medium tabular-nums text-pine">{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer ? <div className="mt-2 border-t border-pine/10 pt-2 text-ink/55">{footer}</div> : null}
    </div>
  );
}

/** Pill-style single choice, used for ranges and chart views. */
export function Segmented<T extends string>({ label, options, value, onChange, size = "md" }: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-pine/12 bg-paper p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              active ? "bg-primary text-white shadow-sm" : "text-pine/70 hover:bg-pine-mist hover:text-pine",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Legend entry that doubles as a series toggle. */
export function LegendToggle({ label, color, active, onClick, shape = "square" }: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  shape?: "square" | "line";
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] transition", active ? "text-ink/70 hover:bg-pine-mist/70" : "text-ink/35 line-through hover:bg-pine-mist/40")}>
      <span className={shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-sm"} style={{ background: active ? color : "var(--color-chart-other)" }} aria-hidden />
      {label}
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-clay-deep/80">{children}</p>;
}
