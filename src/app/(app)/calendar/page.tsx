import Link from "next/link";
import type { Metadata } from "next";
import { CalendarCheck, Plus } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import {
  calendarEventsForUnit,
  monthGridRange,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  addDaysLocal,
  isValidMonth,
  nightsBetween,
  shiftMonth,
  todayInTimeZone,
  utcToLocalDateTimeParts,
} from "@/lib/dates";
import { RESERVATION_STATUS_LABELS, UNIT_STATUS_LABELS } from "@/lib/labels";
import {
  getOccupancySegments,
  listCalendarActivity,
} from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { listTasks } from "@/server/operations/service";
import { PageHeading } from "@/components/app/page-heading";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthCalendar, type DisplayCalendarEvent } from "./month-calendar";
import { TodayPanel } from "./today-panel";
import { UnitFilter } from "./unit-filter";

export const metadata: Metadata = { title: "Calendar" };
const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const SHORT_DATE = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const DAY_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
function timeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
}
/** "3PM", "10:30AM": fits on a slim calendar bar. */
function compactTimeLabel(time: string) {
  const [hour, minute] = time.split(":");
  return `${Number(hour) % 12 || 12}${minute === "00" ? "" : `:${minute}`}${Number(hour) < 12 ? "AM" : "PM"}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; unit?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;
  const [properties, allUnits] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);

  if (properties.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeading title="Calendar" />
        <EmptyState
          title="No properties yet"
          description={
            membership.role === "owner"
              ? "Add a property and its first unit to start planning your stays."
              : "Ask the owner to add a property and its first unit."
          }
          action={
            membership.role === "owner" ? (
              <Link
                href="/settings/properties"
                className={buttonClassName("clay", "md")}
              >
                Add your first property
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const selectedUnit = allUnits.find((unit) => unit.id === params.unit);
  const visibleUnits = selectedUnit ? [selectedUnit] : allUnits;
  const unitMap = new Map(allUnits.map((unit) => [unit.id, unit]));
  const propertyMap = new Map(
    properties.map((property) => [property.id, property]),
  );
  const propertyForUnit = (unitId: string) =>
    propertyMap.get(unitMap.get(unitId)!.propertyId)!;
  // Resolve the selected property's timezone BEFORE deriving today or the month.
  const timezone = selectedUnit
    ? propertyForUnit(selectedUnit.id).timezone
    : properties[0]!.timezone;
  const today = todayInTimeZone(timezone);
  const unitDays = visibleUnits.map((unit) => ({
    unitId: unit.id,
    today: todayInTimeZone(propertyForUnit(unit.id).timezone),
  }));
  const todayByUnit = new Map(
    unitDays.map((unit) => [unit.unitId, unit.today]),
  );
  const multipleTimezones =
    new Set(visibleUnits.map((unit) => propertyForUnit(unit.id).timezone))
      .size > 1;
  const month = isValidMonth(params.month ?? "")
    ? params.month!
    : today.slice(0, 7);
  const gridRange = monthGridRange(month);
  const [segmentsByUnit, activity, taskRows] = await Promise.all([
    // Include the preceding night so time-bound turnovers on the first grid date are retained.
    getOccupancySegments(
      membership.organizationId,
      visibleUnits.map((unit) => unit.id),
      addDaysLocal(gridRange.start, -1),
      gridRange.end,
    ),
    listCalendarActivity(membership.organizationId, unitDays),
    listTasks(membership.organizationId, { status: "open" }),
  ]);

  const unitLabel = (unitId: string) => {
    const unit = unitMap.get(unitId)!;
    return properties.length > 1
      ? `${propertyForUnit(unitId).name} · ${unit.name}`
      : unit.name;
  };
  const expiryLabel = (date: Date, unitId: string) =>
    new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: propertyForUnit(unitId).timezone,
    }).format(date);
  const visibleIds = new Set(visibleUnits.map((unit) => unit.id));
  const openTasks = taskRows.filter((task) => visibleIds.has(task.unitId));
  const arrivals = activity.filter(
    (reservation) =>
      reservation.status !== "hold" &&
      reservation.startDate === todayByUnit.get(reservation.unitId),
  );
  const departures = activity.filter(
    (reservation) =>
      reservation.status !== "hold" &&
      reservation.endDate === todayByUnit.get(reservation.unitId),
  );
  const activeHolds = activity.filter(
    (reservation) => reservation.status === "hold",
  );

  // Unit status controls bookability; it is not a calendar event. Real blocks,
  // stays, holds, manual blocks, and turnovers remain visible regardless of current status.
  const events: CalendarEvent[] = visibleUnits.flatMap((unit) =>
    calendarEventsForUnit(unit.id, segmentsByUnit.get(unit.id) ?? []),
  );
  // Turnovers render as a marker where the departing stay ends, not as bars.
  const turnoverByReservation = new Map(
    events
      .filter((event) => event.kind === "turnover" && event.reservationId)
      .map((event) => [event.reservationId!, event]),
  );
  const shortDate = (date: string) =>
    SHORT_DATE.format(new Date(`${date}T00:00:00Z`));
  const dayLabel = (date: string) =>
    DAY_LABEL.format(new Date(`${date}T00:00:00Z`));
  const displayEvents = events.flatMap((event): DisplayCalendarEvent[] => {
    if (event.kind === "turnover") return [];
    const unit = unitMap.get(event.unitId)!;
    const timezone = propertyForUnit(event.unitId).timezone;
    const reservationEvent = event.kind === "stay" || event.kind === "hold";
    const nights = nightsBetween(event.startDate, event.endDate);
    const nightLabel = `${nights} night${nights === 1 ? "" : "s"}`;
    const turnover = event.reservationId
      ? turnoverByReservation.get(event.reservationId)
      : undefined;
    const turnoverWindow =
      turnover?.startTime && turnover.endTime
        ? { startTime: turnover.startTime, endTime: turnover.endTime }
        : undefined;
    const href = event.reservationId
      ? `/reservations/${event.reservationId}`
      : membership.role === "owner"
        ? `/settings/properties/${unit.propertyId}/units/${unit.id}`
        : undefined;
    const title =
      event.kind === "block" ? (event.description ?? event.title) : event.title;

    if (!reservationEvent) {
      const lastNight = addDaysLocal(event.endDate, -1);
      return [
        {
          ...event,
          unitLabel: unitLabel(event.unitId),
          detail: event.description ?? "Unit unavailable",
          href,
          accessibleLabel: `Blocked · ${title} · ${unitLabel(event.unitId)} · ${shortDate(event.startDate)} to ${shortDate(lastNight)}`,
          quickView: {
            kindLabel: "Blocked",
            tone: "block",
            title,
            unitLabel: unitLabel(event.unitId),
            facts: [
              { label: "From", value: dayLabel(event.startDate) },
              { label: "Through", value: dayLabel(lastNight) },
            ],
            href,
            hrefLabel: "View unit",
          },
        },
      ];
    }

    // The bar ends at the recorded departure when there is one, otherwise at
    // the unit's expected check-out time on the checkout date.
    const actual = event.actualCheckoutAt
      ? utcToLocalDateTimeParts(event.actualCheckoutAt, timezone)
      : null;
    const endDate = actual?.date ?? event.endDate;
    const endTime = actual?.time ?? unit.checkOutTime;
    const tone =
      event.kind === "hold"
        ? "hold"
        : event.status === "checked_in"
          ? "in-house"
          : event.status === "checked_out"
            ? "checked-out"
            : "confirmed";
    const kindLabel =
      event.kind === "hold" ? "Hold" : RESERVATION_STATUS_LABELS[event.status!];
    const detail =
      event.kind === "hold"
        ? `Hold · ${nightLabel}${event.expiresAt ? ` · expires ${expiryLabel(event.expiresAt, event.unitId)}` : ""}`
        : `${kindLabel} · ${nightLabel}`;
    const checkInLabel = `${shortDate(event.startDate)}, ${timeLabel(unit.checkInTime)}`;
    const checkOutLabel = `${shortDate(endDate)}, ${timeLabel(endTime)}${actual ? " (actual)" : ""}`;
    const facts = [
      { label: "Nights", value: String(nights) },
      ...(event.guestCount
        ? [{ label: "Guests", value: String(event.guestCount) }]
        : []),
      ...(event.kind === "hold" && event.expiresAt
        ? [
            {
              label: "Hold expires",
              value: expiryLabel(event.expiresAt, event.unitId),
            },
          ]
        : []),
    ];
    return [
      {
        ...event,
        endDate,
        timed: true,
        startTime: unit.checkInTime,
        endTime,
        turnover: turnoverWindow,
        timeLabel: `${compactTimeLabel(unit.checkInTime)} → ${compactTimeLabel(endTime)}`,
        unitLabel: unitLabel(event.unitId),
        detail,
        href,
        accessibleLabel: `${event.title} · ${unitLabel(event.unitId)} · ${detail} · check-in ${checkInLabel} · check-out ${checkOutLabel}${turnover ? ` · ${turnover.description}` : ""}`,
        quickView: {
          kindLabel,
          tone,
          title: event.title,
          unitLabel: unitLabel(event.unitId),
          checkIn: {
            date: dayLabel(event.startDate),
            time: timeLabel(unit.checkInTime),
          },
          checkOut: {
            date: dayLabel(endDate),
            time: timeLabel(endTime),
            actual: Boolean(actual),
            expected: actual
              ? `${shortDate(event.endDate)}, ${timeLabel(unit.checkOutTime)}`
              : undefined,
          },
          facts,
          turnover: turnoverWindow
            ? `Turnover ${timeLabel(turnoverWindow.startTime)} – ${timeLabel(turnoverWindow.endTime)}`
            : undefined,
          href,
          hrefLabel: "View reservation",
        },
      },
    ];
  });

  const calendarHref = (targetMonth: string) =>
    `/calendar?${new URLSearchParams({ month: targetMonth, ...(selectedUnit ? { unit: selectedUnit.id } : {}) })}`;
  const newReservationHref = (date: string) =>
    `/reservations/new?${new URLSearchParams({ checkIn: date, checkOut: addDaysLocal(date, 1), ...(selectedUnit?.status === "active" ? { unit: selectedUnit.id } : {}) })}`;
  const canBookVisibleUnit = visibleUnits.some(
    (unit) => unit.status === "active",
  );
  const monthLabel = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
  // Only display-safe fields cross into the presentation components.
  const activityDisplay = (reservation: (typeof activity)[number]) => ({
    ...reservation,
    unitLabel: unitLabel(reservation.unitId),
    timezone: propertyForUnit(reservation.unitId).timezone,
    checkInTime:
      unitMap.get(reservation.unitId)!.checkInTime ??
      propertyForUnit(reservation.unitId).checkInTime,
    checkOutTime:
      unitMap.get(reservation.unitId)!.checkOutTime ??
      propertyForUnit(reservation.unitId).checkOutTime,
    expiryLabel: reservation.expiresAt
      ? expiryLabel(reservation.expiresAt, reservation.unitId)
      : null,
  });

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] overflow-hidden">
      <PageHeading title="Calendar">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/calendar/availability"
            className={buttonClassName("ghost", "md")}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Check availability
          </Link>
          <Link
            href={newReservationHref(today)}
            className={buttonClassName("clay", "md")}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New reservation
          </Link>
        </div>
      </PageHeading>

      {allUnits.length > 1 ? (
        <UnitFilter
          selectedId={selectedUnit?.id ?? null}
          hrefFor={(unitId) => `/calendar?${new URLSearchParams({ month, ...(unitId ? { unit: unitId } : {}) })}`}
          units={allUnits.map((unit) => {
            const property = propertyMap.get(unit.propertyId);
            return {
              id: unit.id,
              name: unit.name,
              propertyName: property?.name ?? null,
              imageUrl: unit.imageUrl ?? property?.imageUrl ?? null,
              bedrooms: unit.bedrooms,
              statusLabel: unit.status === "active" ? null : UNIT_STATUS_LABELS[unit.status],
            };
          })}
        />
      ) : null}

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          {visibleUnits.length ? (
            <MonthCalendar
              month={month}
              today={today}
              monthLabel={monthLabel}
              events={displayEvents}
              previousHref={calendarHref(shiftMonth(month, -1))}
              nextHref={calendarHref(shiftMonth(month, 1))}
              todayHref={calendarHref(today.slice(0, 7))}
              newReservationHref={
                canBookVisibleUnit ? newReservationHref : null
              }
              reservationUnitId={
                selectedUnit?.status === "active" ? selectedUnit.id : undefined
              }
              showUnit={!selectedUnit && allUnits.length > 1}
            />
          ) : (
            <EmptyState
              title="No units to show"
              description="Add a unit to your property to see stays and availability here."
              action={
                membership.role === "owner" ? (
                  <Link
                    href="/settings/properties"
                    className={buttonClassName("outline", "md")}
                  >
                    Manage properties
                  </Link>
                ) : undefined
              }
            />
          )}
        </div>

        <TodayPanel
          today={today}
          timezone={timezone}
          multipleTimezones={multipleTimezones}
          scopeLabel={selectedUnit ? unitLabel(selectedUnit.id) : "All units"}
          arrivals={arrivals.map(activityDisplay)}
          departures={departures.map(activityDisplay)}
          activeHolds={activeHolds.map(activityDisplay)}
          openTasks={openTasks.map((task) => ({
            ...task,
            unitLabel: unitLabel(task.unitId),
          }))}
        />
      </div>
    </div>
  );
}
