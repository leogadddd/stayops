import { requireOwner } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { editBlockPanel } from "../../../../unit-actions";

/** Opened from the unit: the same form, as a modal over it. */
export default async function EditUnitBlockModal({ params }: { params: Promise<{ propertyId: string; unitId: string; blockId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return null;
  const { propertyId, unitId, blockId } = await params;
  const { form, title, description } = await editBlockPanel(membership.organizationId, propertyId, unitId, blockId);
  return <RouteModal title={title} description={description}>{form}</RouteModal>;
}
