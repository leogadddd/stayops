import Link from "next/link";
import { CalendarDays, ChartGantt } from "lucide-react";
import { cn } from "@/lib/utils";

export const CALENDAR_VIEWS = ["month", "timeline"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function isCalendarView(value: string | undefined): value is CalendarView {
  return CALENDAR_VIEWS.includes(value as CalendarView);
}

const OPTIONS: { view: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { view: "month", label: "Month", icon: CalendarDays },
  { view: "timeline", label: "Timeline", icon: ChartGantt },
];

/** Plain links, so the chosen view lives in the URL and survives a refresh. */
export function ViewSwitcher({ view, hrefFor }: { view: CalendarView; hrefFor: (view: CalendarView) => string }) {
  return (
    <nav aria-label="Calendar view" className="flex overflow-hidden rounded-md border border-pine/20 text-sm">
      {OPTIONS.map(({ view: option, label, icon: Icon }) => {
        const active = option === view;
        return (
          <Link
            key={option}
            href={hrefFor(option)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 px-3 font-medium transition-colors not-first:border-l not-first:border-pine/15 focus-visible:-outline-offset-2",
              active ? "bg-pine text-paper" : "text-pine hover:bg-pine-mist/60",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
