import { requireOwner } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { statusPanel } from "../../unit-actions";

/** Opened from the unit: the same form, as a modal over it. */
export default async function UnitStatusModal({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return null;
  const { propertyId, unitId } = await params;
  const { form, title, description } = await statusPanel(membership.organizationId, propertyId, unitId);
  return <RouteModal title={title} description={description}>{form}</RouteModal>;
}
