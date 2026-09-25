import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getPropertyOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { UnitCreateForm } from "../../../unit-create-form";
import { listAmenities } from "@/server/inventory/amenities";

export const metadata: Metadata = { title: "Add unit" };

export default async function NewUnitPage({ params }: { params: Promise<{ propertyId: string }> }) {
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Add unit" description={`Create an independently bookable space in ${property.name}.`} backHref={`/properties/${property.id}`} backLabel={property.name} />
      <UnitCreateForm propertyId={property.id} defaults={{ checkInTime: property.checkInTime, checkOutTime: property.checkOutTime }} amenityOptions={await listAmenities(membership.organizationId, "unit")} />
    </div>
  );
}
