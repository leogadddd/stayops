import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { ReservationActionPage } from "../action-page";
import { checkOutPanel } from "../stay-actions";

export const metadata: Metadata = { title: "Check out guest" };

export default async function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { form, ...panel } = await checkOutPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
