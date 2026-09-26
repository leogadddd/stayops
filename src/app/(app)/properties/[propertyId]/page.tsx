import { photoSrc } from "@/lib/photos";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  CalendarDays,
  CalendarPlus,
  DoorOpen,
  LogIn,
  MapPin,
  Pencil,
  Plus,
  TrendingUp,
} from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { addDaysLocal, todayInTimeZone } from "@/lib/dates";
import { formatPHP } from "@/lib/money";
import { summarizeUnitActivity } from "@/lib/unit-activity";
import { cn } from "@/lib/utils";
import { getOccupancySegments } from "@/server/inventory/availability";
import { getPropertyOrThrow, listPropertyUnits } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { listPropertyAmenities } from "@/server/inventory/amenities";
import { buttonClassName } from "@/components/ui/button";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import { deleteUnitAction } from "../actions";
import { AmenityList } from "../amenity-icons";
import {
  activityLine,
  Panel,
  percent,
  SideAction,
  StatTile,
  StayRow,
  UnitStatusBadge,
} from "../inventory-display";
import { timeLabel, UnitPhoto } from "../../calendar/availability/stay-display";

export const metadata: Metadata = { title: "Property" };

const OUTLOOK_DAYS = 30;
const ARRIVAL_DAYS = 14;

