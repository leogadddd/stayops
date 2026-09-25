import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { todayInTimeZone } from "@/lib/dates";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { formatPHP } from "@/lib/money";
import { normalizeChecklistTemplate } from "@/lib/turnover";
import { getPropertyOrThrow, getUnitOrThrow, listUnitBlocks } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RemoveBlockButton } from "../block-forms";
import { AmenityList } from "../../../amenity-icons";
import { listUnitAmenities } from "@/server/inventory/amenities";

export const metadata: Metadata = { title: "Unit" };

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

  const [blocks, amenities] = await Promise.all([
    listUnitBlocks(membership.organizationId, unit.id, todayInTimeZone(property.timezone)),
    listUnitAmenities(membership.organizationId, unit.id),
  ]);
  const checklist = normalizeChecklistTemplate(unit.checklistTemplate);
  const unitHref = `/properties/${property.id}/units/${unit.id}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeading title={unit.name} description={`${property.name} · ${formatPHP(unit.defaultNightlyRateCents)} per night`} backHref={`/properties/${property.id}`} backLabel={property.name}>
        <Link href={`${unitHref}/edit`} className={buttonClassName("outline")}>Edit unit</Link>
      </PageHeading>

      <Card className="overflow-hidden bg-[#FFFDFA]">
        {unit.imageUrl ? <img src={unit.imageUrl} alt={`${unit.name} cover`} className="h-64 w-full object-cover" /> : null}
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-pine">Unit details</h2>
          <Badge tone={unit.status === "active" ? "sage" : unit.status === "maintenance" ? "clay" : "neutral"}>{UNIT_STATUS_LABELS[unit.status]}</Badge>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-5 text-sm sm:grid-cols-3">
            <div><dt className="text-ink/55">Capacity</dt><dd className="mt-1 text-pine">{unit.capacity} guests</dd></div>
            <div><dt className="text-ink/55">Bedrooms</dt><dd className="mt-1 text-pine">{unit.bedrooms}</dd></div>
            <div><dt className="text-ink/55">Bathrooms</dt><dd className="mt-1 text-pine">{unit.bathrooms}</dd></div>
            <div><dt className="text-ink/55">Nightly rate</dt><dd className="mt-1 text-pine">{formatPHP(unit.defaultNightlyRateCents)}</dd></div>
            <div><dt className="text-ink/55">Cleaning fee</dt><dd className="mt-1 text-pine">{unit.cleaningFeeCents === null ? "Not set" : formatPHP(unit.cleaningFeeCents)}</dd></div>
            <div><dt className="text-ink/55">Refundable deposit</dt><dd className="mt-1 text-pine">{unit.securityDepositCents === null ? "Not set" : formatPHP(unit.securityDepositCents)}</dd></div>
            <div className="sm:col-span-3"><dt className="mb-2 text-ink/55">Amenities</dt><dd><AmenityList amenities={amenities} emptyLabel="No amenities selected." /></dd></div>
          </dl>
        </CardBody>
      </Card>

      <Card className="overflow-hidden bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-xl text-pine">Out-of-service blocks</h2><p className="mt-1 text-xs text-ink/55">Current and upcoming blocks. The end date is the first bookable night.</p></div>
          <Link href={`${unitHref}/blocks/new`} className={buttonClassName("clay", "sm")}><Plus className="h-4 w-4" aria-hidden />Add block</Link>
        </CardHeader>
        <Table aria-label="Out-of-service blocks">
          <TableHeader><TableRow><TableHead>Start date</TableHead><TableHead>End date · exclusive</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {blocks.length === 0 ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-ink/55">No current or upcoming blocks. Active units can accept bookings on available dates.</TableCell></TableRow> : blocks.map((block) => (
              <TableRow key={block.id}>
                <TableCell className="whitespace-nowrap">{block.startDate}</TableCell>
                <TableCell className="whitespace-nowrap">{block.endDate}</TableCell>
                <TableCell>{block.reason}</TableCell>
                <TableCell className="text-right"><RemoveBlockButton propertyId={property.id} unitId={unit.id} blockId={block.id} label={`${block.startDate} to ${block.endDate}`} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-xl text-pine">Turnover checklist</h2><p className="mt-1 text-xs text-ink/55">{checklist.length} items · {checklist.filter((item) => item.required).length} required</p></div>
          <Link href={`${unitHref}/checklist/edit`} className={buttonClassName("outline", "sm")}>Edit checklist</Link>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm text-ink/60">Every checkout opens a turnover task from this checklist. Changes apply to future turnovers only.</p>
          <ol className="divide-y divide-pine/10">
            {checklist.map((item, index) => <li key={index} className="flex items-start justify-between gap-4 py-3 text-sm"><span className="text-pine">{index + 1}. {item.label}</span><span className="shrink-0 text-xs text-ink/55">{item.required ? "Required" : "Optional"}</span></li>)}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
