import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage } from "../../action-page";
import { deductionPanel } from "../../money-actions";

export const metadata: Metadata = { title: "Record deposit deduction" };

export default async function NewDeductionPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requirePermission("payments.create");
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { form, ...panel } = await deductionPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
