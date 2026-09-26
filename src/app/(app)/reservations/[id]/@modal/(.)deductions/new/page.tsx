import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { RouteModal } from "@/components/app/route-modal";
import { deductionPanel } from "../../../money-actions";

/** Opened from the reservation: the same form, as a modal over it. */
export default async function NewDeductionPageModal({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("payments.create");
  if (!membership) return <RouteModal title="Record deposit deduction" description="Your role doesn’t include recording money for a reservation."><PermissionDenied /></RouteModal>;
  const { id } = await params;
  const { form, ...panel } = await deductionPanel(membership.organizationId, id);
  return <RouteModal {...panel}>{form}</RouteModal>;
}
