import type { Metadata } from "next";
import { requireMembership } from "@/lib/auth/session";
import { ReservationActionPage, loadActionReservation } from "../action-page";
import { CheckInForm } from "../check-in-form";

export const metadata: Metadata = { title: "Check in guest" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status === "confirmed";
  return (
    <ReservationActionPage title="Check in guest" description={`${guest.name} · ${unit.name}. Record the arrival and any handover notes.`} reservationId={id}
      unavailable={available ? undefined : "Only a confirmed reservation can be checked in."}>
      {available ? <CheckInForm reservationId={id} /> : null}
    </ReservationActionPage>
  );
}
