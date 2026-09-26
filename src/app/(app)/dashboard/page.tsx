import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  BrushCleaning,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  Clock3,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMembership } from "@/lib/auth/session";
import { calendarEventsForUnit, monthGridRange } from "@/lib/calendar";
import { seriesStart } from "@/lib/dashboard-series";
import {
  addDaysLocal,
  monthNightRange,
  nightsBetween,
  todayInTimeZone,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  getOccupancySegments,
  listCalendarActivity,
} from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { getDashboardSeries } from "@/server/reports/dashboard";
import { getReport } from "@/server/reports/service";
import { MiniCalendar, type MiniCalendarEvent } from "./mini-calendar";
import { PerformanceSection } from "./performance";

export const metadata: Metadata = { title: "Dashboard" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function localTimeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
}

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(new Date()),
  );
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}

/** Keep the operations dashboard up when a money query fails, but say why in the logs. */
function logAndSkip(label: string) {
  return (error: unknown) => {
    console.error(`Dashboard ${label} unavailable:`, error);
    return null;
  };
}

export default async function DashboardPage() {
  const membership = await requireMembership();
  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);

  const propertyById = new Map(
    properties.map((property) => [property.id, property]),
  );
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const propertyForUnit = (unitId: string) =>
    propertyById.get(unitById.get(unitId)?.propertyId ?? "");
  const timezone = properties[0]?.timezone ?? "Asia/Manila";
  const today = todayInTimeZone(timezone);
  const unitDays = units.map((unit) => ({
    unitId: unit.id,
    today: todayInTimeZone(propertyForUnit(unit.id)?.timezone ?? timezone),
  }));
  const todayByUnit = new Map(
    unitDays.map((item) => [item.unitId, item.today]),
  );
  const month = today.slice(0, 7);
  const isOwner = membership.role === "owner";
  const monthGrid = monthGridRange(month);

  const [activity, openTasks, monthSegmentsByUnit, series, monthReport] =
    await Promise.all([
      listCalendarActivity(membership.organizationId, unitDays),
      listTasks(membership.organizationId, { status: "open" }),
      getOccupancySegments(
        membership.organizationId,
        units.map((unit) => unit.id),
        monthGrid.start,
        monthGrid.end,
      ),
      isOwner
        ? getDashboardSeries(membership.organizationId, {
            from: seriesStart(today),
            to: addDaysLocal(today, 1),
          }).catch(logAndSkip("performance series"))
        : null,
      isOwner
        ? getReport(membership.organizationId, {
            from: monthNightRange(month).start,
            to: monthNightRange(month).end,
          }).catch(logAndSkip("month balances"))
        : null,
    ]);

  const arrivals = activity.filter(
    (item) =>
      item.status !== "hold" && item.startDate === todayByUnit.get(item.unitId),
  );
  const departures = activity.filter(
    (item) =>
      item.status !== "hold" && item.endDate === todayByUnit.get(item.unitId),
  );
  const holds = activity
    .filter((item) => item.status === "hold")
    .sort(
      (a, b) =>
        (a.expiresAt?.getTime() ?? Infinity) -
        (b.expiresAt?.getTime() ?? Infinity),
    );
  const expiryLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  const arrivalUnitIds = new Set(
    arrivals.map((reservation) => reservation.unitId),
  );
  const urgentTasks = openTasks.filter((task) =>
    arrivalUnitIds.has(task.unitId),
  );
  const watchTasks = [
    ...urgentTasks,
    ...openTasks.filter((task) => !arrivalUnitIds.has(task.unitId)),
  ];
  const scheduleTime = (kind: "arrival" | "departure", unitId: string) => {
    const property = propertyForUnit(unitId);
    return (
      (kind === "arrival" ? property?.checkInTime : property?.checkOutTime) ??
      "99:99"
    );
  };
  // Departures free the unit before arrivals can use it, so they lead the day.
  const schedule = [
    ...departures.map((reservation) => ({
      kind: "departure" as const,
      reservation,
    })),
    ...arrivals.map((reservation) => ({
      kind: "arrival" as const,
      reservation,
    })),
  ].sort((a, b) =>
    a.kind !== b.kind
      ? a.kind === "departure"
        ? -1
        : 1
      : scheduleTime(a.kind, a.reservation.unitId).localeCompare(
          scheduleTime(b.kind, b.reservation.unitId),
        ),
  );

  // Confirmed stays (not holds) checking in this month, and their nights in it.
  const monthRange = monthNightRange(month);
  const monthBookings = [...monthSegmentsByUnit.values()]
    .flat()
    .filter(
      (segment) =>
        segment.kind === "reservation" &&
        segment.status !== "hold" &&
        segment.startDate >= monthRange.start &&
        segment.startDate < monthRange.end,
    );
  const monthBookedNights = monthBookings.reduce(
    (sum, segment) =>
      sum +
      nightsBetween(
        segment.startDate,
        segment.endDate < monthRange.end ? segment.endDate : monthRange.end,
      ),
    0,
  );

  const needsAttention = watchTasks.length > 0 || holds.length > 0;
  const unitLabel = (unitId: string) => {
    const unit = unitById.get(unitId);
    return properties.length > 1
      ? `${propertyForUnit(unitId)?.name} · ${unit?.name}`
      : (unit?.name ?? "");
  };
  // Stays, holds and blocks for this month's grid; turnovers stay on the full calendar.
  const miniCalendarEvents: MiniCalendarEvent[] = units.flatMap((unit) =>
    calendarEventsForUnit(
      unit.id,
      monthSegmentsByUnit.get(unit.id) ?? [],
    ).flatMap((event): MiniCalendarEvent[] => {
      if (event.kind === "turnover") return [];
      const blocked = event.kind === "block" || event.kind === "unavailable";
      return [
        {
          id: event.id,
          startDate: event.startDate,
          endDate: event.endDate,
          title: blocked ? (event.description ?? event.title) : event.title,
          unitLabel: unitLabel(unit.id),
          tone: blocked
            ? "blocked"
            : event.kind === "hold"
              ? "hold"
              : event.status === "checked_in"
                ? "in-house"
                : event.status === "checked_out"
                  ? "checked-out"
                  : "confirmed",
          href: event.reservationId
            ? `/reservations/${event.reservationId}`
            : isOwner
              ? `/properties/${unit.propertyId}/units/${unit.id}`
              : undefined,
        },
      ];
    }),
  );

  const tiles: {
    label: string;
    value: number;
    helper: string;
    icon: LucideIcon;
    tone: string;
    href: string;
  }[] = [
    {
      label: "Bookings this month",
      value: monthBookings.length,
      helper: monthBookings.length
        ? `${monthBookedNights} night${monthBookedNights === 1 ? "" : "s"} booked`
        : "No bookings yet this month",
      icon: CalendarDays,
      tone: "bg-sage/55 text-pine",
      href: `/calendar?month=${month}`,
    },
    {
      label: "Arrivals today",
      value: arrivals.length,
      helper: arrivals.length
        ? "Prepare guest access"
        : "No arrivals scheduled",
      icon: ArrowDownToLine,
      tone: "bg-sage/55 text-pine",
      href: "/calendar",
    },
    {
      label: "Departures today",
      value: departures.length,
      helper: departures.length
        ? "Turnovers will follow"
        : "No check-outs scheduled",
      icon: ArrowRightLeft,
      tone: "bg-clay-mist text-clay-deep",
      href: "/calendar",
    },
    {
      label: "Open turnovers",
      value: openTasks.length,
      helper: urgentTasks.length
        ? `${urgentTasks.length} before today's arrivals`
        : openTasks.length
          ? "None block today's arrivals"
          : "All units are ready",
      icon: BrushCleaning,
      tone: "bg-sand text-bark",
      href: "/tasks?status=open",
    },
    {
      label: "Active holds",
      value: holds.length,
      helper: holds[0]?.expiresAt
        ? `Next expires ${expiryLabel.format(holds[0].expiresAt)}`
        : "No holds expiring",
      icon: Clock3,
      tone: "bg-pine-mist text-pine",
      href: "/reservations?status=hold",
    },
  ];

  return (
    <div className="mx-auto max-w-[1600px] overflow-hidden pb-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          {/* <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-clay-deep/80">
            {DATE_LABEL.format(new Date(`${today}T00:00:00Z`))}
          </p> */}
          <h1 className="font-display text-3xl tracking-tight text-pine sm:text-[2.6rem] sm:leading-tight">
            {greeting(timezone)}, {membership.organizationName}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-ink/60">
            {schedule.length || openTasks.length || holds.length
              ? `${schedule.length} guest movement${schedule.length === 1 ? "" : "s"}, ${openTasks.length} turnover${openTasks.length === 1 ? "" : "s"} and ${holds.length} hold${holds.length === 1 ? "" : "s"} need your attention today.`
              : "A calm day. Nothing needs your attention right now."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/calendar/availability"
            className={buttonClassName("ghost", "md")}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Check availability
          </Link>
          <Link
            href="/reservations/new"
            className={buttonClassName("clay", "md")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New reservation
          </Link>
        </div>
      </header>

      {units.length === 0 ? (
        <EmptyState
          title="Your operations dashboard is ready"
          description={
            isOwner
              ? "Add your first property and unit to start tracking arrivals, cleaning work, occupancy and cash movement."
              : "Ask the owner to add the first property and unit."
          }
          action={
            isOwner ? (
              <Link
                href="/properties/new"
                className={buttonClassName("clay", "md")}
              >
                Add a property
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <section
            aria-label="Today at a glance"
            className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            {tiles.map(({ label, value, helper, icon: Icon, tone, href }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-xl border border-pine/12 bg-linen p-4 shadow-[0_2px_8px_rgba(32,58,53,0.035)] transition hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-[0_10px_24px_rgba(32,58,53,0.08)] sm:p-5"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                      tone,
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-ink/60">{label}</p>
                    <p className="mt-1 font-display text-3xl leading-none text-pine">
                      {value}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-clay"
                    aria-hidden
                  />
                </div>
                <p className="mt-3 truncate border-t border-pine/8 pt-2.5 text-[11px] text-ink/50">
                  {helper}
                </p>
              </Link>
            ))}
          </section>

          <section className="mt-5 grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.25fr)]">
            {needsAttention ? (
              <Card className="flex flex-col">
                <CardHeader className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl text-pine">
                      Needs attention
                    </h2>
                    <p className="mt-1 text-xs text-ink/50">
                      Turnovers and holds waiting on you.
                    </p>
                  </div>
                  <Link
                    href="/tasks?status=open"
                    className="text-xs font-medium text-clay-deep hover:underline"
                  >
                    All tasks
                  </Link>
                </CardHeader>
                <CardBody className="space-y-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                      Turnovers
                    </p>
                    {watchTasks.length ? (
                      <ul className="mt-2 space-y-2">
                        {watchTasks.slice(0, 4).map((task) => {
                          const progress = task.totalItems
                            ? task.doneItems / task.totalItems
                            : 0;
                          return (
                            <li key={task.id}>
                              <Link
                                href={`/tasks/${task.id}`}
                                className="block rounded-lg border border-pine/8 bg-paper/60 px-3 py-2.5 transition hover:border-pine/20 hover:bg-pine-mist/40"
                              >
                                <span className="flex items-center justify-between gap-3 text-xs">
                                  <span className="min-w-0 truncate font-medium text-pine">
                                    {task.propertyName} · {task.unitName}
                                  </span>
                                  {arrivalUnitIds.has(task.unitId) ? (
                                    <Badge tone="clay">Arrival today</Badge>
                                  ) : (
                                    <span className="tabular-nums text-ink/50">
                                      {task.doneItems}/{task.totalItems}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className="mt-2 block h-1.5 overflow-hidden rounded-full bg-pine-mist"
                                  aria-hidden
                                >
                                  <span
                                    className="block h-full rounded-full bg-moss"
                                    style={{ width: `${progress * 100}%` }}
                                  />
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-ink/55">
                        Every unit is ready for its next guest.
                      </p>
                    )}
                  </div>
                  <div className="border-t border-pine/10 pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                      Holds
                    </p>
                    {holds.length ? (
                      <ul className="mt-2 divide-y divide-pine/8">
                        {holds.slice(0, 4).map((hold) => (
                          <li key={hold.id}>
                            <Link
                              href={`/reservations/${hold.id}`}
                              className="flex items-center justify-between gap-3 py-2 text-xs hover:text-clay-deep"
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-medium text-pine">
                                  {hold.guestName}
                                </span>
                                <span className="text-ink/50">
                                  {" "}
                                  · {unitById.get(hold.unitId)?.name}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-clay-deep">
                                {hold.expiresAt
                                  ? `Expires ${expiryLabel.format(hold.expiresAt)}`
                                  : "No expiry"}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-ink/55">
                        No holds waiting for payment.
                      </p>
                    )}
                  </div>
                </CardBody>
              </Card>
            ) : (
              <MiniCalendar
                month={month}
                today={today}
                monthLabel={MONTH_LABEL.format(
                  new Date(`${month}-01T00:00:00Z`),
                )}
                gridStart={monthGrid.start}
                gridEnd={monthGrid.end}
                events={miniCalendarEvents}
              />
            )}

            <Card className="flex flex-col">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl text-pine">
                    Today&apos;s schedule
                  </h2>
                  <p className="mt-1 text-xs text-ink/50">
                    Check-outs first, then arrivals, in the order they happen.
                  </p>
                </div>
                <Badge tone="neutral">
                  {schedule.length} event{schedule.length === 1 ? "" : "s"}
                </Badge>
              </CardHeader>
              <CardBody className="flex flex-1 flex-col p-0">
                {schedule.length ? (
                  <ol className="relative px-5 py-3">
                    {schedule.map(({ kind, reservation }, index) => {
                      const property = propertyForUnit(reservation.unitId);
                      const unit = unitById.get(reservation.unitId);
                      const arrival = kind === "arrival";
                      const time = arrival
                        ? property?.checkInTime
                        : property?.checkOutTime;
                      return (
                        <li
                          key={`${kind}:${reservation.id}`}
                          className="relative flex gap-4"
                        >
                          <div className="flex w-20 shrink-0 flex-col items-end pt-4 text-right">
                            <span className="text-xs font-semibold tabular-nums text-pine">
                              {time ? localTimeLabel(time) : "—"}
                            </span>
                            <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-ink/40">
                              {arrival ? "Check-in" : "Check-out"}
                            </span>
                          </div>
                          <div className="relative flex flex-col items-center">
                            <span
                              className={cn(
                                "mt-4 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-linen",
                                arrival
                                  ? "bg-sage text-pine"
                                  : "bg-clay-mist text-clay-deep",
                              )}
                            >
                              {arrival ? (
                                <ArrowDownToLine
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                              ) : (
                                <ArrowRightLeft
                                  className="h-3.5 w-3.5"
                                  aria-hidden
                                />
                              )}
                            </span>
                            {index < schedule.length - 1 ? (
                              <span
                                className="w-px flex-1 bg-pine/12"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                          <Link
                            href={`/reservations/${reservation.id}`}
                            className="my-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-pine-mist/45"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-pine">
                                {reservation.guestName}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-ink/55">
                                {property?.name} · {unit?.name} ·{" "}
                                {reservation.guestCount} guest
                                {reservation.guestCount === 1 ? "" : "s"}
                              </span>
                            </span>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-ink/30"
                              aria-hidden
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
                    <CircleCheck
                      className="h-7 w-7 text-sage-deep"
                      aria-hidden
                    />
                    <p className="mt-2 text-sm text-ink/60">
                      No arrivals or departures today.
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-ink/45">
                      Use the quiet window to clear turnover work and follow up
                      on active holds.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>

          {isOwner ? (
            series ? (
              <PerformanceSection
                series={series}
                today={today}
                balances={
                  monthReport
                    ? {
                        depositsHeldCents:
                          monthReport.summary.depositsHeldCents,
                        bookedValueCents: monthReport.summary.bookedValueCents,
                        month,
                      }
                    : null
                }
              />
            ) : (
              <Card className="mt-10">
                <CardBody>
                  <p className="text-sm text-ink/60">
                    Performance charts are temporarily unavailable. Your
                    operations overview above is still current.
                  </p>
                </CardBody>
              </Card>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
