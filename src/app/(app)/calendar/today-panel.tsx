import Link from "next/link";
import { ArrowDownToLine, ArrowRight, ArrowRightLeft, BrushCleaning } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { nightsBetween } from "@/lib/dates";
import { RESERVATION_STATUS_LABELS } from "@/lib/labels";
import type { ReservationStatus } from "@/lib/db/schema";

interface TodayReservation {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  guestName: string;
  guestCount: number;
  unitLabel: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  expiryLabel: string | null;
}
interface TodayTask {
  id: string;
  unitId: string;
  reservationId: string | null;
  unitLabel: string;
  doneItems: number;
  totalItems: number;
}
const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
function localTimeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
}

function StayCard({ reservation, departure = false, taskId, multipleTimezones }: {
  reservation: TodayReservation;
  departure?: boolean;
  taskId?: string;
  multipleTimezones: boolean;
}) {
  const nights = nightsBetween(reservation.startDate, reservation.endDate);
  const Icon = departure ? ArrowRightLeft : ArrowDownToLine;
  const status = departure
    ? reservation.status === "checked_out" ? "Checked out" : "Checking out"
    : RESERVATION_STATUS_LABELS[reservation.status];
  return (
    <article className={`rounded-lg p-4 ${departure ? "bg-clay-mist/80" : "bg-sage/45"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-2 text-xs ${departure ? "text-clay-deep" : "text-pine"}`}>
        <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4" aria-hidden />{departure ? "Check-out" : "Arrival"}</span>
        <span className={`rounded-full px-2 py-1 ${departure ? "bg-[#edcbbd]" : "bg-sage"}`}>{status}</span>
      </div>
      <h4 className="mt-2 break-words font-display text-xl text-pine">{reservation.guestName}</h4>
      <p className="mt-1 break-words text-xs text-ink/70">{reservation.unitLabel}</p>
      {!departure ? <p className="mt-2 text-sm">{reservation.guestCount} guest{reservation.guestCount === 1 ? "" : "s"} · {nights} night{nights === 1 ? "" : "s"}</p> : null}
      <p className="mt-2 text-xs">{departure ? "Check-out" : "Check-in"}: {localTimeLabel(departure ? reservation.checkOutTime : reservation.checkInTime)}</p>
      {multipleTimezones ? <p className="mt-1 text-[10px] text-ink/60">{reservation.timezone} · {departure ? reservation.endDate : reservation.startDate}</p> : null}
      <Link href={taskId ? `/tasks/${taskId}` : `/reservations/${reservation.id}`} className={buttonClassName(departure ? "clay" : "primary", "sm", "mt-4 w-full")}>
        {taskId ? "Open turnover checklist" : "View reservation"}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </article>
  );
}

export function TodayPanel({ today, timezone, multipleTimezones, scopeLabel, arrivals, departures, activeHolds, openTasks }: {
  today: string;
  timezone: string;
  multipleTimezones: boolean;
  scopeLabel: string;
  arrivals: TodayReservation[];
  departures: TodayReservation[];
  activeHolds: TodayReservation[];
  openTasks: TodayTask[];
}) {
  const tasksByReservation = new Map(openTasks.map((task) => [task.reservationId, task]));
  const needsCleaning = new Set(openTasks.map((task) => task.unitId)).size;
  return (
    <aside aria-labelledby="today-title" className="min-w-0 rounded-lg border border-pine/15 bg-linen p-4 xl:min-h-[740px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="today-title" className="font-display text-2xl text-pine">Today</h2>
        <time dateTime={today} className="text-xs text-ink/65">{DATE_LABEL.format(new Date(`${today}T00:00:00Z`))}</time>
      </div>
      <p className="mt-1 text-[11px] text-ink/55">{scopeLabel} · {multipleTimezones ? "property-local dates" : timezone}</p>

      <section id="today-arrivals" aria-labelledby="arrivals-title" className="mt-5 scroll-mt-6">
        <h3 id="arrivals-title" className="mb-2 text-xs font-medium text-ink/65">Arriving today</h3>
        <div className="space-y-3">
          {arrivals.map((reservation) => <StayCard key={reservation.id} reservation={reservation} multipleTimezones={multipleTimezones} />)}
          {arrivals.length === 0 ? <p className="rounded-lg bg-sage/20 p-3 text-xs text-ink/60">No arrivals today.</p> : null}
        </div>
      </section>

      <section aria-labelledby="departures-title" className="mt-5">
        <h3 id="departures-title" className="mb-2 text-xs font-medium text-ink/65">Checking out today</h3>
        <div className="space-y-3">
          {departures.map((reservation) => <StayCard key={reservation.id} reservation={reservation} departure taskId={tasksByReservation.get(reservation.id)?.id} multipleTimezones={multipleTimezones} />)}
          {departures.length === 0 ? <p className="rounded-lg bg-clay-mist/40 p-3 text-xs text-ink/60">No check-outs today.</p> : null}
        </div>
      </section>

      <section id="needs-cleaning" aria-labelledby="cleaning-title" className="mt-5 scroll-mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="cleaning-title" className="text-xs font-medium text-ink/65">Needs cleaning · {needsCleaning} unit{needsCleaning === 1 ? "" : "s"}</h3>
          <Link href="/tasks?status=open" className="text-xs text-clay-deep underline-offset-4 hover:underline">All tasks</Link>
        </div>
        {openTasks.length ? <ul className="space-y-2">{openTasks.map((task) => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 rounded-lg border border-clay/15 bg-clay-mist/50 p-3 hover:bg-clay-mist">
              <BrushCleaning className="h-4 w-4 shrink-0 text-clay" aria-hidden />
              <span className="min-w-0"><span className="block break-words text-xs font-medium">{task.unitLabel}</span><span className="mt-1 block text-[11px] text-ink/60">{task.doneItems} of {task.totalItems} checklist items done</span></span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-clay" aria-hidden />
            </Link>
          </li>
        ))}</ul> : <p className="text-xs text-ink/55">No open turnover checklists.</p>}
      </section>

      <section id="active-holds" aria-labelledby="holds-title" className="mt-5 scroll-mt-6 border-t border-pine/10 pt-4">
        <h3 id="holds-title" className="mb-2 text-xs font-medium text-ink/65">Active holds · {activeHolds.length}</h3>
        {activeHolds.length ? <ul className="space-y-2">{activeHolds.map((reservation) => (
          <li key={reservation.id}>
            <Link href={`/reservations/${reservation.id}`} className="block rounded-lg bg-[#eee3d1] p-3 hover:bg-[#e8d8be]">
              <p className="break-words text-sm font-medium">{reservation.guestName}</p>
              <p className="mt-1 break-words text-xs">{reservation.unitLabel}</p>
              <p className="mt-1 text-[11px] text-ink/70">{reservation.expiryLabel ? `Expires ${reservation.expiryLabel}` : "Active hold"}</p>
              {multipleTimezones ? <p className="text-[10px] text-ink/60">{reservation.timezone}</p> : null}
            </Link>
          </li>
        ))}</ul> : <p className="text-xs text-ink/55">No active holds.</p>}
      </section>
    </aside>
  );
}
