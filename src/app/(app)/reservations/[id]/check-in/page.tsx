import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { ReservationActionPage } from "../action-page";
import { checkInPanel } from "../stay-actions";

export const metadata: Metadata = { title: "Check in guest" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { form, ...panel } = await checkInPanel(membership.organizationId, id);
  return <ReservationActionPage {...panel} reservationId={id}>{form}</ReservationActionPage>;
}
