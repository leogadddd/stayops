import { photoSrc } from "@/lib/photos";
import Link from "next/link";
import type { Metadata } from "next";
import { BedDouble, DoorOpen, MapPin, Plus, TrendingUp } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { addDaysLocal, todayInTimeZone } from "@/lib/dates";
import { summarizeUnitActivity } from "@/lib/unit-activity";
import { getOccupancySegments } from "@/server/inventory/availability";
import { listOrgUnits, listProperties } from "@/server/inventory/service";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TableActionsMenu } from "@/components/ui/table-actions-menu";
import { deletePropertyAction } from "./actions";
import { percent } from "./inventory-display";
import { UnitPhoto } from "../calendar/availability/stay-display";

export const metadata: Metadata = { title: "Properties" };

const OUTLOOK_DAYS = 30;

export default async function PropertiesPage() {
  const membership = await requirePermission("properties.view");
  if (!membership) return <PermissionDenied />;

  const [properties, units] = await Promise.all([
    listProperties(membership.organizationId),
    listOrgUnits(membership.organizationId),
  ]);
  // Each property counts from its own today; fetch from the earliest of them.
  const todayByProperty = new Map(properties.map((property) => [property.id, todayInTimeZone(property.timezone)]));
  const earliest = [...todayByProperty.values()].sort()[0];
  const segmentsByUnit = earliest
    ? await getOccupancySegments(
        membership.organizationId,
        units.map((unit) => unit.id),
        earliest,
        addDaysLocal(earliest, OUTLOOK_DAYS + 1),
      )
    : new Map();

  const summaries = properties.map((property) => {
    const today = todayByProperty.get(property.id)!;
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const active = propertyUnits.filter((unit) => unit.status === "active");
    const activities = propertyUnits.map((unit) => ({
      unit,
      activity: summarizeUnitActivity(segmentsByUnit.get(unit.id) ?? [], today, addDaysLocal(today, OUTLOOK_DAYS)),
    }));
    return {
      property,
      unitCount: propertyUnits.length,
      activeCount: active.length,
      staying: activities.filter(({ activity }) => activity.current).length,
      bookedNights: activities
        .filter(({ unit }) => unit.status === "active")
        .reduce((sum, { activity }) => sum + activity.bookedNights, 0),
    };
  });

  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading title="Properties" description="Where your stays happen, and the units guests book inside each one.">
        <Link href="/properties/new" className={buttonClassName("clay")}>
          <Plus className="h-4 w-4" aria-hidden />
          Add property
        </Link>
      </PageHeading>

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Add your first property, then the units guests can book."
          action={
            <Link href="/properties/new" className={buttonClassName("clay", "md")}>
              Add property
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map(({ property, unitCount, activeCount, staying, bookedNights }) => {
            const href = `/properties/${property.id}`;
            return (
              <li
                key={property.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)] transition hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-[0_10px_24px_rgba(32,58,53,0.08)]"
              >
                <UnitPhoto src={photoSrc("property", property)} className="aspect-[16/9]" />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={href} className="block truncate font-display text-xl text-pine after:absolute after:inset-0">
                        {property.name}
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink/55">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-pine/40" aria-hidden />
                        <span className="truncate">{property.address || "No address yet"}</span>
                      </p>
                    </div>
                    <div className="relative z-10">
                      <TableActionsMenu
                        label={property.name}
                        viewHref={href}
                        editHref={`${href}/edit`}
                        deleteLabel={`Delete ${property.name}?`}
                        deleteDescription="The property and its units will disappear from active inventory, but reservation, payment, expense, and audit history will be preserved. Properties with an active hold or stay cannot be deleted."
                        onDelete={deletePropertyAction.bind(null, property.id)}
                        links={[{ href: `${href}/units/new`, label: "Add unit", icon: <Plus className="h-4 w-4" aria-hidden /> }]}
                      />
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-pine/8 pt-4 text-center">
                    <Fact icon={DoorOpen} label="Units" value={String(unitCount)} detail={`${activeCount} active`} />
                    <Fact icon={BedDouble} label="Tonight" value={String(staying)} detail="staying" />
                    <Fact
                      icon={TrendingUp}
                      label={`${OUTLOOK_DAYS} days`}
                      value={percent(bookedNights, activeCount * OUTLOOK_DAYS)}
                      detail="booked"
                    />
                  </dl>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, value, detail }: { icon: typeof DoorOpen; label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl text-pine">{value}</dd>
      <dd className="text-[11px] text-ink/50">{detail}</dd>
    </div>
  );
}
