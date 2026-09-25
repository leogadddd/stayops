import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionModal } from "../../../action-modal";
import { deductionPanel } from "../../../money-actions";

/** Opened from the reservation: the same form, as a modal over it. */
export default async function NewDeductionPageModal({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <ReservationActionModal title="Record deposit deduction" description="Only the owner can record money for a reservation."><PermissionDenied /></ReservationActionModal>;
  const { id } = await params;
  const { form, ...panel } = await deductionPanel(membership.organizationId, id);
  return <ReservationActionModal {...panel}>{form}</ReservationActionModal>;
}
