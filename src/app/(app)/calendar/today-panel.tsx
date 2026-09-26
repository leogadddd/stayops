import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BrushCleaning, Check, ChevronDown, ChevronRight } from "lucide-react";
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
  weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
});
function localTimeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
}

type Kind = "checkout" | "clean" | "checkin";
interface ScheduleItem {
  key: string;
  kind: Kind;
  time: string | null; // null: carried over from an earlier day.
  title: string;
  subtitle: string;
  done: boolean;
  status: string;
  href: string;
  action: string;
  timezone?: string;
}

const KIND_ORDER: Record<Kind, number> = { checkout: 0, clean: 1, checkin: 2 };
const KIND_STYLE: Record<Kind, { label: string; icon: typeof ArrowUpRight; dot: string; text: string }> = {
  checkout: { label: "Check-out", icon: ArrowUpRight, dot: "bg-clay-mist text-clay-deep ring-clay/25", text: "text-clay-deep" },
  clean: { label: "Turnover", icon: BrushCleaning, dot: "bg-stay-turnover text-stay-turnover-ink ring-stay-turnover-line/40", text: "text-stay-turnover-ink" },
  checkin: { label: "Check-in", icon: ArrowDownRight, dot: "bg-sage text-pine ring-pine/20", text: "text-pine" },
};

function buildSchedule(arrivals: TodayReservation[], departures: TodayReservation[], openTasks: TodayTask[], multipleTimezones: boolean): ScheduleItem[] {
  const departureById = new Map(departures.map((reservation) => [reservation.id, reservation]));
  const items: ScheduleItem[] = [
    ...departures.map((reservation): ScheduleItem => ({
      key: `out:${reservation.id}`,
      kind: "checkout",
      time: reservation.checkOutTime,
      title: reservation.guestName,
      subtitle: reservation.unitLabel,
      done: reservation.status === "checked_out",
      status: reservation.status === "checked_out" ? "Checked out" : "Due",
      href: `/reservations/${reservation.id}`,
      action: "View",
      timezone: multipleTimezones ? reservation.timezone : undefined,
    })),
    ...openTasks.map((task): ScheduleItem => {
      const departure = task.reservationId ? departureById.get(task.reservationId) : undefined;
      return {
        key: `task:${task.id}`,
        kind: "clean",
        time: departure?.checkOutTime ?? null,
        title: `Clean ${task.unitLabel}`,
        subtitle: `${task.doneItems} of ${task.totalItems} items done`,
        done: false,
        status: departure ? "Open" : "Carried over",
        href: `/tasks/${task.id}`,
        action: "Checklist",
      };
    }),
    ...arrivals.map((reservation): ScheduleItem => ({
      key: `in:${reservation.id}`,
      kind: "checkin",
      time: reservation.checkInTime,
      title: reservation.guestName,
      subtitle: `${reservation.unitLabel} · ${reservation.guestCount} guest${reservation.guestCount === 1 ? "" : "s"}`,
      done: reservation.status === "checked_in" || reservation.status === "checked_out",
      status: reservation.status === "checked_in" || reservation.status === "checked_out" ? "Checked in" : "Expected",
      href: `/reservations/${reservation.id}`,
      action: "View",
      timezone: multipleTimezones ? reservation.timezone : undefined,
    })),
  ];
  // Carried-over cleaning first, then the day in time order.
  return items.sort((a, b) =>
    (a.time === null ? -1 : 0) - (b.time === null ? -1 : 0) ||
    (a.time ?? "").localeCompare(b.time ?? "") ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
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
  const schedule = buildSchedule(arrivals, departures, openTasks, multipleTimezones);
  const summary = [
    [arrivals.length, "arrival", "arrivals"],
    [departures.length, "check-out", "check-outs"],
    [openTasks.length, "to clean", "to clean"],
  ] as const;

  return (
    <aside aria-labelledby="today-title" className="min-w-0 rounded-lg border border-pine/15 bg-linen xl:sticky xl:top-0">
      <div className="border-b border-pine/10 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="today-title" className="font-display text-2xl text-pine">Today</h2>
          <time dateTime={today} className="text-xs text-ink/65">{DATE_LABEL.format(new Date(`${today}T00:00:00Z`))}</time>
        </div>
        <p className="mt-0.5 text-[11px] text-ink/55">{scopeLabel} · {multipleTimezones ? "property-local times" : timezone}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {summary.map(([count, one, many]) => (
            <li key={one} className={`rounded-full px-2 py-0.5 ${count ? "bg-pine-mist text-pine" : "bg-pine/5 text-ink/45"}`}>
              <span className="font-semibold">{count}</span> {count === 1 ? one : many}
            </li>
          ))}
        </ul>
      </div>

      <section aria-label="Today's schedule" className="px-4 py-3">
        {schedule.length ? (
          <ol className="relative">
            {schedule.map((item, index) => {
              const style = KIND_STYLE[item.kind];
              const Icon = item.done ? Check : style.icon;
              return (
                <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < schedule.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[4.6rem] top-7 w-px bg-pine/10" /> : null}
                  <span className="w-14 shrink-0 pt-1.5 text-right text-[11px] tabular-nums text-ink/60">
                    {item.time ? localTimeLabel(item.time) : "Earlier"}
                  </span>
                  <span aria-hidden className={`relative z-10 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ${item.done ? "bg-pine-mist text-pine/60 ring-pine/10" : style.dot}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <Link href={item.href} className={`group min-w-0 flex-1 rounded-md py-0.5 ${item.done ? "opacity-60" : ""}`}>
                    <span className={`flex items-center gap-1.5 text-[11px] font-medium ${style.text}`}>
                      {style.label}
                      <span className="font-normal text-ink/50">· {item.status}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-ink group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                    <span className="block truncate text-xs text-ink/60">{item.subtitle}</span>
                    {item.timezone ? <span className="block text-[10px] text-ink/45">{item.timezone}</span> : null}
                    <span className="sr-only">{item.action}</span>
                  </Link>
                  <ChevronRight aria-hidden className="mt-2 h-4 w-4 shrink-0 text-ink/30" />
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-ink/55">Nothing scheduled today.</p>
        )}
      </section>

      <details className="group border-t border-pine/10 px-4 py-3" open={activeHolds.length > 0 && activeHolds.length <= 3}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-ink/65 [&::-webkit-details-marker]:hidden">
          <span>Active holds · {activeHolds.length}</span>
          <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        {activeHolds.length ? (
          <ul className="mt-2 space-y-1">
            {activeHolds.map((reservation) => (
              <li key={reservation.id}>
                <Link href={`/reservations/${reservation.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stay-turnover">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full border border-dashed border-stay-turnover-line bg-stay-turnover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{reservation.guestName}</span>
                    <span className="block truncate text-[11px] text-ink/55">{reservation.unitLabel}{reservation.expiryLabel ? ` · expires ${reservation.expiryLabel}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-xs text-ink/50">No active holds.</p>}
      </details>

      <div className="border-t border-pine/10 px-4 py-2.5 text-right">
        <Link href="/tasks?status=open" className="text-xs text-clay-deep underline-offset-4 hover:underline">All tasks</Link>
      </div>
    </aside>
  );
}
