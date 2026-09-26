import { unitOrPropertyPhotoSrc } from "@/lib/photos";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  ClipboardList,
  Construction,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { addDaysLocal, nightsBetween, todayInTimeZone } from "@/lib/dates";
import { UNIT_STATUS_DESCRIPTIONS, UNIT_STATUS_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { normalizeChecklistTemplate } from "@/lib/turnover";
import { summarizeUnitActivity } from "@/lib/unit-activity";
import { dayRateSummary } from "@/lib/rates";
import { stayLengthHours, stayLengthLabel } from "@/lib/stay-times";
import { getOccupancySegments } from "@/server/inventory/availability";
import { getPropertyOrThrow, getUnitOrThrow, listUnitBlocks } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { listUnitAmenities } from "@/server/inventory/amenities";
import { buttonClassName } from "@/components/ui/button";
import { RemoveBlockButton } from "../block-forms";
import { AmenitySummary } from "../../../amenity-summary";
import {
  Panel,
  SideAction,
  StatTile,
  StayRow,
  UnitStatusBadge,
  percent,
} from "../../../inventory-display";
import { dayLabel, timeLabel, UnitPhoto } from "../../../../calendar/availability/stay-display";

export const metadata: Metadata = { title: "Unit" };

const OUTLOOK_DAYS = 30;
const UPCOMING_DAYS = 120;

export default async function UnitDetailPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const { propertyId, unitId } = await params;
  let property;
  let unit;
  try {
    property = await getPropertyOrThrow(membership.organizationId, propertyId);
    unit = await getUnitOrThrow(membership.organizationId, unitId);
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
  if (unit.propertyId !== property.id) notFound();

  const today = todayInTimeZone(property.timezone);
  const [blocks, amenities, segmentsByUnit] = await Promise.all([
    listUnitBlocks(membership.organizationId, unit.id, today),
    listUnitAmenities(membership.organizationId, unit.id),
    getOccupancySegments(membership.organizationId, [unit.id], today, addDaysLocal(today, UPCOMING_DAYS)),
  ]);
  const activity = summarizeUnitActivity(segmentsByUnit.get(unit.id) ?? [], today, addDaysLocal(today, OUTLOOK_DAYS));
  const checklist = normalizeChecklistTemplate(unit.checklistTemplate);
  const dayRates = dayRateSummary(unit.defaultNightlyRateCents, unit.dayRates, formatPHP);
  const unitHref = `/properties/${property.id}/units/${unit.id}`;
  const bookable = unit.status === "active";
  const newReservationHref = `/reservations/new?unit=${unit.id}`;
  const calendarHref = `/calendar?unit=${unit.id}`;

  const nowValue = activity.current
    ? activity.current.guestName
    : activity.blockedNow
      ? "Blocked"
      : "Free tonight";
  const nowDetail = activity.current
    ? `Until ${dayLabel(activity.current.endDate)}`
    : activity.blockedNow
      ? activity.blockedNow.reason
      : activity.next
        ? `Next: ${dayLabel(activity.next.startDate)}`
        : "No upcoming stays";

  return (
    <div className="min-w-0 overflow-hidden">
      <Link
        href={`/properties/${property.id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {property.name}
      </Link>

      <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        <div className="grid md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <UnitPhoto
            src={unitOrPropertyPhotoSrc(unit, property)}
            className="aspect-[16/9] md:aspect-auto md:h-full md:min-h-56"
          />
          <div className="@container flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <UnitStatusBadge status={unit.status} />
                <h1 className="mt-3 truncate font-display text-3xl tracking-tight text-pine sm:text-4xl">
                  {unit.name}
                </h1>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/65">
                  <MapPin className="h-4 w-4 shrink-0 text-pine/45" aria-hidden />
                  <span className="truncate">
                    {property.name}
                    {property.address ? ` · ${property.address}` : ""}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {bookable ? (
                  <Link href={newReservationHref} className={buttonClassName("clay", "md")}>
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    New reservation
                  </Link>
                ) : null}
                <Link href={`${unitHref}/edit`} className={buttonClassName("outline", "md")}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit
                </Link>
                <Link href={calendarHref} className={buttonClassName("ghost", "md")}>
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Calendar
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2.5 @3xl:grid-cols-4">
              <StatTile
                icon={Wallet}
                label="Nightly rate"
                value={unit.defaultNightlyRateCents ? formatPHP(unit.defaultNightlyRateCents) : "Not set"}
                detail={dayRates.length ? dayRates.join(" · ") : unit.cleaningFeeCents ? `+ ${formatPHP(unit.cleaningFeeCents)} cleaning` : undefined}
              />
              <StatTile
                icon={Users}
                label="Sleeps"
                value={`${unit.capacity} guest${unit.capacity === 1 ? "" : "s"}`}
                detail={`${unit.bedrooms} bed · ${unit.bathrooms} bath`}
              />
              <StatTile
                icon={TrendingUp}
                label={`Next ${OUTLOOK_DAYS} days`}
                value={percent(activity.bookedNights, activity.windowNights)}
                detail={`${activity.bookedNights} of ${activity.windowNights} nights booked`}
              />
              <StatTile
                icon={BedDouble}
                label="Tonight"
                value={nowValue}
                detail={nowDetail}
                tone={activity.current ? "sage" : activity.blockedNow ? "clay" : undefined}
              />
            </dl>
          </div>
        </div>
      </section>

      {!bookable ? (
        <p
          className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong>{UNIT_STATUS_LABELS[unit.status]}.</strong> {UNIT_STATUS_DESCRIPTIONS[unit.status]}
          </span>
          <Link href={`${unitHref}/status`} className="font-medium underline underline-offset-4">
            Change status
          </Link>
        </p>
      ) : null}

      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Upcoming stays"
            description={`Current and upcoming holds and bookings for the next ${UPCOMING_DAYS} days.`}
            action={
              <Link href={calendarHref} className="text-xs font-medium text-clay-deep hover:underline">
                View calendar
              </Link>
            }
            flush
          >
            {activity.upcoming.length ? (
              <ul className="divide-y divide-pine/8 border-t border-pine/8">
                {activity.upcoming.map((stay) => (
                  <li key={stay.id}>
                    <StayRow stay={stay} today={today} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="border-t border-pine/8 px-5 py-8 text-center sm:px-6">
                <p className="text-sm text-ink/60">No upcoming stays.</p>
                {bookable ? (
                  <Link href={newReservationHref} className={buttonClassName("outline", "sm", "mt-3")}>
                    <Plus className="h-4 w-4" aria-hidden />
                    New reservation
                  </Link>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel
            title="Out-of-service blocks"
            description="Nights closed for repairs or preparation."
            action={
              <Link href={`${unitHref}/blocks/new`} className={buttonClassName("outline", "sm")}>
                <Plus className="h-4 w-4" aria-hidden />
                Add block
              </Link>
            }
            flush
          >
            {blocks.length ? (
              <ul className="divide-y divide-pine/8 border-t border-pine/8">
                {blocks.map((block) => {
                  const lastNight = addDaysLocal(block.endDate, -1);
                  const nights = nightsBetween(block.startDate, block.endDate);
                  const range = `${dayLabel(block.startDate)}${lastNight !== block.startDate ? ` → ${dayLabel(lastNight)}` : ""}`;
                  return (
                    <li key={block.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                      <Construction className="h-4 w-4 shrink-0 text-ink/40" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-pine">{block.reason}</span>
                        <span className="block text-xs text-ink/55">
                          {range} · {nights} night{nights === 1 ? "" : "s"}
                        </span>
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Link
                          href={`${unitHref}/blocks/${block.id}/edit`}
                          className={buttonClassName("ghost", "sm")}
                          aria-label={`Edit block ${range}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Link>
                        <RemoveBlockButton propertyId={property.id} unitId={unit.id} blockId={block.id} label={range} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-pine/8 px-5 py-6 text-center text-sm text-ink/55 sm:px-6">
                No current or upcoming blocks.
              </p>
            )}
          </Panel>

          <Panel
            title="Turnover checklist"
            description={`${checklist.length} items · ${checklist.filter((item) => item.required).length} required. Every checkout opens a cleaning task from this list.`}
            action={
              <Link href={`${unitHref}/checklist/edit`} className={buttonClassName("outline", "sm")}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit
              </Link>
            }
          >
            <ol className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {checklist.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="mt-px w-5 shrink-0 text-right text-xs tabular-nums text-ink/40">{index + 1}.</span>
                  <span className="min-w-0 flex-1 text-pine">{item.label}</span>
                  {item.required ? null : <span className="shrink-0 text-xs text-ink/40">Optional</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Unit actions">
          <Panel title="Manage unit">
            <div className="space-y-2">
              {bookable ? (
                <SideAction href={newReservationHref} icon={CalendarPlus} tone="clay">
                  New reservation
                </SideAction>
              ) : null}
              <SideAction href={`${unitHref}/status`} icon={RefreshCw}>
                Change status
              </SideAction>
              <SideAction href={`${unitHref}/blocks/new`} icon={Construction}>
                Block dates
              </SideAction>
              <SideAction href={`${unitHref}/checklist/edit`} icon={ClipboardList}>
                Edit checklist
              </SideAction>
              <SideAction href={`${unitHref}/edit`} icon={Pencil}>
                Edit unit details
              </SideAction>
            </div>
          </Panel>

          <Panel title="Details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Check-in from" value={timeLabel(unit.checkInTime)} />
              <DetailRow label="Check-out by" value={`${timeLabel(unit.checkOutTime)}, next day`} />
              <DetailRow label="Stay length" value={stayLengthLabel(stayLengthHours(unit.checkInTime, unit.checkOutTime))} />
              <DetailRow
                label="Nightly rate"
                value={unit.defaultNightlyRateCents ? formatPHP(unit.defaultNightlyRateCents) : "Not set"}
              />
              {dayRates.map((line) => (
                <DetailRow key={line} label={line.slice(0, line.lastIndexOf(" "))} value={line.slice(line.lastIndexOf(" ") + 1)} />
              ))}
              {/* Optional charges only show when the unit has them. */}
              {unit.cleaningFeeCents ? <DetailRow label="Cleaning fee" value={formatPHP(unit.cleaningFeeCents)} /> : null}
              {unit.securityDepositCents ? (
                <DetailRow label="Refundable deposit" value={formatPHP(unit.securityDepositCents)} />
              ) : null}
            </dl>
            <AmenitySummary amenities={amenities} editHref={`${unitHref}/edit`} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-medium text-pine">{value}</dd>
    </div>
  );
}
