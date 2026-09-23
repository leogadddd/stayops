import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { ReservationActionPage, loadActionReservation } from "../action-page";
import { CheckOutForm } from "../check-out-form";

export const metadata: Metadata = { title: "Check out guest" };

export default async function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status === "checked_in";
  return (
    <ReservationActionPage title="Check out guest" description={`${guest.name} · ${unit.name}. Finish the stay and start the turnover checklist.`} reservationId={id}
      unavailable={available ? undefined : "Only a checked-in reservation can be checked out."}>
      {available ? <CheckOutForm reservationId={id} /> : null}
    </ReservationActionPage>
  );
}