export default async function PropertyDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const { propertyId } = await params;
  let property;
  try {
    property = await getPropertyOrThrow(membership.organizationId, propertyId);
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
  const today = todayInTimeZone(property.timezone);
  const outlookEnd = addDaysLocal(today, OUTLOOK_DAYS);
  const [units, amenities] = await Promise.all([
    listPropertyUnits(membership.organizationId, property.id),
    listPropertyAmenities(membership.organizationId, property.id),
  ]);
  const segmentsByUnit = await getOccupancySegments(
    membership.organizationId,
    units.map((unit) => unit.id),
    today,
    outlookEnd,
  );
  const activityByUnit = new Map(
    units.map((unit) => [unit.id, summarizeUnitActivity(segmentsByUnit.get(unit.id) ?? [], today, outlookEnd)]),
  );
  const activeUnits = units.filter((unit) => unit.status === "active");
  const staying = units.filter((unit) => activityByUnit.get(unit.id)?.current).length;
  const bookedNights = activeUnits.reduce((sum, unit) => sum + (activityByUnit.get(unit.id)?.bookedNights ?? 0), 0);
  const arrivalEnd = addDaysLocal(today, ARRIVAL_DAYS);
  const arrivals = units
    .flatMap((unit) =>
      (activityByUnit.get(unit.id)?.upcoming ?? [])
        .filter((stay) => stay.startDate >= today && stay.startDate < arrivalEnd)
        .map((stay) => ({ stay, unitName: unit.name })),
    )
    .sort((a, b) => a.stay.startDate.localeCompare(b.stay.startDate));

  const propertyHref = `/properties/${property.id}`;
  const calendarHref = "/calendar";

  return (
    <div className="min-w-0 overflow-hidden">
      <Link href="/properties" className="mb-4 inline-flex items-center gap-2 text-sm text-pine/70 hover:text-clay">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All properties
      </Link>

      <section className="overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
        <div className="grid md:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <UnitPhoto src={photoSrc("property", property)} className="aspect-[16/9] md:aspect-auto md:h-full md:min-h-56" />
          <div className="@container flex min-w-0 flex-col gap-5 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-mist px-2.5 py-0.5 text-xs font-medium text-pine">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  Property
                </span>
                <h1 className="mt-3 truncate font-display text-3xl tracking-tight text-pine sm:text-4xl">{property.name}</h1>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink/65">
                  <MapPin className="h-4 w-4 shrink-0 text-pine/45" aria-hidden />
                  <span className="truncate">{property.address || "No address yet"}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Link href={`${propertyHref}/units/new`} className={buttonClassName("clay", "md")}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add unit
                </Link>
                <Link href={`${propertyHref}/edit`} className={buttonClassName("outline", "md")}>
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
                icon={DoorOpen}
                label="Units"
                value={String(units.length)}
                detail={`${activeUnits.length} taking bookings`}
              />
              <StatTile
                icon={BedDouble}
                label="Tonight"
                value={`${staying} staying`}
                detail={`${units.length - staying} free`}
                tone={staying ? "sage" : undefined}
              />
              <StatTile
                icon={TrendingUp}
                label={`Next ${OUTLOOK_DAYS} days`}
                value={percent(bookedNights, activeUnits.length * OUTLOOK_DAYS)}
                detail={`${bookedNights} nights booked`}
              />
              <StatTile
                icon={LogIn}
                label="Arrivals"
                value={String(arrivals.length)}
                detail={`In the next ${ARRIVAL_DAYS} days`}
              />
            </dl>
          </div>
        </div>
      </section>

      <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={`Units (${units.length})`}
            description="Each unit is booked on its own."
            action={
              <Link href={`${propertyHref}/units/new`} className={buttonClassName("outline", "sm")}>
                <Plus className="h-4 w-4" aria-hidden />
                Add unit
              </Link>
            }
            flush
          >
            {units.length ? (
              <ul className="divide-y divide-pine/8 border-t border-pine/8">
                {units.map((unit) => {
                  const activity = activityByUnit.get(unit.id);
                  const line = activityLine(activity?.current ?? null, activity?.next ?? null);
                  const unitHref = `${propertyHref}/units/${unit.id}`;
                  return (
                    <li key={unit.id} className="relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-pine-mist/35 sm:px-6">
                      <UnitPhoto
                        src={photoSrc("unit", unit)}
                        className="h-14 w-20 shrink-0 rounded-lg [&_span]:hidden [&_svg]:h-5 [&_svg]:w-5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={unitHref} className="truncate font-medium text-pine after:absolute after:inset-0">
                            {unit.name}
                          </Link>
                          <UnitStatusBadge status={unit.status} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-ink/55">
                          Sleeps {unit.capacity} · {unit.bedrooms} bed · {unit.bathrooms} bath
                          {unit.defaultNightlyRateCents ? ` · ${formatPHP(unit.defaultNightlyRateCents)}/night` : ""}
                        </p>
                        <p className={cn("mt-0.5 truncate text-xs", line.tone === "pine" ? "font-medium text-pine" : "text-ink/45")}>
                          {line.label}
                        </p>
                      </div>
                      <div className="relative z-10">
                        <TableActionsMenu
                          label={unit.name}
                          viewHref={unitHref}
                          editHref={`${unitHref}/edit`}
                          deleteLabel={`Delete ${unit.name}?`}
                          deleteDescription="The unit will disappear from active inventory, but its reservation, payment, task, expense, and audit history will be preserved. Units with an active hold or stay cannot be deleted."
                          onDelete={deleteUnitAction.bind(null, property.id, unit.id)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="border-t border-pine/8 px-5 py-10 text-center sm:px-6">
                <p className="font-medium text-pine">No units yet</p>
                <p className="mt-1 text-sm text-ink/55">Add a room, studio or villa that guests can book.</p>
                <Link href={`${propertyHref}/units/new`} className={buttonClassName("clay", "sm", "mt-4")}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add unit
                </Link>
              </div>
            )}
          </Panel>

          <Panel title="Arriving soon" description={`Holds and bookings checking in over the next ${ARRIVAL_DAYS} days.`} flush>
            {arrivals.length ? (
              <ul className="divide-y divide-pine/8 border-t border-pine/8">
                {arrivals.map(({ stay, unitName }) => (
                  <li key={stay.id}>
                    <StayRow stay={stay} today={today} suffix={unitName} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-pine/8 px-5 py-6 text-center text-sm text-ink/55 sm:px-6">
                No arrivals in the next {ARRIVAL_DAYS} days.
              </p>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Property actions">
          <Panel title="Manage property">
            <div className="space-y-2">
              {activeUnits.length ? (
                <SideAction href="/reservations/new" icon={CalendarPlus} tone="clay">
                  New reservation
                </SideAction>
              ) : null}
              <SideAction href={`${propertyHref}/units/new`} icon={Plus}>
                Add unit
              </SideAction>
              <SideAction href={`${propertyHref}/edit`} icon={Pencil}>
                Edit property details
              </SideAction>
              <SideAction href={calendarHref} icon={CalendarDays}>
                View calendar
              </SideAction>
            </div>
          </Panel>

          <Panel title="Details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Check-in from" value={timeLabel(property.checkInTime)} />
              <DetailRow label="Check-out by" value={timeLabel(property.checkOutTime)} />
              <DetailRow
                label="Turnover time"
                value={durationLabel(property.turnoverDurationMinutes)}
              />
              <DetailRow label="Timezone" value={property.timezone.replace(/_/g, " ")} />
            </dl>
            <div className="mt-4 border-t border-pine/10 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">Amenities</p>
              <AmenityList amenities={amenities} emptyLabel="No amenities selected." />
            </div>
            <div className="mt-4 border-t border-pine/10 pt-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink/45">House rules</p>
                <Link href={`${propertyHref}/house-rules`} className="text-xs font-medium text-clay-deep hover:underline">
                  {property.houseRules ? "View & edit" : "Add"}
                </Link>
              </div>
              {property.houseRules ? (
                // A short preview; the full rules open in a modal where they can be edited.
                <Link
                  href={`${propertyHref}/house-rules`}
                  className="group block rounded-lg transition-colors hover:bg-pine-mist/40"
                  aria-label="View and edit house rules"
                >
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-pine">
                    {property.houseRules}
                  </p>
                  <span className="mt-1 inline-block text-xs text-ink/45 group-hover:text-clay-deep">Read all</span>
                </Link>
              ) : (
                <p className="text-sm text-ink/55">None yet.</p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-medium text-pine">{value}</dd>
    </div>
  );
}
