import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownToLine, BrushCleaning, CalendarCheck, Clock3, Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import { calendarEventsForUnit, monthGridRange, type CalendarEvent } from "@/lib/calendar";
import { addDaysLocal, isValidMonth, nightsBetween, shiftMonth, todayInTimeZone } from "@/lib/dates";
import { RESERVATION_STATUS_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { getOccupancySegments, listCalendarActivity } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { MonthCalendar, type DisplayCalendarEvent } from "./month-calendar";
import { TodayPanel } from "./today-panel";

export const metadata: Metadata = { title: "Calendar" };
const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function CalendarPage({ searchParams }: {
  searchParams: Promise<{ month?: string; unit?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;
  const [properties, allUnits] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);

  if (properties.length === 0) {
    return <div className="mx-auto max-w-5xl"><PageHeading title="Calendar" /><EmptyState title="No properties yet" description={membership.role === "owner" ? "Add a property and its first unit to start planning your stays." : "Ask the owner to add a property and its first unit."} action={membership.role === "owner" ? <Link href="/settings/properties" className={buttonClassName("clay", "md")}>Add your first property</Link> : undefined} /></div>;
  }

  const selectedUnit = allUnits.find((unit) => unit.id === params.unit);
  const visibleUnits = selectedUnit ? [selectedUnit] : allUnits;
  const unitMap = new Map(allUnits.map((unit) => [unit.id, unit]));
  const propertyMap = new Map(properties.map((property) => [property.id, property]));
  const propertyForUnit = (unitId: string) => propertyMap.get(unitMap.get(unitId)!.propertyId)!;
  // Resolve the selected property's timezone BEFORE deriving today or the month.
  const timezone = selectedUnit ? propertyForUnit(selectedUnit.id).timezone : properties[0]!.timezone;
  const today = todayInTimeZone(timezone);
  const unitDays = visibleUnits.map((unit) => ({ unitId: unit.id, today: todayInTimeZone(propertyForUnit(unit.id).timezone) }));
  const todayByUnit = new Map(unitDays.map((unit) => [unit.unitId, unit.today]));
  const multipleTimezones = new Set(visibleUnits.map((unit) => propertyForUnit(unit.id).timezone)).size > 1;
  const month = isValidMonth(params.month ?? "") ? params.month! : today.slice(0, 7);
  const gridRange = monthGridRange(month);
  const [segmentsByUnit, activity, taskRows] = await Promise.all([
    // Include the preceding night so checkout on the first grid date is retained.
    getOccupancySegments(membership.organizationId, visibleUnits.map((unit) => unit.id), addDaysLocal(gridRange.start, -1), gridRange.end),
    listCalendarActivity(membership.organizationId, unitDays),
    listTasks(membership.organizationId, { status: "open" }),
  ]);

  const unitLabel = (unitId: string) => {
    const unit = unitMap.get(unitId)!;
    return properties.length > 1 ? `${propertyForUnit(unitId).name} · ${unit.name}` : unit.name;
  };
  const expiryLabel = (date: Date, unitId: string) => new Intl.DateTimeFormat("en-PH", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: propertyForUnit(unitId).timezone,
  }).format(date);
  const visibleIds = new Set(visibleUnits.map((unit) => unit.id));
  const openTasks = taskRows.filter((task) => visibleIds.has(task.unitId));
  const needsCleaning = new Set(openTasks.map((task) => task.unitId)).size;
  const arrivals = activity.filter((reservation) => reservation.status !== "hold" && reservation.startDate === todayByUnit.get(reservation.unitId));
  const departures = activity.filter((reservation) => reservation.status !== "hold" && reservation.endDate === todayByUnit.get(reservation.unitId));
  const activeHolds = activity.filter((reservation) => reservation.status === "hold");

  // Unit status controls bookability; it is not a calendar event. Real blocks,
  // stays, holds, and check-outs remain visible regardless of current status.
  const events: CalendarEvent[] = visibleUnits.flatMap((unit) =>
    calendarEventsForUnit(unit.id, segmentsByUnit.get(unit.id) ?? []),
  );
  const displayEvents: DisplayCalendarEvent[] = events.map((event) => {
    const unit = unitMap.get(event.unitId)!;
    const nights = nightsBetween(event.startDate, event.endDate);
    const nightLabel = `${nights} night${nights === 1 ? "" : "s"}`;
    const detail = event.kind === "checkout"
      ? event.status === "checked_out" ? "Checked out" : "Check-out"
      : event.kind === "hold"
        ? `Hold · ${nightLabel}${event.expiresAt ? ` · expires ${expiryLabel(event.expiresAt, event.unitId)}` : ""}`
        : event.kind === "stay"
          ? `${RESERVATION_STATUS_LABELS[event.status!]} · ${nightLabel}`
          : event.description ?? "Unit unavailable";
    return {
      ...event,
      startTime: event.kind === "stay" || event.kind === "hold" ? unit.checkInTime : undefined,
      endTime: event.kind === "checkout" ? unit.checkOutTime : undefined,
      unitLabel: unitLabel(event.unitId),
      detail,
      href: event.reservationId ? `/reservations/${event.reservationId}` : membership.role === "owner" ? `/settings/properties/${unit.propertyId}/units/${unit.id}` : undefined,
      accessibleLabel: `${event.title} · ${unitLabel(event.unitId)} · ${detail} · ${event.startDate}${event.kind === "checkout" ? "; checkout marker, not occupancy" : ` to ${event.endDate} (end date exclusive)`}`,
    };
  });

  const calendarHref = (targetMonth: string) => `/calendar?${new URLSearchParams({ month: targetMonth, ...(selectedUnit ? { unit: selectedUnit.id } : {}) })}`;
  const newReservationHref = (date: string) => `/reservations/new?${new URLSearchParams({ checkIn: date, checkOut: addDaysLocal(date, 1), ...(selectedUnit?.status === "active" ? { unit: selectedUnit.id } : {}) })}`;
  const canBookVisibleUnit = visibleUnits.some((unit) => unit.status === "active");
  const monthLabel = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
  // Only display-safe fields cross into the presentation components.
  const activityDisplay = (reservation: (typeof activity)[number]) => ({
    ...reservation,
    unitLabel: unitLabel(reservation.unitId),
    timezone: propertyForUnit(reservation.unitId).timezone,
    checkInTime: propertyForUnit(reservation.unitId).checkInTime,
    checkOutTime: propertyForUnit(reservation.unitId).checkOutTime,
    expiryLabel: reservation.expiresAt ? expiryLabel(reservation.expiresAt, reservation.unitId) : null,
  });

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] overflow-hidden">
      <PageHeading title="Calendar">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3 sm:ml-5">
          <form method="get" className="flex min-w-0 items-center gap-2">
            <input type="hidden" name="month" value={month} />
            <label htmlFor="unit-filter" className="sr-only">Calendar unit</label>
            <Select id="unit-filter" name="unit" defaultValue={selectedUnit?.id ?? ""} className="max-w-64 bg-linen sm:min-w-48">
              <option value="">All units</option>
              {allUnits.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit.id)}{unit.status !== "active" ? ` · ${UNIT_STATUS_LABELS[unit.status]}` : ""}</option>)}
            </Select>
            <Button type="submit" variant="outline" size="sm">Show</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Link href="/calendar/availability" className={buttonClassName("outline", "md")}><CalendarCheck className="h-4 w-4" aria-hidden />Check availability</Link>
            <Link href={newReservationHref(today)} className={buttonClassName("clay", "md")}><Plus className="h-4 w-4" aria-hidden />New reservation</Link>
          </div>
        </div>
      </PageHeading>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: "Arriving today", count: arrivals.length, icon: ArrowDownToLine, href: "#today-arrivals", tone: "bg-sage/40", iconTone: "bg-sage" },
              { label: "Active holds", count: activeHolds.length, icon: Clock3, href: "#active-holds", tone: "bg-[#eee6d9]", iconTone: "bg-[#e6d7c1]" },
              { label: "Needs cleaning", count: needsCleaning, icon: BrushCleaning, href: "#needs-cleaning", tone: "bg-sage/40", iconTone: "bg-sage" },
            ].map(({ label, count, icon: Icon, href, tone, iconTone }) => (
              <Link key={label} href={href} className={`flex min-w-0 items-center gap-3 rounded-lg p-3 transition-[filter] hover:brightness-95 sm:p-4 ${tone}`}>
                <span className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-pine lg:inline-flex ${iconTone}`}><Icon className="h-5 w-5" strokeWidth={1.6} aria-hidden /></span>
                <div><p className="text-[11px] leading-4 text-ink/80 sm:text-xs">{label}</p><p className="mt-1 font-display text-3xl leading-none text-pine">{count}</p></div>
              </Link>
            ))}
          </div>

          {visibleUnits.length ? <MonthCalendar month={month} today={today} monthLabel={monthLabel} events={displayEvents} previousHref={calendarHref(shiftMonth(month, -1))} nextHref={calendarHref(shiftMonth(month, 1))} todayHref={calendarHref(today.slice(0, 7))} newReservationHref={canBookVisibleUnit ? newReservationHref : null} reservationUnitId={selectedUnit?.status === "active" ? selectedUnit.id : undefined} /> : <EmptyState title="No units to show" description="Add a unit to your property to see stays and availability here." action={membership.role === "owner" ? <Link href="/settings/properties" className={buttonClassName("outline", "md")}>Manage properties</Link> : undefined} />}

          <p className="mt-2 text-xs leading-relaxed text-ink/55">{multipleTimezones ? `Dates use each property's timezone. The calendar's today highlight uses ${timezone}; the Today panel uses each unit's local date.` : `Property timezone: ${timezone}.`} Inactive units keep their booking history; gray status bars apply only from today.</p>
        </div>

        <TodayPanel today={today} timezone={timezone} multipleTimezones={multipleTimezones} scopeLabel={selectedUnit ? unitLabel(selectedUnit.id) : "All units"} arrivals={arrivals.map(activityDisplay)} departures={departures.map(activityDisplay)} activeHolds={activeHolds.map(activityDisplay)} openTasks={openTasks.map((task) => ({ ...task, unitLabel: unitLabel(task.unitId) }))} />
      </div>
    </div>
  );
}
