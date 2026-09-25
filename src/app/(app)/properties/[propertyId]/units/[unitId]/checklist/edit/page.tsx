import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { normalizeChecklistTemplate } from "@/lib/turnover";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { Card, CardBody } from "@/components/ui/card";
import { ChecklistTemplateEditor } from "../../../checklist-template-editor";

export const metadata: Metadata = { title: "Edit turnover checklist" };

export default async function EditChecklistPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
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
      <PageHeading title="Edit turnover checklist" description={`${unit.name} · Changes apply to future turnovers. Tasks already in progress keep their existing checklist.`} backHref={`/properties/${property.id}/units/${unit.id}`} backLabel={unit.name} />
      <Card className="bg-[#FFFDFA]"><CardBody><ChecklistTemplateEditor propertyId={property.id} unitId={unit.id} items={normalizeChecklistTemplate(unit.checklistTemplate)} /></CardBody></Card>
    </div>
  );
}
