"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BedDouble, ChevronLeft, ChevronRight, LogIn, LogOut, Minus, MousePointerClick, Plus, X } from "lucide-react";
import { addDaysLocal, listNights, nightsBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { dayLabel, plural, timeLabel } from "../stay-display";

export interface PlannerDay {
  date: string;
  kind: "available" | "booked" | "held" | "blocked";
  label: string;
  href?: string;
}

export interface PlannerNeighbor {
  date: string;
  label: string;
  href?: string;
}

const SHORT_DAY = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" });
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_WEEKS = 5;
const MAX_NIGHTS = 365;

const toDate = (date: string) => new Date(`${date}T00:00:00Z`);
/** Free nights between two dates; 0 for a same-day turnover. */
const emptyNights = (from: string, to: string) => (to > from ? nightsBetween(from, to) : 0);
const weekStart = (date: string) => addDaysLocal(date, -toDate(date).getUTCDay());
function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ");
}

/**
 * The owner's planning surface for one unit: the booking window with its
 * neighbours, and a calendar to try other dates. Changing dates rewrites the
 * URL, so the server re-checks availability and re-prices the stay.
 */
export function StayPlanner({ unitId, search, guestCount, today, days, previous, next, checkInTime, checkOutTime, turnoverMinutes }: {
  unitId: string;
  search: { checkIn: string; checkOut: string; nights: number } | null;
  guestCount: number;
  today: string;
  days: PlannerDay[];
  previous: PlannerNeighbor | null;
  next: PlannerNeighbor | null;
  checkInTime: string;
  checkOutTime: string;
  turnoverMinutes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (checkIn: string, checkOut: string) => {
    const query = new URLSearchParams({ checkIn, checkOut, guests: String(guestCount) });
    startTransition(() => router.replace(`/calendar/availability/${unitId}?${query}`, { scroll: false }));
  };

  return (
    <div className={cn("space-y-6 transition-opacity", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
      {search ? (
        <BookingWindow
          search={search}
          previous={previous}
          next={next}
          checkInTime={checkInTime}
          checkOutTime={checkOutTime}
          turnoverMinutes={turnoverMinutes}
          onNights={(nights) => go(search.checkIn, addDaysLocal(search.checkIn, nights))}
        />
      ) : null}
      <DatePicker key={search ? `${search.checkIn}:${search.checkOut}` : "none"} search={search} today={today} days={days} onPick={go} />
    </div>
  );
}

function BookingWindow({ search, previous, next, checkInTime, checkOutTime, turnoverMinutes, onNights }: {
  search: { checkIn: string; checkOut: string; nights: number };
  previous: PlannerNeighbor | null;
  next: PlannerNeighbor | null;
  checkInTime: string;
  checkOutTime: string;
  turnoverMinutes: number;
  onNights: (nights: number) => void;
}) {
  const gapBefore = previous ? emptyNights(previous.date, search.checkIn) : null;
  const gapAfter = next ? emptyNights(search.checkOut, next.date) : null;
  // Longest stay that still ends on or before the next booking starts.
  const maxNights = Math.min(MAX_NIGHTS, next && next.date >= search.checkOut ? listNights(search.checkIn, next.date).length : MAX_NIGHTS);
  return (
    <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 sm:px-6">
        <h2 className="font-display text-xl text-pine">Booking window</h2>
        <p className="text-sm text-ink/55">Where this stay fits on the unit’s calendar</p>
      </div>
      <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Step icon={LogIn} label="Guest arrives" title={dayLabel(search.checkIn)} detail={`From ${timeLabel(checkInTime)}`} />
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-linen p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/60 text-pine"><BedDouble className="h-4 w-4" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/45">Length</p>
            <p className="mt-0.5 font-medium text-pine">{plural(search.nights, "night")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onNights(search.nights - 1)} disabled={search.nights <= 1} aria-label="One night shorter" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"><Minus className="h-4 w-4" aria-hidden /></button>
            <button type="button" onClick={() => onNights(search.nights + 1)} disabled={search.nights >= maxNights} aria-label="One night longer" title={search.nights >= maxNights ? "The next booking starts at check-out" : undefined} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30"><Plus className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
        <Step icon={LogOut} label="Guest departs" title={dayLabel(search.checkOut)} detail={`By ${timeLabel(checkOutTime)} · ${durationLabel(turnoverMinutes)} turnover`} />
      </div>
      <div className="grid gap-px border-t border-pine/10 bg-pine/10 sm:grid-cols-2">
        <NeighborTile heading="Previous booking" neighbor={previous} gap={gapBefore} verb="Ends" gapText={(gap) => gap === 0 ? "Back-to-back: same-day turnover" : `${plural(gap, "empty night")} before arrival`} />
        <NeighborTile heading="Next booking" neighbor={next} gap={gapAfter} verb="Starts" gapText={(gap) => gap === 0 ? "Back-to-back: same-day turnover" : `${plural(gap, "empty night")} after checkout`} />
      </div>
    </section>
  );
}

function Step({ icon: Icon, label, title, detail }: { icon: typeof LogIn; label: string; title: string; detail: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl bg-linen p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clay-mist text-clay-deep"><Icon className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
        <p className="mt-0.5 truncate font-medium text-pine">{title}</p>
        <p className="mt-0.5 truncate text-xs text-ink/55">{detail}</p>
      </div>
    </div>
  );
}

function NeighborTile({ heading, neighbor, gap, verb, gapText }: { heading: string; neighbor: PlannerNeighbor | null; gap: number | null; verb: string; gapText: (gap: number) => string }) {
  const tight = gap === 0;
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{heading}</p>
      {neighbor && gap !== null ? (
        <>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-medium text-pine">{neighbor.label}{neighbor.href ? <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden /> : null}</p>
          <p className="text-xs text-ink/55">{verb} {dayLabel(neighbor.date)}</p>
          <p className={cn("mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tight ? "bg-clay-mist text-clay-deep" : "bg-pine-mist text-pine")}>{gapText(gap)}</p>
        </>
      ) : <p className="mt-1 text-sm text-ink/60">None nearby. The unit is open around these dates.</p>}
    </>
  );
  return neighbor?.href
    ? <Link href={neighbor.href} className="group block min-w-0 bg-white px-5 py-4 transition-colors hover:bg-linen sm:px-6">{body}</Link>
    : <div className="min-w-0 bg-white px-5 py-4 sm:px-6">{body}</div>;
}

function DatePicker({ search, today, days, onPick }: {
  search: { checkIn: string; checkOut: string } | null;
  today: string;
  days: PlannerDay[];
  onPick: (checkIn: string, checkOut: string) => void;
}) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = weekStart(days[0]!.date);
  const lastStart = weekStart(addDaysLocal(days.at(-1)!.date, -7 * (VISIBLE_WEEKS - 1)));
  const [viewStart, setViewStart] = useState(() => {
    const start = weekStart(addDaysLocal(search?.checkIn ?? today, -7));
    return start < first ? first : start > lastStart ? lastStart : start;
  });
  // First click picks check-in; the second picks check-out and applies.
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const visible = listNights(viewStart, addDaysLocal(viewStart, VISIBLE_WEEKS * 7));
  const previewEnd = anchor && hover && hover > anchor ? hover : null;
  const inRange = (date: string) => anchor
    ? previewEnd ? date >= anchor && date < previewEnd : date === anchor
    : search ? date >= search.checkIn && date < search.checkOut : false;
  const pick = (date: string) => {
    if (!anchor || date <= anchor) { setAnchor(date); return; }
    if (listNights(anchor, date).length > MAX_NIGHTS) return;
    setAnchor(null);
    onPick(anchor, date);
  };
  const monthLabel = MONTH_YEAR.format(toDate(addDaysLocal(viewStart, 14)));

  return (
    <section className="rounded-2xl border border-pine/10 bg-white p-5 shadow-[0_1px_2px_rgba(32,58,53,0.06)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-pine">{search ? "Try other dates" : "Pick dates"}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink/55">
            <MousePointerClick className="h-4 w-4 shrink-0" aria-hidden />
            {anchor ? `Check-in ${SHORT_DAY.format(toDate(anchor))}. Now pick the check-out day.` : "Click a check-in day, then a check-out day. Click a booking to open it."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {anchor ? <button type="button" onClick={() => setAnchor(null)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-clay-deep hover:bg-clay-mist"><X className="h-4 w-4" aria-hidden />Cancel</button> : null}
          <span className="min-w-32 text-center text-sm font-medium text-pine">{monthLabel}</span>
          <button type="button" aria-label="Earlier weeks" onClick={() => setViewStart((start) => { const value = addDaysLocal(start, -14); return value < first ? first : value; })} disabled={viewStart <= first} className="flex h-9 w-9 items-center justify-center rounded-lg border border-pine/15 bg-white text-pine hover:bg-pine-mist disabled:opacity-35"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
          <button type="button" aria-label="Later weeks" onClick={() => setViewStart((start) => { const value = addDaysLocal(start, 14); return value > lastStart ? lastStart : value; })} disabled={viewStart >= lastStart} className="flex h-9 w-9 items-center justify-center rounded-lg border border-pine/15 bg-white text-pine hover:bg-pine-mist disabled:opacity-35"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-1.5" onMouseLeave={() => setHover(null)}>
        {WEEKDAYS.map((day) => <div key={day} className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-ink/40">{day}</div>)}
        {visible.map((date) => {
          const day = byDate.get(date) ?? { date, kind: "available" as const, label: "Free" };
          const occupied = day.kind !== "available";
          const selected = inRange(date);
          const departure = !anchor && search?.checkOut === date;
          const past = date < today;
          const title = `${dayLabel(date)} · ${day.label}`;
          const content = (
            <>
              {date.endsWith("-01") || date === viewStart ? <span className="text-[10px] leading-none opacity-70">{MONTH.format(toDate(date))}</span> : null}
              <span className="leading-tight">{Number(date.slice(8))}</span>
              {occupied ? <span className="mt-0.5 hidden max-w-full truncate px-1 text-[10px] leading-none opacity-80 sm:block">{day.label.split(" · ").at(-1)}</span> : null}
              {date === today ? <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-clay" /> : null}
            </>
          );
          const className = cn(
            "relative flex h-12 min-w-0 flex-col items-center justify-center rounded-lg text-xs transition sm:h-14",
            day.kind === "booked" && "bg-pine text-white",
            day.kind === "held" && "bg-sage-deep text-pine-deep",
            day.kind === "blocked" && "bg-ink/20 text-ink/70",
            !occupied && "border border-pine/10 bg-white text-ink/75",
            selected && (occupied ? "ring-2 ring-clay ring-offset-1" : "border-transparent bg-clay-mist font-medium text-clay-deep ring-2 ring-clay"),
            anchor === date && "bg-clay text-white",
            departure && !occupied && "outline-2 outline-offset-1 outline-dashed outline-clay/60",
            past && "opacity-40",
          );
          if (occupied && day.href && !anchor) {
            return <Link key={date} href={day.href} title={`${title} · open`} className={cn(className, "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay")}>{content}</Link>;
          }
          return (
            <button
              key={date}
              type="button"
              title={title}
              disabled={past}
              onClick={() => pick(date)}
              onMouseEnter={() => setHover(date)}
              aria-pressed={selected}
              className={cn(className, !past && "cursor-pointer hover:ring-2 hover:ring-clay/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay")}
            >
              {content}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink/60">
        <Legend className="border border-pine/15 bg-white">Free</Legend>
        <Legend className="bg-pine">Booked</Legend>
        <Legend className="bg-sage-deep">Hold</Legend>
        <Legend className="bg-ink/20">Blocked</Legend>
        {search ? <Legend className="bg-clay-mist ring-2 ring-clay">Selected nights</Legend> : null}
      </ul>
    </section>
  );
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return <li className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded", className)} aria-hidden />{children}</li>;
}

/** Tabs for the unit's reference info, so it reads as one compact panel. */
export function InfoTabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]!.id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]!;
  return (
    <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
      <div role="tablist" aria-label="Unit information" className="flex overflow-hidden border-b border-pine/10 px-2 pt-2 sm:gap-1 sm:px-4 sm:pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === current.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-2 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3.5",
              tab.id === current.id ? "border-clay text-pine" : "border-transparent text-ink/55 hover:text-pine",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={cn("rounded-full px-1.5 py-px text-[11px]", tab.id === current.id ? "bg-clay-mist text-clay-deep" : "bg-pine/10 text-ink/60")}>{tab.count}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="min-h-64 p-5 sm:p-6">
        {current.content}
      </div>
    </section>
  );
}
