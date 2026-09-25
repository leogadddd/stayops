import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage } from "../../action-page";
import { refundPanel } from "../../money-actions";

export const metadata: Metadata = { title: "Record refund" };

export default async function NewRefundPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { form, ...panel } = await refundPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
