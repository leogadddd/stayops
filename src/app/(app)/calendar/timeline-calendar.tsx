import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BrushCleaning, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { layoutTimelineBars } from "@/lib/calendar";
import { barStyle, CalendarLegend } from "./calendar-legend";
import { CalendarSelection } from "./calendar-selection";
import { EventTrigger, QuickViewProvider } from "./event-quick-view";
import type { DisplayCalendarEvent } from "./month-calendar";
import { PlatformLogo } from "@/components/app/platform-badge";

export interface TimelineUnit {
  id: string;
  name: string;
  propertyName: string | null;
  /** Active units take new reservations by dragging across their row. */
  bookable: boolean;
}

const WEEKDAY = new Intl.DateTimeFormat("en-PH", { weekday: "narrow", timeZone: "UTC" });
const FULL_DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});

const DAY_WIDTH = 44;
const UNIT_COLUMN = 176;
const LANE_HEIGHT = 34;
// As tall as an empty six-week month grid (37px day-name row plus 103px per
// week), whatever the month, so paging months or switching views doesn't jump.
const MIN_HEIGHT = 37 + 6 * 103;

/** Gantt view: one row per unit, one column per day of the month. */
export function TimelineCalendar({
  month, today, monthLabel, units, events, previousHref, nextHref, todayHref, viewSwitcher,
}: {
  month: string;
  today: string;
  monthLabel: string;
  units: TimelineUnit[];
  events: DisplayCalendarEvent[];
  previousHref: string;
  nextHref: string;
  todayHref: string;
  viewSwitcher?: ReactNode;
}) {
  const { days, rows } = layoutTimelineBars(month, units.map((unit) => unit.id), events);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const pct = (value: number) => `${(value / days.length) * 100}%`;
  const weekend = (day: string) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
  const dayColumns = (className = "") => (
    <div aria-hidden="true" className={`pointer-events-none grid ${className}`} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((day) => <div key={day} className={`border-r border-pine/10 last:border-r-0 ${day === today ? "bg-clay-mist/50" : weekend(day) ? "bg-pine/3" : ""}`} />)}
    </div>
  );

  return (
    <QuickViewProvider>
      <section aria-labelledby="calendar-month" className="overflow-hidden rounded-lg border border-pine/15 bg-linen shadow-[0_1px_3px_rgba(32,58,53,0.03)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-pine/15 px-4 py-4 sm:px-5">
          <nav aria-label="Calendar month" className="flex overflow-hidden rounded-md border border-pine/20">
            <Link href={previousHref} aria-label="Previous month" className="inline-flex h-10 w-10 items-center justify-center hover:bg-pine-mist/60 focus-visible:-outline-offset-2">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </Link>
            <Link href={nextHref} aria-label="Next month" className="inline-flex h-10 w-10 items-center justify-center border-l border-pine/15 hover:bg-pine-mist/60 focus-visible:-outline-offset-2">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          </nav>
          <h2 id="calendar-month" className="font-display text-2xl tracking-tight text-pine sm:text-[1.75rem]">{monthLabel}</h2>
          <div className="ml-auto flex items-center gap-2">
            {viewSwitcher}
            <Link href={todayHref} className={buttonClassName("outline", "sm")}>Today</Link>
          </div>
        </div>
        <div tabIndex={0} role="region" aria-label={`${monthLabel} timeline by unit`} className="overflow-x-auto focus-visible:-outline-offset-2">
          <div className="flex flex-col" style={{ minWidth: UNIT_COLUMN + days.length * DAY_WIDTH, minHeight: MIN_HEIGHT }}>
            <div className="flex border-b border-pine/15">
              <div className="sticky left-0 z-30 shrink-0 border-r border-pine/15 bg-linen px-3 py-2 text-xs text-ink/60" style={{ width: UNIT_COLUMN }}>Unit</div>
              <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                {days.map((day) => {
                  const currentDay = day === today;
                  return (
                    <div key={day} className={`flex flex-col items-center border-r border-pine/10 py-1.5 last:border-r-0 ${weekend(day) ? "bg-pine/3" : ""}`}>
                      <span className="text-[10px] uppercase text-ink/50">{WEEKDAY.format(new Date(`${day}T00:00:00Z`))}</span>
                      <time dateTime={day} aria-label={FULL_DATE_LABEL.format(new Date(`${day}T00:00:00Z`))} aria-current={currentDay ? "date" : undefined} className={`mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${currentDay ? "bg-clay font-semibold text-white" : "text-ink"}`}>
                        {Number(day.slice(-2))}
                      </time>
                    </div>
                  );
                })}
              </div>
            </div>
            {rows.map((row) => {
              const unit = unitById.get(row.unitId)!;
              return (
                <section key={row.unitId} aria-label={unit.name} className="flex border-b border-pine/15">
                  <div className="sticky left-0 z-30 flex shrink-0 flex-col justify-center border-r border-pine/15 bg-linen px-3 py-2" style={{ width: UNIT_COLUMN }}>
                    <span className="truncate text-sm font-medium text-pine">{unit.name}</span>
                    {unit.propertyName ? <span className="truncate text-xs text-ink/55">{unit.propertyName}</span> : null}
                    {!unit.bookable ? <span className="mt-0.5 w-fit rounded bg-amber-100 px-1 text-[11px] font-medium text-amber-900">Not bookable</span> : null}
                  </div>
                  <div className="relative flex-1 py-1.5" style={{ height: Math.max(row.laneCount, 1) * LANE_HEIGHT + 12 }}>
                    {dayColumns("absolute inset-0")}
                    <div className="absolute inset-x-0 inset-y-1.5">
                      {unit.bookable ? <CalendarSelection days={days} unitId={unit.id} /> : null}
                      {row.bars.map(({ event, start, end, lane, continuesBefore, continuesAfter }) => {
                        const { className, style } = barStyle(event);
                        const showMarker = event.turnover && !continuesAfter;
                        return (
                          <div key={event.id} className="absolute flex" style={{ left: pct(start), width: pct(end - start), top: lane * LANE_HEIGHT, height: LANE_HEIGHT - 4 } as CSSProperties}>
                            <EventTrigger
                              quickView={event.quickView}
                              href={event.href}
                              aria-label={`${event.accessibleLabel}${continuesBefore ? "; continued from previous month" : ""}${continuesAfter ? "; continues next month" : ""}`}
                              title={event.accessibleLabel}
                              className={`z-10 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-2.5 text-[13px] leading-none transition-[filter] hover:brightness-95 focus-visible:z-20 ${className} ${continuesBefore ? "rounded-l-none border-l-0" : "ml-0.5 rounded-l-full"} ${continuesAfter ? "rounded-r-none border-r-0" : "mr-0.5 rounded-r-full"} ${showMarker ? "pr-4" : ""}`}
                              style={style}
                            >
                              {event.kind === "block" ? <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                              {/* Short bars keep their room for the guest's name. */}
                              {event.platform && end - start >= 3 ? <PlatformLogo platform={event.platform} className="h-3.5 w-3.5 rounded-[3px]" /> : null}
                              <span className="truncate font-semibold">{event.kind === "block" ? event.description ?? event.title : event.title}</span>
                              {event.timeLabel && end - start >= 3 ? <span className="shrink-0 tabular-nums opacity-70">{event.timeLabel}</span> : null}
                            </EventTrigger>
                            {showMarker ? (
                              <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 z-20 inline-flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-clay/50 bg-clay-mist text-clay-deep shadow-sm" title={`Turnover ${event.turnover!.startTime}–${event.turnover!.endTime}`}>
                                <BrushCleaning className="h-3.5 w-3.5" />
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
            <div aria-hidden="true" className="flex flex-1">
              <div className="sticky left-0 z-30 shrink-0 border-r border-pine/15 bg-linen" style={{ width: UNIT_COLUMN }} />
              {dayColumns("flex-1")}
            </div>
          </div>
        </div>
      </section>

      <CalendarLegend />
    </QuickViewProvider>
  );
}
