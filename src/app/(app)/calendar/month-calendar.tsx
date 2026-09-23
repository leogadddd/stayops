import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowRightLeft, ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { layoutMonthEvents, type CalendarEvent } from "@/lib/calendar";
import { addDaysLocal, monthNightRange } from "@/lib/dates";

export interface DisplayCalendarEvent extends CalendarEvent {
  unitLabel: string;
  detail: string;
  href?: string;
  accessibleLabel: string;
}

function EventSurface({ href, ...props }: Pick<ComponentProps<"div">, "children" | "className" | "style" | "aria-label" | "title"> & { href?: string }) {
  return href ? <Link href={href} {...props} /> : <div {...props} />;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "short", day: "numeric", timeZone: "UTC",
});
const FULL_DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});
const EVENT_STYLES: Record<CalendarEvent["kind"], string> = {
  stay: "border-[#b6c9bc] bg-[#cfddd3] text-pine",
  hold: "border-[#ddc6a5] bg-[#eddfc9] text-[#624a32]",
  checkout: "border-[#d8a28f] bg-[#edcbbd] text-[#783925]",
  block: "border-[#c4c6c5] bg-[#dedfdd] text-[#444b48]",
  unavailable: "border-[#d5d6d3] bg-[#e9e9e5] text-[#525953]",
};

function dateLabel(date: string) {
  return DATE_LABEL.format(new Date(`${date}T00:00:00Z`));
}

