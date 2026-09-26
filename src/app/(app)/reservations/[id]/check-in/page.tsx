import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage } from "../action-page";
import { checkInPanel } from "../stay-actions";

export const metadata: Metadata = { title: "Check in guest" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("stays.update");
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { form, ...panel } = await checkInPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
