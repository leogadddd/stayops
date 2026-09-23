import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage, loadActionReservation } from "../action-page";
import { CancelReservationForm } from "../cancel-reservation-form";

export const metadata: Metadata = { title: "Cancel reservation" };

export default async function CancelReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status === "hold" || reservation.status === "confirmed";
  return (
    <ReservationActionPage title={reservation.status === "hold" ? "Cancel hold" : "Cancel reservation"} description={`${guest.name} · ${unit.name}. Cancelling releases the dates for another guest.`} reservationId={id}
      unavailable={available ? undefined : "Only a hold or confirmed booking can be cancelled."}>
      {available ? <CancelReservationForm reservationId={id} label={reservation.status === "hold" ? "Cancel hold" : "Cancel reservation"} /> : null}
    </ReservationActionPage>
  );
}
