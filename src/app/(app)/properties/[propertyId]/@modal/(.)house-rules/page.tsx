import { requireOwner } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { houseRulesPanel } from "../../property-actions";

/** Opened from the property: the same form, as a modal over it. */
export default async function HouseRulesModal({ params }: { params: Promise<{ propertyId: string }> }) {
  const membership = await requireOwner();
  if (!membership) return null;
  const { propertyId } = await params;
  const { form, title, description } = await houseRulesPanel(membership.organizationId, propertyId);
  return <RouteModal title={title} description={description}>{form}</RouteModal>;
}
