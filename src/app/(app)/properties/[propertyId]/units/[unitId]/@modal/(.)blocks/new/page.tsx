import { requireOwner } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { blockPanel } from "../../../unit-actions";

/** Opened from the unit: the same form, as a modal over it. */
export default async function NewUnitBlockModal({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return null;
  const { propertyId, unitId } = await params;
  const { form, title, description } = await blockPanel(membership.organizationId, propertyId, unitId);
  return <RouteModal title={title} description={description}>{form}</RouteModal>;
}
