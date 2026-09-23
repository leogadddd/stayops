import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { formatPHP } from "@/lib/money";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import {
  getPropertyOrThrow,
  listPropertyUnits,
} from "@/server/inventory/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PropertyForm } from "../property-form";
import { UnitCreateForm } from "../unit-create-form";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;

  const { propertyId } = await params;
  let property;
  try {
    property = await getPropertyOrThrow(membership.organizationId, propertyId);
  } catch {
    notFound();
  }
  const propertyUnits = await listPropertyUnits(
    membership.organizationId,
    property.id,
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/settings/properties"
        className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
      >
        ← All properties
      </Link>
      <h1 className="mt-2 font-display text-3xl text-pine">{property.name}</h1>
      <p className="mt-1 text-sm text-ink/60">
        {property.timezone} · check-in {property.checkInTime} · check-out{" "}
        {property.checkOutTime}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <h2 className="font-display text-xl text-pine">Property details</h2>
        </CardHeader>
        <CardBody>
          <PropertyForm
            propertyId={property.id}
            initialValues={{
              name: property.name,
              address: property.address ?? "",
              timezone: property.timezone,
              checkInTime: property.checkInTime,
              checkOutTime: property.checkOutTime,
              houseRules: property.houseRules ?? "",
            }}
          />
        </CardBody>
      </Card>

      <h2 className="mt-10 font-display text-2xl text-pine">Units</h2>
      {propertyUnits.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No units yet"
          description="A unit is one independently bookable space — a studio, a room, a whole floor."
        />
      ) : (
        <ul className="mt-4 divide-y divide-pine/10 rounded-2xl border border-pine/10 bg-white shadow-[0_1px_2px_rgba(32,58,53,0.06)]">
          {propertyUnits.map((unit) => (
            <li key={unit.id}>
              <Link
                href={`/settings/properties/${property.id}/units/${unit.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-pine-mist/40"
              >
                <div>
                  <p className="font-medium text-pine">{unit.name}</p>
                  <p className="mt-0.5 text-sm text-ink/55">
                    {unit.capacity} guests · {unit.bedrooms} bd ·{" "}
                    {unit.bathrooms} ba · {formatPHP(unit.defaultNightlyRateCents)}
                    /night
                    {unit.cleaningFeeCents !== null &&
                      ` · ${formatPHP(unit.cleaningFeeCents)} cleaning`}
                  </p>
                </div>
                <Badge
                  tone={
                    unit.status === "active"
                      ? "sage"
                      : unit.status === "maintenance"
                        ? "clay"
                        : "neutral"
                  }
                >
                  {UNIT_STATUS_LABELS[unit.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-8">
        <CardHeader>
          <h2 className="font-display text-xl text-pine">Add a unit</h2>
        </CardHeader>
        <CardBody>
          <UnitCreateForm propertyId={property.id} />
        </CardBody>
      </Card>
    </div>
  );
}
