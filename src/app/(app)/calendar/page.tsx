import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireMembership } from "@/lib/auth/session";
import {
  isValidMonth,
  listNights,
  monthNightRange,
  shiftMonth,
  todayInTimeZone,
} from "@/lib/dates";
import { UNIT_STATUS_LABELS, RESERVATION_STATUS_LABELS } from "@/lib/labels";
import {
  buildNightStatusMap,
  getOccupancySegments,
  type NightStatus,
} from "@/server/inventory/availability";
import {
  listOrgUnits,
  listProperties,
} from "@/server/inventory/service";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/input";
import { AvailabilityCheckForm } from "./availability-check-form";

export const metadata: Metadata = { title: "Calendar" };

const MONTH_LABEL = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const NIGHT_LABEL = new Intl.DateTimeFormat("en-PH", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const TIME_LABEL = new Intl.DateTimeFormat("en-PH", { timeStyle: "short" });

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; unit?: string }>;
}) {
  const membership = await requireMembership();
  const params = await searchParams;

  const properties = await listProperties(membership.organizationId);
  const allUnits = await listOrgUnits(membership.organizationId);

  const timezone = properties[0]?.timezone ?? "Asia/Manila";
  const today = todayInTimeZone(timezone);
  const month = isValidMonth(params.month ?? "")
    ? (params.month as string)
    : today.slice(0, 7);
  const { start, end } = monthNightRange(month);
  const nights = listNights(start, end);

  const visibleUnits = params.unit
    ? allUnits.filter((unit) => unit.id === params.unit)
    : allUnits;

  const segmentsByUnit = await getOccupancySegments(
    membership.organizationId,
    visibleUnits.map((unit) => unit.id),
    start,
    end,
  );

  const unitLabel = (unitId: string) => {
    const unit = allUnits.find((candidate) => candidate.id === unitId);
    if (!unit) return "Unit";
    const property = properties.find((item) => item.id === unit.propertyId);
    return properties.length > 1 && property
      ? `${property.name} · ${unit.name}`
      : unit.name;
  };

  const monthLabel = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));

  // Built once per unit for the whole month.
  const nightMaps = new Map<string, Map<string, NightStatus>>();
  for (const unit of visibleUnits) {
    nightMaps.set(
      unit.id,
      buildNightStatusMap(start, end, segmentsByUnit.get(unit.id) ?? []),
    );
  }

  if (properties.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl text-pine">Calendar</h1>
        <EmptyState
          className="mt-8"
          title="No properties yet"
          description="Your calendar shows availability once you add a property and its first unit."
          action={
            <Link
              href="/settings/properties"
              className={buttonClassName("primary", "md")}
            >
              Add your first property
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-pine">Calendar</h1>
          <p className="mt-1 text-sm text-ink/60">
            Availability, holds and reservations across your units. Nights use
            each property&apos;s local timezone; check-out days are free.
          </p>
        </div>
        <Link
          href="/settings/properties"
          className={buttonClassName("outline", "md")}
        >
          Manage properties
        </Link>
      </div>

      <div className="mt-6">
        <AvailabilityCheckForm
          units={allUnits.map((unit) => ({
            id: unit.id,
            name: unitLabel(unit.id),
          }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${shiftMonth(month, -1)}${params.unit ? `&unit=${params.unit}` : ""}`}
            className={buttonClassName("ghost", "sm")}
            aria-label={`Previous month, ${shiftMonth(month, -1)}`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h2 className="min-w-40 text-center font-display text-xl text-pine">
            {monthLabel}
          </h2>
          <Link
            href={`/calendar?month=${shiftMonth(month, 1)}${params.unit ? `&unit=${params.unit}` : ""}`}
            className={buttonClassName("ghost", "sm")}
            aria-label={`Next month, ${shiftMonth(month, 1)}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          {month !== today.slice(0, 7) ? (
            <Link
              href={`/calendar${params.unit ? `?unit=${params.unit}` : ""}`}
              className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
            >
              Back to today
            </Link>
          ) : null}
        </div>

        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="month" value={month} />
          <label htmlFor="unit-filter" className="text-sm text-ink/60">
            Unit
          </label>
          <Select id="unit-filter" name="unit" defaultValue={params.unit ?? ""}>
            <option value="">All units</option>
            {allUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unitLabel(unit.id)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>
      </div>

      {visibleUnits.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No units to show"
          description="Add a unit under Settings → Properties & units, or clear the filter."
        />
      ) : (
        <>
          {/* Desktop: night matrix */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)] lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-40 bg-white px-4 py-3 text-left font-medium text-pine">
                    Unit
                  </th>
                  {nights.map((night) => (
                    <th
                      key={night}
                      className={`min-w-9 px-1 py-3 text-center text-xs font-medium ${
                        night === today
                          ? "text-clay-deep"
                          : "text-ink/50"
                      }`}
                    >
                      {NIGHT_LABEL.format(new Date(`${night}T00:00:00Z`))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUnits.map((unit) => {
                  const map = nightMaps.get(unit.id)!;
                  const inactive = unit.status !== "active";
                  return (
                    <tr
                      key={unit.id}
                      className="border-t border-pine/10"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left font-medium"
                      >
                        <span className="block truncate text-pine">
                          {unitLabel(unit.id)}
                        </span>
                        {inactive ? (
                          <span className="text-xs font-normal text-ink/50">
                            {UNIT_STATUS_LABELS[unit.status]}
                          </span>
                        ) : null}
                      </th>
                      {nights.map((night) => {
                        const status = map.get(night) ?? {
                          kind: "available" as const,
                        };
                        let title: string;
                        let cellClass: string;
                        let reservationLink: string | null = null;
                        if (status.kind === "blocked") {
                          title = `Out of service — ${status.reason}`;
                          cellClass = "bg-clay-mist";
                        } else if (status.kind === "held") {
                          title = `Hold for ${status.guestName} — expires ${
                            status.expiresAt
                              ? TIME_LABEL.format(status.expiresAt)
                              : "soon"
                          }`;
                          cellClass = "bg-clay/45";
                          reservationLink = `/reservations/${status.segmentId}`;
                        } else if (status.kind === "booked") {
                          title = `${RESERVATION_STATUS_LABELS[status.status]} — ${status.guestName}`;
                          cellClass = "bg-pine/75";
                          reservationLink = `/reservations/${status.segmentId}`;
                        } else if (inactive) {
                          title = `Not accepting bookings — ${UNIT_STATUS_LABELS[unit.status]}`;
                          cellClass = "bg-pine-mist/50";
                        } else {
                          title = "Available";
                          cellClass = "bg-sage/40";
                        }
                        const ariaLabel = `${unitLabel(unit.id)} ${NIGHT_LABEL.format(new Date(`${night}T00:00:00Z`))}: ${title}`;
                        return (
                          <td
                            key={night}
                            className={`h-9 border-l border-pine/5 px-0 text-center ${cellClass} ${
                              night === today
                                ? "ring-1 ring-inset ring-clay/50"
                                : ""
                            }`}
                          >
                            {reservationLink ? (
                              <Link
                                href={reservationLink}
                                title={title}
                                aria-label={ariaLabel}
                                className="block h-full w-full"
                              />
                            ) : (
                              <span
                                title={title}
                                aria-label={ariaLabel}
                                className="block h-full w-full"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-4 border-t border-pine/10 px-4 py-3 text-xs text-ink/55">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-sage/70" /> Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-clay/45" /> Hold
                (expires)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-pine/75" /> Booked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-clay-mist" /> Out of
                service (hover for reason)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-pine-mist/70" /> Not
                accepting bookings
              </span>
            </div>
          </div>

          {/* Mobile: date-grouped list */}
          <div className="mt-4 space-y-4 lg:hidden">
            {nights.map((night) => {
              const isToday = night === today;
              return (
                <section
                  key={night}
                  className="rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]"
                  aria-label={NIGHT_LABEL.format(new Date(`${night}T00:00:00Z`))}
                >
                  <h3
                    className={`border-b border-pine/10 px-4 py-2.5 font-display text-base ${
                      isToday ? "text-clay-deep" : "text-pine"
                    }`}
                  >
                    {NIGHT_LABEL.format(new Date(`${night}T00:00:00Z`))}
                    {isToday ? " · Today" : ""}
                  </h3>
                  <ul className="divide-y divide-pine/10">
                    {visibleUnits.map((unit) => {
                      const status = nightMaps.get(unit.id)?.get(night) ?? {
                        kind: "available" as const,
                      };
                      const inactive = unit.status !== "active";
                      const reservationLink =
                        status.kind === "held" || status.kind === "booked"
                          ? `/reservations/${status.segmentId}`
                          : null;
                      const statusText =
                        status.kind === "blocked"
                          ? `Out of service — ${status.reason}`
                          : status.kind === "held"
                            ? `Hold — ${status.guestName}`
                            : status.kind === "booked"
                              ? `${RESERVATION_STATUS_LABELS[status.status]} — ${status.guestName}`
                              : inactive
                                ? UNIT_STATUS_LABELS[unit.status]
                                : "Available";
                      const content = (
                        <>
                          <span className="min-w-0 truncate text-sm font-medium text-pine">
                            {unitLabel(unit.id)}
                          </span>
                          <span
                            className={`shrink-0 text-sm ${
                              status.kind === "blocked"
                                ? "text-clay-deep"
                                : status.kind === "held" ||
                                    status.kind === "booked"
                                  ? "text-pine"
                                  : inactive
                                    ? "text-ink/50"
                                    : "text-pine/70"
                            }`}
                          >
                            {statusText}
                          </span>
                        </>
                      );
                      return (
                        <li key={unit.id}>
                          {reservationLink ? (
                            <Link
                              href={reservationLink}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                              {content}
                            </Link>
                          ) : (
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              {content}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
