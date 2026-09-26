import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RouteModal } from "@/components/app/route-modal";
import { checkOutPanel } from "../../stay-actions";

/** Opened from the reservation: the same form, as a modal over it. */
export default async function CheckOutPageModal({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("stays.update");
  if (!membership) return <RouteModal title="Not available" description="Your role doesn’t include checking guests in or out."><PermissionDenied /></RouteModal>;
  const { id } = await params;
  const { form, ...panel } = await checkOutPanel(membership.organizationId, id);
  return <RouteModal {...panel}>{form}</RouteModal>;
}
