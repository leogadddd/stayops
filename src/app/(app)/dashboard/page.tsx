import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  BrushCleaning,
  CalendarCheck,
  Clock3,
  Plus,
  TrendingUp,
} from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireMembership } from "@/lib/auth/session";
import { monthNightRange, todayInTimeZone } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { listCalendarActivity } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { getReport } from "@/server/reports/service";

export const metadata: Metadata = { title: "Dashboard" };

const DATE_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function localTimeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
}

export default async function DashboardPage() {
  const membership = await requireMembership();
  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);

  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const propertyForUnit = (unitId: string) => propertyById.get(unitById.get(unitId)?.propertyId ?? "");
  const timezone = properties[0]?.timezone ?? "Asia/Manila";
  const today = todayInTimeZone(timezone);
  const unitDays = units.map((unit) => ({
    unitId: unit.id,
    today: todayInTimeZone(propertyForUnit(unit.id)?.timezone ?? timezone),
  }));
  const todayByUnit = new Map(unitDays.map((item) => [item.unitId, item.today]));
  const monthRange = monthNightRange(today.slice(0, 7));

  const [activity, openTasks, report] = await Promise.all([
    listCalendarActivity(membership.organizationId, unitDays),
    listTasks(membership.organizationId, { status: "open" }),
    membership.role === "owner"
      ? getReport(membership.organizationId, { from: monthRange.start, to: monthRange.end }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const arrivals = activity.filter((item) => item.status !== "hold" && item.startDate === todayByUnit.get(item.unitId));
  const departures = activity.filter((item) => item.status !== "hold" && item.endDate === todayByUnit.get(item.unitId));
  const holds = activity.filter((item) => item.status === "hold");
  const activeUnits = units.filter((unit) => unit.status === "active").length;
  const schedule = [
    ...arrivals.map((reservation) => ({ kind: "arrival" as const, reservation })),
    ...departures.map((reservation) => ({ kind: "departure" as const, reservation })),
  ];

  return (
    <div className="mx-auto max-w-[1500px] overflow-hidden">
      <PageHeading
        title={`Good day, ${membership.organizationName}`}
        description={`${DATE_LABEL.format(new Date(`${today}T00:00:00Z`))} · Here is what needs your attention today.`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/calendar/availability" className={buttonClassName("outline", "md")}><CalendarCheck className="h-4 w-4" aria-hidden />Check availability</Link>
          <Link href="/reservations/new" className={buttonClassName("clay", "md")}><Plus className="h-4 w-4" aria-hidden />New reservation</Link>
        </div>
      </PageHeading>

      {units.length === 0 ? (
        <EmptyState
          title="Your operations dashboard is ready"
          description={membership.role === "owner" ? "Add your first property and unit to start tracking arrivals, cleaning work, occupancy and cash movement." : "Ask the owner to add the first property and unit."}
          action={membership.role === "owner" ? <Link href="/settings/properties/new" className={buttonClassName("clay", "md")}>Add a property</Link> : undefined}
        />
      ) : (
        <>
          <section aria-label="Today at a glance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Arrivals today", value: arrivals.length, helper: arrivals.length ? "Prepare guest access" : "No arrivals scheduled", icon: ArrowDownToLine, tone: "bg-sage/40 text-pine" },
              { label: "Departures today", value: departures.length, helper: departures.length ? "Turnovers may follow" : "No check-outs scheduled", icon: ArrowRightLeft, tone: "bg-clay-mist/70 text-clay-deep" },
              { label: "Needs cleaning", value: openTasks.length, helper: openTasks.length ? "Open turnover tasks" : "All units are ready", icon: BrushCleaning, tone: "bg-[#eee6d9] text-[#624a32]" },
              { label: "Active holds", value: holds.length, helper: holds.length ? "Waiting for confirmation" : "No holds expiring", icon: Clock3, tone: "bg-pine-mist text-pine" },
            ].map(({ label, value, helper, icon: Icon, tone }) => (
              <Card key={label} className="overflow-hidden">
                <CardBody className="flex items-center gap-4 p-4 sm:p-5">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden /></span>
                  <div className="min-w-0"><p className="text-xs font-medium text-ink/60">{label}</p><p className="mt-1 font-display text-3xl leading-none text-pine">{value}</p><p className="mt-1 truncate text-[11px] text-ink/45">{helper}</p></div>
                </CardBody>
              </Card>
            ))}
          </section>

          {membership.role === "owner" ? (
            <section aria-labelledby="money-heading" className="mt-6">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div><h2 id="money-heading" className="font-display text-2xl text-pine">Money this month</h2><p className="mt-1 text-xs text-ink/55">Cash basis for {monthRange.start} to {monthRange.end} (end date exclusive).</p></div>
                <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-clay-deep hover:underline">Open full reports<ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
              {report ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: "Cash collected", value: formatPHP(report.summary.bookingCollectedCents), note: "Booking payments", icon: Banknote },
                      { label: "Net operating cash", value: formatPHP(report.summary.netOperatingCashCents), note: "After refunds and operating expenses", icon: TrendingUp },
                      { label: "Booked value", value: formatPHP(report.summary.bookedValueCents), note: "Stay nights in this month", icon: CalendarCheck },
                      { label: "Deposits held", value: formatPHP(report.summary.depositsHeldCents), note: "Refundable liability", icon: Clock3 },
                    ].map(({ label, value, note, icon: Icon }) => (
                      <Card key={label}><CardBody className="p-4"><Icon className="h-4 w-4 text-clay" aria-hidden /><p className="mt-4 text-xs text-ink/55">{label}</p><p className="mt-1 break-words text-xl font-semibold tabular-nums text-pine">{value}</p><p className="mt-2 text-[11px] leading-4 text-ink/45">{note}</p></CardBody></Card>
                    ))}
                  </div>
                  <CashMovementChart
                    collected={report.summary.bookingCollectedCents}
                    refunded={report.summary.bookingRefundedCents}
                    expenses={report.summary.operatingExpensesCents}
                  />
                </div>
              ) : <Card><CardBody><p className="text-sm text-ink/60">The monthly money summary is temporarily unavailable. Your operations overview is still current.</p></CardBody></Card>}
            </section>
          ) : null}

          <section className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-xl text-pine">Today&apos;s schedule</h2><p className="mt-1 text-xs text-ink/50">Arrivals and departures across all active units.</p></div><Badge tone="neutral">{schedule.length} event{schedule.length === 1 ? "" : "s"}</Badge></CardHeader>
              <CardBody className="p-0">
                {schedule.length ? <ul className="divide-y divide-pine/10">{schedule.map(({ kind, reservation }) => {
                  const property = propertyForUnit(reservation.unitId);
                  const unit = unitById.get(reservation.unitId);
                  const arrival = kind === "arrival";
                  const time = arrival ? property?.checkInTime : property?.checkOutTime;
                  return (
                    <li key={`${kind}:${reservation.id}`}>
                      <Link href={`/reservations/${reservation.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-pine-mist/35">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${arrival ? "bg-sage/55 text-pine" : "bg-clay-mist text-clay-deep"}`}>{arrival ? <ArrowDownToLine className="h-4 w-4" aria-hidden /> : <ArrowRightLeft className="h-4 w-4" aria-hidden />}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-pine">{reservation.guestName}</span><span className="mt-1 block truncate text-xs text-ink/55">{property?.name} · {unit?.name}</span></span>
                        <span className="text-right"><span className="block text-xs font-medium text-ink/70">{arrival ? "Check-in" : "Check-out"}</span><span className="mt-1 block text-xs tabular-nums text-ink/50">{time ? localTimeLabel(time) : "Time not set"}</span></span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink/35" aria-hidden />
                      </Link>
                    </li>
                  );
                })}</ul> : <p className="px-5 py-8 text-center text-sm text-ink/55">No arrivals or departures today. Use the quiet window to clear turnover work and follow up active holds.</p>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader className="flex items-center justify-between gap-3"><div><h2 className="font-display text-xl text-pine">Operations watchlist</h2><p className="mt-1 text-xs text-ink/50">Readiness and inventory right now.</p></div><BrushCleaning className="h-5 w-5 text-clay" aria-hidden /></CardHeader>
              <CardBody className="space-y-5">
                <div><div className="flex items-center justify-between text-sm"><span className="text-ink/60">Active inventory</span><strong className="text-pine">{activeUnits} / {units.length} units</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-pine-mist"><div className="h-full rounded-full bg-pine" style={{ width: `${units.length ? (activeUnits / units.length) * 100 : 0}%` }} /></div></div>
                {report ? <div><div className="flex items-center justify-between text-sm"><span className="text-ink/60">Month occupancy</span><strong className="text-pine">{percent(report.summary.occupancyRate)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-pine-mist"><div className="h-full rounded-full bg-clay" style={{ width: `${Math.max(0, Math.min(100, (report.summary.occupancyRate ?? 0) * 100))}%` }} /></div><p className="mt-2 text-[11px] text-ink/45">{report.summary.occupiedNights} occupied of {report.summary.bookableNights} bookable nights</p></div> : null}
                <div className="border-t border-pine/10 pt-4">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium text-pine">Turnover tasks</p><Link href="/tasks?status=open" className="text-xs text-clay-deep hover:underline">View all</Link></div>
                  {openTasks.length ? <ul className="mt-3 space-y-2">{openTasks.slice(0, 3).map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-clay-mist/50 px-3 py-2.5 text-xs hover:bg-clay-mist"><span className="min-w-0 truncate">{task.propertyName} · {task.unitName}</span><span className="shrink-0 text-ink/55">{task.doneItems}/{task.totalItems}</span></Link></li>)}</ul> : <p className="mt-3 text-xs text-ink/55">No units waiting for turnover.</p>}
                </div>
              </CardBody>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function CashMovementChart({ collected, refunded, expenses }: { collected: number; refunded: number; expenses: number }) {
  const rows = [
    { label: "Collected", value: collected, color: "bg-pine" },
    { label: "Refunded", value: refunded, color: "bg-clay" },
    { label: "Operating expenses", value: expenses, color: "bg-[#c49a6c]" },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Card aria-labelledby="cash-movement-title">
      <CardHeader><h3 id="cash-movement-title" className="font-display text-lg text-pine">Cash movement</h3><p className="mt-1 text-xs text-ink/50">Booking cash in and operating cash out this month.</p></CardHeader>
      <CardBody className="space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="text-ink/60">{row.label}</span><span className="font-medium tabular-nums text-pine">{formatPHP(row.value)}</span></div>
            <div className="h-3 overflow-hidden rounded-full bg-pine-mist/80"><div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / max) * 100}%`, minWidth: row.value > 0 ? "0.75rem" : 0 }} /></div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