export function MonthCalendar({
  month, today, monthLabel, events, previousHref, nextHref, todayHref, newReservationHref,
}: {
  month: string;
  today: string;
  monthLabel: string;
  events: DisplayCalendarEvent[];
  previousHref: string;
  nextHref: string;
  todayHref: string;
  newReservationHref: ((date: string) => string) | null;
}) {
  const weeks = layoutMonthEvents(month, events);
  const range = monthNightRange(month);
  const agenda = events
    .filter((event) => event.startDate < range.end && event.endDate > range.start)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));

  return (
    <>
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
          <Link href={todayHref} className={buttonClassName("outline", "sm", "ml-auto")}>Today</Link>
        </div>
        <p id="calendar-scroll-help" className="border-b border-pine/10 px-4 py-2 text-xs text-ink/60 md:hidden">Swipe across the month, or read the agenda below.</p>
        <div tabIndex={0} role="region" aria-label={`${monthLabel} month calendar`} aria-describedby="calendar-date-help" className="overflow-x-auto focus-visible:-outline-offset-2">
          <div className="min-w-[630px]">
            <div className="grid grid-cols-7 border-b border-pine/15">
              {DAY_NAMES.map((name) => <div key={name} className="border-r border-pine/10 py-2.5 text-center text-xs text-ink/75 last:border-r-0">{name}</div>)}
            </div>
            {weeks.map((week) => (
              <section key={week.start} aria-label={`Week of ${dateLabel(week.start)}`} className="relative border-b border-pine/15 last:border-b-0">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-cols-7">
                  {week.days.map((day) => <div key={day} className={`border-r border-pine/10 last:border-r-0 ${day === today ? "bg-clay-mist/65" : !day.startsWith(month) ? "bg-pine/3" : ""}`} />)}
                </div>
                <div className="relative grid grid-cols-7">
                  {week.days.map((day) => {
                    const label = FULL_DATE_LABEL.format(new Date(`${day}T00:00:00Z`));
                    const currentDay = day === today;
                    const numberClass = `inline-flex h-8 min-w-8 items-center justify-center rounded-md text-sm ${currentDay ? "font-semibold text-clay-deep" : day.startsWith(month) ? "text-ink" : "text-ink/40"}`;
                    return (
                      <div key={day} className="px-1.5 pt-1">
                        {newReservationHref ? (
                          <Link href={newReservationHref(day)} aria-label={`New reservation starting ${label}`} aria-current={currentDay ? "date" : undefined} className={`${numberClass} hover:bg-sage/60`}>
                            <time dateTime={day}>{Number(day.slice(-2))}</time>
                          </Link>
                        ) : <time dateTime={day} aria-label={label} aria-current={currentDay ? "date" : undefined} className={numberClass}>{Number(day.slice(-2))}</time>}
                      </div>
                    );
                  })}
                </div>
                <div className="relative grid grid-cols-7 gap-y-1.5 px-1 pb-3 pt-1" style={{ gridTemplateRows: `repeat(${Math.max(week.laneCount, 1)}, 64px)`, minHeight: 78 }}>
                  {week.events.map(({ event, startColumn, span, lane, continuesBefore, continuesAfter }) => (
                    <EventSurface
                      key={event.id}
                      href={event.href}
                      aria-label={`${event.accessibleLabel}${continuesBefore ? "; continued from previous week" : ""}${continuesAfter ? "; continues next week" : ""}`}
                      title={event.accessibleLabel}
                      className={`relative mx-0.5 flex min-w-0 flex-col justify-center overflow-hidden rounded-md border px-2 py-1 transition-[filter] hover:brightness-95 focus-visible:z-10 ${EVENT_STYLES[event.kind]} ${continuesBefore ? "rounded-l-none border-l-2 border-l-current" : ""} ${continuesAfter ? "rounded-r-none border-r-2 border-r-current" : ""}`}
                      style={{ gridColumn: `${startColumn + 1} / span ${span}`, gridRow: lane + 1 }}
                    >
                      <span className="flex min-w-0 items-center gap-1 text-xs font-semibold leading-4">
                        {event.kind === "checkout" ? <ArrowRightLeft className="h-3 w-3 shrink-0" aria-hidden /> : event.kind === "block" ? <Wrench className="h-3 w-3 shrink-0" aria-hidden /> : null}
                        <span className="truncate">{event.title}</span>
                      </span>
                      <span className="truncate text-[11px] leading-4">{event.unitLabel}</span>
                      <span className="truncate text-[10px] leading-4 opacity-85">{event.detail}</span>
                    </EventSurface>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <ul aria-label="Calendar legend" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/75">
        {([
          ["stay", "Confirmed stay"], ["hold", "Hold (expires)"], ["checkout", "Check-out / turnover"],
          ["block", "Maintenance / blocked"], ["unavailable", "Unit unavailable"],
        ] as const).map(([kind, label]) => (
          <li key={kind} className="inline-flex items-center gap-2"><span aria-hidden className={`h-3.5 w-3.5 rounded-full border ${EVENT_STYLES[kind]}`} />{label}</li>
        ))}
      </ul>
      <p id="calendar-date-help" className="mt-3 text-xs leading-relaxed text-ink/55">Stays cover nights only. Check-out is a separate one-day marker; that night is free unless another stay or block occupies it. Select a date to start a reservation.</p>
      {agenda.length === 0 ? <p className="mt-4 rounded-lg border border-dashed border-pine/20 p-4 text-sm text-ink/60">No stays or blocks this month. Your calendar is clear.</p> : null}

      <section aria-labelledby="calendar-agenda" className="mt-6 md:hidden">
        <h3 id="calendar-agenda" className="mb-3 font-display text-xl text-pine">{monthLabel} at a glance</h3>
        <ul className="space-y-2">
          {agenda.map((event) => (
            <li key={event.id}>
              <EventSurface href={event.href} aria-label={event.accessibleLabel} className={`block rounded-lg border px-3 py-3 ${EVENT_STYLES[event.kind]}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-sm font-medium">{event.title}</span>
                  <span className="shrink-0 text-xs">{dateLabel(event.startDate)}{event.kind !== "checkout" && event.endDate !== addDaysLocal(event.startDate, 1) ? ` – ${dateLabel(addDaysLocal(event.endDate, -1))}` : ""}</span>
                </div>
                <p className="mt-1 break-words text-xs">{event.unitLabel} · {event.detail}</p>
              </EventSurface>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
