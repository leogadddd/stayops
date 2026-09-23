import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PageHeading } from "@/components/app/page-heading";
import { formatPHP } from "@/lib/money";
import { UNIT_STATUS_LABELS } from "@/lib/labels";
import { getPropertyOrThrow, listPropertyUnits } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const metadata: Metadata = { title: "Property" };

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
  const propertyUnits = await listPropertyUnits(membership.organizationId, property.id);
  const propertyHref = `/settings/properties/${property.id}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeading title={property.name} description="Property details and bookable units." backHref="/settings/properties" backLabel="All properties">
        <Link href={`${propertyHref}/edit`} className={buttonClassName("outline")}>Edit property</Link>
      </PageHeading>

      <Card className="bg-[#FFFDFA]">
        <CardHeader><h2 className="font-display text-xl text-pine">Property details</h2></CardHeader>
        <CardBody>
          <dl className="grid gap-5 text-sm sm:grid-cols-3">
            <div className="sm:col-span-3"><dt className="text-ink/55">Address · private</dt><dd className="mt-1 whitespace-pre-wrap text-pine">{property.address || "No address provided."}</dd></div>
            <div><dt className="text-ink/55">Timezone</dt><dd className="mt-1 text-pine">{property.timezone}</dd></div>
            <div><dt className="text-ink/55">Check-in</dt><dd className="mt-1 text-pine">{property.checkInTime}</dd></div>
            <div><dt className="text-ink/55">Check-out</dt><dd className="mt-1 text-pine">{property.checkOutTime}</dd></div>
            <div className="sm:col-span-3"><dt className="text-ink/55">House rules · shown to guests</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-pine">{property.houseRules || "No house rules provided."}</dd></div>
          </dl>
        </CardBody>
      </Card>

      <Card className="overflow-hidden bg-[#FFFDFA]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-pine">Units <span className="text-ink/45">({propertyUnits.length})</span></h2>
          <Link href={`${propertyHref}/units/new`} className={buttonClassName("clay", "sm")}><Plus className="h-4 w-4" aria-hidden />Add unit</Link>
        </CardHeader>
        <Table aria-label="Property units">
          <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead>Capacity</TableHead><TableHead>Rooms</TableHead><TableHead>Nightly rate</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {propertyUnits.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center"><p className="font-medium text-pine">No units yet</p><p className="mt-1 text-ink/55">Add an independently bookable space — a studio, room or whole floor.</p></TableCell></TableRow>
            ) : propertyUnits.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell><Link href={`${propertyHref}/units/${unit.id}`} className="font-medium text-pine underline-offset-4 hover:underline">{unit.name}</Link></TableCell>
                <TableCell className="whitespace-nowrap">{unit.capacity} guests</TableCell>
                <TableCell className="whitespace-nowrap">{unit.bedrooms} bed · {unit.bathrooms} bath</TableCell>
                <TableCell className="whitespace-nowrap">{formatPHP(unit.defaultNightlyRateCents)}</TableCell>
                <TableCell><Badge tone={unit.status === "active" ? "sage" : unit.status === "maintenance" ? "clay" : "neutral"}>{UNIT_STATUS_LABELS[unit.status]}</Badge></TableCell>
                <TableCell className="text-right"><Link href={`${propertyHref}/units/${unit.id}`} className={buttonClassName("ghost", "sm")} aria-label={`View ${unit.name}`}>View unit</Link></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
