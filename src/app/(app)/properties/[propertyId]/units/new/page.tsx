import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getPropertyOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { listAmenities } from "@/server/inventory/amenities";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { UnitCreateForm } from "../../../unit-create-form";

export const metadata: Metadata = { title: "Add unit" };

export default async function NewUnitPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const membership = await requirePermission("properties.create");
  if (!membership) return <PermissionDenied />;
  const { propertyId } = await params;
  let property;
  try {
    property = await getPropertyOrThrow(membership.organizationId, propertyId);
  } catch (error) {
    if (error instanceof InventoryError) notFound();
    throw error;
  }
  return (
    <div className="min-w-0 overflow-hidden">
      <PageHeading
        title="Add unit"
        description={`A room, studio or villa in ${property.name} that guests book on its own.`}
        backHref={`/properties/${property.id}`}
        backLabel={property.name}
      />
      <UnitCreateForm
        propertyId={property.id}
        propertyName={property.name}
        defaults={{ checkInTime: property.checkInTime, checkOutTime: property.checkOutTime }}
        amenityOptions={await listAmenities(membership.organizationId, "unit")}
      />
    </div>
  );
}
