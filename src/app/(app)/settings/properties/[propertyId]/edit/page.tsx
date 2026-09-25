import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getPropertyOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { PropertyForm } from "../../property-form";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
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
      <PageHeading title="Edit property" description={property.name} backHref={`/settings/properties/${property.id}`} backLabel={property.name} />
      <PropertyForm propertyId={property.id} initialValues={{ name: property.name, address: property.address ?? "", timezone: property.timezone, checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, turnoverDurationMinutes: property.turnoverDurationMinutes, houseRules: property.houseRules ?? "", imageUrl: property.imageUrl }} />
    </div>
  );
}
