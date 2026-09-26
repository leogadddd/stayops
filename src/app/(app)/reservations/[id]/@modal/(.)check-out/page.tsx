import { requireMembership } from "@/lib/auth/session";
import { RouteModal } from "@/components/app/route-modal";
import { checkOutPanel } from "../../stay-actions";

/** Opened from the reservation: the same form, as a modal over it. */
export default async function CheckOutPageModal({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { form, ...panel } = await checkOutPanel(membership.organizationId, id);
  return <RouteModal {...panel}>{form}</RouteModal>;
}
