"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, LogIn, LogOut, MousePointerClick, X } from "lucide-react";
import { addDaysLocal, nightsBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getUnitOccupancyAction, type OccupiedNight } from "./actions";

const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const SHORT_LABEL = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
function shiftMonth(month: string, delta: number) {
  const value = toDate(`${month}-01`);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return value.toISOString().slice(0, 7);
}
function monthDays(month: string) {
  const first = `${month}-01`;
  const days: string[] = [];
  for (let day = first; day.startsWith(month); day = addDaysLocal(day, 1)) days.push(day);
  return { leading: toDate(first).getUTCDay(), days };
}

/**
 * A two-month range picker for a stay: click check-in, then check-out. The
 * unit's booked, held, and blocked nights are drawn in, and once check-in is
 * picked, days past the next occupied night can't be chosen (the check-out
 * day itself may be the next guest's arrival).
 */
export function StayRangeCalendar({ unitId, excludeReservationId, checkIn, checkOut, today, onChange }: {
  unitId: string;
  excludeReservationId?: string;
  checkIn: string;
  checkOut: string;
  today: string;
  onChange: (checkIn: string, checkOut: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => (checkIn || today).slice(0, 7));
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  // Occupied nights for the two visible months, cached per unit and window.
  const windowStart = `${viewMonth}-01`;
  const windowEnd = `${shiftMonth(viewMonth, 2)}-01`;
  const windowKey = `${unitId}:${windowStart}`;
  const [loaded, setLoaded] = useState<Record<string, OccupiedNight[]>>({});
  useEffect(() => {
    if (!unitId || loaded[windowKey]) return;
    let cancelled = false;
    getUnitOccupancyAction(unitId, windowStart, windowEnd, excludeReservationId)
      .then((nights) => { if (!cancelled) setLoaded((current) => ({ ...current, [windowKey]: nights })); })
      .catch(() => { if (!cancelled) setLoaded((current) => ({ ...current, [windowKey]: [] })); });
    return () => { cancelled = true; };
  }, [unitId, windowKey, windowStart, windowEnd, excludeReservationId, loaded]);
  const nights = loaded[windowKey];
  const occupied = new Map((nights ?? []).map((night) => [night.date, night]));

  // With a check-in picked, the stay can run up to (and check out on) the next occupied night.
  const limit = anchor ? [...occupied.keys()].filter((date) => date >= anchor).sort()[0] ?? null : null;
  const rangeStart = anchor ?? checkIn;
  const rangeEnd = anchor ? (hover && hover > anchor && (!limit || hover <= limit) ? hover : null) : checkOut;

  function choose(date: string) {
    if (!anchor || date <= anchor) {
      setAnchor(date);
      return;
    }
    setAnchor(null);
    setHover(null);
    onChange(anchor, date);
  }

  const months = [viewMonth, shiftMonth(viewMonth, 1)];
  const selectedNights = !anchor && checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut) : null;

  return (
    <div className="@container rounded-2xl border border-pine/10 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-ink/65" aria-live="polite">
          <MousePointerClick className="h-4 w-4 shrink-0 text-pine/50" aria-hidden />
          {anchor
            ? <span>Check-in <strong className="text-pine">{SHORT_LABEL.format(toDate(anchor))}</strong>. Now pick the check-out day.</span>
            : selectedNights
              ? <span><strong className="text-pine">{SHORT_LABEL.format(toDate(checkIn))}</strong> → <strong className="text-pine">{SHORT_LABEL.format(toDate(checkOut))}</strong> · {selectedNights} night{selectedNights === 1 ? "" : "s"}. Click a day to change.</span>
              : <span>Click a check-in day, then a check-out day.</span>}
        </p>
        <div className="flex items-center gap-1.5">
          {nights === undefined ? <LoaderCircle className="h-4 w-4 animate-spin text-pine/40" aria-label="Loading bookings" /> : null}
          {anchor ? <button type="button" onClick={() => { setAnchor(null); setHover(null); }} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-clay-deep hover:bg-clay-mist"><X className="h-4 w-4" aria-hidden />Cancel</button> : null}
          <button type="button" aria-label="Previous month" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} disabled={viewMonth <= today.slice(0, 7) && !(checkIn && checkIn.slice(0, 7) < viewMonth)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-pine/15 text-pine hover:bg-pine-mist disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Next month" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-pine/15 text-pine hover:bg-pine-mist"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 @2xl:grid-cols-2" onMouseLeave={() => setHover(null)}>
        {months.map((month, monthIndex) => {
          const { leading, days } = monthDays(month);
          return (
            <div key={month} className={cn(monthIndex === 1 && "hidden @2xl:block")}>
              <p className="mb-2 text-center text-sm font-medium text-pine">{MONTH_LABEL.format(toDate(`${month}-01`))}</p>
              <div className="grid grid-cols-7 gap-y-1">
                {WEEKDAYS.map((day) => <div key={day} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink/40" aria-hidden>{day}</div>)}
                {Array.from({ length: leading }, (_, index) => <div key={`blank-${index}`} aria-hidden />)}
                {days.map((date) => {
                  const night = occupied.get(date);
                  const past = date < today;
                  const beyondLimit = Boolean(anchor && limit && date > limit);
                  // A check-in needs a free night; a check-out day only needs to be reachable.
                  const disabled = past || beyondLimit || (!anchor && Boolean(night)) || (Boolean(anchor) && date <= anchor! && Boolean(night));
                  const isStart = date === rangeStart;
                  const isEnd = Boolean(rangeEnd) && date === rangeEnd;
                  const inside = Boolean(rangeStart && rangeEnd && date > rangeStart && date < rangeEnd);
                  const status = night ? night.label : "Free";
                  return (
                    <div key={date} className={cn("relative flex h-11 items-center justify-center", inside && "bg-clay-mist", isStart && rangeEnd && "bg-gradient-to-r from-transparent from-50% to-clay-mist to-50%", isEnd && "bg-gradient-to-l from-transparent from-50% to-clay-mist to-50%")}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(date)}
                        onMouseEnter={() => setHover(date)}
                        onFocus={() => setHover(date)}
                        aria-pressed={isStart || isEnd || inside}
                        aria-label={`${DAY_LABEL.format(toDate(date))}, ${status}${isStart ? ", check-in" : ""}${isEnd ? ", check-out" : ""}`}
                        title={status}
                        className={cn(
                          "relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                          isStart || isEnd ? "bg-clay font-semibold text-white" : inside ? "font-medium text-clay-deep" : "text-ink/80",
                          !disabled && !isStart && !isEnd && "hover:bg-pine-mist",
                          night && !isStart && !isEnd && (night.kind === "booked" ? "bg-pine/10 text-pine/50 line-through" : night.kind === "held" ? "bg-amber-100 text-amber-900/60 line-through" : "bg-ink/10 text-ink/45 line-through"),
                          disabled && !night && "text-ink/25",
                          date === today && !isStart && !isEnd && "ring-1 ring-pine/30",
                        )}
                      >
                        {Number(date.slice(8))}
                      </button>
                      {isStart && !anchor ? <span className="pointer-events-none absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-surface px-1 text-[9px] font-semibold uppercase text-clay-deep shadow-sm"><LogIn className="h-2.5 w-2.5" aria-hidden />In</span> : null}
                      {isEnd && !anchor ? <span className="pointer-events-none absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-surface px-1 text-[9px] font-semibold uppercase text-clay-deep shadow-sm"><LogOut className="h-2.5 w-2.5" aria-hidden />Out</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-pine/10 pt-3 text-xs text-ink/60">
        <Legend className="bg-clay">Your stay</Legend>
        <Legend className="bg-pine/15">Booked</Legend>
        <Legend className="bg-amber-100">Hold</Legend>
        <Legend className="bg-ink/10">Blocked</Legend>
        <li className="text-ink/45">The check-out day is free for the next guest.</li>
      </ul>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return <li className="flex items-center gap-1.5"><span aria-hidden className={cn("h-3 w-3 rounded-full", className)} />{children}</li>;
}
