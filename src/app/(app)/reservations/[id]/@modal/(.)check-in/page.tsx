import { requireMembership } from "@/lib/auth/session";
import { ReservationActionModal } from "../../action-modal";
import { checkInPanel } from "../../stay-actions";

/** Opened from the reservation: the same form, as a modal over it. */
export default async function CheckInPageModal({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { form, ...panel } = await checkInPanel(membership.organizationId, id);
  return <ReservationActionModal {...panel}>{form}</ReservationActionModal>;
}
