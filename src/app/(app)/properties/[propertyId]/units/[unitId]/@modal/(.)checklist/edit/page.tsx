import { requirePermission } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { checklistPanel } from "../../../unit-actions";

/** Opened from the unit: the same form, as a modal over it. */
export default async function EditChecklistModal({ params }: { params: Promise<{ propertyId: string; unitId: string }> }) {
  const membership = await requirePermission("properties.update");
  if (!membership) return null;
  const { propertyId, unitId } = await params;
  const { form, title, description } = await checklistPanel(membership.organizationId, propertyId, unitId);
  return <RouteModal title={title} description={description}>{form}</RouteModal>;
}
