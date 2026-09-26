import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BrushCleaning, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { layoutMonthBars, type BarInterval, type CalendarEvent } from "@/lib/calendar";
import { addDaysLocal, monthNightRange } from "@/lib/dates";
import { barStyle, CalendarLegend } from "./calendar-legend";
import { CalendarSelection } from "./calendar-selection";
import { EventTrigger, QuickViewProvider, type EventQuickViewData } from "./event-quick-view";

export interface DisplayCalendarEvent extends CalendarEvent, BarInterval {
  unitLabel: string;
  detail: string;
  href?: string;
  accessibleLabel: string;
  turnover?: { startTime: string; endTime: string };
  timeLabel?: string;
  quickView: EventQuickViewData;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "short", day: "numeric", timeZone: "UTC",
});
const FULL_DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});

// Bars are one line; weeks show MAX_LANES rows until expanded.
const LANE_HEIGHT = 34;
const MAX_LANES = 3;
function dateLabel(date: string) {
  return DATE_LABEL.format(new Date(`${date}T00:00:00Z`));
}

const pct = (days: number) => `${(days / 7) * 100}%`;

export function MonthCalendar({
  month, today, monthLabel, events, previousHref, nextHref, todayHref, newReservationHref, reservationUnitId, showUnit = false, viewSwitcher,
}: {
  month: string;
  today: string;
  monthLabel: string;
  events: DisplayCalendarEvent[];
  previousHref: string;
  nextHref: string;
  todayHref: string;
  newReservationHref: ((date: string) => string) | null;
  reservationUnitId?: string;
  showUnit?: boolean;
  viewSwitcher?: ReactNode;
}) {
  const weeks = layoutMonthBars(month, events);
  const range = monthNightRange(month);
  const agenda = events
    .filter((event) => event.startDate < range.end && event.endDate > range.start)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

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
        <p id="calendar-scroll-help" className="border-b border-pine/10 px-4 py-2 text-xs text-ink/60 md:hidden">Swipe across the month, or read the agenda below.</p>
        <div tabIndex={0} role="region" aria-label={`${monthLabel} month calendar`} className="overflow-x-auto focus-visible:-outline-offset-2">
          <div className="min-w-[630px]">
            <div className="grid grid-cols-7 border-b border-pine/15">
              {DAY_NAMES.map((name) => <div key={name} className="border-r border-pine/10 py-2.5 text-center text-xs text-ink/75 last:border-r-0">{name}</div>)}
            </div>
            {weeks.map((week) => {
              const toggleId = `week-more-${week.start}`;
              const overflow = week.laneCount > MAX_LANES;
              // Hidden bars per day, so "+N more" sits under the busy days.
              const hiddenByDay = week.days.map((_, column) => week.bars.filter((bar) => bar.lane >= MAX_LANES && bar.start < column + 1 && bar.end > column).length);
              const collapsedRows = overflow ? MAX_LANES + 1 : Math.max(week.laneCount, 1);
              return (
                <section key={week.start} aria-label={`Week of ${dateLabel(week.start)}`} className="group/week relative border-b border-pine/15 last:border-b-0">
                  {overflow ? <input id={toggleId} type="checkbox" className="sr-only" aria-label={`Show all stays for the week of ${dateLabel(week.start)}`} /> : null}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-7">
                    {week.days.map((day) => <div key={day} className={`border-r border-pine/10 last:border-r-0 ${day === today ? "bg-clay-mist/50" : !day.startsWith(month) ? "bg-pine/3" : ""}`} />)}
                  </div>
                  <div className="relative grid grid-cols-7">
                    {week.days.map((day) => {
                      const label = FULL_DATE_LABEL.format(new Date(`${day}T00:00:00Z`));
                      const currentDay = day === today;
                      const numberClass = `inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm ${currentDay ? "bg-clay font-semibold text-white" : day.startsWith(month) ? "text-ink" : "text-ink/40"}`;
                      return (
                        <div key={day} className="px-1.5 pt-1.5">
                          {newReservationHref ? (
                            <Link href={newReservationHref(day)} aria-label={`New reservation starting ${label}`} aria-current={currentDay ? "date" : undefined} className={`${numberClass} ${currentDay ? "hover:bg-clay-strong" : "hover:bg-sage/60"}`}>
                              <time dateTime={day}>{Number(day.slice(-2))}</time>
                            </Link>
                          ) : <time dateTime={day} aria-label={label} aria-current={currentDay ? "date" : undefined} className={numberClass}>{Number(day.slice(-2))}</time>}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="relative mt-1 mb-2 h-(--collapsed) group-has-[:checked]/week:h-(--expanded)"
                    style={{
                      "--collapsed": `${collapsedRows * LANE_HEIGHT + 8}px`,
                      "--expanded": `${(week.laneCount + 1) * LANE_HEIGHT + 8}px`,
                      minHeight: 56,
                    } as CSSProperties}
                  >
                    {newReservationHref ? <CalendarSelection days={week.days} unitId={reservationUnitId} /> : null}
                    {week.bars.map(({ event, start, end, lane, continuesBefore, continuesAfter }) => {
                      const { className, style } = barStyle(event);
                      const hidden = lane >= MAX_LANES ? "hidden group-has-[:checked]/week:flex" : "flex";
                      const showMarker = event.turnover && !continuesAfter;
                      return (
                        <div key={event.id} className={`absolute ${hidden}`} style={{ left: pct(start), width: pct(end - start), top: lane * LANE_HEIGHT, height: LANE_HEIGHT - 4 }}>
                          <EventTrigger
                            quickView={event.quickView}
                            href={event.href}
                            aria-label={`${event.accessibleLabel}${continuesBefore ? "; continued from previous week" : ""}${continuesAfter ? "; continues next week" : ""}`}
                            title={event.accessibleLabel}
                            className={`z-10 flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-2.5 text-[13px] leading-none transition-[filter] hover:brightness-95 focus-visible:z-20 ${className} ${continuesBefore ? "rounded-l-none border-l-0" : "ml-0.5 rounded-l-full"} ${continuesAfter ? "rounded-r-none border-r-0" : "mr-0.5 rounded-r-full"} ${showMarker ? "pr-4" : ""}`}
                            style={style}
                          >
                            {event.kind === "block" ? <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                            <span className="truncate font-semibold">{event.kind === "block" ? event.description ?? event.title : event.title}</span>
                            {event.timeLabel && end - start >= 1.7 ? <span className="shrink-0 tabular-nums opacity-70">{event.timeLabel}</span> : null}
                            {showUnit && end - start >= 3.2 ? <span className="truncate opacity-75">· {event.unitLabel}</span> : null}
                          </EventTrigger>
                          {showMarker ? (
                            <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 z-20 inline-flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-clay/50 bg-clay-mist text-clay-deep shadow-sm" title={`Turnover ${event.turnover!.startTime}–${event.turnover!.endTime}`}>
                              <BrushCleaning className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                    {overflow ? (
                      <>
                        {hiddenByDay.map((count, column) => count ? (
                          <label key={column} htmlFor={toggleId} className="absolute z-10 cursor-pointer px-2 text-[11px] font-medium text-pine/70 hover:text-pine group-has-[:checked]/week:hidden" style={{ left: pct(column), top: MAX_LANES * LANE_HEIGHT + 2 }}>
                            +{count} more
                          </label>
                        ) : null)}
                        <label htmlFor={toggleId} className="absolute right-2 z-10 hidden cursor-pointer text-[11px] font-medium text-pine/70 hover:text-pine group-has-[:checked]/week:block" style={{ top: week.laneCount * LANE_HEIGHT + 2 }}>
                          Show less
                        </label>
                      </>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      <CalendarLegend />

      <section aria-labelledby="calendar-agenda" className="mt-6 md:hidden">
        <h3 id="calendar-agenda" className="mb-3 font-display text-xl text-pine">{monthLabel} at a glance</h3>
        <ul className="space-y-2">
          {agenda.map((event) => {
            const { className, style } = barStyle(event);
            const lastDay = event.timed ? event.endDate : addDaysLocal(event.endDate, -1);
            return (
              <li key={event.id}>
                <EventTrigger quickView={event.quickView} href={event.href} aria-label={event.accessibleLabel} className={`block w-full rounded-lg px-3 py-3 ${className}`} style={style}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words text-sm font-medium">{event.title}</span>
                    <span className="shrink-0 text-xs">{dateLabel(event.startDate)}{lastDay !== event.startDate ? ` – ${dateLabel(lastDay)}` : ""}</span>
                  </div>
                  <p className="mt-1 break-words text-xs">{event.unitLabel} · {event.detail}{event.timeLabel ? ` · ${event.timeLabel}` : ""}</p>
                </EventTrigger>
              </li>
            );
          })}
        </ul>
      </section>
    </QuickViewProvider>
  );
}
