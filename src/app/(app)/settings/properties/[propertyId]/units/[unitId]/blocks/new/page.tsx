import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { BlockForms } from "../../../block-forms";

export const metadata: Metadata = { title: "Add unit block" };

export default async function NewUnitBlockPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Add out-of-service block" description={`${property.name} · ${unit.name}. Block nights for repairs or preparation.`} backHref={`/settings/properties/${property.id}/units/${unit.id}`} backLabel={unit.name} />
      <Card className="bg-[#FFFDFA]"><CardBody><BlockForms propertyId={property.id} unitId={unit.id} /></CardBody></Card>
    </div>
  );
}
