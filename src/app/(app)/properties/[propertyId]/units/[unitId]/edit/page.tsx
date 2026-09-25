import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { centavosToPesosInput } from "@/lib/money";
import { getPropertyOrThrow, getUnitOrThrow } from "@/server/inventory/service";
import { InventoryError } from "@/server/inventory/validation";
import { PageHeading } from "@/components/app/page-heading";
import { PermissionDenied } from "@/components/app/permission-denied";
import { UnitEditForm } from "../../unit-edit-form";
import { listAmenities, listUnitAmenities } from "@/server/inventory/amenities";

export const metadata: Metadata = { title: "Edit unit" };

export default async function EditUnitPage({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
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
  const [amenityOptions, selected] = await Promise.all([
    listAmenities(membership.organizationId, "unit"),
    listUnitAmenities(membership.organizationId, unit.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title="Edit unit" description={`${property.name} · ${unit.name}`} backHref={`/properties/${property.id}/units/${unit.id}`} backLabel={unit.name} />
      <UnitEditForm propertyId={property.id} unitId={unit.id} amenityOptions={amenityOptions} selectedAmenityIds={selected.map((amenity) => amenity.id)} values={{ name: unit.name, capacity: unit.capacity, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, nightlyRate: centavosToPesosInput(unit.defaultNightlyRateCents), cleaningFee: centavosToPesosInput(unit.cleaningFeeCents), securityDeposit: centavosToPesosInput(unit.securityDepositCents), checkInTime: unit.checkInTime, checkOutTime: unit.checkOutTime, status: unit.status, imageUrl: unit.imageUrl }} />
    </div>
  );
}
