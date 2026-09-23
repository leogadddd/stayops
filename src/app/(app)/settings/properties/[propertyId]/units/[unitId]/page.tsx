import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { todayInTimeZone } from "@/lib/dates";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { centavosToPesosInput, formatPHP } from "@/lib/money";
import {
  getPropertyOrThrow,
  getUnitOrThrow,
  listUnitBlocks,
} from "@/server/inventory/service";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BlockForms } from "../block-forms";
import { UnitEditForm } from "../unit-edit-form";

export const metadata: Metadata = { title: "Unit" };

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ propertyId: string; unitId: string }>;
}) {
  const { propertyId, unitId } = await params;
  const membership = await requireMembership();

  let property;
  let unit;
  try {
    property = await getPropertyOrThrow(membership.organizationId, propertyId);
    unit = await getUnitOrThrow(membership.organizationId, unitId);
  } catch {
    notFound();
  }
  if (unit.propertyId !== property.id) {
    notFound();
  }

  const today = todayInTimeZone(property.timezone);
  const blocks = await listUnitBlocks(membership.organizationId, unit.id, today);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/settings/properties/${property.id}`}
        className="text-sm text-pine/70 underline-offset-4 hover:text-pine hover:underline"
      >
        ← {property.name}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl text-pine">{unit.name}</h1>
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
      </div>
      <p className="mt-1 text-sm text-ink/60">
        {formatPHP(unit.defaultNightlyRateCents)}/night
        {unit.cleaningFeeCents !== null &&
          ` · ${formatPHP(unit.cleaningFeeCents)} cleaning fee`}
        {unit.securityDepositCents !== null &&
          ` · ${formatPHP(unit.securityDepositCents)} refundable deposit`}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <h2 className="font-display text-xl text-pine">Unit details</h2>
        </CardHeader>
        <CardBody>
          <UnitEditForm
            propertyId={property.id}
            unitId={unit.id}
            values={{
              name: unit.name,
              capacity: unit.capacity,
              bedrooms: unit.bedrooms,
              bathrooms: unit.bathrooms,
              nightlyRate: centavosToPesosInput(unit.defaultNightlyRateCents),
              cleaningFee: centavosToPesosInput(unit.cleaningFeeCents),
              securityDeposit: centavosToPesosInput(unit.securityDepositCents),
              status: unit.status,
            }}
          />
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <h2 className="font-display text-xl text-pine">Availability</h2>
        </CardHeader>
        <CardBody>
          <BlockForms
            propertyId={property.id}
            unitId={unit.id}
            blocks={blocks.map((block) => ({
              id: block.id,
              startDate: block.startDate,
              endDate: block.endDate,
              reason: block.reason,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
