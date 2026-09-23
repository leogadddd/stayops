import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { PermissionDenied } from "@/components/app/permission-denied";
import { ReservationActionPage, loadActionReservation } from "../../action-page";
import { RecordPaymentForm } from "../../record-payment-form";

export const metadata: Metadata = { title: "Record payment" };

export default async function NewPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireOwner();
  if (!membership) return <PermissionDenied />;
  const { id } = await params;
  const { reservation, guest, unit } = await loadActionReservation(membership.organizationId, id);
  const available = reservation.status !== "cancelled" && reservation.status !== "expired";
  return (
    <ReservationActionPage title="Record payment" description={`${guest.name} · ${unit.name}. Verify receipt in your account before recording.`} reservationId={id}
      unavailable={available ? undefined : "Payments cannot be recorded from this reservation's current state."}>
      {available ? <RecordPaymentForm reservationId={id} /> : null}
    </ReservationActionPage>
  );
}
