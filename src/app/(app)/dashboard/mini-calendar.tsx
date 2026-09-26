"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarDays } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listNights } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type MiniCalendarTone =
  "confirmed" | "in-house" | "checked-out" | "hold" | "blocked";

export interface MiniCalendarEvent {
  id: string;
  /** First night, inclusive. */
  startDate: string;
  /** Checkout date, exclusive. */
  endDate: string;
  title: string;
  unitLabel: string;
  tone: MiniCalendarTone;
  href?: string;
}

// Same palette as the full calendar's bars, reduced to dots.
const DOT: Record<MiniCalendarTone, string> = {
  confirmed: "bg-[#8fb09b]",
  "in-house": "bg-pine",
  "checked-out": "bg-[#b3c4bb]",
  hold: "bg-[#b0823f]",
  blocked: "bg-[#a9ada8]",
};
const TONE_LABEL: Record<MiniCalendarTone, string> = {
  confirmed: "Confirmed",
  "in-house": "In-house",
  "checked-out": "Checked out",
  hold: "Hold",
  blocked: "Blocked",
};
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const MAX_DOTS = 3;

/**
 * This month at a glance: a dot per stay, hold or block on each night.
 * Selecting a day lists who is there (select it again to close); the header opens the full calendar.
 */
export function MiniCalendar({
  month,
  today,
  monthLabel,
  gridStart,
  gridEnd,
  events,
}: {
  month: string;
  today: string;
  monthLabel: string;
  gridStart: string;
  /** Exclusive. */
  gridEnd: string;
  events: MiniCalendarEvent[];
}) {
  // Nothing is selected at first: today's schedule already covers today.
  const [selected, setSelected] = useState<string | null>(null);
  const days = listNights(gridStart, gridEnd);
  const eventsOn = (date: string) =>
    events.filter((event) => event.startDate <= date && date < event.endDate);
  const selectedEvents = selected ? eventsOn(selected) : [];

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-pine">{monthLabel}</h2>
          <p className="mt-1 text-xs text-ink/50">
            Nothing needs your attention.
          </p>
        </div>
        <Link
          href={`/calendar?month=${month}`}
          className={buttonClassName("ghost", "sm", "text-clay-deep")}
        >
          <CalendarDays className="h-4 w-4" aria-hidden />
          Open calendar
        </Link>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-4">
        <div role="grid" aria-label={monthLabel}>
          <div role="row" className="grid grid-cols-7 pb-1">
            {DAY_NAMES.map((name, index) => (
              <span
                key={index}
                role="columnheader"
                className="text-center text-[10px] font-semibold uppercase tracking-wider text-ink/40"
              >
                {name}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((date) => {
              const dayEvents = eventsOn(date);
              const inMonth = date.startsWith(month);
              const isToday = date === today;
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-label={`${DAY_LABEL.format(new Date(`${date}T00:00:00Z`))}, ${dayEvents.length} booking${dayEvents.length === 1 ? "" : "s"}`}
                  onClick={() => setSelected(isSelected ? null : date)}
                  className={cn(
                    "flex h-11 flex-col items-center justify-start gap-1 rounded-lg pt-1.5 transition-colors",
                    isSelected ? "bg-pine-mist" : "hover:bg-pine-mist/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday
                        ? "bg-clay font-semibold text-white"
                        : inMonth
                          ? "text-pine"
                          : "text-ink/25",
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <span className="flex h-1.5 gap-0.5" aria-hidden>
                    {dayEvents.slice(0, MAX_DOTS).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          DOT[event.tone],
                          !inMonth && "opacity-40",
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selected ? (
          <div className="mt-auto border-t border-pine/10 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
              {DAY_LABEL.format(new Date(`${selected}T00:00:00Z`))}
            </p>
            {selectedEvents.length ? (
              <ul className="mt-1.5 divide-y divide-pine/8">
                {selectedEvents.map((event) => {
                  const content = (
                    <>
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          DOT[event.tone],
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-pine">
                          {event.title}
                        </span>
                        <span className="text-ink/50">
                          {" "}
                          · {event.unitLabel}
                        </span>
                      </span>
                      <span className="shrink-0 text-ink/45">
                        {TONE_LABEL[event.tone]}
                      </span>
                    </>
                  );
                  return (
                    <li key={event.id}>
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="group flex items-center gap-2.5 py-2 text-xs hover:text-clay-deep"
                        >
                          {content}
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-clay"
                            aria-hidden
                          />
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2.5 py-2 text-xs">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-ink/55">
                No stays, holds or blocks.
              </p>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
