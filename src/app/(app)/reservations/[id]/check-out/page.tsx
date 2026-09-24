import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { ReservationActionPage, loadActionReservation } from "../action-page";
import { CheckOutForm } from "../check-out-form";
import { utcToLocalDateTimeParts } from "@/lib/dates";

export const metadata: Metadata = { title: "Check out guest" };

export default async function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { reservation, guest, unit, property } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status === "checked_in";
  const now = utcToLocalDateTimeParts(new Date(), property?.timezone ?? "Asia/Manila");
  return (
    <ReservationActionPage title="Check out guest" description={`${guest.name} · ${unit.name}. Finish the stay and start the turnover checklist.`} reservationId={id}
      unavailable={available ? undefined : "Only a checked-in reservation can be checked out."}>
      {available ? <CheckOutForm reservationId={id} defaultActualCheckoutAt={`${now.date}T${now.time}`} /> : null}
    </ReservationActionPage>
  );
}
