import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage } from "../action-page";
import { checkOutPanel } from "../stay-actions";

export const metadata: Metadata = { title: "Check out guest" };

export default async function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("stays.update");
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { form, ...panel } = await checkOutPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
